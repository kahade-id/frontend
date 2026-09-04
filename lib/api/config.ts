/**
 * Kahade — konfigurasi API client (base URL per environment, timeout, header).
 *
 * Prioritas base URL (yang pertama terisi menang):
 *   1. `EXPO_PUBLIC_API_URL`     — override eksplisit (mis. tunnel ngrok saat dev)
 *   2. `EXPO_PUBLIC_API_ENV`     — pilih salah satu env: dev | staging | prod
 *   3. `expo.extra.apiEnv`       — di app.json / app.config (per build profile EAS)
 *   4. `__DEV__` → dev, selain itu → prod
 *
 * Kenapa `EXPO_PUBLIC_*` (non-obvious): hanya prefix ini yang di-inline Metro
 * ke bundle klien; `process.env.API_URL` biasa akan `undefined` di runtime RN.
 *
 * Host dev untuk emulator Android BUKAN localhost: emulator memetakan host
 * machine ke 10.0.2.2. iOS simulator berbagi loopback dengan host, jadi
 * localhost aman. Perangkat fisik butuh IP LAN/tunnel → pakai
 * EXPO_PUBLIC_API_URL.
 *
 * TODO(backend): konfirmasi host staging/prod final. Nilai di bawah adalah
 * asumsi berdasarkan domain kahade.id — ganti tanpa menyentuh file lain.
 */
import Constants from "expo-constants"
import { Platform } from "react-native"

export type ApiEnv = "dev" | "staging" | "prod"

const DEV_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost"

const BASE_URLS: Record<ApiEnv, string> = {
  dev: `http://${DEV_HOST}:3000`,
  staging: "https://api-staging.kahade.id",
  prod: "https://api.kahade.id",
}

function isApiEnv(value: unknown): value is ApiEnv {
  return value === "dev" || value === "staging" || value === "prod"
}

export function resolveApiEnv(): ApiEnv {
  const fromEnv = process.env.EXPO_PUBLIC_API_ENV
  if (isApiEnv(fromEnv)) return fromEnv

  const extra = Constants.expoConfig?.extra as { apiEnv?: unknown } | undefined
  if (isApiEnv(extra?.apiEnv)) return extra.apiEnv

  return __DEV__ ? "dev" : "prod"
}

export const API_ENV: ApiEnv = resolveApiEnv()

/** Base URL TANPA trailing slash dan TANPA prefix `/v1` (path sudah membawa `/v1`). */
export const API_BASE_URL: string = (process.env.EXPO_PUBLIC_API_URL ?? BASE_URLS[API_ENV]).replace(/\/+$/, "")

/** Batas waktu satu request; di atas ini dianggap `TIMEOUT` (bukan hang selamanya). */
export const API_TIMEOUT_MS = 20_000

/**
 * Nama header custom yang dikirim di SETIAP request.
 * Backend juga menerima `deviceId`/`deviceInfo` di body beberapa DTO auth —
 * header ini adalah pelengkap agar endpoint yang DTO-nya tidak punya field
 * tersebut (mis. GET) tetap bisa mengenali perangkat untuk daftar sesi.
 */
export const HEADER_DEVICE_ID = "X-Device-Id"
export const HEADER_DEVICE_INFO = "X-Device-Info"
export const HEADER_APP_VERSION = "X-App-Version"
export const HEADER_PLATFORM = "X-Platform"

/** Nama cookie refresh token sesuai `components.securitySchemes.cookie` di spec. */
export const REFRESH_COOKIE_NAME = "kahade_refresh_token"
