/** One HTTP boundary for the app: envelope decoding, auth, cancellation and safe retries. */
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
import { asRecord, invalidResponse, unwrapResponse } from "@/lib/api/response"
import {
  clearSession,
  emitSessionExpired,
  getAccessToken,
  getAppVersion,
  getDeviceId,
  getDeviceInfo,
  getRefreshToken,
  getSessionRevision,
  setAccessToken,
  setRefreshToken,
} from "@/lib/api/session"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
export type QueryPrimitive = string | number | boolean
export type QueryValue = QueryPrimitive | QueryPrimitive[] | null | undefined
export type QueryParams = Record<string, QueryValue>
export type AuthMode = "optional" | "required" | "none"
export type ResponseType = "json" | "text" | "blob" | "void"
export type RequestOptions<TBody = undefined> = {
  method?: HttpMethod
  body?: TBody
  formData?: FormData
  query?: QueryParams
  auth?: AuthMode
  headers?: Record<string, string>
  timeoutMs?: number
  signal?: AbortSignal
  responseType?: ResponseType
  /** GET only. Mutations are NEVER automatically retried on network/server errors. */
  retry?: number
}

export function buildUrl(path: string, query?: QueryParams): string {
  // Prevent accidental credential leakage to a presigned/external URL. Uploads
  // deliberately use a separate unauthenticated transport.
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//")) {
    throw new Error("API request paths must be relative to the configured backend.")
  }
  const base = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`
  const parts: string[] = []
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined) continue
    for (const item of Array.isArray(value) ? value : [value]) {
      if (typeof item === "number" && !Number.isFinite(item))
        throw new Error(`Invalid query: ${key}`)
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`)
    }
  }
  return parts.length ? `${base}${base.includes("?") ? "&" : "?"}${parts.join("&")}` : base
}

export function seg(value: string | number): string {
  const segment = String(value)
  if (
    !segment ||
    segment === "undefined" ||
    segment === "null" ||
    segment === "." ||
    segment === ".."
  ) {
    throw new ApiError({ code: "BAD_REQUEST", message: "Identitas data tidak valid." })
  }
  return encodeURIComponent(segment)
}

async function deviceHeaders(): Promise<Record<string, string>> {
  return {
    [HEADER_DEVICE_ID]: await getDeviceId(),
    [HEADER_DEVICE_INFO]: getDeviceInfo(),
    [HEADER_APP_VERSION]: getAppVersion(),
    [HEADER_PLATFORM]: Platform.OS,
  }
}

function aborted(path?: string) {
  return new ApiError({ code: "ABORTED", message: DEFAULT_ERROR_MESSAGES.ABORTED, path })
}
function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw aborted()
}

/** Timeout includes reading/decoding the body, not just receipt of HTTP headers. */
async function bounded<T>(
  task: (signal: AbortSignal) => Promise<T>,
  method: HttpMethod,
  path: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  checkAborted(signal)
  const controller = new AbortController()
  let timedOut = false
  let rejectAbort: (error: ApiError) => void = () => undefined
  const interruption = new Promise<never>((_, reject) => {
    rejectAbort = reject
  })
  const interrupt = () => {
    controller.abort()
    rejectAbort(
      new ApiError({
        code: timedOut ? "TIMEOUT" : "ABORTED",
        message: DEFAULT_ERROR_MESSAGES[timedOut ? "TIMEOUT" : "ABORTED"],
        method,
        path,
      }),
    )
  }
  const timer = setTimeout(() => {
    timedOut = true
    interrupt()
  }, timeoutMs)
  signal?.addEventListener("abort", interrupt, { once: true })
  try {
    return await Promise.race([task(controller.signal), interruption])
  } catch (cause) {
    if (cause instanceof ApiError) throw cause
    if (controller.signal.aborted) {
      throw new ApiError({
        code: timedOut ? "TIMEOUT" : "ABORTED",
        message: DEFAULT_ERROR_MESSAGES[timedOut ? "TIMEOUT" : "ABORTED"],
        method,
        path,
        cause,
      })
    }
    throw new ApiError({
      code: "NETWORK",
      message: DEFAULT_ERROR_MESSAGES.NETWORK,
      method,
      path,
      cause,
    })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", interrupt)
  }
}

async function parseBody(res: Response, type: ResponseType): Promise<unknown> {
  if (type === "void" || res.status === 204 || res.status === 205) return undefined
  if (type === "blob") return res.blob()
  const text = await res.text()
  if (type === "text") return text
  if (!text.trim()) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch (cause) {
    throw new ApiError({
      code: "PARSE",
      message: DEFAULT_ERROR_MESSAGES.PARSE,
      status: res.status,
      raw: text,
      cause,
    })
  }
}

async function toApiError(res: Response, method: HttpMethod, path: string): Promise<ApiError> {
  let raw: unknown
  try {
    raw = await parseBody(res, "json")
  } catch (error) {
    raw = error instanceof ApiError ? error.raw : undefined
  }
  const parsed = parseErrorBody(raw)
  const code = codeFromStatus(res.status, Boolean(parsed.validationMessages?.length))
  return new ApiError({
    code,
    status: res.status,
    message: parsed.message ?? DEFAULT_ERROR_MESSAGES[code],
    backendCode: parsed.backendCode,
    validationMessages: parsed.validationMessages,
    raw,
    method,
    path,
  })
}

type Reply = { status: number; value?: unknown; error?: ApiError }
async function exchange(
  path: string,
  url: string,
  init: RequestInit,
  type: ResponseType,
  timeout: number,
  signal?: AbortSignal,
): Promise<Reply> {
  const method = init.method as HttpMethod
  return bounded(
    async (innerSignal) => {
      const response = await fetch(url, { ...init, signal: innerSignal })
      if (!response.ok)
        return { status: response.status, error: await toApiError(response, method, path) }
      const body = await parseBody(response, type)
      return { status: response.status, value: type === "json" ? unwrapResponse(body) : body }
    },
    method,
    path,
    timeout,
    signal,
  )
}

const REFRESH_PATH = "/v1/auth/refresh"
let refreshInFlight: { revision: number; promise: Promise<string | null> } | null = null

/** Cookie refresh remains single-flight; 429/offline/5xx MUST NOT log the user out. */
export function refreshAccessToken(): Promise<string | null> {
  const revision = getSessionRevision()
  if (refreshInFlight?.revision === revision) return refreshInFlight.promise
  const promise = (async () => {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(await deviceHeaders()),
    }
    const stored = await getRefreshToken()
    if (stored) headers["X-Refresh-Token"] = stored
    const reply = await exchange(
      REFRESH_PATH,
      buildUrl(REFRESH_PATH),
      {
        method: "POST",
        headers,
        credentials: "include",
        body: "{}",
      },
      "json",
      API_TIMEOUT_MS,
    )
    if (revision !== getSessionRevision()) throw aborted(REFRESH_PATH)
    if (reply.error) {
      if (reply.status === 401 || reply.status === 403) return null
      throw reply.error
    }
    const body = asRecord(reply.value)
    const token = body?.accessToken ?? body?.access_token
    if (typeof token !== "string" || !token.trim()) throw invalidResponse(REFRESH_PATH)
    if (typeof body?.refreshToken === "string") await setRefreshToken(body.refreshToken)
    if (revision !== getSessionRevision()) throw aborted(REFRESH_PATH)
    await setAccessToken(token)
    if (revision !== getSessionRevision()) throw aborted(REFRESH_PATH)
    return token
  })().finally(() => {
    if (refreshInFlight?.promise === promise) refreshInFlight = null
  })
  refreshInFlight = { revision, promise }
  return promise
}

let expiration: { revision: number; promise: Promise<void> } | null = null
function expireSession(revision: number): Promise<void> {
  if (revision !== getSessionRevision()) return Promise.resolve()
  if (expiration?.revision === revision) return expiration.promise
  const clearing = clearSession()
  const clearedRevision = getSessionRevision()
  const promise = clearing.finally(() => {
    // Delayed storage cleanup must not emit an expiry event for a NEW login.
    if (getSessionRevision() === clearedRevision) emitSessionExpired()
    if (expiration?.promise === promise) expiration = null
  })
  expiration = { revision, promise }
  return promise
}

const getRequests = new Map<string, Promise<unknown>>()

/** Dedupe identical in-flight GETs. No persisted response cache; no cross-account data. */
export function request<TResponse = unknown, TBody = undefined>(
  path: string,
  options: RequestOptions<TBody> = {},
): Promise<TResponse> {
  if ((options.method ?? "GET") !== "GET" || options.signal)
    return performRequest<TResponse, TBody>(path, options)
  const key = JSON.stringify([
    getSessionRevision(),
    buildUrl(path, options.query),
    options.auth ?? "optional",
    options.responseType ?? "json",
    options.headers,
    options.timeoutMs,
    options.retry,
  ])
  const existing = getRequests.get(key)
  if (existing) return existing as Promise<TResponse>
  const pending = performRequest<TResponse, TBody>(path, options).finally(() => {
    if (getRequests.get(key) === pending) getRequests.delete(key)
  })
  getRequests.set(key, pending)
  return pending
}

async function performRequest<TResponse, TBody>(
  path: string,
  options: RequestOptions<TBody>,
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
  } = options
  if (body !== undefined && formData)
    throw new Error("body dan formData tidak boleh dipakai bersamaan")
  if (typeof FormData !== "undefined" && body instanceof FormData)
    throw new Error("Multipart harus memakai opsi formData, bukan body JSON.")
  checkAborted(signal)
  const url = buildUrl(path, query)
  const revision = getSessionRevision()
  const send = async (token: string | null) => {
    checkAborted(signal)
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(await deviceHeaders()),
      ...extraHeaders,
    }
    if (body !== undefined) headers["Content-Type"] = "application/json"
    if (formData)
      for (const name of Object.keys(headers))
        if (name.toLowerCase() === "content-type") delete headers[name]
    if (token && auth !== "none") headers.Authorization = `Bearer ${token}`
    checkAborted(signal)
    return exchange(
      path,
      url,
      {
        method,
        headers,
        body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
        credentials: "include",
      },
      responseType,
      timeoutMs,
      signal,
    )
  }
  const assertSession = () => {
    if (auth !== "none" && revision !== getSessionRevision()) throw aborted(path)
  }
  const attempt = async (): Promise<TResponse> => {
    checkAborted(signal)
    let token = auth === "none" ? null : await getAccessToken()
    if (auth === "required" && !token) {
      token = await refreshAccessToken()
      checkAborted(signal)
      assertSession()
      if (!token) {
        await expireSession(revision)
        throw new ApiError({
          code: "UNAUTHORIZED",
          message: DEFAULT_ERROR_MESSAGES.UNAUTHORIZED,
          method,
          path,
        })
      }
    }
    assertSession()
    let reply = await send(token)
    assertSession()
    if (reply.status === 401 && auth !== "none") {
      // A concurrent request may already have rotated this exact access token.
      const current = await getAccessToken()
      const fresh = current && current !== token ? current : await refreshAccessToken()
      checkAborted(signal)
      assertSession()
      if (fresh) reply = await send(fresh)
      assertSession()
      if (!fresh || reply.status === 401) {
        await expireSession(revision)
        throw (
          reply.error ??
          new ApiError({
            code: "UNAUTHORIZED",
            message: DEFAULT_ERROR_MESSAGES.UNAUTHORIZED,
            method,
            path,
          })
        )
      }
    }
    if (reply.error) throw reply.error
    return reply.value as TResponse
  }
  const retry = method === "GET" ? Math.min(2, Math.max(0, options.retry ?? 0)) : 0
  for (let count = 0; ; count += 1) {
    try {
      return await attempt()
    } catch (error) {
      if (count >= retry || !(error instanceof ApiError) || !error.isTransient || signal?.aborted)
        throw error
      await bounded(
        () => new Promise<void>((resolve) => setTimeout(resolve, 400 * (count + 1))),
        method,
        path,
        timeoutMs,
        signal,
      )
    }
  }
}

type NoBody = Omit<RequestOptions<undefined>, "method" | "body">
type WithBody<TBody> = Omit<RequestOptions<TBody>, "method" | "body">
export const http = {
  get: <T>(path: string, options?: NoBody) => request<T>(path, { ...options, method: "GET" }),
  delete: <T>(path: string, options?: NoBody) => request<T>(path, { ...options, method: "DELETE" }),
  post: <T, B = undefined>(path: string, body?: B, options?: WithBody<B>) =>
    request<T, B>(path, { ...options, method: "POST", body }),
  put: <T, B = undefined>(path: string, body?: B, options?: WithBody<B>) =>
    request<T, B>(path, { ...options, method: "PUT", body }),
  patch: <T, B = undefined>(path: string, body?: B, options?: WithBody<B>) =>
    request<T, B>(path, { ...options, method: "PATCH", body }),
}
