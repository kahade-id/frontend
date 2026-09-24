/**
 * Kahade — aksi uang menggantung yang bisa dipulihkan (J-02/J-04, A-06).
 *
 * Tiga alur meninggalkan state menggantung di SERVER tanpa jalur kembali di
 * klien: withdraw PENDING_OTP (sheet ditutup), QRIS yang belum dibayar, dan
 * top-up dengan instruksi pembayaran yang ditinggal. Setelah app ditutup,
 * tidak ada satu pun penanda "Anda punya aksi menunggu".
 *
 * Modul ini menyimpan catatan kecil (bukan sumber kebenaran — status akhir
 * tetap milik server) di SecureStore:
 *   - withdraw-otp : { txId, amount, expiresAt } → layar Tarik Dana bisa
 *     RESUME ke langkah OTP (confirm-otp hanya butuh txId+otp).
 *   - qris-payment : { orderId } → kembali ke detail order, sheet bayar.
 *   - topup-unpaid : { paymentTxId, amount } → riwayat top-up (instruksi
 *     pembayaran tidak bisa dipulihkan penuh tanpa paymentCode dari server).
 *
 * Keputusan non-obvious:
 *   - TTL klien 24 jam: catatan lebih tua dibuang saat baca. Server punya TTL
 *     sendiri; catatan lokal yang basi hanya menghasilkan banner menyesatkan.
 *   - `resolvePendingAction` dipanggil setelah aksi selesai/dibatalkan ATAU
 *     setelah server menyatakan status final — klien tidak pernah menebak.
 *   - Web: memory-only (lihat WEB_PERSISTENT_KEYS) — txId/nominal tidak boleh
 *     menetap di localStorage bersama.
 */
import { useEffect, useSyncExternalStore } from "react"
import { AppState } from "react-native"

import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { serverNow } from "@/lib/server-time"
import { logWarn } from "@/lib/telemetry"

/**
 * I-04 (audit 2026-09-22): `prunePendingActions` dulu tidak pernah dipanggil —
 * penyaringan hanya terjadi saat catatan DIBACA (boot), sehingga aksi yang
 * kedaluwarsa selama sesi berjalan tetap hidup di memori dan banner pemulihan
 * menawarkan aksi yang sudah mati di server.
 */
const PRUNE_INTERVAL_MS = 60_000

export type PendingAction =
  | {
      kind: "withdraw-otp"
      txId: string
      amount: number
      createdAt: number
      /** Bila server mengirim expiresAt (WithdrawResult) — dipakai menyaring catatan basi. */
      expiresAt?: number
    }
  | {
      kind: "qris-payment"
      orderId: string
      amount: number
      createdAt: number
      expiresAt?: number
    }
  | {
      kind: "topup-unpaid"
      paymentTxId: string
      amount: number
      createdAt: number
      expiresAt?: number
    }

/**
 * Normalisasi expiresAt server (epoch number ATAU ISO string) → epoch ms.
 *
 * C-04 + I-01 (audit escrow 2026-09-24): domain jam pernah dicampur —
 * epoch DETIK (1700000000) dianggap milidetik sehingga dihitung tahun 1970
 * (catatan hidup langsung "kedaluwarsa"), sementara string numerik
 * `"1700000000000"` dibuang ke `undefined`. Sekarang:
 *   - angka > 1e12  → sudah ms;
 *   - angka 1e9..1e12 → epoch detik → ×1000;
 *   - string numerik → proses sebagai angka (aturan sama);
 *   - string lain → Date.parse (ISO-8601 dst.).
 */
export function toEpochMs(value: unknown): number | undefined {
  const normalizeNumber = (n: number): number | undefined => {
    if (!Number.isFinite(n) || n <= 0) return undefined
    if (n > 1e12) return n
    if (n >= 1e9) return n * 1000
    return undefined
  }
  if (typeof value === "number") return normalizeNumber(value)
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (/^\d+$/.test(trimmed)) return normalizeNumber(Number(trimmed))
    const parsed = Date.parse(trimmed)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

/** Catatan lebih tua dari ini dibuang saat baca (server TTL biasanya ≤ 24 jam). */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000
const PENDING_MAX = 10

let actions: PendingAction[] = []
const listeners = new Set<() => void>()
let loadPromise: Promise<void> | null = null

function actionKey(action: PendingAction): string {
  return action.kind === "withdraw-otp"
    ? `${action.kind}:${action.txId}`
    : action.kind === "qris-payment"
      ? `${action.kind}:${action.orderId}`
      : `${action.kind}:${action.paymentTxId}`
}

/**
 * A-02 (audit 2026-09-22): `expiresAt` diisi dari respons server
 * (`toEpochMs`) sedangkan `createdAt` dulu memakai `Date.now()` perangkat —
 * dua domain jam yang berbeda dalam satu perbandingan. Perangkat dengan jam
 * maju membuang catatan penarikan PENDING_OTP yang masih hidup (banner
 * pemulihan hilang padahal dana masih tertahan di server); jam mundur
 * menawarkan pemulihan untuk aksi yang sudah mati. Sekarang keduanya memakai
 * `serverNow()`.
 */
function isStale(action: PendingAction, now = serverNow()): boolean {
  if (action.expiresAt && Number.isFinite(action.expiresAt) && action.expiresAt <= now) return true
  return now - action.createdAt > PENDING_TTL_MS
}

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function sanitize(raw: unknown): PendingAction[] {
  if (!Array.isArray(raw)) return []
  const result: PendingAction[] = []
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue
    const rec = item as Record<string, unknown>
    const amount = typeof rec.amount === "number" && Number.isFinite(rec.amount) ? rec.amount : 0
    const createdAt =
      typeof rec.createdAt === "number" && Number.isFinite(rec.createdAt) ? rec.createdAt : 0
    const expiresAt =
      typeof rec.expiresAt === "number" && Number.isFinite(rec.expiresAt)
        ? rec.expiresAt
        : undefined
    if (rec.kind === "withdraw-otp" && typeof rec.txId === "string" && rec.txId) {
      result.push({ kind: "withdraw-otp", txId: rec.txId, amount, createdAt, expiresAt })
    } else if (rec.kind === "qris-payment" && typeof rec.orderId === "string" && rec.orderId) {
      result.push({ kind: "qris-payment", orderId: rec.orderId, amount, createdAt, expiresAt })
    } else if (
      rec.kind === "topup-unpaid" &&
      typeof rec.paymentTxId === "string" &&
      rec.paymentTxId
    ) {
      result.push({ kind: "topup-unpaid", paymentTxId: rec.paymentTxId, amount, createdAt, expiresAt })
    }
  }
  return result.filter((action) => !isStale(action)).slice(0, PENDING_MAX)
}

export function loadPendingActions(): Promise<void> {
  if (!loadPromise) {
    loadPromise = getSecureItem(SecureKeys.pendingActions)
      .then((rawValue) => {
        if (!rawValue) return
        try {
          actions = sanitize(JSON.parse(rawValue))
        } catch (err) {
          // JSON rusak = catatan tidak bisa dipercaya; buang dan laporkan
          // (dulu `catch {}` tanpa jejak — kegagalan persistensi tak terlihat).
          logWarn("pending-actions:parse", err)
          actions = []
        }
        emit()
      })
      .catch((err) => {
        logWarn("pending-actions:load", err)
        loadPromise = null
      })
  }
  return loadPromise
}

function persist() {
  void setSecureItem(SecureKeys.pendingActions, JSON.stringify(actions)).catch((err) =>
    logWarn("pending-actions:save", err),
  )
}

/**
 * Catat aksi menggantung (dedupe by kind+id; yang terbaru menang).
 *
 * C-04 (audit escrow 2026-09-24): aksi yang datang sudah kedaluwarsa/TTL
 * (mis. membuat QRIS dari respons basi setelah app lama di background) tidak
 * dicatat — banner tidak boleh menawarkan langkah yang sudah lewat. Guard
 * "langkah selesai" lain ada di konsumen: `use-qris-payment` menghapus
 * catatan begitu order settled/completed, dan tiap layar sinkron dengan
 * status server sebelum mengeksekusi (pending-actions kini tanpa step
 * machine — layar adalah sumber kebenaran langkah).
 */
export function recordPendingAction(action: PendingAction): void {
  if (isStale(action)) return
  const key = actionKey(action)
  actions = [action, ...actions.filter((existing) => actionKey(existing) !== key)].slice(
    0,
    PENDING_MAX,
  )
  emit()
  persist()
}

/** Hapus catatan setelah aksi selesai/dibatalkan/status final diketahui. */
export function resolvePendingAction(kind: PendingAction["kind"], id: string): void {
  const key = `${kind}:${id}`
  const next = actions.filter((action) => actionKey(action) !== key)
  if (next.length === actions.length) return
  actions = next
  emit()
  persist()
}

/** Buang catatan basi (dipanggil saat baca/boot). */
export function prunePendingActions(): void {
  const next = actions.filter((action) => !isStale(action))
  if (next.length === actions.length) return
  actions = next
  emit()
  persist()
}

export function clearPendingActions(): void {
  if (actions.length === 0) return
  actions = []
  emit()
  persist()
}

export function getPendingActionsSnapshot(): readonly PendingAction[] {
  return actions
}

const EMPTY: readonly PendingAction[] = []

/** Hook daftar aksi menggantung (sudah disaring basi saat load). */
export function usePendingActions(): readonly PendingAction[] {
  const snapshot = useSyncExternalStore(subscribe, getPendingActionsSnapshot, () => EMPTY)
  useEffect(() => {
    void loadPendingActions()
    // I-04: buang catatan yang kedaluwarsa SELAMA sesi berjalan, bukan hanya
    // saat boot — dan periksa lagi begitu app kembali ke depan (pengguna
    // menutup app lebih lama dari TTL).
    const timer = setInterval(() => prunePendingActions(), PRUNE_INTERVAL_MS)
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") prunePendingActions()
    })
    return () => {
      clearInterval(timer)
      subscription.remove()
    }
  }, [])
  return snapshot
}

/** Reset memori (dipakai test). */
export function resetPendingActionsForTest(): void {
  actions = []
  loadPromise = null
  emit()
}
