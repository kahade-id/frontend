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
import type { NotificationCategory } from "@/lib/api"

export type TransactionsTab = "buyer" | "seller"

/**
 * Tab feed Etalase terakhir yang dibuka (mega-batch FE-IMP-1, item 47).
 * Persist level perangkat seperti `appMode` — logout tidak meresetnya.
 */
export type ShowcaseFeedTab = "forYou" | "following" | "latest" | "popular"

/**
 * Item 47 (FE-IMP-1): parser fail-closed untuk tab feed — dipakai param URL
 * deep link maupun nilai yang dibaca dari SecureStore. Nilai asing/undefined
 * → "forYou" (tab default).
 */
export function parseShowcaseFeedTab(raw: unknown): ShowcaseFeedTab {
  return raw === "following" || raw === "latest" || raw === "popular" || raw === "forYou"
    ? raw
    : "forYou"
}

/** Cakupan hasil layar /search — diingat perangkat (item 77, mega-batch 2026-09-28). */
/** Item 87 (mega-batch 2026-09-28): cakupan "chats" — pencarian lintas-room. */
export type SearchScope = "all" | "users" | "posts" | "orders" | "transactions" | "chats"

export type UiPrefs = {
  /** Saldo disembunyikan (privasi bahu-penumpang) — dipakai Beranda & Dompet. */
  balanceHidden: boolean
  /** Tab Transaksi terakhir yang dipilih pengguna. */
  transactionsTab: TransactionsTab
  /** Tab feed Etalase terakhir yang dibuka (item 47). */
  showcaseFeedTab: ShowcaseFeedTab
  /** Cakupan chip terakhir layar Pencarian (item 77, 2026-09-28). */
  searchScope: SearchScope
  /**
   * Mode navbar (E-Commerce / E-Wallet). Preferensi perangkat, sama seperti
   * `balanceHidden`: logout tidak boleh mengembalikannya ke commerce.
   */
  appMode: "commerce" | "wallet"
  /** orderId → epoch ms sampai kapan pengingat ulasan ditunda (J-14). */
  ratingSnoozeUntil: Record<string, number>
  /**
   * Batch 19 (item 15) — Mode hemat data. Default OFF. Saat ON, gambar feed
   * (dan video) TIDAK dimuat sampai diketuk — menghemat kuota pengguna.
   * Preferensi perangkat (bukan akun): logout tidak meresetnya.
   */
  dataSaver: boolean
  /**
   * Item mega-batch 40 — kategori terakhir tab Notifikasi (pola yang sama
   * dengan `transactionsTab`). Preferensi perangkat: logout tidak mereset.
   */
  notificationsCategory: NotificationCategory
  /**
   * Batch 139 E14 — umpan balik pindaian QR (haptic + bunyi). Default ON.
   * Preferensi perangkat (bukan akun): logout tidak meresetnya. Mode senyap
   * perangkat tetap dihormati terpisah (bunyi tidak diputar saat senyap).
   */
  scanFeedback: boolean
}

const DEFAULT_PREFS: UiPrefs = {
  balanceHidden: false,
  transactionsTab: "buyer",
  showcaseFeedTab: "forYou",
  searchScope: "all",
  appMode: "commerce",
  ratingSnoozeUntil: {},
  dataSaver: false,
  notificationsCategory: "TRANSAKSI",
  // Batch 139 E14: umpan balik pindaian default ON.
  scanFeedback: true,
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
/**
 * R1-002 (2026-09-29, audit render-perf): emitter DIPISAH — `prefs` dan
 * `recents` punya listener set sendiri. Sebelumnya `recordRecentRecipient`
 * membangunkan seluruh subscriber preferensi app-wide (dan sebaliknya
 * `setUiPrefs` membangunkan subscriber daftar penerima).
 */
const prefsListeners = new Set<() => void>()
const recentsListeners = new Set<() => void>()
let loadPromise: Promise<void> | null = null

function emitPrefs() {
  for (const listener of prefsListeners) listener()
}

function emitRecents() {
  for (const listener of recentsListeners) listener()
}

function subscribePrefs(listener: () => void) {
  prefsListeners.add(listener)
  return () => {
    prefsListeners.delete(listener)
  }
}

function subscribeRecents(listener: () => void) {
  recentsListeners.add(listener)
  return () => {
    recentsListeners.delete(listener)
  }
}

/**
 * D01 (batch 139): hidrasi sinkron preferensi dari localStorage web.
 *
 * `loadUiPrefs()` itu async — di render pertama `balanceHidden` masih
 * DEFAULT (`false`) sampai SecureStore menjawab, sehingga ikon mata sempat
 * terlihat "terbuka" walau pengguna menyembunyikan saldo sebelum restart.
 * Di web, localStorage dapat dibaca sinkron: baca sekali saat modul dimuat
 * agar preferensi sudah benar sebelum render pertama. Di native (tanpa
 * `window`) ini no-op — skeleton saldo tetap menutupi nilai selama pemuatan
 * sehingga tidak ada kebocoran angka.
 */
export function hydrateUiPrefsSync(): void {
  try {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return
    const raw = window.localStorage.getItem(SecureKeys.uiPrefs)
    if (!raw) return
    prefs = sanitizePrefs(safeJsonParse(raw))
    emitPrefs()
  } catch {
    /* storage tidak tersedia — biarkan nilai default */
  }
}

// Hidrasi sinkron saat modul dimuat (web saja; no-op di native & test node).
hydrateUiPrefsSync()

/** Diekspor untuk test (Batch 139 E14): sanitizer preferensi murni. */
export function sanitizePrefs(raw: unknown): UiPrefs {
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
    // Item 47: hanya 4 nilai tab yang sah; nilai asing → default "forYou".
    showcaseFeedTab:
      rec.showcaseFeedTab === "following" ||
      rec.showcaseFeedTab === "latest" ||
      rec.showcaseFeedTab === "popular"
        ? rec.showcaseFeedTab
        : "forYou",
    // Item 77 (2026-09-28): cakupan chip Pencarian terakhir — sanitize ke
    // salah satu nilai yang valid, selain itu "all".
    searchScope: isSearchScope(rec.searchScope) ? rec.searchScope : "all",
    // Field-by-field: lupa menyalin appMode di sini membuat mode hilang saat load.
    appMode: rec.appMode === "wallet" ? "wallet" : "commerce",
    ratingSnoozeUntil: snooze,
    // Batch 19 (item 15): default OFF bila belum pernah disimpan.
    dataSaver: rec.dataSaver === true,
    // Item mega-batch 40: kategori notifikasi terakhir — validasi ketat ke
    // enum API supaya nilai basi/rusak jatuh ke TRANSAKSI.
    notificationsCategory:
      rec.notificationsCategory === "PROMOSI" || rec.notificationsCategory === "INFORMASI"
        ? rec.notificationsCategory
        : "TRANSAKSI",
    // Batch 139 E14: default ON bila belum pernah disimpan; nilai non-boolean
    // (data rusak) jatuh ke ON agar umpan balik tidak hilang diam-diam.
    scanFeedback: rec.scanFeedback !== false,
  }
}

/** Validasi nilai searchScope dari storage — bukan enum terbuka. */
export function isSearchScope(v: unknown): v is SearchScope {
  return (
    v === "all" ||
    v === "users" ||
    v === "posts" ||
    v === "orders" ||
    v === "transactions" ||
    v === "chats"
  )
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
        emitPrefs()
        emitRecents()
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
  // R1-002: emit HANYA bila ada key yang nilainya benar-benar berubah
  // (shallow-compare patch). Tulis no-op — mis. set tab yang sama — tidak
  // lagi membangunkan ratusan subscriber (Picture, galeri, dsb).
  let changed = false
  for (const key of Object.keys(patch) as (keyof UiPrefs)[]) {
    if (!Object.is(prefs[key], patch[key])) {
      changed = true
      break
    }
  }
  if (!changed) return
  prefs = { ...prefs, ...patch }
  emitPrefs()
  // PERF-FIX (state audit): debounce persist — perubahan beruntun (swipe tab
  // feed, scroll position) tidak lagi menulis SecureStore berkali-kali
  // berurutan (I/O mahal + race urutan tulis).
  scheduleUiPrefsPersist()
}

/**
 * PERF-FIX (state audit): antrean tulis tunggal untuk ui-prefs.
 * Pola mengikuti `writeCache` di lib/i18n/store.ts.
 */
let uiPrefsPersistTimer: ReturnType<typeof setTimeout> | null = null
function scheduleUiPrefsPersist(): void {
  if (uiPrefsPersistTimer !== null) clearTimeout(uiPrefsPersistTimer)
  uiPrefsPersistTimer = setTimeout(() => {
    uiPrefsPersistTimer = null
    const snapshot = prefs
    void setSecureItem(SecureKeys.uiPrefs, JSON.stringify(snapshot)).catch((err) =>
      logWarn("ui-prefs:save", err),
    )
  }, 500)
}

/**
 * B-06 (audit): buang preferensi MILIK AKUN saat logout/sesi berakhir.
 *
 * `ratingSnoozeUntil` berkunci `orderId` akun yang sedang login — akun
 * berikutnya di perangkat yang sama tidak boleh mewarisi jejak transaksi itu
 * (alasan yang sama dengan `pendingActions`/`recentRecipients` di
 * `clearSession()`).
 *
 * D18 (batch 139): `transactionsTab` kini ikut dibuang — filter tab
 * Transaksi disimpan PER AKUN, bukan per perangkat. Akun berikutnya mulai
 * dari default ("buyer") supaya tidak mewarisi saringan akun sebelumnya.
 *
 * `balanceHidden`, `notificationsCategory`, `appMode`, `showcaseFeedTab`,
 * `searchScope`, dan `dataSaver` sengaja TIDAK disentuh: preferensi perangkat
 * yang berlaku untuk siapa pun yang memakai perangkat ini.
 *
 * Tidak ada I/O saat tidak ada yang perlu dibersihkan (kasus paling sering:
 * logout tanpa pernah menunda pengingat ulasan dan tanpa mengganti tab).
 */
export function clearAccountPrefs(): void {
  const needsClear =
    Object.keys(prefs.ratingSnoozeUntil).length > 0 || prefs.transactionsTab !== "buyer"
  if (!needsClear) return
  setUiPrefs({ ratingSnoozeUntil: {}, transactionsTab: "buyer" })
}

/**
 * J-14: lama penundaan pengingat ulasan sekali tekan "Ingatkan nanti". *
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
  emitRecents()
  void setSecureItem(SecureKeys.recentRecipients, JSON.stringify(recents)).catch((err) =>
    logWarn("ui-prefs:save-recent", err),
  )
}

/** Reset memori (dipakai test). */
export function resetUiPrefsForTest(): void {
  prefs = DEFAULT_PREFS
  recents = []
  loadPromise = null
  emitPrefs()
  emitRecents()
}

/**
 * R1-002: selector per-key — snapshot mengembalikan SATU nilai key
 * (primitif untuk semua key kecuali `ratingSnoozeUntil`); `useSyncExternalStore`
 * bail-out otomatis via Object.is bila key lain yang berubah.
 */
export function useUiPref<K extends keyof UiPrefs>(key: K): UiPrefs[K] {
  const snapshot = useSyncExternalStore(
    subscribePrefs,
    () => prefs[key],
    () => DEFAULT_PREFS[key],
  )
  useEffect(() => {
    void loadUiPrefs()
  }, [])
  return snapshot
}

/** Setter tanpa langganan — untuk layar yang hanya menulis preferensi. */
export function useSetUiPrefs(): (patch: Partial<UiPrefs>) => void {
  return useCallback((patch: Partial<UiPrefs>) => setUiPrefs(patch), [])
}

/** Hook baca semua preferensi + pastikan pemuatan dimulai. */
export function useUiPrefs() {
  const snapshot = useSyncExternalStore(subscribePrefs, getUiPrefsSnapshot, () => DEFAULT_PREFS)
  const set = useSetUiPrefs()
  useEffect(() => {
    void loadUiPrefs()
  }, [])
  return { prefs: snapshot, setPrefs: set }
}

/**
 * Batch 19 (item 15) — baca status mode hemat data + pastikan pemuatan
 * dimulai. Dipakai <Picture dataSaverGate>, <ShowcaseMediaGallery>, dan
 * <FeedVideo>/galeri video.
 *
 * R1-002: kini selector per-key — tulis preferensi lain (ganti tab feed,
 * snooze rating, catat penerima transfer) TIDAK lagi me-render ulang
 * ratusan instance Picture/galeri.
 */
export function useDataSaver(): boolean {
  return useUiPref("dataSaver")
}

/** Batch 19 (item 15) — ubah mode hemat data (persist lokal). */
export function setDataSaver(enabled: boolean): void {
  setUiPrefs({ dataSaver: enabled })
}

/** Hook daftar penerima terakhir (sudah terurut terbaru dulu). */
export function useRecentRecipients() {
  const snapshot = useSyncExternalStore(
    subscribeRecents,
    getRecentRecipientsSnapshot,
    () => [] as readonly RecentRecipient[],
  )
  useEffect(() => {
    void loadUiPrefs()
  }, [])
  return snapshot
}
