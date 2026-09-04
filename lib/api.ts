/**
 * Kahade — pintu masuk API client. Import dari sini, bukan dari lib/api/*.
 *
 *   import { api, ApiError, userMessage } from "@/lib/api"
 *   const result = await api.auth.login({ email, password })
 *   const orders = await api.orders.listOrders({ page: 1, limit: 20, role: "ALL" })
 *
 * Struktur:
 *   lib/api/config.ts   — base URL per env (dev/staging/prod), timeout, nama header
 *   lib/api/errors.ts   — ApiError + pemetaan status/body backend → kode stabil
 *   lib/api/session.ts  — access token (SecureStore + cache), deviceId, event sesi habis
 *   lib/api/client.ts   — request() generik: Bearer, X-Device-Id, timeout, refresh-on-401
 *   lib/api/types.ts    — DTO request, GENERATED dari docs/api/kahade-api-mobile.json
 *   lib/api/<domain>.ts — fungsi typed per tag OpenAPI (auth, orders, public, …)
 *
 * Menambah domain baru: buat lib/api/<tag>.ts yang memanggil `http.*` dengan
 * DTO dari types.ts, lalu daftarkan di objek `api` di bawah. Regenerate types
 * dengan `npm run gen:api` bila spec berubah.
 */
import * as auth from "@/lib/api/auth"
import * as orders from "@/lib/api/orders"
import * as publicApi from "@/lib/api/public"

export { API_BASE_URL, API_ENV, type ApiEnv } from "@/lib/api/config"
export { OTP_METHODS, type OtpMethod, type OtpMethodsResult } from "@/lib/api/auth"
export {
  buildUrl,
  http,
  refreshAccessToken,
  request,
  seg,
  type AuthMode,
  type HttpMethod,
  type QueryParams,
  type RequestOptions,
  type ResponseType,
} from "@/lib/api/client"
export {
  ApiError,
  DEFAULT_ERROR_MESSAGES,
  isApiError,
  userMessage,
  type ApiErrorCode,
} from "@/lib/api/errors"
export {
  clearSession,
  getAccessToken,
  getDeviceId,
  getDeviceInfo,
  onSessionExpired,
} from "@/lib/api/session"
export type * from "@/lib/api/types"

export const api = {
  auth,
  orders,
  public: publicApi,
} as const

export type Api = typeof api
