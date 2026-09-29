import Constants from "expo-constants"
import { Platform } from "react-native"
import { resolveApiConfiguration } from "@/lib/api/environment"
export type { ApiEnv } from "@/lib/api/environment"

// Default is the real HTTPS API in BOTH Expo Go and release builds. Local/staging
// servers are opt-in; a guessed localhost silently breaks physical devices and web previews.
const configuration = resolveApiConfiguration({
  env: process.env.EXPO_PUBLIC_API_ENV,
  extraEnv: Constants.expoConfig?.extra?.apiEnv,
  url: process.env.EXPO_PUBLIC_API_URL,
  platform: Platform.OS,
  development: __DEV__,
})
export const API_ENV = configuration.env
/** No trailing slash and no /v1 prefix. */
export const API_BASE_URL = configuration.baseUrl
export const resolveApiEnv = () => API_ENV
export const API_TIMEOUT_MS = 20_000
/**
 * FE-077: timeout per kategori, bukan satu angka global. 20s + 1 retry =
 * ~41s gantung — terlalu lama untuk interaksi sekelas login, tapi angka
 * global tidak boleh diturunkan begitu saja (ada request JSON lambat yang
 * sah, mis. laporan). Kategori:
 * - INTERACTIVE (10s): login/OTP/register — gagal cepat, pengguna mengetuk
 *   ulang; mutasi TIDAK pernah di-retry otomatis jadi tidak ada risiko
 *   submit ganda.
 * - default 20s: bacaan JSON umum.
 * - upload: punya timeout sendiri (60s–600s, XHR) — tidak tersentuh.
 */
export const API_TIMEOUT_INTERACTIVE_MS = 10_000
export const HEADER_DEVICE_ID = "X-Device-Id"
export const HEADER_DEVICE_INFO = "X-Device-Info"
export const HEADER_APP_VERSION = "X-App-Version"
export const HEADER_PLATFORM = "X-Platform"
export const REFRESH_COOKIE_NAME = "kahade_refresh_token"
