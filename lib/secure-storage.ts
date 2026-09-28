/**
 * Kahade — penyimpanan rahasia (§14 Keamanan & Sesi).
 *
 * SATU-SATUNYA tempat yang menyentuh expo-secure-store. Access token, refresh
 * token, hash PIN, dan flag "biometrik aktif" WAJIB lewat sini — TIDAK lewat
 * AsyncStorage (plaintext di sandbox app; terbaca oleh backup/root).
 *
 * Kenapa expo-secure-store, bukan AsyncStorage (non-obvious):
 *   - iOS: Keychain (dienkripsi Secure Enclave). Android: EncryptedSharedPreferences
 *     berbasis Keystore. Kedua-duanya TIDAK ikut cloud backup untuk key yang
 *     memakai `*_THIS_DEVICE_ONLY` — sesi tidak "berpindah" ke ponsel baru
 *     saat restore iCloud, yang memang perilaku yang kita inginkan (§14:
 *     perangkat baru = login ulang + 2FA).
 *   - Batas nilai 2048 byte/entri: cukup untuk JWT biasa, TIDAK untuk payload
 *     besar. Jangan simpan objek user/profil di sini — hanya rahasia.
 *
 * Keputusan non-obvious:
 *   - Key dipusatkan di `SecureKeys` (bukan string bebas) supaya logout bisa
 *     menghapus SEMUA rahasia lewat `clearSession()` tanpa ada yang terlewat.
 *   - `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` untuk token: token
 *     tidak perlu dibaca saat layar terkunci (kita tidak punya background
 *     sync yang butuh auth), dan tidak ikut backup.
 *   - Hash PIN memakai `requireAuthentication`? TIDAK. Kalau di-set, membaca
 *     hash PIN akan memicu prompt biometrik OS — padahal PIN justru fallback
 *     saat biometrik gagal. Lihat <BiometricPromptTrigger>.
 *   - Web: expo-secure-store tidak tersedia. Fallback ke memori proses
 *     (hilang saat reload) — sengaja BUKAN localStorage, supaya token tidak
 *     pernah tersimpan plaintext di browser. Sesi web bertumpu pada cookie
 *     HttpOnly dari backend; di web modul ini efektif hanya cache.
 */
import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

export const SecureKeys = {
  themePreference: "kahade.theme.preference",
  sessionSignedOut: "kahade.session.signedOut",
  accessToken: "kahade.auth.accessToken",
  refreshToken: "kahade.auth.refreshToken",
  /**
   * Token akses admin panel (sesi TERPISAH dari sesi user — admin bisa login
   * sebagai admin tanpa mengganggu sesi user di perangkat yang sama).
   * Sama seperti token user: memory-only di web (tidak masuk
   * WEB_PERSISTENT_KEYS).
   */
  adminAccessToken: "kahade.admin.accessToken",
  /**
   * "1" bila pengguna mengaktifkan kunci aplikasi biometrik (app-lock §14:
   * re-autentikasi setelah background > 1 menit — lib/app-lock.ts).
   *
   * Catatan audit A-05: slot lama `pinHash` DIHAPUS — tidak pernah ada kode
   * yang menulis/membacanya (dead API yang menyesatkan). PIN diverifikasi
   * server-side lewat POST /v1/wallet/verify-pin, tidak pernah di-hash lokal.
   */
  biometricEnabled: "kahade.security.biometricEnabled",
  /** Fingerprint per-install untuk RegisterDeviceDto.deviceId */
  deviceId: "kahade.device.id",
  /** Push token terakhir yang berhasil didaftarkan ke backend */
  pushToken: "kahade.push.token",
  /**
   * Identifier respons notifikasi terakhir yang sudah ditangani
   * (cold-start dedupe). BUKAN rahasia — pengecualian seperti `deviceId`.
   */
  lastNotificationResponse: "kahade.push.lastResponse",
  /**
   * Pilihan tema eksklusif Kahade+ (id tema — lib/kahade-plus-theme.ts).
   * Preferensi UI level perangkat seperti `themePreference`: boleh persist di
   * web, dan TIDAK dihapus `clearSession()` (pilihan dikunci oleh status
   * langganan saat dipakai, bukan saat disimpan — lihat effectiveThemeId).
   */
  kahadePlusTheme: "kahade.plus.theme",
  /**
   * "1" bila user sudah melewati onboarding (slide intro). BUKAN rahasia —
   * pengecualian yang disengaja, sama seperti `deviceId`: repo ini tidak
   * memasang AsyncStorage dan SecureStore adalah satu-satunya storage
   * persisten yang tersedia (lihat package.json). Nilai 1 byte, tidak ikut
   * backup, dan TIDAK dihapus `clearSession()` — logout bukan alasan untuk
   * menampilkan intro lagi.
   */
  onboardingSeen: "kahade.onboarding.seen",
  /**
   * "1" bila checklist onboarding (KYC + rekening + etalase pertama) sudah
   * selesai SEMUA — kartu checklist disembunyikan permanen. BUKAN rahasia,
   * preferensi level perangkat seperti `onboardingSeen`: boleh persist di
   * web, TIDAK dihapus `clearSession()`.
   */
  onboardingChecklistDone: "kahade.onboarding.checklistDone",
  /**
   * Bahasa antarmuka ("id" | "en"). BUKAN rahasia — sama seperti
   * `themePreference` & `onboardingSeen`: 2 byte, tidak ikut cadangan cloud,
   * dan TIDAK dihapus `clearSession()` (logout bukan alasan untuk mengembalikan
   * bahasa ke bawaan OS). Sumber kebenaran tetap GET/PUT /v1/settings/language;
   * ini cache agar bahasa sudah benar SEBELUM respons pertama tiba.
   */
  languagePreference: "kahade.language.preference",
  /**
   * Antrean umpan balik yang belum terkirim (endpoint /v1/feedback belum
   * tersedia atau perangkat sedang luring). Di native disimpan sementara di
   * SecureStore; di web sengaja hanya memory agar PII tidak masuk localStorage.
   * BUKAN rahasia — lihat lib/feedback.
   */
  feedbackQueue: "kahade.feedback.queue",
  /**
   * Karya etalase yang di-soft-delete (JSON — lib/showcase-deleted.ts).
   * BUKAN rahasia: hanya id/judul/tanggal hapus untuk daftar "Baru dihapus"
   * agar user bisa memulihkan dalam 30 hari. Dihapus `clearSession()` saat logout.
   */
  deletedShowcaseItems: "kahade.showcase.deleted",
  /** S7: draft teks form "Buat karya" (autosave lokal). */
  showcaseDraft: "kahade.showcase.draft",
  /**
   * Preferensi UI non-sensitif (JSON kecil — lib/ui-prefs.ts): saldo
   * disembunyikan, tab transaksi terakhir, snooze pengingat ulasan.
   * BUKAN rahasia; boleh persist di localStorage web (tanpa PII/angka uang).
   */
  uiPrefs: "kahade.ui.prefs",
  /** At most 25 public item IDs, scoped to one account; cleared at logout. */
  showcaseBookmarks: "kahade.showcase.bookmarks",
  /**
   * Penerima transfer terakhir (JSON — lib/ui-prefs.ts recentRecipients).
   * Berisi username/nama penerima = PII ringan: di native persist, di web
   * SENGAJA memory-only (tidak masuk WEB_PERSISTENT_KEYS).
   */
  recentRecipients: "kahade.transfer.recent",
  /**
   * Aksi uang menggantung (JSON — lib/pending-actions.ts): withdraw
   * PENDING_OTP, QRIS menunggu, top-up belum dibayar. Berisi txId + nominal
   * → di web memory-only seperti feedbackQueue.
   */
  pendingActions: "kahade.pending.actions",
  /**
   * Update id OTA terakhir yang diumumkan (lib/ota-notice.ts). BUKAN rahasia;
   * level perangkat — TIDAK dihapus clearSession (update bundle tidak peduli
   * siapa yang login).
   */
  lastUpdateId: "kahade.ota.lastUpdateId",
  /**
   * FE-IMP-3 #99 — waktu terakhir pengguna menekan "Periksa pembaruan OTA"
   * (ISO string). BUKAN rahasia; level perangkat seperti `lastUpdateId` —
   * TIDAK dihapus clearSession.
   */
  otaLastChecked: "kahade.ota.lastChecked",
  /**
   * Coach mark "sekali saja" untuk elemen baru (lib/coach-mark.ts):
   * tombol (+) di header Etalase ("create") dan ikon QR di bottom navbar
   * ("qr"). "1" bila tooltip pengenalnya sudah pernah tampil/ditutup.
   * BUKAN rahasia — preferensi level perangkat seperti `onboardingSeen`:
   * boleh persist di web, TIDAK dihapus `clearSession()` (logout bukan
   * alasan menampilkan ulang pengenal elemen).
   */
  coachMarkCreateSeen: "kahade.coachMark.createSeen",
  coachMarkQrSeen: "kahade.coachMark.qrSeen",
  /**
   * Toggle notifikasi granular per jenis (JSON — lib/notification-local-prefs.ts):
   * Chat, Transaksi, Etalase, Promo. BUKAN rahasia — hanya boolean preferensi
   * tampilan banner, tanpa PII/angka uang: boleh persist di web seperti
   * `uiPrefs`, dan TIDAK dihapus `clearSession()` (preferensi perangkat,
   * bukan sesi).
   */
  notificationLocalPrefs: "kahade.notifications.localPrefs",
  /**
   * Antrean aksi sosial offline (JSON — lib/offline-queue.ts): like/unlike
   * karya dan follow/unfollow. BUKAN rahasia (hanya path + label tampilan);
   * boleh persist di web seperti `uiPrefs`. Dibatasi revisi sesi saat
   * eksekusi — entri sesi lama dibuang, bukan dikirim sebagai sesi baru.
   */
  offlineSocialQueue: "kahade.offline.socialQueue",
  /**
   * Item mega-batch 126 — timestamp terakhir tiket dukungan dibuka per
   * ticketId (JSON, lib/support-unread.ts). Data milik AKUN: dihapus
   * `clearSession()`; memory-only di web (bukan WEB_PERSISTENT_KEYS) supaya
   * jejak baca tiket tidak menetap di localStorage.
   */
  supportOpenedAt: "kahade.support.openedAt",
  /**
   * Item mega-batch 131 — draft form tiket dukungan (lib/support-draft.ts).
   * Data milik AKUN: dihapus `clearSession()`; memory-only di web.
   */
  supportDraft: "kahade.support.draft",
  /**
   * Batch 139 (F11) — draft tiket dukungan PER KATEGORI (JSON map
   * kategori → draft, lib/support-draft.ts). Menggantikan `supportDraft`
   * (satu draft global yang tertimpa saat kategori berubah); kunci lama
   * dibaca sekali sebagai migrasi. Data milik AKUN: dihapus
   * `clearSession()`; memory-only di web.
   */
  supportDrafts: "kahade.support.drafts",
  /**
   * Batch 139 (F04) — riwayat artikel bantuan terakhir dilihat per akun
   * (JSON — lib/help-history.ts). Dihapus `clearSession()`; memory-only
   * di web supaya jejak baca tidak menetap di localStorage.
   */
  helpHistory: "kahade.help.history",
  /**
   * Batch 139 (F17) — pilihan umpan balik artikel per versi artikel
   * (JSON — lib/help-feedback.ts). Dihapus `clearSession()`.
   */
  helpFeedback: "kahade.help.feedback",
  /**
   * Batch 139 (F07) — antrean pesan live support yang gagal terkirim
   * (JSON — lib/live-support-outbox.ts). Data milik AKUN: dihapus
   * `clearSession()`; memory-only di web.
   */
  liveSupportOutbox: "kahade.livesupport.outbox",
  /**
   * Item #28 — skala ukuran font A-/A+ (0.85–1.3). String desimal, mis. "1.1".
   * Preferensi perangkat non-sensitif: persist di web, TIDAK ikut clearSession.
   */
  fontScale: "kahade.ui.fontScale",
} as const

export type SecureKey = (typeof SecureKeys)[keyof typeof SecureKeys]

const isWeb = Platform.OS === "web"
const memory = new Map<string, string>()
// Only small, non-sensitive preferences may persist in browser storage.
// Feedback can contain an email or transaction context, so its offline queue is
// memory-only on web: a reload must not leave private feedback in localStorage.
// Never persist JWT/PIN/push tokens in the browser.
const WEB_PERSISTENT_KEYS = new Set<SecureKey>([
  SecureKeys.deviceId,
  SecureKeys.onboardingSeen,
  SecureKeys.themePreference,
  SecureKeys.languagePreference,
  SecureKeys.sessionSignedOut,
  SecureKeys.lastNotificationResponse,
  SecureKeys.uiPrefs,
  SecureKeys.showcaseBookmarks,
  SecureKeys.kahadePlusTheme,
  SecureKeys.coachMarkCreateSeen,
  SecureKeys.coachMarkQrSeen,
  SecureKeys.notificationLocalPrefs,
  SecureKeys.onboardingChecklistDone,
  SecureKeys.offlineSocialQueue,
  /**
   * Item #28 — skala font A-/A+ (lib/font-scale.ts). Preferensi aksesibilitas
   * non-sensitif level perangkat: boleh persist di web seperti themePreference,
   * dan TIDAK dihapus `clearSession()` (logout bukan alasan mengembalikan
   * ukuran teks pengguna).
   */
  SecureKeys.fontScale,
])
/**
 * D-07 (audit): apakah kunci ini BERTAHAN di web? Dipakai modul yang harus
 * jujur soal nasib datanya (`lib/feedback.ts`) tanpa menyalin ulang daftar
 * `WEB_PERSISTENT_KEYS` — dua daftar yang bisa berbeda pendapat justru sumber
 * bug yang sedang diperbaiki.
 */
export function isSecureKeyPersisted(key: SecureKey): boolean {
  return !isWeb || WEB_PERSISTENT_KEYS.has(key)
}

function webStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export async function getSecureItem(key: SecureKey): Promise<string | null> {
  if (isWeb) {
    if (WEB_PERSISTENT_KEYS.has(key)) {
      try {
        return webStorage()?.getItem(key) ?? memory.get(key) ?? null
      } catch {
        /* private browsing */
      }
    }
    return memory.get(key) ?? null
  }
  return SecureStore.getItemAsync(key, OPTIONS)
}

export async function setSecureItem(key: SecureKey, value: string): Promise<void> {
  if (isWeb) {
    memory.set(key, value)
    if (WEB_PERSISTENT_KEYS.has(key)) {
      try {
        webStorage()?.setItem(key, value)
      } catch {
        /* memory fallback */
      }
    }
    return
  }
  await SecureStore.setItemAsync(key, value, OPTIONS)
}

export async function deleteSecureItem(key: SecureKey): Promise<void> {
  if (isWeb) {
    memory.delete(key)
    if (WEB_PERSISTENT_KEYS.has(key)) {
      try {
        webStorage()?.removeItem(key)
      } catch {
        /* storage disabled */
      }
    }
    return
  }
  await SecureStore.deleteItemAsync(key, OPTIONS)
}

/**
 * Hapus SEMUA rahasia sesi saat logout / "keluar dari semua perangkat".
 * `deviceId` sengaja dipertahankan: backend memakainya untuk mengenali
 * perangkat yang sama saat login berikutnya (daftar perangkat §9, trust).
 */
export async function clearSession(): Promise<void> {
  await Promise.all([
    deleteSecureItem(SecureKeys.accessToken),
    deleteSecureItem(SecureKeys.refreshToken),
    deleteSecureItem(SecureKeys.biometricEnabled),
    deleteSecureItem(SecureKeys.pushToken),
    deleteSecureItem(SecureKeys.feedbackQueue),
    // Data milik akun (bukan preferensi perangkat): akun berikutnya di
    // perangkat yang sama tidak boleh mewarisi jejak transaksi/penerima.
    deleteSecureItem(SecureKeys.pendingActions),
    deleteSecureItem(SecureKeys.recentRecipients),
    deleteSecureItem(SecureKeys.showcaseBookmarks),
    // Antrean aksi sosial milik akun yang logout — akun berikutnya tidak
    // boleh mewarisi/mengirimnya (drain juga membuang revisi sesi asing).
    deleteSecureItem(SecureKeys.offlineSocialQueue),
    // Item mega-batch 126: jejak "terakhir dibuka" tiket dukungan milik akun.
    deleteSecureItem(SecureKeys.supportOpenedAt),
    // Item mega-batch 131: draft tiket milik akun.
    deleteSecureItem(SecureKeys.supportDraft),
    // Batch 139 (F11): draft tiket per kategori milik akun.
    deleteSecureItem(SecureKeys.supportDrafts),
    // Batch 139 (F04): riwayat artikel bantuan milik akun.
    deleteSecureItem(SecureKeys.helpHistory),
    // Batch 139 (F17): umpan balik artikel per versi milik akun.
    deleteSecureItem(SecureKeys.helpFeedback),
    // Batch 139 (F07): antrean pesan live support yang belum terkirim.
    deleteSecureItem(SecureKeys.liveSupportOutbox),
  ])
}

/**
 * Kunci dinamis draft chat per-room (lib/chat-drafts.ts) — satu-satunya kunci
 * dinamis yang diizinkan modul ini. Draft BUKAN rahasia (teks ketikan user),
 * tapi SecureStore adalah satu-satunya storage persisten yang terpasang
 * (repo tidak memakai AsyncStorage). Di web sengaja memory-only (tidak masuk
 * WEB_PERSISTENT_KEYS) — isi chat tidak boleh mendarat di localStorage.
 *
 * roomId dinormalisasi: hanya [a-zA-Z0-9_-] yang lolos, sisanya diganti "-"
 * supaya kunci tetap valid & tidak bisa menyuntik path/key lain.
 */
export function chatDraftKey(roomId: string): string {
  const safe = String(roomId ?? "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 128)
  return `kahade.chat.draft.${safe}`
}

/**
 * Kunci draft komentar etalase per item (mega-batch FE-IMP-1, item 161 —
 * "seperti draft chat"): pola sama dengan `chatDraftKey` — memory + SecureStore
 * (web memory-only), tidak dihapus `clearSession()`.
 */
export function showcaseCommentDraftKey(showcaseId: string): string {
  const safe = String(showcaseId ?? "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 128)
  return `kahade.showcase.commentDraft.${safe}`
}

/**
 * Akses mentah untuk kunci dinamis (lihat `chatDraftKey`). Aturan yang sama
 * dengan API ber-tipe: di web kunci mentah TIDAK persist ke localStorage
 * (memory proses saja) — pemanggil yang butuh persist web harus menambah
 * kunci tetap ke SecureKeys + WEB_PERSISTENT_KEYS, bukan memakai ini.
 */
export async function getRawItem(key: string): Promise<string | null> {
  if (isWeb) return memory.get(key) ?? null
  return SecureStore.getItemAsync(key, OPTIONS)
}

export async function setRawItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    memory.set(key, value)
    return
  }
  await SecureStore.setItemAsync(key, value, OPTIONS)
}

export async function deleteRawItem(key: string): Promise<void> {
  if (isWeb) {
    memory.delete(key)
    return
  }
  await SecureStore.deleteItemAsync(key, OPTIONS)
}

/**
 * Apakah perangkat bisa memakai biometrik untuk MELINDUNGI entri SecureStore
 * (bukan sekadar punya sensor). Dipakai untuk memutuskan apakah opsi
 * "Buka dengan biometrik" layak ditawarkan di pengaturan.
 */
export function canUseBiometricStorage(): boolean {
  if (isWeb) return false
  return SecureStore.canUseBiometricAuthentication()
}

/**
 * ID perangkat stabil per-install (RegisterDeviceDto.deviceId, maks 128).
 * Dibuat sekali lalu disimpan; hilang hanya saat uninstall — sesuai definisi
 * "stable per-install device fingerprint" di API.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await getSecureItem(SecureKeys.deviceId)
  if (existing) return existing
  const id = generateId()
  await setSecureItem(SecureKeys.deviceId, id)
  return id
}

function generateId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } }
  if (g.crypto?.randomUUID) return g.crypto.randomUUID()
  // Fallback RN lama tanpa crypto.randomUUID — cukup unik untuk fingerprint
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`
}
