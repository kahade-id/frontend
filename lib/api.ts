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
import * as badges from "@/lib/api/badges"
import * as bankAccounts from "@/lib/api/bank-accounts"
import * as chat from "@/lib/api/chat"
import * as deeplinks from "@/lib/api/deeplinks"
import * as disputes from "@/lib/api/disputes"
import * as helpCenter from "@/lib/api/help-center"
import * as kyc from "@/lib/api/kyc"
import * as notifications from "@/lib/api/notifications"
import * as orders from "@/lib/api/orders"
import * as publicApi from "@/lib/api/public"
import * as ratings from "@/lib/api/ratings"
import * as referrals from "@/lib/api/referrals"
import * as search from "@/lib/api/search"
import * as sessions from "@/lib/api/sessions"
import * as settings from "@/lib/api/settings"
import * as subscriptions from "@/lib/api/subscriptions"
import * as support from "@/lib/api/support"
import * as transactionTemplates from "@/lib/api/transaction-templates"
import * as upload from "@/lib/api/upload"
import * as users from "@/lib/api/users"
import * as vouchers from "@/lib/api/vouchers"
import * as wallet from "@/lib/api/wallet"
import * as withdrawals from "@/lib/api/withdrawals"

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
export { readUnreadCount, type AppNotification, type NotificationCategory, type UnreadCountResult } from "@/lib/api/notifications"
export type {
  AverageDurations,
  FeeBreakdown,
  ListOrdersQuery,
  Order,
  OrderHistoryEntry,
  OrderLink,
  OrderRole,
  OrderStatus,
  OrderStatusFilter,
  OrderSummary,
  Paginated,
} from "@/lib/api/orders"
export type { UserProfile } from "@/lib/api/users"
export type { Wallet, WalletTransaction } from "@/lib/api/wallet"

export const api = {
  auth,
  badges,
  bankAccounts,
  chat,
  deeplinks,
  disputes,
  helpCenter,
  kyc,
  notifications,
  orders,
  public: publicApi,
  ratings,
  referrals,
  search,
  sessions,
  settings,
  subscriptions,
  support,
  transactionTemplates,
  upload,
  users,
  vouchers,
  wallet,
  withdrawals,
} as const

export type Api = typeof api
