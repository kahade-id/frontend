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
import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"

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

/** Normalisasi expiresAt server (epoch number ATAU ISO string) → epoch ms. */
export function toEpochMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Date.parse(value)
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

function isStale(action: PendingAction, now = Date.now()): boolean {
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
        } catch {
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

/** Catat aksi menggantung (dedupe by kind+id; yang terbaru menang). */
export function recordPendingAction(action: PendingAction): void {
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
  }, [])
  return snapshot
}

/** Reset memori (dipakai test). */
export function resetPendingActionsForTest(): void {
  actions = []
  loadPromise = null
  emit()
}
