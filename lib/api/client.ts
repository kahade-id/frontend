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
import {
  ApiError,
  codeFromStatus,
  DEFAULT_ERROR_MESSAGES,
  parseErrorBody,
  parseRetryAfterMs,
} from "@/lib/api/errors"
import { asRecord, invalidResponse, unwrapResponse } from "@/lib/api/response"
import { recordServerDate } from "@/lib/server-time"
import { recordBackpressure, clearBackpressure } from "@/lib/api/backpressure"
import { invalidateQueryCache } from "@/lib/query-cache"
import { logWarn } from "@/lib/telemetry"
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
  /**
   * D-08 (audit): WAJIB eksplisit. Sebelumnya opsional dengan default
   * `"optional"`, sehingga adapter yang lupa menuliskannya tetap mengirim
   * `X-Device-Id`/`X-Device-Info` (model + OS + versi app) dan cookie
   * (`credentials: "include"`) ke endpoint publik — kebalikan dari maksud
   * komentar minimalisasi data di bawah. Dengan wajib, keputusan "endpoint ini
   * publik atau tidak" tidak bisa diambil tanpa sadar: setiap pemanggil baru
   * harus menyebutkannya, dan mode yang keliru muncul di review, bukan di
   * produksi.
   */
  auth: AuthMode
  headers?: Record<string, string>
  timeoutMs?: number
  signal?: AbortSignal
  responseType?: ResponseType
  /** GET only. Mutations are NEVER automatically retried on network/server errors. */
  retry?: number
}

/** Backend requires a UUID v4 on idempotent mutations (chat, uploads, ratings, etc.). */
export function createIdempotencyKey(): string {
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof cryptoApi?.getRandomValues === "function") cryptoApi.getRandomValues(bytes)
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
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
    // H-06 (audit escrow 2026-09-24): string kosong DILEWATI seperti
    // null/undefined — `buildUrl({status:""})` dulu menembak `?status=` yang
    // membuat backend mengembalikan daftar kosong misterius (bug nyata yang
    // sudah pernah terjadi; kontrak "jangan kirim string kosong" kini berlaku
    // di lapisan transport, bukan hanya ingatan penulis layar).
    if (value === null || value === undefined || value === "") continue
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === null || item === undefined || item === "") continue
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
  // H-05 (audit escrow 2026-09-24): id dengan garis miring/spasi/kontrol
  // DITOLAK, bukan di-encode diam-diam (`a/b` → `a%2Fb` = URL ganda yang
  // 404 tanpa pesan yang bisa ditindaklanjuti). Karakter yang diizinkan untuk
  // segmen identitas (UUID, id `c…`, token base64url) semuanya aman.
  if (/[\\/?#\s]|[\u0000-\u001f]/.test(segment)) {
    throw new ApiError({ code: "BAD_REQUEST", message: "Identitas data tidak valid." })
  }
  return encodeURIComponent(segment)
}

/**
 * L-03 (audit escrow 2026-09-24): lapisan redaksi untuk SALINAN body mutasi
 * yang dipakai jalur log/diagnostik — PIN dompet, OTP, dan token sesi tidak
 * boleh ikut tercatat lewat debug/telemetri masa depan yang membaca body.
 * Body yang DIKIRIM ke server tetap utuh (kontrak `PayOrderDto.pin`);
 * implementasi `redactSensitive` ada di `lib/api/errors.ts` (dipakai
 * konstruktor `ApiError` sebagai jaring pengaman terakhir).
 */
export { redactSensitive } from "@/lib/api/errors"

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
    // 429/503: server sering menyebut berapa lama harus menunggu. Tanpa ini UI
    // hanya bisa bilang "tunggu sebentar" dan pengguna mencoba lagi terlalu
    // cepat, memperpanjang masa throttle-nya sendiri.
    retryAfterMs:
      res.status === 429 || res.status === 503
        ? parseRetryAfterMs(res.headers?.get?.("Retry-After") ?? null)
        : undefined,
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
      // Offset jam server (F-13): header `Date` wajib dari origin (RFC 9110
      // §5.6.7). Di web header ini bisa tidak terekspos CORS — null diabaikan,
      // countdown jatuh ke jam perangkat seperti sebelumnya.
      recordServerDate(response.headers?.get?.("Date"))
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
    // Jalur refresh: cookie HttpOnly `kahade_refresh_token` (utama, web+native
    // dengan credentials include) ATAU body `{ refreshToken }` (cadangan mobile,
    // dibaca controller produksi: req.cookies?.kahade_refresh_token || body?.refreshToken).
    // Header X-Refresh-Token DIHAPUS: tidak pernah dibaca backend dan tidak ada
    // di CORS allowlist — hanya membuang byte.
    const stored = await getRefreshToken()
    const reply = await exchange(
      REFRESH_PATH,
      buildUrl(REFRESH_PATH),
      {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(stored ? { refreshToken: stored } : {}),
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
    const refresh = body?.refreshToken ?? body?.refresh_token
    if (typeof token !== "string" || !token.trim()) throw invalidResponse(REFRESH_PATH)
    if (typeof refresh === "string") await setRefreshToken(refresh)
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
  /**
   * B-07 (audit): pembersihan sesi yang gagal TIDAK boleh menyamarkan galat
   * otentikasi.
   *
   * Sebelumnya promise ini meneruskan hasil `clearSession()` apa adanya. Bila
   * `SecureStore.deleteItemAsync` melempar (Keystore terkunci, penyimpanan
   * penuh), `await expireSession()` di `attempt()` reject → pengguna melihat
   * galat penyimpanan alih-alih UNAUTHORIZED, dan `emitSessionExpired()` di
   * `.finally` di bawah tidak pernah berjalan sehingga sesi habis TANPA
   * redirect ke login. Kegagalannya kini dicatat dan ditelan: penyimpanan
   * akan dicoba dibersihkan lagi pada logout/boot berikutnya.
   */
  const clearing = clearSession().catch((error: unknown) => {
    logWarn("client:expire-cleanup", error)
  })
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
  options: RequestOptions<TBody>,
): Promise<TResponse> {
  if ((options.method ?? "GET") !== "GET")
    return performRequest<TResponse, TBody>(path, options)
  // R2 (audit ronde-2, butir #99): signal TIDAK lagi melewati dedupe. Hampir
  // semua pemanggil (useApiQuery/usePaginatedQuery) memasok AbortSignal, jadi
  // cabang lama membuat dedupe tidak pernah aktif di jalur utama — dua layar
  // mount bersamaan = dua GET identik paralel. Kini request pita dibagikan,
  // dan abort seorang pemanggil hanya melepaskan ACARANYA sendiri (fetch
  // bersama tetap jalan untuk pemanggil lain). Tata urutannya penting: jangan
  // MULAI request pita baru saat satu-satunya pemanggilnya sudah aborted —
  // tanpa gerbang ini fetch menembus jaringan (mengabaikan abort-nya sendiri).
  const { signal, ...shared } = options
  if (signal?.aborted) return Promise.reject(aborted(path))
  const key = JSON.stringify([
    getSessionRevision(),
    buildUrl(path, shared.query),
    shared.auth,
    shared.responseType ?? "json",
    shared.headers,
    shared.timeoutMs,
    shared.retry,
  ])
  const existing = getRequests.get(key)
  const pending = (existing ??
    performRequest<TResponse, TBody>(path, shared as RequestOptions<TBody>).finally(() => {
      if (getRequests.get(key) === pending) getRequests.delete(key)
    })) as Promise<TResponse>
  if (!existing) getRequests.set(key, pending)
  if (!signal) return pending
  if (signal.aborted) return Promise.reject(aborted())
  return new Promise<TResponse>((resolve, reject) => {
    const onAbort = () => reject(aborted())
    signal.addEventListener("abort", onAbort, { once: true })
    pending.then(
      (value) => {
        signal.removeEventListener("abort", onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener("abort", onAbort)
        reject(error)
      },
    )
  })
}

/**
 * C-01 (audit): jalur mutasi yang mengubah saldo/status escrow.
 *
 * Invalidsi cache ditaruh di TRANSPORT, bukan di tiap layar: sebelumnya
 * `invalidateQueryCache()` tidak pernah dipanggil siapa pun — saldo pasca
 * transfer/top-up bisa tampil basi selama jendela TTL 5 detik. Layar tetap
 * boleh memanggilnya lagi (idempoten) untuk mengubah data lewat jalur lain
 * (mis. rekonsiliasi aksi menggantung), tetapi aturan "mutasi uang membatalkan
 * cache GET" tidak lagi bergantung pada ingatan penulis layar.
 *
 * G-01 (audit escrow 2026-09-24): `calculate-fee` dan `validate-counterpart`
 * adalah KALKULASI MURNI (POST tanpa efek samping) — dulu ikut tercakup pola
 * `/v1/orders*` sehingga setiap ketik nominal (debounce 400ms) menyapu SELURUH
 * cache GET aplikasi dan memicu request beruntun di tab lain. Keduanya kini
 * diecualikan secara eksplisit; mutasi state order (pay, process, cancel, …)
 * tetap menyapu cache.
 *
 * I-01 (audit escrow end-to-end 2026-09-24): resolusi bersama sengketa
 * (`/v1/disputes/{id}/mutual-resolution[/…]`) MEMBELAH dana escrow saat
 * diterima (respond ACCEPT) — mutasi uang sejati yang dulu tidak tercakup
 * pola mana pun sehingga saldo/holdBalance tetap basi setelah pembagian dana.
 */
const MONEY_MUTATION_PATTERNS = [
  /^\/v1\/wallet\/(?:topup|withdraw|transfer)(?:\/|$)/,
  /^\/v1\/orders(?:\/|$)/,
  /^\/v1\/disputes\/.+\/mutual-resolution(?:\/|$)/,
]
const PURE_CALCULATION_PATHS = [/^\/v1\/orders\/calculate-fee$/, /^\/v1\/orders\/validate-counterpart$/]

function invalidatesMoneyCache(path: string): boolean {
  if (PURE_CALCULATION_PATHS.some((pattern) => pattern.test(path))) return false
  return MONEY_MUTATION_PATTERNS.some((pattern) => pattern.test(path))
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
    auth,
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
  /**
   * SATU kunci per panggilan logis, dibuat DI SINI (bukan di dalam `send()`).
   *
   * Sebelumnya kunci dibuat ulang setiap kali `send()` jalan. Itu tidak terlihat
   * masalah sampai jalur 401 → refresh → kirim-ulang diperhatikan: percobaan
   * kedua memakai kunci BARU, jadi backend tidak punya cara mengenali keduanya
   * sebagai permintaan yang sama. Untuk mutasi keuangan (bayar pesanan, top-up,
   * withdraw, transfer) kemampuan korelasi itu justru seluruh gunanya
   * `Idempotency-Key`.
   *
   * Aman untuk GET karena GET tetap tidak diberi kunci, dan aman untuk mutasi
   * karena `check-retry.mjs` menjamin mutasi tidak pernah di-retry otomatis —
   * satu-satunya pengiriman ulang adalah setelah 401, yang memang HARUS berbagi
   * kunci.
   */
  /**
   * D-09 (audit): kunci dibuat HANYA bila pemanggil belum menyediakannya.
   * Sebelumnya `crypto.randomUUID()` selalu dipanggil untuk setiap mutasi dan
   * header kiriman pemanggil hanya "tidak ditimpa" — sehingga pola "satu kunci
   * untuk rangkaian percobaan manual" (pemulihan aksi menggantung, J-04) tidak
   * mungkin diterapkan dari luar. Pencocokan header tidak peka huruf besar/kecil
   * karena nama header HTTP memang begitu.
   */
  const providedKey = Object.keys(extraHeaders ?? {}).find(
    (name) => name.toLowerCase() === "idempotency-key",
  )
  const idempotencyKey =
    method !== "GET" && !(providedKey && extraHeaders?.[providedKey])
      ? createIdempotencyKey()
      : null
  const send = async (token: string | null) => {
    checkAborted(signal)
    const headers: Record<string, string> = {
      Accept: "application/json",
      // Minimalisasi data (D-14): identitas perangkat (model+OS) hanya untuk
      // endpoint yang terautentikasi/ber-sesi. Endpoint publik (auth:"none" —
      // showcase feed, order-link, health, legal) tidak memerlukannya, dan
      // mengirimnya ke sana = fingerprinting tanpa manfaat. Jalur refresh
      // tetap mengirim header device (sesi-related; backend memakainya untuk
      // rotasi/kolom perangkat).
      ...(auth === "none" ? {} : await deviceHeaders()),
      ...extraHeaders,
    }
    if (idempotencyKey && !headers["Idempotency-Key"]) headers["Idempotency-Key"] = idempotencyKey
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
          requestBody: body,
        })
      }
    }
    assertSession()
    let reply = await send(token)
    /**
     * C-09 (audit): transport adalah satu-satunya tempat yang melihat 429/503
     * apa pun bentuk callback pemanggilnya — polling yang menelan galatnya
     * sendiri (`lib/unread-count.ts`, `lib/use-qris-payment.ts`, karena mereka
     * menampilkan status inline) tidak pernah melihat `retryAfterMs`. Sinyalnya
     * dicatat di `lib/api/backpressure.ts` supaya `usePolling` melambat, dan
     * dihapus begitu ada respons sukses.
     */
    if (reply.status === 429 || reply.status === 503) {
      recordBackpressure(reply.error?.retryAfterMs)
    } else if (reply.status >= 200 && reply.status < 300) {
      clearBackpressure()
    }
    assertSession()
    if (reply.status === 401 && (auth === "required" || (auth === "optional" && token))) {
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
            requestBody: body,
          })
        )
      }
    }
    if (reply.error) throw reply.error
    // C-01 (audit): mutasi uang/status membatalkan cache GET DI SINI — aturan
    // ini tidak boleh bergantung pada ingatan penulis layar. `invalidateQueryCache`
    // idempoten, jadi layar yang memanggilnya lagi tidak masalah.
    if (method !== "GET" && invalidatesMoneyCache(path)) invalidateQueryCache()
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

// D-08 (audit): `auth` tidak lagi boleh di-omit — lihat catatan di
// RequestOptions. Tipe helper di bawah mewajibkannya untuk semua verb.
type NoBody = Omit<RequestOptions<undefined>, "method" | "body">
type WithBody<TBody> = Omit<RequestOptions<TBody>, "method" | "body">
type RequiredAuth<T> = T & { auth: AuthMode }
export const http = {
  get: <T>(path: string, options: RequiredAuth<NoBody>) =>
    request<T>(path, { ...options, method: "GET" }),
  delete: <T>(path: string, options: RequiredAuth<NoBody>) =>
    request<T>(path, { ...options, method: "DELETE" }),
  post: <T, B = undefined>(path: string, body: B | undefined, options: RequiredAuth<WithBody<B>>) =>
    request<T, B>(path, { ...options, method: "POST", body }),
  put: <T, B = undefined>(path: string, body: B | undefined, options: RequiredAuth<WithBody<B>>) =>
    request<T, B>(path, { ...options, method: "PUT", body }),
  patch: <T, B = undefined>(path: string, body: B | undefined, options: RequiredAuth<WithBody<B>>) =>
    request<T, B>(path, { ...options, method: "PATCH", body }),
}
