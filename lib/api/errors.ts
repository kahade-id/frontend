/**
 * Kahade — bentuk Error yang KONSISTEN untuk semua kegagalan API.
 *
 * Kenapa perlu (non-obvious): `fetch` gagal dengan 3 cara berbeda — TypeError
 * (offline), AbortError (timeout), dan response non-2xx (yang bukan error di
 * mata fetch). Screen tidak boleh membedakan ketiganya sendiri; semuanya
 * dinormalisasi menjadi satu `ApiError` dengan `code` yang stabil untuk
 * dipetakan ke copy UI (<ErrorState>, <Toast>, <Field error>).
 *
 * Catatan jujur soal spec: docs/api/kahade-api-mobile.json TIDAK
 * mendokumentasikan response error apa pun — tidak ada `error_code`, tidak ada
 * schema 4xx/5xx. Yang kita pegang adalah format standar NestJS
 * (`{ statusCode, message, error }`) karena spec ini dihasilkan oleh
 * @nestjs/swagger. `message` bisa string ATAU string[] (class-validator).
 * Bila backend kelak menambah field kode (`code` / `errorCode` / `error_code`),
 * `parseErrorBody` sudah membacanya ke `backendCode` tanpa perubahan lain.
 */

/** Kode stabil untuk dipetakan ke UI — TIDAK bergantung pada wording backend. */
export type ApiErrorCode =
  | "NETWORK" // offline / DNS / TLS — request tidak pernah sampai
  | "TIMEOUT" // melewati API_TIMEOUT_MS
  | "BAD_REQUEST" // 400 non-validasi
  | "VALIDATION" // 400 dengan message[] dari class-validator
  | "UNAUTHORIZED" // 401 — sesi habis dan refresh gagal
  | "FORBIDDEN" // 403 — login OK tapi tidak berhak (KYC belum, bukan pemilik)
  | "NOT_FOUND" // 404
  | "CONFLICT" // 409 — username/email sudah dipakai, state order tidak valid
  | "PAYLOAD_TOO_LARGE" // 413 — upload melebihi batas
  | "UNPROCESSABLE" // 422
  | "RATE_LIMITED" // 429 — OTP/login throttling
  | "SERVER" // 5xx
  | "PARSE" // body bukan JSON padahal diharapkan JSON
  | "UNKNOWN"

export type ApiErrorInit = {
  code: ApiErrorCode
  message: string
  status?: number
  /** Kode mentah dari backend bila ada (`code` | `errorCode` | `error_code`) */
  backendCode?: string
  /** Pesan-pesan validasi per field dari class-validator, apa adanya */
  validationMessages?: string[]
  /** Body respons mentah (untuk log/debug — JANGAN tampilkan ke user) */
  raw?: unknown
  method?: string
  path?: string
  cause?: unknown
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number | undefined
  readonly backendCode: string | undefined
  readonly validationMessages: string[] | undefined
  readonly raw: unknown
  readonly method: string | undefined
  readonly path: string | undefined

  constructor(init: ApiErrorInit) {
    super(init.message, init.cause !== undefined ? { cause: init.cause } : undefined)
    this.name = "ApiError"
    this.code = init.code
    this.status = init.status
    this.backendCode = init.backendCode
    this.validationMessages = init.validationMessages
    this.raw = init.raw
    this.method = init.method
    this.path = init.path
  }

  /** Sesi tidak valid — UI harus ke layar login */
  get isAuthError(): boolean {
    return this.code === "UNAUTHORIZED"
  }

  /** Aman untuk retry otomatis (tidak mengubah state server) */
  get isTransient(): boolean {
    return this.code === "NETWORK" || this.code === "TIMEOUT" || this.code === "SERVER"
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}

// ------------------------------------------------------------------
// Parsing body error backend (format NestJS)
// ------------------------------------------------------------------

type NestErrorBody = {
  statusCode?: number
  message?: string | string[]
  error?: string
  code?: string
  errorCode?: string
  error_code?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

export function parseErrorBody(body: unknown): {
  message: string | undefined
  backendCode: string | undefined
  validationMessages: string[] | undefined
} {
  const rec = asRecord(body) as NestErrorBody | null
  if (!rec) {
    return {
      message: typeof body === "string" && body.trim() ? body.trim() : undefined,
      backendCode: undefined,
      validationMessages: undefined,
    }
  }

  // Beberapa backend membungkus error di `{ error: { code, message } }`
  const nested = asRecord(rec.error) as NestErrorBody | null
  const src: NestErrorBody = nested ?? rec

  const rawMessage = src.message ?? rec.message
  const validationMessages = Array.isArray(rawMessage)
    ? rawMessage.filter((m): m is string => typeof m === "string")
    : undefined
  const message = Array.isArray(rawMessage)
    ? validationMessages?.[0]
    : typeof rawMessage === "string"
      ? rawMessage
      : typeof rec.error === "string"
        ? rec.error
        : undefined

  const backendCode = [src.code, src.errorCode, src.error_code, rec.code, rec.errorCode, rec.error_code].find(
    (c): c is string => typeof c === "string" && c.length > 0,
  )

  return { message, backendCode, validationMessages }
}

export function codeFromStatus(status: number, hasValidationMessages: boolean): ApiErrorCode {
  if (status === 400) return hasValidationMessages ? "VALIDATION" : "BAD_REQUEST"
  if (status === 401) return "UNAUTHORIZED"
  if (status === 403) return "FORBIDDEN"
  if (status === 404) return "NOT_FOUND"
  if (status === 409) return "CONFLICT"
  if (status === 413) return "PAYLOAD_TOO_LARGE"
  if (status === 422) return "UNPROCESSABLE"
  if (status === 429) return "RATE_LIMITED"
  if (status >= 500) return "SERVER"
  return "UNKNOWN"
}

/**
 * Copy default Bahasa Indonesia per kode — dipakai bila backend tidak memberi
 * `message` yang layak tampil. Screen boleh override per konteks.
 */
export const DEFAULT_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  NETWORK: "Tidak ada koneksi internet. Periksa jaringan lalu coba lagi.",
  TIMEOUT: "Server terlalu lama merespons. Coba lagi sebentar.",
  BAD_REQUEST: "Permintaan tidak valid.",
  VALIDATION: "Ada data yang belum benar. Periksa kembali isian Anda.",
  UNAUTHORIZED: "Sesi Anda telah berakhir. Silakan masuk kembali.",
  FORBIDDEN: "Anda tidak memiliki akses untuk tindakan ini.",
  NOT_FOUND: "Data tidak ditemukan.",
  CONFLICT: "Data bentrok dengan yang sudah ada.",
  PAYLOAD_TOO_LARGE: "Ukuran berkas terlalu besar.",
  UNPROCESSABLE: "Permintaan tidak dapat diproses.",
  RATE_LIMITED: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.",
  SERVER: "Terjadi gangguan di server kami. Coba lagi nanti.",
  PARSE: "Respons server tidak dapat dibaca.",
  UNKNOWN: "Terjadi kesalahan. Coba lagi.",
}

/** Pesan siap tampil: pakai message backend bila ada, selain itu default per kode. */
export function userMessage(err: unknown): string {
  if (isApiError(err)) {
    // Untuk error jaringan/server, wording backend (bila ada) biasanya teknis — pakai default.
    if (err.code === "NETWORK" || err.code === "TIMEOUT" || err.code === "SERVER" || err.code === "PARSE") {
      return DEFAULT_ERROR_MESSAGES[err.code]
    }
    return err.message || DEFAULT_ERROR_MESSAGES[err.code]
  }
  return DEFAULT_ERROR_MESSAGES.UNKNOWN
}
