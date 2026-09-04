/**
 * Kahade — state sesi untuk API client: access token + identitas perangkat.
 *
 * Satu-satunya jembatan antara `lib/secure-storage.ts` dan `request()`.
 *
 * Keputusan non-obvious:
 *   - Access token di-CACHE di memori setelah pembacaan pertama. Membaca
 *     Keychain/Keystore tiap request itu I/O async yang terasa di list
 *     (FlashList memuat halaman berikutnya) — cukup sekali per proses, lalu
 *     cache di-invalidate saat `setAccessToken`/`clearAccessToken`.
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
import Constants from "expo-constants"
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

let accessTokenCache: string | null | undefined // undefined = belum dibaca

export async function getAccessToken(): Promise<string | null> {
  if (accessTokenCache !== undefined) return accessTokenCache
  accessTokenCache = await getSecureItem(SecureKeys.accessToken)
  return accessTokenCache
}

export async function setAccessToken(token: string): Promise<void> {
  accessTokenCache = token
  await setSecureItem(SecureKeys.accessToken, token)
}

export async function clearAccessToken(): Promise<void> {
  accessTokenCache = null
  await deleteSecureItem(SecureKeys.accessToken)
}

/** Opsional — hanya bila backend mengirim refresh token di body (bukan cookie). */
export async function setRefreshToken(token: string): Promise<void> {
  await setSecureItem(SecureKeys.refreshToken, token)
}

export async function getRefreshToken(): Promise<string | null> {
  return getSecureItem(SecureKeys.refreshToken)
}

/** Hapus semua rahasia sesi (token, PIN hash, flag biometrik) — deviceId dipertahankan. */
export async function clearSession(): Promise<void> {
  accessTokenCache = null
  await clearSecureSession()
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
  const appVersion = Constants.expoConfig?.version ?? "0.0.0"
  const os = `${Device.osName ?? Platform.OS} ${Device.osVersion ?? ""}`.trim()
  const model = [Device.brand, Device.modelName].filter(Boolean).join(" ") || (Platform.OS === "web" ? "Web" : "Unknown")
  return `Kahade/${appVersion} (${os}; ${model})`.slice(0, 512)
}

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0"
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
