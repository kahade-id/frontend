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
export const HEADER_DEVICE_ID = "X-Device-Id"
export const HEADER_DEVICE_INFO = "X-Device-Info"
export const HEADER_APP_VERSION = "X-App-Version"
export const HEADER_PLATFORM = "X-Platform"
export const REFRESH_COOKIE_NAME = "kahade_refresh_token"
