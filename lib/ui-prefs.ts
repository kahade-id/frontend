/**
 * Kahade — preferensi UI persisten lintas layar (J-05/J-06/J-08/J-14).
 *
 * Sebelumnya "sembunyikan saldo" adalah `useState` di Beranda (reset tiap
 * sesi), tab Transaksi selalu mulai di "Penjual", dan penerima transfer
 * terakhir hilang tiap masuk layar. Semuanya preferensi kecil yang layak
 * diingat perangkat.
 *
 * Keputusan non-obvious:
 *   - SATU blob JSON di `SecureKeys.uiPrefs` (bukan satu key per preferensi):
 *     SecureStore web/localStorage punya kuota per-key dan pembacaan async —
 *     satu blob = satu baca saat boot. Ukuran dijaga kecil (< 2 KB).
 *   - Store modul-level + `useSyncExternalStore`: Beranda dan Dompet melihat
 *     `balanceHidden` yang sama tanpa Context tambahan (pola unread-count).
 *   - `recentRecipients` dipisah key-nya: berisi username/nama (PII ringan)
 *     sehingga di web memory-only (lihat WEB_PERSISTENT_KEYS), sedangkan
 *     uiPrefs boleh persist di localStorage.
 *   - Penulisan gagal (SecureStore error) TIDAK dilempar: preferensi UI bukan
 *     data kritis — state memori tetap benar untuk sesi ini, `logWarn`
 *     mencatatnya.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react"
import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { serverNow } from "@/lib/server-time"
import { logWarn } from "@/lib/telemetry"

export type TransactionsTab = "buyer" | "seller"

export type UiPrefs = {
  /** Saldo disembunyikan (privasi bahu-penumpang) — dipakai Beranda & Dompet. */
  balanceHidden: boolean
  /** Tab Transaksi terakhir yang dipilih pengguna. */
  transactionsTab: TransactionsTab
  /**
   * Mode navbar (E-Commerce / E-Wallet). Preferensi perangkat, sama seperti
   * `balanceHidden`: logout tidak boleh mengembalikannya ke commerce.
   */
  appMode: "commerce" | "wallet"
  /** orderId → epoch ms sampai kapan pengingat ulasan ditunda (J-14). */
  ratingSnoozeUntil: Record<string, number>
}

const DEFAULT_PREFS: UiPrefs = {
  balanceHidden: false,
  transactionsTab: "buyer",
  appMode: "commerce",
  ratingSnoozeUntil: {},
}

export type RecentRecipient = {
  id: string
  name: string
  username: string
  avatarUrl?: string
  kycVerified?: boolean
  /** Epoch ms pemakaian terakhir — daftar diurutkan dari yang terbaru. */
  usedAt: number
}

const RECENT_MAX = 5

let prefs: UiPrefs = DEFAULT_PREFS
let recents: RecentRecipient[] = []
const listeners = new Set<() => void>()
let loadPromise: Promise<void> | null = null

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function sanitizePrefs(raw: unknown): UiPrefs {
  if (typeof raw !== "object" || raw === null) return DEFAULT_PREFS
  const rec = raw as Record<string, unknown>
  const snooze: Record<string, number> = {}
  if (typeof rec.ratingSnoozeUntil === "object" && rec.ratingSnoozeUntil !== null) {
    for (const [key, value] of Object.entries(rec.ratingSnoozeUntil as Record<string, unknown>)) {
      // E-03: ambang snooze ditulis dengan serverNow() (call site order/[id]) —
      // pembacaan harus domain yang sama atau jam perangkat yang menyimpang
      // memangkas/memanjangkan penundaan pengingat ulasan.
      if (typeof value === "number" && Number.isFinite(value) && value > serverNow()) {
        snooze[key] = value
      }
    }
  }
  return {
    balanceHidden: rec.balanceHidden === true,
    transactionsTab: rec.transactionsTab === "seller" ? "seller" : "buyer",
    // Field-by-field: lupa menyalin appMode di sini membuat mode hilang saat load.
    appMode: rec.appMode === "wallet" ? "wallet" : "commerce",
    ratingSnoozeUntil: snooze,
  }
}

function sanitizeRecents(raw: unknown): RecentRecipient[] {
  if (!Array.isArray(raw)) return []
  const result: RecentRecipient[] = []
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue
    const rec = item as Record<string, unknown>
    if (typeof rec.id !== "string" || typeof rec.username !== "string") continue
    result.push({
      id: rec.id,
      name: typeof rec.name === "string" ? rec.name : rec.username,
      username: rec.username,
      avatarUrl: typeof rec.avatarUrl === "string" ? rec.avatarUrl : undefined,
      kycVerified: rec.kycVerified === true,
      usedAt: typeof rec.usedAt === "number" ? rec.usedAt : 0,
    })
  }
  return result.sort((a, b) => b.usedAt - a.usedAt).slice(0, RECENT_MAX)
}

/** Muat dari storage sekali per proses; aman dipanggil berulang/paralel. */
export function loadUiPrefs(): Promise<void> {
  if (!loadPromise) {
    loadPromise = Promise.all([
      getSecureItem(SecureKeys.uiPrefs).catch((err) => {
        logWarn("ui-prefs:load", err)
        return null
      }),
      getSecureItem(SecureKeys.recentRecipients).catch((err) => {
        logWarn("ui-prefs:load-recent", err)
        return null
      }),
    ])
      .then(([prefsRaw, recentsRaw]) => {
        prefs = sanitizePrefs(prefsRaw ? safeJsonParse(prefsRaw) : null)
        recents = sanitizeRecents(recentsRaw ? safeJsonParse(recentsRaw) : null)
        emit()
      })
      .catch((err) => {
        logWarn("ui-prefs:load-failed", err)
        loadPromise = null // izinkan coba lagi pada pemanggilan berikutnya
      })
  }
  return loadPromise
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function getUiPrefsSnapshot(): UiPrefs {
  return prefs
}
export function getRecentRecipientsSnapshot(): readonly RecentRecipient[] {
  return recents
}

/** Ubah sebagian preferensi; persist async (kegagalan hanya dicatat). */
export function setUiPrefs(patch: Partial<UiPrefs>): void {
  prefs = { ...prefs, ...patch }
  emit()
  void setSecureItem(SecureKeys.uiPrefs, JSON.stringify(prefs)).catch((err) =>
    logWarn("ui-prefs:save", err),
  )
}

/**
 * B-06 (audit): buang preferensi MILIK AKUN saat logout/sesi berakhir.
 *
 * `ratingSnoozeUntil` berkunci `orderId` akun yang sedang login — akun
 * berikutnya di perangkat yang sama tidak boleh mewarisi jejak transaksi itu
 * (alasan yang sama dengan `pendingActions`/`recentRecipients` di
 * `clearSession()`). `balanceHidden`, `transactionsTab`, dan `appMode`
 * sengaja TIDAK disentuh: ketiganya preferensi perangkat yang berlaku untuk
 * siapa pun yang memakai perangkat ini.
 *
 * Tidak ada I/O saat tidak ada yang perlu dibersihkan (kasus paling sering:
 * logout tanpa pernah menunda pengingat ulasan).
 */
export function clearAccountPrefs(): void {
  if (Object.keys(prefs.ratingSnoozeUntil).length === 0) return
  setUiPrefs({ ratingSnoozeUntil: {} })
}

/**
 * J-14: lama penundaan pengingat ulasan sekali tekan "Ingatkan nanti".
 *
 * Tinggal bersama fungsi snooze-nya (bukan di layar detail order) karena ini
 * kebijakan fitur, bukan angka presentasi: layar mana pun yang nanti ikut
 * menunda pengingat harus memakai jendela yang sama.
 */
export const RATING_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000

/** Tunda pengingat ulasan satu order sampai `untilMs` (J-14). */
export function snoozeRatingReminder(orderId: string, untilMs: number): void {
  const next = { ...prefs.ratingSnoozeUntil, [orderId]: untilMs }
  // Bersihkan snooze yang sudah lewat agar blob tidak tumbuh selamanya.
  for (const [key, value] of Object.entries(next)) if (value <= serverNow()) delete next[key]
  setUiPrefs({ ratingSnoozeUntil: next })
}

/**
 * E-03 (audit 2026-09-22): `now` memakai domain jam SERVER karena nilai yang
 * dibandingkan (`ratingSnoozeUntil`) ditulis di domain itu dari
 * `serverNow() + RATING_SNOOZE_MS` (layar order). Sempat campur domain
 * (`Date.now()` di sini): perangkat dengan jam mundur 1 hari memperpanjang
 * penundaan 3 hari menjadi 4 hari, jam maju memangkasnya.
 */
export function isRatingSnoozed(orderId: string, now = serverNow()): boolean {
  const until = prefs.ratingSnoozeUntil[orderId]
  return typeof until === "number" && until > now
}

/**
 * Catat pemakaian penerima transfer (J-06): dedupe by id, terbaru di depan,
 * maksimum 5 entri — pola "recent" e-wallet pada umumnya.
 */
export function recordRecentRecipient(
  recipient: Omit<RecentRecipient, "usedAt">,
): void {
  const next = [
    // waktu-perangkat: `usedAt` hanya untuk mengurutkan daftar "terakhir
    // dipakai" di perangkat ini, tidak pernah dibandingkan dengan waktu server.
    { ...recipient, usedAt: Date.now() },
    ...recents.filter((r) => r.id !== recipient.id),
  ].slice(0, RECENT_MAX)
  recents = next
  emit()
  void setSecureItem(SecureKeys.recentRecipients, JSON.stringify(recents)).catch((err) =>
    logWarn("ui-prefs:save-recent", err),
  )
}

/** Reset memori (dipakai test). */
export function resetUiPrefsForTest(): void {
  prefs = DEFAULT_PREFS
  recents = []
  loadPromise = null
  emit()
}

/** Hook baca semua preferensi + pastikan pemuatan dimulai. */
export function useUiPrefs() {
  const snapshot = useSyncExternalStore(subscribe, getUiPrefsSnapshot, () => DEFAULT_PREFS)
  const set = useCallback((patch: Partial<UiPrefs>) => setUiPrefs(patch), [])
  useEffect(() => {
    void loadUiPrefs()
  }, [])
  return { prefs: snapshot, setPrefs: set }
}

/** Hook daftar penerima terakhir (sudah terurut terbaru dulu). */
export function useRecentRecipients() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getRecentRecipientsSnapshot,
    () => [] as readonly RecentRecipient[],
  )
  useEffect(() => {
    void loadUiPrefs()
  }, [])
  return snapshot
}
