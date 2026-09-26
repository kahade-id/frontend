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
  | "ABORTED" // dibatalkan pemanggil / sesi berubah; bukan error jaringan
  | "BAD_REQUEST" // 400 non-validasi
  | "VALIDATION" // 400 dengan message[] dari class-validator
  | "UNAUTHORIZED" // 401 — sesi habis dan refresh gagal
  | "FORBIDDEN" // 403 — login OK tapi tidak berhak (KYC belum, bukan pemilik)
  | "NOT_FOUND" // 404
  | "CONFLICT" // 409 — username/email sudah dipakai, state order tidak valid
  | "PAYLOAD_TOO_LARGE" // 413 — upload melebihi batas
  | "UNPROCESSABLE" // 422
  | "RATE_LIMITED" // 429 — OTP/login throttling
  | "PIN_RATE_LIMITED" // 403 + code PIN_RATE_LIMITED — kebanyakan salah PIN, kunci 15 menit
  | "SERVER" // 5xx
  | "PARSE" // body bukan JSON padahal diharapkan JSON
  | "UNKNOWN"

/**
 * L-03 (audit escrow 2026-09-24): lapisan redaksi untuk body REQUEST yang
 * masuk ke jalur log/diagnostik — PIN dompet, OTP, password, dan token sesi
 * diganti `"***"`. Body yang DIKIRIM ke server tetap utuh (kontrak
 * `PayOrderDto.pin` wajib); yang disamakan hanya SALINAN untuk inspeksi.
 * Dipakai `ApiError` (field `requestBody`) dan tersedia untuk logger lain.
 */
const SENSITIVE_KEYS =
  /^(?:pin|password|passcode|otp|secret|accessToken|refreshToken|access_token|refresh_token|authorization)$/i

export function redactSensitive<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item)) as unknown as T
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.test(key) ? "***" : redactSensitive(item)
    }
    return out as T
  }
  return value
}

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
  /**
   * L-03 (audit escrow 2026-09-24): salinan body REQUEST untuk diagnostik.
   * WAJIB melewati redaksi — konstruktor memanggil `redactSensitive` apa pun
   * yang diberikan pemanggil, sehingga PIN/OTP/token tidak bisa bocor ke
   * logger/telemetri yang membaca field ini di masa depan.
   */
  requestBody?: unknown
  method?: string
  path?: string
  cause?: unknown
  /**
   * Berapa lama pengguna harus menunggu sebelum mencoba lagi, dari header
   * `Retry-After` (429/503). `undefined` bila server tidak mengirimnya.
   */
  retryAfterMs?: number
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number | undefined
  readonly backendCode: string | undefined
  readonly validationMessages: string[] | undefined
  readonly method: string | undefined
  readonly path: string | undefined
  readonly retryAfterMs: number | undefined

  /**
   * D-11 (audit): body respons mentah disimpan di field privat dan hanya
   * dibuka lewat getter. Sebelumnya `raw` adalah properti biasa, sehingga
   * `JSON.stringify(err)` — atau logger apa pun yang menyerialisasi error —
   * ikut mengirim body tersebut, yang pada endpoint order/auth bisa memuat
   * data akun. Getter di prototype TIDAK enumerable, jadi tidak ikut
   * serialisasi, sementara pemakaian debug (`err.raw`) tetap bekerja.
   */
  readonly #raw: unknown
  readonly #requestBody: unknown

  constructor(init: ApiErrorInit) {
    super(init.message, init.cause !== undefined ? { cause: init.cause } : undefined)
    this.name = "ApiError"
    this.code = init.code
    this.status = init.status
    this.backendCode = init.backendCode
    this.validationMessages = init.validationMessages
    this.#raw = init.raw
    // L-03: selalu disamarkan di titik ini — jaring pengaman terakhir sebelum
    // body request (bisa berisi PIN) masuk ke jalur log/debug.
    this.#requestBody =
      init.requestBody !== undefined ? redactSensitive(init.requestBody) : undefined
    this.method = init.method
    this.path = init.path
    this.retryAfterMs = init.retryAfterMs
  }

  /** Body respons mentah — untuk log/debug; JANGAN tampilkan ke user. */
  get raw(): unknown {
    return this.#raw
  }

  /** Body request dengan nilai sensitif sudah `***` — untuk log/debug. */
  get requestBody(): unknown {
    return this.#requestBody
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

/**
 * R2 (audit escrow ronde-2, butir #1–#16, #19): klasifikasi "kegagalan TAK
 * PASTI" untuk mutasi — jaringan/timeout/PARSE/ABORTED/non-ApiError berarti
 * perubahan MUNGKIN sudah terjadi di server meski respons hilang.
 *
 * Pola ini sebelumnya tersalin inline di `handlePayPin` / `handlePayQris` /
 * `handleSubmitProof` (ronde-1) tetapi belum ada di seluruh handler mutasi
 * sengketa/ekstensi/order-link/rating/template — dipusatkan di sini supaya
 * setiap mutasi uang memakai definisi yang sama. UI yang menampilkan cabang
 * ini tidak boleh menuduh "gagal" saat nasib mutasi tidak diketahui.
 */
export function isUncertainMutationError(err: unknown): boolean {
  return (
    !isApiError(err) ||
    err.isTransient ||
    err.code === "ABORTED" ||
    err.code === "PARSE"
  )
}

// ------------------------------------------------------------------
// Parsing body error backend (format NestJS)
// ------------------------------------------------------------------

type NestErrorBody = {
  statusCode?: number
  message?: string | string[]
  error?: unknown
  errors?: unknown
  code?: string
  errorCode?: string
  error_code?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * Batas panjang pesan backend yang boleh sampai ke UI (D-10 audit).
 *
 * Pesan class-validator bersarang bisa ribuan karakter dan memuat jalur
 * internal (nama DTO, aturan, indeks array). Itu berguna di log, bukan di
 * toast: di UI ia mendorong tombol keluar layar dan membocorkan detail yang
 * tidak perlu. 300 karakter cukup untuk pesan manusia paling panjang.
 */
const USER_MESSAGE_MAX = 300

/** Potong pesan untuk UI tanpa memotong di tengah kata terakhir. */
function toUserMessage(value: string): string {
  const text = value.trim()
  if (text.length <= USER_MESSAGE_MAX) return text
  const cut = text.slice(0, USER_MESSAGE_MAX)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > USER_MESSAGE_MAX * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export function parseErrorBody(body: unknown): {
  message: string | undefined
  backendCode: string | undefined
  validationMessages: string[] | undefined
} {
  const rec = asRecord(body) as NestErrorBody | null
  if (!rec) {
    return {
      message:
        typeof body === "string" && body.trim() && !/<[a-z!/]/i.test(body)
          ? body.trim().slice(0, 500)
          : undefined,
      backendCode: undefined,
      validationMessages: undefined,
    }
  }

  // Beberapa backend membungkus error di `{ error: { code, message } }`
  const nested = (asRecord(rec.errors) ?? asRecord(rec.error)) as NestErrorBody | null
  const src: NestErrorBody = nested ?? rec

  const rawMessage = src.message ?? rec.message
  // D-10 (audit): `validationMessages` dipakai layar/form untuk menampilkan
  // alasan per field — panjangnya dibatasi dengan aturan yang sama seperti
  // pesan tunggal supaya jalur array tidak jadi celah.
  const validationMessages = Array.isArray(rawMessage)
    ? rawMessage.filter((m): m is string => typeof m === "string").map(toUserMessage)
    : undefined
  const message = Array.isArray(rawMessage)
    ? validationMessages?.[0]
    : typeof rawMessage === "string"
      ? toUserMessage(rawMessage)
      : typeof rec.error === "string"
        ? toUserMessage(rec.error)
        : undefined

  const backendCode = [
    src.code,
    src.errorCode,
    src.error_code,
    rec.code,
    rec.errorCode,
    rec.error_code,
  ].find((c): c is string => typeof c === "string" && c.length > 0)

  return { message, backendCode, validationMessages }
}

/**
 * M-35 (audit end-to-end 2026-09-24, issue #81): petakan kode mentah backend
 * (`code`/`errorCode`/`error_code`) ke `ApiErrorCode` yang dikenal sistem —
 * dipakai `unwrapResponse` untuk klasifikasi `success:false` tanpa kunci error.
 * Kode tak dikenal → `undefined` (pemanggil memakai BAD_REQUEST/VALIDATION).
 */
export function codeFromBackend(backendCode: string | undefined): ApiErrorCode | undefined {
  if (!backendCode) return undefined
  const k = backendCode.toUpperCase().replace(/[^A-Z0-9]+/g, "_")
  // Urutan penting: "INVALID_TOKEN" mengandung "VALID" — cek sesi dulu.
  // PIN_RATE_LIMITED dicek sebelum FORBIDDEN agar pesan klien yang jelas
  // (tunggu 15 menit) dipakai, bukan "tidak memiliki akses".
  if (k.includes("PIN") && k.includes("RATE_LIMIT")) return "PIN_RATE_LIMITED"
  if (
    k.includes("UNAUTHORIZED") ||
    k.includes("INVALID_TOKEN") ||
    k.includes("TOKEN_EXPIRED") ||
    k.includes("SESSION_EXPIRED")
  )
    return "UNAUTHORIZED"
  if (k.includes("FORBIDDEN") || k.includes("KYC")) return "FORBIDDEN"
  if (k.includes("NOT_FOUND") || k === "NO_SUCH_ENTITY") return "NOT_FOUND"
  if (k.includes("CONFLICT") || k.includes("ALREADY") || k.includes("DUPLICATE")) return "CONFLICT"
  if (k.includes("TIMEOUT") || k.includes("TIMED_OUT")) return "TIMEOUT"
  if (k.includes("VALID")) return "VALIDATION"
  return undefined
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
  ABORTED: "Permintaan dibatalkan.",
  BAD_REQUEST: "Permintaan tidak valid.",
  VALIDATION: "Ada data yang belum benar. Periksa kembali isian Anda.",
  UNAUTHORIZED: "Sesi Anda telah berakhir. Silakan masuk kembali.",
  FORBIDDEN: "Anda tidak memiliki akses untuk tindakan ini.",
  NOT_FOUND: "Data tidak ditemukan.",
  CONFLICT: "Data bentrok dengan yang sudah ada.",
  PAYLOAD_TOO_LARGE: "Ukuran berkas terlalu besar.",
  UNPROCESSABLE: "Permintaan tidak dapat diproses.",
  RATE_LIMITED: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.",
  PIN_RATE_LIMITED: "Terlalu banyak percobaan PIN. Tunggu 15 menit lalu coba lagi.",
  SERVER: "Terjadi gangguan di server kami. Coba lagi nanti.",
  PARSE: "Respons server tidak dapat dibaca.",
  UNKNOWN: "Terjadi kesalahan. Coba lagi.",
}

/** Pesan siap tampil: pakai message backend bila ada, selain itu default per kode. */
export function userMessage(err: unknown): string {
  if (isApiError(err)) {
    // Rate-limit PIN selalu pakai copy ID klien yang jelas — pesan backend
    // berbahasa Inggris dan tidak menyebut durasi kunci. Dicek lewat code
    // maupun backendCode karena error HTTP dinormalisasi via codeFromStatus
    // (403 → FORBIDDEN) sementara kode backend mentah tersimpan terpisah.
    if (isPinRateLimited(err)) return DEFAULT_ERROR_MESSAGES.PIN_RATE_LIMITED
    // Untuk error jaringan/server, wording backend (bila ada) biasanya teknis — pakai default.
    if (
      err.code === "NETWORK" ||
      err.code === "TIMEOUT" ||
      err.code === "SERVER" ||
      err.code === "PARSE"
    ) {
      return DEFAULT_ERROR_MESSAGES[err.code]
    }
    return err.message || DEFAULT_ERROR_MESSAGES[err.code]
  }
  return DEFAULT_ERROR_MESSAGES.UNKNOWN
}

/**
 * true bila error ini adalah rate-limit PIN (kunci 15 menit).
 * Dicek lewat `code` (jalur `success:false`) maupun `backendCode` mentah
 * (jalur error HTTP — `toApiError` memetakan 403 ke FORBIDDEN generik).
 */
export function isPinRateLimited(err: unknown): boolean {
  if (!isApiError(err)) return false
  if (err.code === "PIN_RATE_LIMITED") return true
  const k = (err.backendCode ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "_")
  return k.includes("PIN") && k.includes("RATE_LIMIT")
}

/**
 * Parse header `Retry-After` → milidetik.
 *
 * Header ini punya dua bentuk sah (RFC 9110 §10.2.3): delta-detik
 * (`Retry-After: 120`) atau tanggal HTTP (`Retry-After: Wed, 21 Oct 2026
 * 07:28:00 GMT`). Keduanya dipakai server rate-limit; hanya membaca bentuk
 * pertama berarti separuh kasus tetap tanpa hitung mundur.
 *
 * Dibatasi 24 jam: tanggal yang salah/tanggal masa lalu tidak boleh membuat UI
 * menampilkan hitung mundur absurd. `undefined` bila header tidak ada/rusak.
 */
export function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined
  const value = headerValue.trim()
  if (!value) return undefined
  const MAX_MS = 24 * 60 * 60 * 1000
  if (/^\d+$/.test(value)) {
    const seconds = Number(value)
    return seconds > 0 ? Math.min(seconds * 1000, MAX_MS) : undefined
  }
  const dateMs = Date.parse(value)
  if (Number.isNaN(dateMs)) return undefined
  const delta = dateMs - Date.now()
  return delta > 0 ? Math.min(delta, MAX_MS) : undefined
}
