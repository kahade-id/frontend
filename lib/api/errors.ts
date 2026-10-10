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

import {
  ACTIVE_ORDERS_PRESENT,
  BANK_ACCOUNT_VERIFICATION_FAILED,
  CHAT_MESSAGE_LOCKED_DISPUTE,
  DISPLAYABLE_BACKEND_MESSAGES,
  ESCROW_BALANCE_PRESENT,
  NOT_ORDER_PARTICIPANT,
  ORDER_NOT_FOUND,
  REAUTH_INVALID_PASSWORD,
  REAUTH_PASSWORD_REQUIRED,
  REAUTH_TOO_MANY_ATTEMPTS,
  REAUTH_UNAVAILABLE,
  SUBSCRIPTION_NOT_FOUND,
  WALLET_BALANCE_PRESENT,
  WALLET_PIN_NOT_SET,
} from "@/lib/api/error-codes"

/** BFI-059: satu field error validasi dari backend (`errors.fields`). */
export type FieldError = {
  /** Nama field dari backend (mis. `phoneNumber`) — tanpa target/value (PII). */
  field: string
  /** Pesan validasi untuk field ini (sudah dipotong agar aman tampil). */
  messages: string[]
}

/** Kode stabil untuk dipetakan ke UI — TIDAK bergantung pada wording backend. */
export type ApiErrorCode =
  | "NETWORK" // offline / DNS / TLS — request tidak pernah sampai
  | "TIMEOUT" // melewati API_TIMEOUT_MS
  | "ABORTED" // dibatalkan pemanggil / sesi berubah; bukan error jaringan
  | "BAD_REQUEST" // 400 non-validasi
  | "VALIDATION" // 400 dengan message[] dari class-validator
  | "UNAUTHORIZED" // 401 — sesi habis dan refresh gagal
  | "ACCOUNT_LOCKED" // 401 + code ACCOUNT_LOCKED — akun terkunci sementara (terlalu banyak gagal login)
  | "FORBIDDEN" // 403 — login OK tapi tidak berhak (KYC belum, bukan pemilik)
  | "NOT_FOUND" // 404
  | "CONFLICT" // 409 — username/email sudah dipakai, state order tidak valid
  | "PAYLOAD_TOO_LARGE" // 413 — upload melebihi batas
  | "UNPROCESSABLE" // 422
  | "RATE_LIMITED" // 429 — OTP/login throttling
  | "PIN_RATE_LIMITED" // 403 + code PIN_RATE_LIMITED — kebanyakan salah PIN, kunci 15 menit
  | "SERVER" // 5xx
  | "PARSE" // body bukan JSON padahal diharapkan JSON
  | "CHUNK_SOURCE_UNSUPPORTED" // NP-006: perangkat tak mendukung baca parsial file (fallback single-shot)
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
  /**
   * BFI-059: atribusi field error validasi dari backend
   * (`errors.fields: [{ field, messages }]` — validation-exception.factory.ts).
   * Screen/form memakai ini untuk menampilkan pesan tepat di field yang
   * salah, bukan menebak dari `validationMessages` yang diratakan.
   */
  fieldErrors?: FieldError[]
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
  /**
   * CPY-012 (audit UI/UX 2026-09-28): true bila `message` dikarang KLIEN
   * (copy Indonesia, aman tampil ke user). WAJIB false bila `message`
   * berasal — atau bisa berasal — dari body respons backend, yang bahasanya
   * tidak terjamin (bisa Inggris) — `userMessage()` akan fail-closed ke
   * copy Indonesia per kode. Default true: seluruh titik konstruksi yang ada
   * memakai string Indonesia hardcoded; jalur yang mem-parsing body backend
   * (`toApiError`, `unwrapResponse`, XHR upload chat) mengeset false eksplisit.
   */
  clientMessage?: boolean
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number | undefined
  readonly backendCode: string | undefined
  readonly validationMessages: string[] | undefined
  /** BFI-059: atribusi per field — lihat `ApiErrorInit.fieldErrors`. */
  readonly fieldErrors: FieldError[] | undefined
  readonly method: string | undefined
  readonly path: string | undefined
  readonly retryAfterMs: number | undefined
  /** Lihat `ApiErrorInit.clientMessage`. */
  readonly clientMessage: boolean

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
    this.fieldErrors = init.fieldErrors
    this.#raw = init.raw
    // L-03: selalu disamarkan di titik ini — jaring pengaman terakhir sebelum
    // body request (bisa berisi PIN) masuk ke jalur log/debug.
    this.#requestBody =
      init.requestBody !== undefined ? redactSensitive(init.requestBody) : undefined
    this.method = init.method
    this.path = init.path
    this.retryAfterMs = init.retryAfterMs
    this.clientMessage = init.clientMessage ?? true
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
// Offline yang DIKETAHUI (item #27): gerbang fail-closed untuk mutasi.
// ------------------------------------------------------------------

/**
 * Dilempar transport (`lib/api/client.ts`) saat perangkat JELAS offline dan
 * pemanggil mencoba mutasi (non-GET) yang tidak diizinkan masuk antrean.
 *
 * BUKAN ApiError: tidak ada respons HTTP sama sekali. Bedakan dari
 * `ApiError` berkode NETWORK (request dikirim tapi jaringan gagal di tengah
 * jalan — nasib mutasi TAK PASTI, lihat `isUncertainMutationError`).
 * OfflineError berarti request TIDAK PERNAH dikirim — aman untuk retry
 * manual tanpa risiko eksekusi ganda.
 *
 * Copy disengaja eksplisit menyebut "tidak diantrekan": pengguna produk
 * keuangan harus tahu aksi uangnya DIBATALKAN saat offline, bukan
 * "disimpan dan dikirim nanti" (itu hanya berlaku untuk aksi sosial
 * like/ikuti/simpan).
 */
export class OfflineError extends Error {
  readonly code = "OFFLINE" as const
  constructor() {
    super(
      "Anda sedang offline. Aksi ini membutuhkan koneksi internet dan tidak " +
        "dapat diantrekan — silakan coba lagi setelah tersambung.",
    )
    this.name = "OfflineError"
  }
}

export function isOfflineError(err: unknown): err is OfflineError {
  return err instanceof OfflineError
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
  /**
   * BFI-059: atribusi per field dari envelope backend
   * (`errors.fields: [{ field, messages }]` — validation-exception.factory.ts
   * → http-exception.filter.ts). `undefined` bila backend tidak mengirimnya.
   */
  fieldErrors: FieldError[] | undefined
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
      fieldErrors: undefined,
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

  return { message, backendCode, validationMessages, fieldErrors: parseFieldErrors(src) }
}

/**
 * BFI-059: baca `errors.fields` dari envelope kanonis backend
 * (`{ success:false, message, data:null, errors:{ code, message, fields } }` —
 * http-exception.filter.ts:94-97; fields dibangun validation-exception.factory.ts).
 *
 * Sanitasi cermin backend: maksimal 50 field, hanya entri dengan `field`
 * string non-kosong dan minimal satu `messages` string yang dilewatkan;
 * tiap pesan dipotong dengan aturan UI yang sama (toUserMessage).
 */
function parseFieldErrors(source: NestErrorBody): FieldError[] | undefined {
  const rawFields = (source as { fields?: unknown }).fields
  if (!Array.isArray(rawFields)) return undefined
  const out: FieldError[] = []
  for (const item of rawFields.slice(0, 50)) {
    const entry = asRecord(item)
    if (!entry) continue
    const field = entry.field
    const messages = Array.isArray(entry.messages)
      ? entry.messages
          .filter((m): m is string => typeof m === "string")
          .map(toUserMessage)
      : []
    if (typeof field !== "string" || !field || messages.length === 0) continue
    out.push({ field, messages })
  }
  return out.length > 0 ? out : undefined
}

/**
 * SYS-A-001 (audit sistemik ronde 3, 2026-10-03): tabel lookup EKSPLISIT
 * untuk kode error kritis jalur uang — KANONIS dan dicek SEBELUM heuristik
 * `includes()` di `codeFromBackend`.
 *
 * Kenapa: heuristik substring MENEBak. Untuk uang, tebakan salah = copy UI
 * yang menyesatkan di momen dana (mis. refund DANA yang gagal di provider
 * terpetakan ke VALIDATION "data belum benar"). Setiap entri di sini
 * terverifikasi ke exception class backend (kolom kanan) — bukan tebakan:
 * nilai = ApiErrorCode yang sepadan dengan status HTTP yang dilempar backend.
 *
 * Aturan keras: JANGAN tambah pola `includes()` baru untuk kode uang —
 * tambah entri eksplisit di tabel ini. Kode tak dikenal → `undefined`
 * (jujur: pemanggil memakai generik), jangan tebak.
 */
const MONEY_ERROR_CODES: Record<string, ApiErrorCode> = {
  // --- Escrow / invariant dana (409 → CONFLICT) ---
  ESCROW_LOCK_MISSING: "CONFLICT", // order-state.service.ts:713 ConflictException
  MILESTONE_INVARIANT_VIOLATION: "CONFLICT", // milestone-activation.ts:30 ConflictException
  MILESTONE_ALREADY_RELEASED: "CONFLICT", // milestones.service.ts ConflictException
  // --- Disbursement tak tersedia / diblokir (400 → BAD_REQUEST) ---
  DISBURSEMENT_UNAVAILABLE: "BAD_REQUEST", // order-state.service.ts:856 BadRequestException
  // --- Validasi jumlah / batas uang (400 → BAD_REQUEST) ---
  MILESTONE_AMOUNT_MISMATCH: "BAD_REQUEST", // milestones.service.ts BadRequestException
  MILESTONE_REVISION_LIMIT: "BAD_REQUEST", // milestones.service.ts BadRequestException
  MILESTONE_ORDER_LEGACY_FLOW_FORBIDDEN: "BAD_REQUEST", // milestones.service.ts BadRequestException
  INVALID_REFUND_AMOUNT: "BAD_REQUEST", // dana/disbursement BadRequestException
  REFUND_AMOUNT_REQUIRED: "BAD_REQUEST", // refunds BadRequestException
  WALLET_LOCKED: "BAD_REQUEST", // wallet.service.ts BadRequestException
  WALLET_DISABLED_USE_DANA: "BAD_REQUEST", // wallet.service.ts BadRequestException
  // --- Saldo tak cukup (422 primer → UNPROCESSABLE; satu titik 409, tapi
  //     kode lebih spesifik dari status sehingga UNPROCESSABLE menang) ---
  INSUFFICIENT_BALANCE: "UNPROCESSABLE", // wallet.service.ts UnprocessableEntityException
  // --- Kegagalan provider / layanan hilir (503 → SERVER) ---
  DANA_REFUND_FAILED: "SERVER", // dana-payment.service.ts:311 ServiceUnavailableException
  DANA_TOPUP_BALANCE_FAILED: "SERVER", // dana-payment.service.ts ServiceUnavailableException
  DANA_TOPUP_REFUND_NO_REFERENCE: "SERVER", // dana-payment.service.ts ServiceUnavailableException
  MILESTONE_CANCEL_REFUND_FAILED: "SERVER", // milestones.service.ts ServiceUnavailableException
  MILESTONE_CANCEL_NO_DANA_PAYMENT: "SERVER", // milestones.service.ts ServiceUnavailableException
  NO_WALLET_PROVIDER_UNAVAILABLE: "SERVER", // wallet.service.ts ServiceUnavailableException
  LEGACY_PAYOUT_NO_BANK: "SERVER", // legacy-payout.service.ts ServiceUnavailableException
  ORDER_QRIS_REFUND_LEDGER_MISSING: "SERVER", // refunds ServiceUnavailableException
  ORDER_QRIS_REFUND_LEDGER_INVALID: "SERVER", // refunds ServiceUnavailableException
  IRIS_PAYOUT_FAILED: "SERVER", // iris-payout ServiceUnavailableException
  IRIS_PAYOUT_TIMEOUT: "SERVER", // iris-payout ServiceUnavailableException
  IRIS_PAYOUT_NETWORK_ERROR: "SERVER", // iris-payout ServiceUnavailableException
  IRIS_PAYOUT_STATUS_UNAVAILABLE: "SERVER", // iris-payout ServiceUnavailableException
  IRIS_PAYOUT_INVALID_RESPONSE: "SERVER", // iris-payout ServiceUnavailableException
  IRIS_PAYOUT_REFERENCE_MISMATCH: "SERVER", // iris-payout ServiceUnavailableException
  IRIS_PAYOUT_EMPTY_RESPONSE: "SERVER", // iris-payout ServiceUnavailableException
  IRIS_PAYOUT_STATUS_INVALID: "SERVER", // iris-payout ServiceUnavailableException
  IRIS_PAYOUT_UNEXPECTED_STATUS: "SERVER", // iris-payout ServiceUnavailableException
  // --- Akses / eksistensi (403 → FORBIDDEN, 404 → NOT_FOUND) ---
  WALLET_DISABLED: "FORBIDDEN", // wallet.service.ts ForbiddenException
  MILESTONE_NOT_FOUND: "NOT_FOUND", // milestones.service.ts NotFoundException
  WALLET_NOT_FOUND: "NOT_FOUND", // wallet.service.ts NotFoundException
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
  // SYS-A-001: tabel eksplisit kode uang dicek DULU — menang atas heuristik.
  const moneyCode = MONEY_ERROR_CODES[k]
  if (moneyCode) return moneyCode
  // BFI-058: kode eksak yang tidak tertangkap heuristik `includes` di bawah
  // (atau harus menang atasnya). Dicek dulu sebelum pola longgar.
  if (k === ORDER_NOT_FOUND) return "NOT_FOUND"
  if (k === NOT_ORDER_PARTICIPANT) return "FORBIDDEN"
  // Urutan penting: "INVALID_TOKEN" mengandung "VALID" — cek sesi dulu.
  // PIN_RATE_LIMITED dicek sebelum FORBIDDEN agar pesan klien yang jelas
  // (tunggu 15 menit) dipakai, bukan "tidak memiliki akses".
  // BFI-XXX (2026-10-01): INVALID_CREDENTIALS / TOKEN_INVALID_OR_EXPIRED /
  // INVALID_2FA_CODE juga mengandung "VALID" — tanpa ini login yang gagal
  // terpetakan ke VALIDATION ("data belum benar") bukan UNAUTHORIZED
  // ("username/kata sandi salah").
  if (k.includes("PIN") && k.includes("RATE_LIMIT")) return "PIN_RATE_LIMITED"
  // ACCOUNT_LOCKED dicek sebelum UNAUTHORIZED — backend mengirim 401 dengan
  // code ACCOUNT_LOCKED saat akun terkunci sementara.
  if (k.includes("ACCOUNT_LOCKED") || k.includes("ACCOUNT_LOCK")) return "ACCOUNT_LOCKED"
  if (
    k.includes("UNAUTHORIZED") ||
    k.includes("INVALID_TOKEN") ||
    k.includes("TOKEN_INVALID") ||
    k.includes("INVALID_CREDENTIALS") ||
    k.includes("INVALID_2FA") ||
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
  ACCOUNT_LOCKED: "Akun terkunci sementara karena terlalu banyak percobaan gagal.",
  FORBIDDEN: "Anda tidak memiliki akses untuk tindakan ini.",
  NOT_FOUND: "Data tidak ditemukan.",
  CONFLICT: "Data bentrok dengan yang sudah ada.",
  PAYLOAD_TOO_LARGE: "Ukuran berkas terlalu besar.",
  UNPROCESSABLE: "Permintaan tidak dapat diproses.",
  RATE_LIMITED: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.",
  PIN_RATE_LIMITED: "Terlalu banyak percobaan PIN. Tunggu 15 menit lalu coba lagi.",
  SERVER: "Terjadi gangguan di server kami. Coba lagi nanti.",
  PARSE: "Respons server tidak dapat dibaca.",
  CHUNK_SOURCE_UNSUPPORTED: "Perangkat tidak mendukung upload lanjutan. Mencoba cara biasa…",
  UNKNOWN: "Terjadi kesalahan. Coba lagi.",
}

/**
 * BFE-076: copy actionable per kode REAUTH_* (backend
 * `src/common/constants/error-codes.ts`). Dipakai `userMessage()` — layar
 * cukup memanggilnya tanpa switch sendiri.
 */
const REAUTH_COPY: Record<string, string> = {
  [REAUTH_PASSWORD_REQUIRED]:
    "Perubahan ini membutuhkan verifikasi kata sandi. Masukkan kata sandi Anda untuk melanjutkan.",
  [REAUTH_INVALID_PASSWORD]:
    "Kata sandi salah. Periksa kembali lalu coba lagi.",
  [REAUTH_TOO_MANY_ATTEMPTS]:
    "Terlalu banyak percobaan verifikasi. Tunggu beberapa saat sebelum mencoba lagi.",
  [REAUTH_UNAVAILABLE]:
    "Layanan verifikasi keamanan sedang tidak tersedia. Coba lagi nanti.",
}

/**
 * SYS-C-202 (audit konsistensi 2026-10-03): blocklist password umum TIDAK
 * punya endpoint cek/daftar di backend (terverifikasi read-only —
 * `src/modules/auth/password-policy.ts` `validatePasswordPolicy` melempar
 * VALIDATION_ERROR dengan pesan 'Password terlalu umum. Gunakan kombinasi
 * yang lebih unik.' — TANPA kode khusus). Pre-submit sudah ditangani mirror
 * DBL-015 (`lib/auth-constants.ts` `isCommonPassword`); pemetaan berbasis
 * pesan di sini menutup jalur submit langsung (bypass klien / daftar server
 * diperbarui). TIDAK ada hardcode ulang 60 entri di FE.
 */
export function passwordTooCommonMessage(err: unknown): string | undefined {
  if (!isApiError(err)) return undefined
  const texts = [err.message, ...(err.validationMessages ?? [])]
  if (texts.some((t) => typeof t === "string" && /terlalu umum|too common/i.test(t)))
    return "Kata sandi terlalu umum. Pilih kata sandi yang lain."
  return undefined
}

/**
 * SYS-C-204: regex email FE sengaja longgar (UX) — `@IsEmail()` backend
 * adalah penegak final. Bila penolakan BE sampai ke sini, fail-closed TIDAK
 * boleh membocorkan pesan Inggris mentah class-validator
 * ("email must be an email" / "Invalid contact email format") — tampilkan
 * copy Indonesia spesifik.
 */
export function emailFormatMessage(err: unknown): string | undefined {
  if (!isApiError(err)) return undefined
  const texts = [err.message, ...(err.validationMessages ?? [])]
  if (
    texts.some(
      (t) => typeof t === "string" && /must be an email|invalid .*email.*format/i.test(t),
    )
  )
    return "Format email tidak valid. Periksa kembali alamat email Anda."
  return undefined
}

/** Pesan siap tampil: pakai message backend bila ada, selain itu default per kode. */
export function userMessage(err: unknown): string {
  // Item #27: offline yang diketahui selalu memakai copy klien yang jelas —
  // jangan biarkan wording teknis lolos ke toast.
  if (isOfflineError(err)) return err.message
  if (isApiError(err)) {
    // Rate-limit PIN selalu pakai copy ID klien yang jelas — pesan backend
    // berbahasa Inggris dan tidak menyebut durasi kunci. Dicek lewat code
    // maupun backendCode karena error HTTP dinormalisasi via codeFromStatus
    // (403 → FORBIDDEN) sementara kode backend mentah tersimpan terpisah.
    if (isPinRateLimited(err)) return DEFAULT_ERROR_MESSAGES.PIN_RATE_LIMITED
    // BFI-063: PENGECUALIAN eksplisit dari fail-closed. Backend mendokumentasikan
    // `message` untuk kode-kode di DISPLAYABLE_BACKEND_MESSAGES sebagai copy
    // Bahasa Indonesia yang aman ditampilkan langsung (bukan "pesannya terlihat
    // Indonesia"). Cabang ini hanya untuk pesan yang PASTI dari backend
    // (clientMessage: false); pesan karangan klien sudah ditangani di bawah.
    if (
      !err.clientMessage &&
      err.backendCode &&
      DISPLAYABLE_BACKEND_MESSAGES.has(err.backendCode) &&
      err.message
    ) {
      return err.message
    }
    // BFI-058: getStatus pembayaran — bedakan "order tidak ada" / "bukan
    // partisipan" dari "input salah". Copy Indonesia karangan klien (fail-closed):
    // jangan teruskan wording backend mentah.
    if (err.backendCode === ORDER_NOT_FOUND) {
      return "Pesanan tidak ditemukan. Mungkin sudah dihapus atau tautannya tidak valid."
    }
    if (err.backendCode === NOT_ORDER_PARTICIPANT) {
      return "Anda tidak memiliki akses ke pesanan ini."
    }
    // Audit Pesan #9d: pesan dikunci selama sengketa (bukti) — jelaskan
    // sebabnya, bukan "data belum benar"/CONFLICT generik.
    if (err.backendCode === CHAT_MESSAGE_LOCKED_DISPUTE) {
      return "Pesan tidak bisa diubah atau dihapus selama sengketa berlangsung — isi percakapan menjadi bukti sampai sengketa selesai."
    }
    // BFE-075: verifikasi nama pemilik rekening ke data bank gagal — jangan
    // biarkan jatuh ke VALIDATION generik ("data belum benar").
    if (err.backendCode === BANK_ACCOUNT_VERIFICATION_FAILED) {
      return "Nama pemilik tidak cocok dengan data bank. Periksa ejaan nama pemilik, lalu coba lagi."
    }
    // BFE-080: polling status langganan dengan id basi/kedaluwarsa (404) —
    // jangan biarkan jatuh ke UNKNOWN generik.
    if (err.backendCode === SUBSCRIPTION_NOT_FOUND) {
      return "Data langganan tidak ditemukan. Mungkin sudah kedaluwarsa — silakan buat langganan baru."
    }
    // BFE-076: kegagalan re-auth keamanan — tiap kode punya arti sendiri;
    // pesan generik ("sesi berakhir"/"data belum benar") menyesatkan di sini.
    const reauthCopy = REAUTH_COPY[err.backendCode ?? ""]
    if (reauthCopy) return reauthCopy
    // SYS-C-202: password ditolak blocklist server (tanpa kode khusus —
    // dideteksi dari pesan) → copy jelas, bukan VALIDATION generik.
    const tooCommon = passwordTooCommonMessage(err)
    if (tooCommon) return tooCommon
    // SYS-C-204: regex FE longgar sebagai UX, BE penegak final — penolakan
    // format email dari BE jangan tampil mentah/Inggris.
    const emailFormat = emailFormatMessage(err)
    if (emailFormat) return emailFormat
    // Untuk error jaringan/server, wording backend (bila ada) biasanya teknis — pakai default.
    if (
      err.code === "NETWORK" ||
      err.code === "TIMEOUT" ||
      err.code === "SERVER" ||
      err.code === "PARSE"
    ) {
      return DEFAULT_ERROR_MESSAGES[err.code]
    }
    // CPY-012/ERR-002: pesan backend (bahasa tidak terjamin — bisa Inggris)
    // JANGAN diteruskan mentah ke user. Hanya pesan yang dikarang klien
    // (clientMessage: true, copy Indonesia) boleh tampil apa adanya;
    // sisanya fail-closed ke copy Indonesia per kode. JANGAN ngarang arti:
    // kode yang belum dipetakan jatuh ke UNKNOWN generik.
    if (err.clientMessage) return err.message || DEFAULT_ERROR_MESSAGES[err.code]
    return DEFAULT_ERROR_MESSAGES[err.code]
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
 * T3-004 (audit UI/UX): true bila server menolak karena PIN dompet BELUM
 * PERNAH diatur — bukan PIN yang salah. Pakai ini untuk menampilkan jalan
 * "Buat PIN" di dalam alur, bukan error "PIN salah".
 *
 * BFI-065: backend kini mengirim kode khusus `WALLET_PIN_NOT_SET` (bukan lagi
 * `NOT_FOUND` generik + pesan Inggris). Fallback legacy dipertahankan karena
 * backend dan APK di-deploy terpisah — backend lama masih mengirim bentuk lama.
 */
export function isPinNotSetError(err: unknown): boolean {
  if (!isApiError(err)) return false
  const code = (err.backendCode ?? "").toUpperCase()
  if (code === WALLET_PIN_NOT_SET) return true
  if (code !== "NOT_FOUND") return false
  const raw = err.raw
  const rawMessage =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>).message
      : undefined
  const text = typeof rawMessage === "string" ? rawMessage : err.message
  return /pin has not been set/i.test(text)
}

/**
 * BFI-057: POST /v1/users/me/delete-request yang ditolak backend membawa
 * `errors.code` salah satu dari tiga kode blocker ini (HTTP 400). String
 * `DELETION_BLOCKED` TIDAK PERNAH dikirim backend — cabang lama yang
 * memeriksanya mati total.
 *
 * Kembalikan copy Indonesia SPESIFIK per kode, atau `undefined` bila ini bukan
 * error blocker penghapusan (pemanggil memakai fallback fail-closed generik).
 * Backend tetap penjaga terakhir: penolakan tak dikenal tidak boleh
 * diartikan sebagai "boleh hapus".
 */
const DELETION_BLOCKER_COPY: Record<string, string> = {
  [ACTIVE_ORDERS_PRESENT]:
    "Penghapusan belum bisa diproses: masih ada pesanan aktif, penarikan yang sedang diproses, atau sengketa terbuka. Selesaikan semuanya dulu, lalu coba lagi.",
  [ESCROW_BALANCE_PRESENT]:
    "Penghapusan belum bisa diproses: masih ada dana dalam transaksi yang belum selesai. Selesaikan pesanan yang tertunda dulu, lalu coba lagi.",
  [WALLET_BALANCE_PRESENT]:
    "Penghapusan belum bisa diproses: saldo dompet Anda belum nol. Tarik dana Anda terlebih dahulu, lalu coba lagi.",
}

export function deletionBlockerMessage(err: unknown): string | undefined {
  if (!isApiError(err) || !err.backendCode) return undefined
  return DELETION_BLOCKER_COPY[err.backendCode]
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
