/**
 * Kahade — state sesi untuk API client: access token + identitas perangkat.
 *
 * Satu-satunya jembatan antara `lib/secure-storage.ts` dan `request()`.
 *
 * Keputusan non-obvious:
 *   - Access token di-CACHE di memori setelah pembacaan pertama. Membaca
 *     Keychain/Keystore tiap request itu I/O async yang terasa di list
 *     (FlashList memuat halaman berikutnya) — cukup sekali per proses, lalu
 *     cache di-invalidate saat `setAccessToken`/`clearSession`.
 *   - Refresh token TIDAK dipegang di sini. Spec mendefinisikan refresh
 *     lewat cookie HttpOnly `kahade_refresh_token` (RefreshTokenDto kosong),
 *     dan cookie itu dikelola OS (NSHTTPCookieStorage / CookieManager) saat
 *     fetch memakai `credentials: "include"`. Kalau backend kelak mengirim
 *     refresh token di body untuk mobile, simpan lewat `setRefreshToken` —
 *     slot SecureKeys.refreshToken sudah ada.
 *   - `deviceInfo` dibangun dari expo-device, BUKAN User-Agent fetch (RN tidak
 *     mengizinkan membaca UA sendiri). Formatnya dibuat mirip UA agar kolom
 *     "perangkat" di daftar sesi backend terbaca manusia.
 *   - Listener `onSessionExpired` dipakai root layout untuk redirect ke login
 *     — client tidak boleh import expo-router (dependency arah satu: UI → lib).
 */
import { clearRegistrationState } from "@/lib/registration"
import { clearPendingTwoFactorLogin } from "@/lib/two-factor-login"
import { clearAccountPrefs } from "@/lib/ui-prefs"
import { installedAppVersion } from "@/lib/runtime-info"
import { logWarn } from "@/lib/telemetry"
import * as Device from "expo-device"
import { Platform } from "react-native"

import {
  clearSession as clearSecureSession,
  deleteSecureItem,
  getOrCreateDeviceId,
  getSecureItem,
  SecureKeys,
  setSecureItem,
} from "@/lib/secure-storage"

// ------------------------------------------------------------------
// Access token
// ------------------------------------------------------------------

let accessTokenCache: string | null | undefined
let tokenRead: Promise<string | null> | undefined
let revision = 0
let storageQueue: Promise<unknown> = Promise.resolve()
const sessionListeners = new Set<() => void>()

/** Revision changes on login/logout, NOT token refresh. Used to reject stale responses. */
export function getSessionRevision() {
  return revision
}
/**
 * B-05 (audit): snapshot dinormalisasi ke `string | null`.
 *
 * Sebelumnya nilai mentah cache (`string | null | undefined`) diteruskan apa
 * adanya, sehingga `undefined` ("belum dibaca") dan `null` ("sudah dibaca,
 * tidak ada token") menjadi dua snapshot berbeda bagi `useSyncExternalStore`:
 * render ulang ekstra di tiap transisi, dan hidrasi web membandingkan
 * serverSnapshot `undefined` dengan snapshot klien yang artinya lain. Konsumen
 * (`Boolean(token)`, gerbang tamu) memang hanya peduli "ada token atau tidak".
 */
export function getSessionSnapshot(): string | null {
  return accessTokenCache ?? null
}
export function subscribeSession(listener: () => void) {
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}
function notifySession() {
  for (const listener of sessionListeners) listener()
}
function writeInOrder(task: () => Promise<void>): Promise<void> {
  const next = storageQueue.then(task, task)
  storageQueue = next.catch(() => undefined)
  return next
}

export function getAccessToken(): Promise<string | null> {
  if (accessTokenCache !== undefined) return Promise.resolve(accessTokenCache)
  if (tokenRead) return tokenRead
  const started = revision
  const pending = getSecureItem(SecureKeys.accessToken)
    .then((token) => {
      if (started === revision && accessTokenCache === undefined) {
        accessTokenCache = token
        notifySession()
      }
      return accessTokenCache ?? null
    })
    .finally(() => {
      if (tokenRead === pending) tokenRead = undefined
    })
  tokenRead = pending
  return pending
}

export async function setAccessToken(token: string): Promise<void> {
  const started = revision
  await writeInOrder(() => setSecureItem(SecureKeys.accessToken, token))
  if (started !== revision) return
  accessTokenCache = token
  notifySession()
}

/** Publish a new account only after its tokens were safely persisted. */
export async function startSession(tokens: {
  accessToken: string
  refreshToken?: string
}): Promise<void> {
  revision += 1
  const started = revision
  accessTokenCache = null
  tokenRead = undefined
  notifySession()
  await writeInOrder(async () => {
    if (started !== revision) return
    try {
      // A new account must never inherit the previous account's local PIN/biometric state.
      await clearSecureSession()
      await setSecureItem(SecureKeys.accessToken, tokens.accessToken)
      if (tokens.refreshToken) await setSecureItem(SecureKeys.refreshToken, tokens.refreshToken)
      await deleteSecureItem(SecureKeys.sessionSignedOut)
    } catch (error) {
      await setSecureItem(SecureKeys.sessionSignedOut, "1").catch(() => undefined)
      await clearSecureSession().catch(() => undefined)
      throw error
    }
  })
  if (started !== revision) return
  accessTokenCache = tokens.accessToken
  notifySession()
}

/**
 * B-01 (audit): fungsi ini dulu HANYA menghapus slot `accessToken` — tanpa
 * menaikkan `revision`, tanpa `sessionSignedOut`, tanpa membersihkan data
 * akun. Akibatnya request yang masih terbang tidak di-abort oleh
 * `assertSession()` (`lib/api/client.ts`) dan boot berikutnya mencoba refresh
 * lagi: "logout yang tidak benar-benar logout".
 *
 * Sekarang satu-satunya jalur keluar adalah `clearSession()`; nama lama
 * dipertahankan sebagai alias agar pemanggil (bila ada) tidak bisa lagi
 * mengambil jalur setengah-jadi itu.
 */
export function clearAccessToken(): Promise<void> {
  return clearSession()
}

export async function setRefreshToken(token: string): Promise<void> {
  await writeInOrder(() => setSecureItem(SecureKeys.refreshToken, token))
}
export async function getRefreshToken(): Promise<string | null> {
  return getSecureItem(SecureKeys.refreshToken)
}

export async function clearSession(): Promise<void> {
  revision += 1
  tokenRead = undefined
  accessTokenCache = null
  notifySession()
  clearRegistrationState()
  clearPendingTwoFactorLogin()
  // B-06 (audit): preferensi MILIK AKUN (snooze pengingat ulasan per orderId)
  // ikut dibersihkan — akun berikutnya di perangkat yang sama tidak boleh
  // mewarisi jejak transaksi akun sebelumnya. `balanceHidden`/`transactionsTab`
  // sengaja TETAP: keduanya preferensi perangkat, bukan data akun.
  clearAccountPrefs()
  await writeInOrder(async () => {
    // B-08 (audit): hapus dulu, BARU tandai "signed out".
    //
    // Urutan lama (tulis flag lalu hapus di `finally`) membuat kegagalan hapus
    // meninggalkan perangkat yang "terkunci keluar": flag sudah tertulis
    // padahal token masih ada, dan tiap boot berikutnya
    // (`lib/use-auth-session.ts`) mengulang siklus itu tanpa pernah
    // membersihkan sisa token. Dengan urutan ini, kegagalan hapus membatalkan
    // seluruh blok → boot berikutnya mencoba lagi dari keadaan bersih.
    await clearSecureSession()
    try {
      // Prevent cookie-based auto-login after an explicit/offline logout on the web.
      await setSecureItem(SecureKeys.sessionSignedOut, "1")
    } catch (error) {
      // Flag gagal ditulis TIDAK membatalkan logout (token sudah terhapus);
      // dicatat supaya auto-login yang lolos punya jejak di log.
      logWarn("session:signed-out", error)
    }
  })
}

// ------------------------------------------------------------------
// Identitas perangkat
// ------------------------------------------------------------------

let deviceIdPromise: Promise<string> | undefined

/** Dibuat sekali per install, disimpan di SecureStore, dipakai selamanya. */
export function getDeviceId(): Promise<string> {
  if (!deviceIdPromise) {
    deviceIdPromise = getOrCreateDeviceId().catch((err) => {
      deviceIdPromise = undefined // izinkan percobaan ulang bila SecureStore sempat gagal
      throw err
    })
  }
  return deviceIdPromise
}

/**
 * Deskripsi perangkat untuk `LoginDto.deviceInfo` (maxLength 512) & header
 * X-Device-Info. Contoh: "Kahade/0.1.0 (iOS 17.5; Apple iPhone 15)".
 */
export function getDeviceInfo(): string {
  const appVersion = installedAppVersion() ?? "unknown"
  const os = `${Device.osName ?? Platform.OS} ${Device.osVersion ?? ""}`.trim()
  const model =
    [Device.brand, Device.modelName].filter(Boolean).join(" ") ||
    (Platform.OS === "web" ? "Web" : "Unknown")
  return `Kahade/${appVersion} (${os}; ${model})`.slice(0, 512)
}

export function getAppVersion(): string {
  return installedAppVersion() ?? "unknown"
}

// ------------------------------------------------------------------
// Event sesi berakhir
// ------------------------------------------------------------------

type SessionExpiredListener = () => void
const sessionExpiredListeners = new Set<SessionExpiredListener>()

/** Dipanggil client saat 401 tidak bisa dipulihkan lewat refresh. */
export function emitSessionExpired(): void {
  for (const listener of sessionExpiredListeners) listener()
}

/** Daftarkan handler (mis. `router.replace("/login")`). Mengembalikan fungsi unsubscribe. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener)
  return () => {
    sessionExpiredListeners.delete(listener)
  }
}
