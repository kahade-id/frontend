/**
 * Kahade — `request()` generik: satu jalur untuk SEMUA panggilan HTTP ke backend.
 *
 * Otomatis di setiap request:
 *   1. Base URL per environment (lib/api/config.ts) + query string ter-encode.
 *   2. `Authorization: Bearer <accessToken>` dari SecureStore (via session.ts).
 *   3. Header identitas perangkat: X-Device-Id (dibuat sekali, disimpan
 *      selamanya), X-Device-Info, X-App-Version, X-Platform.
 *   4. Timeout (AbortController) → ApiError `TIMEOUT`; offline → `NETWORK`.
 *   5. Response non-2xx → ApiError dengan kode stabil + pesan backend (NestJS).
 *   6. 401 → refresh token SEKALI (single-flight; request paralel yang ikut
 *      401 menunggu refresh yang sama, bukan memicu N refresh), lalu retry
 *      request asal SEKALI. Kalau refresh gagal → sesi dibersihkan,
 *      `onSessionExpired` dipanggil, ApiError `UNAUTHORIZED` dilempar.
 *
 * Mekanisme refresh (dari spec): `POST /v1/auth/refresh` dengan
 * `RefreshTokenDto = {}` dan securityScheme cookie `kahade_refresh_token`.
 * Artinya refresh token hidup di cookie HttpOnly; kita cukup mengirim
 * `credentials: "include"`. Native RN menyimpan cookie di cookie jar OS
 * (set oleh response login), jadi ini berjalan tanpa kode tambahan. Bila
 * `session.getRefreshToken()` terisi (backend kelak mengirim token di body),
 * kita juga mengirimnya sebagai header `X-Refresh-Token` sebagai fallback.
 *
 * Yang SENGAJA tidak dilakukan di sini (non-obvious):
 *   - Tidak ada retry otomatis untuk NETWORK/TIMEOUT pada POST — order/pay/
 *     transfer tidak idempoten; retry buta bisa membayar dua kali. Screen
 *     memutuskan (tombol "Coba lagi"). Untuk GET, pemanggil boleh set
 *     `retry: 1`.
 *   - Tidak membongkar envelope `{ data: ... }`. Spec tidak mendefinisikan
 *     bentuk response, jadi body dikembalikan apa adanya dan tiap modul domain
 *     menyatakan tipe response-nya sendiri. Kalau nanti backend terbukti
 *     memakai envelope seragam, tambahkan di SATU tempat: `parseBody()`.
 */
import { Platform } from "react-native"

import {
  API_BASE_URL,
  API_TIMEOUT_MS,
  HEADER_APP_VERSION,
  HEADER_DEVICE_ID,
  HEADER_DEVICE_INFO,
  HEADER_PLATFORM,
} from "@/lib/api/config"
import { ApiError, codeFromStatus, DEFAULT_ERROR_MESSAGES, parseErrorBody } from "@/lib/api/errors"
import {
  clearSession,
  emitSessionExpired,
  getAccessToken,
  getAppVersion,
  getDeviceId,
  getDeviceInfo,
  getRefreshToken,
  setAccessToken,
} from "@/lib/api/session"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export type QueryPrimitive = string | number | boolean
export type QueryValue = QueryPrimitive | QueryPrimitive[] | null | undefined
export type QueryParams = Record<string, QueryValue>

/**
 * - "optional" (default): kirim Bearer bila ada token; 401 → coba refresh.
 * - "required": tanpa token langsung ApiError UNAUTHORIZED (hemat roundtrip).
 * - "none": jangan kirim Bearer dan JANGAN refresh saat 401 (login, register,
 *   refresh itu sendiri) — mencegah loop refresh → 401 → refresh.
 */
export type AuthMode = "optional" | "required" | "none"

export type ResponseType = "json" | "text" | "blob" | "void"

export type RequestOptions<TBody = undefined> = {
  method?: HttpMethod
  /** Body JSON — di-serialize otomatis. Eksklusif dengan `formData`. */
  body?: TBody
  /** Body multipart (upload berkas). Content-Type dibiarkan fetch yang mengisi boundary. */
  formData?: FormData
  query?: QueryParams
  auth?: AuthMode
  headers?: Record<string, string>
  timeoutMs?: number
  signal?: AbortSignal
  /** Default "json". "text" untuk receipt HTML / export CSV; "void" untuk 204. */
  responseType?: ResponseType
  /** Retry otomatis untuk error transien (NETWORK/TIMEOUT/5xx). Hanya pakai di GET. */
  retry?: number
}

// ------------------------------------------------------------------
// URL & header
// ------------------------------------------------------------------

export function buildUrl(path: string, query?: QueryParams): string {
  const base = path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`
  if (!query) return base

  const parts: string[] = []
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue
    const values = Array.isArray(value) ? value : [value]
    for (const v of values) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`)
  }
  if (!parts.length) return base
  return `${base}${base.includes("?") ? "&" : "?"}${parts.join("&")}`
}

/** Encode segmen path (orderId, username, token) — JANGAN interpolasi mentah. */
export function seg(value: string | number): string {
  return encodeURIComponent(String(value))
}

async function deviceHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    [HEADER_DEVICE_INFO]: getDeviceInfo(),
    [HEADER_APP_VERSION]: getAppVersion(),
    [HEADER_PLATFORM]: Platform.OS,
  }
  try {
    headers[HEADER_DEVICE_ID] = await getDeviceId()
  } catch (err) {
    // SecureStore bisa gagal sesaat setelah restore/reinstall — request tetap jalan tanpa deviceId.
    if (__DEV__) console.warn("[kahade/api] deviceId tidak tersedia:", err)
  }
  return headers
}

// ------------------------------------------------------------------
// Parsing response
// ------------------------------------------------------------------

async function parseBody(res: Response, responseType: ResponseType): Promise<unknown> {
  if (responseType === "void" || res.status === 204 || res.status === 205) return undefined
  if (responseType === "blob") return res.blob()

  const text = await res.text()
  if (responseType === "text") return text
  if (!text) return undefined

  const contentType = res.headers.get("content-type") ?? ""
  try {
    return JSON.parse(text) as unknown
  } catch (cause) {
    if (contentType.includes("json") || res.ok) {
      throw new ApiError({
        code: "PARSE",
        message: DEFAULT_ERROR_MESSAGES.PARSE,
        status: res.status,
        raw: text,
        cause,
      })
    }
    return text // body error berupa teks polos (mis. dari proxy/nginx)
  }
}

async function toApiError(res: Response, method: HttpMethod, path: string): Promise<ApiError> {
  let raw: unknown
  try {
    raw = await parseBody(res, "json")
  } catch (err) {
    raw = err instanceof ApiError ? err.raw : undefined
  }
  const { message, backendCode, validationMessages } = parseErrorBody(raw)
  const code = codeFromStatus(res.status, Boolean(validationMessages?.length))
  return new ApiError({
    code,
    status: res.status,
    message: message ?? DEFAULT_ERROR_MESSAGES[code],
    backendCode,
    validationMessages,
    raw,
    method,
    path,
  })
}

// ------------------------------------------------------------------
// Refresh token — single-flight
// ------------------------------------------------------------------

const REFRESH_PATH = "/v1/auth/refresh"
let refreshInFlight: Promise<string | null> | null = null

/** Ambil access token dari body refresh — toleran terhadap beberapa penamaan umum. */
function extractAccessToken(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null
  const rec = body as Record<string, unknown>
  const candidates = [rec.accessToken, rec.access_token, (rec.data as Record<string, unknown> | undefined)?.accessToken]
  return candidates.find((v): v is string => typeof v === "string" && v.length > 0) ?? null
}

/**
 * Coba perbarui access token. Resolve `string` bila berhasil, `null` bila
 * refresh ditolak (sesi memang habis). Melempar hanya untuk kegagalan jaringan
 * — supaya offline sesaat TIDAK dianggap "sesi berakhir" dan tidak me-logout user.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(await deviceHeaders()),
    }
    const storedRefresh = await getRefreshToken()
    if (storedRefresh) headers["X-Refresh-Token"] = storedRefresh

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(buildUrl(REFRESH_PATH), {
        method: "POST",
        headers,
        body: "{}", // RefreshTokenDto kosong
        credentials: "include", // cookie kahade_refresh_token
        signal: controller.signal,
      })
    } catch (cause) {
      throw networkError(cause, controller.signal.aborted, "POST", REFRESH_PATH)
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) {
      // 401/403 = refresh token tidak valid → sesi habis. 5xx → biarkan pemanggil menilai.
      if (res.status >= 500) throw await toApiError(res, "POST", REFRESH_PATH)
      return null
    }

    const body = await parseBody(res, "json")
    const token = extractAccessToken(body)
    if (!token) return null
    await setAccessToken(token)
    return token
  })().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

async function handleSessionExpired(): Promise<void> {
  await clearSession()
  emitSessionExpired()
}

// ------------------------------------------------------------------
// Error jaringan
// ------------------------------------------------------------------

function networkError(cause: unknown, timedOut: boolean, method: HttpMethod, path: string): ApiError {
  const isAbort = typeof cause === "object" && cause !== null && (cause as { name?: string }).name === "AbortError"
  if (timedOut || isAbort) {
    return new ApiError({
      code: timedOut ? "TIMEOUT" : "UNKNOWN",
      message: timedOut ? DEFAULT_ERROR_MESSAGES.TIMEOUT : "Permintaan dibatalkan.",
      method,
      path,
      cause,
    })
  }
  return new ApiError({ code: "NETWORK", message: DEFAULT_ERROR_MESSAGES.NETWORK, method, path, cause })
}

// ------------------------------------------------------------------
// request()
// ------------------------------------------------------------------

export async function request<TResponse = unknown, TBody = undefined>(
  path: string,
  options: RequestOptions<TBody> = {},
): Promise<TResponse> {
  const {
    method = "GET",
    body,
    formData,
    query,
    auth = "optional",
    headers: extraHeaders,
    timeoutMs = API_TIMEOUT_MS,
    signal,
    responseType = "json",
    retry = 0,
  } = options

  if (body !== undefined && formData) {
    throw new Error("[kahade/api] `body` dan `formData` tidak boleh dipakai bersamaan")
  }

  const url = buildUrl(path, query)

  const send = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(await deviceHeaders()),
      ...extraHeaders,
    }
    if (body !== undefined) headers["Content-Type"] = "application/json"
    if (token && auth !== "none") headers.Authorization = `Bearer ${token}`

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    const onOuterAbort = () => controller.abort()
    signal?.addEventListener("abort", onOuterAbort, { once: true })

    try {
      return await fetch(url, {
        method,
        headers,
        body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
        credentials: "include",
        signal: controller.signal,
      })
    } catch (cause) {
      throw networkError(cause, timedOut, method, path)
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener("abort", onOuterAbort)
    }
  }

  const attempt = async (): Promise<TResponse> => {
    let token = auth === "none" ? null : await getAccessToken()

    if (auth === "required" && !token) {
      token = await refreshAccessToken()
      if (!token) {
        await handleSessionExpired()
        throw new ApiError({ code: "UNAUTHORIZED", message: DEFAULT_ERROR_MESSAGES.UNAUTHORIZED, method, path })
      }
    }

    let res = await send(token)

    if (res.status === 401 && auth !== "none") {
      const fresh = await refreshAccessToken()
      if (!fresh) {
        await handleSessionExpired()
        throw await toApiError(res, method, path)
      }
      res = await send(fresh)
    }

    if (!res.ok) throw await toApiError(res, method, path)
    return (await parseBody(res, responseType)) as TResponse
  }

  let remaining = retry
  for (;;) {
    try {
      return await attempt()
    } catch (err) {
      if (remaining > 0 && err instanceof ApiError && err.isTransient && !signal?.aborted) {
        remaining -= 1
        await new Promise((r) => setTimeout(r, 400 * (retry - remaining)))
        continue
      }
      throw err
    }
  }
}

// ------------------------------------------------------------------
// Shortcut per method — tipe response WAJIB dinyatakan pemanggil
// ------------------------------------------------------------------

type NoBody = Omit<RequestOptions<undefined>, "method" | "body">
type WithBody<TBody> = Omit<RequestOptions<TBody>, "method" | "body">

export const http = {
  get: <TResponse>(path: string, options?: NoBody) => request<TResponse>(path, { ...options, method: "GET" }),
  delete: <TResponse>(path: string, options?: NoBody) => request<TResponse>(path, { ...options, method: "DELETE" }),
  post: <TResponse, TBody = undefined>(path: string, body?: TBody, options?: WithBody<TBody>) =>
    request<TResponse, TBody>(path, { ...options, method: "POST", body }),
  put: <TResponse, TBody = undefined>(path: string, body?: TBody, options?: WithBody<TBody>) =>
    request<TResponse, TBody>(path, { ...options, method: "PUT", body }),
  patch: <TResponse, TBody = undefined>(path: string, body?: TBody, options?: WithBody<TBody>) =>
    request<TResponse, TBody>(path, { ...options, method: "PATCH", body }),
}
