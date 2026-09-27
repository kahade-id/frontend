/**
 * Kahade — redaksi telemetri (G477 audit 2026-09-26).
 *
 * ATURAN KERAS: tidak ada PII/token/PIN/nomor rekening/nomor HP yang boleh
 * meninggalkan perangkat lewat telemetri. Setiap event yang dibangun
 * `lib/telemetry.ts` WAJIB melewati `redactTelemetryEvent()` di `dispatch()`
 * sebelum masuk ring buffer, sink, maupun remote sink.
 *
 * Dua lapis pertahanan:
 *   1. `redactValue()` — rekursif: kunci yang cocok daftar terlarang nilainya
 *      diganti "[REDACTED]" (perbandingan case-insensitive, pencocokan
 *      substring supaya `userPhoneNumber`, `bank_account_no`, dsb. tertangkap).
 *   2. Pola nilai di string bebas (pesan error sering menempelkan PII):
 *      email, nomor HP Indonesia, NIK 16 digit, nomor kartu 12–19 digit →
 *      "[REDACTED]".
 *
 * Fungsi ini murni (tidak melempar untuk input aneh) — redaksi yang gagal
 * tidak boleh menjatuhkan pencatatan error.
 */

const REDACTED = "[REDACTED]"

/** Kunci terlarang — substring match, case-insensitive. */
const FORBIDDEN_KEY_PARTS = [
  "password",
  "passwd",
  "pin",
  "otp",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "authorization",
  "cookie",
  "set-cookie",
  "secret",
  "apikey",
  "api_key",
  "privatekey",
  "signature",
  "phone",
  "phonenumber",
  "msisdn",
  "whatsapp",
  "email",
  "nik",
  "ktp",
  "accountnumber",
  "account_number",
  "bankaccount",
  "rekening",
  "cardnumber",
  "card_number",
  "cvv",
  "cvc",
  "va_number",
  "vanumber",
  "qris",
  "address",
  "alamat",
  "dob",
  "birthdate",
  "tanggal_lahir",
  "npwp",
  "selfie",
  "liveness",
  "biometric",
  "devicefingerprint",
]

/** Pola nilai sensitif di string bebas. */
const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  // Email
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  // Nomor HP Indonesia (+62/62/08…, 9–14 digit)
  /(\+62|62|0)8\d{8,12}/g,
  // NIK 16 digit
  /\b\d{16}\b/g,
  // Nomor kartu / rekening 12–19 digit
  /\b\d{12,19}\b/g,
]

const MAX_DEPTH = 8
const MAX_STRING = 2000

function isForbiddenKey(key: string): boolean {
  const lower = key.toLowerCase().replace(/[_\-\s]/g, "")
  return FORBIDDEN_KEY_PARTS.some((part) => lower.includes(part))
}

function redactStringValue(value: string): string {
  let out = value
  for (const re of SENSITIVE_VALUE_PATTERNS) {
    re.lastIndex = 0
    out = out.replace(re, REDACTED)
  }
  return out.length > MAX_STRING ? out.slice(0, MAX_STRING) + "…" : out
}

/**
 * Redaksi rekursif: objek/array di-clone dengan nilai sensitif diganti.
 * Siklus referensi diputus (→ "[Circular]") agar tidak stack overflow.
 */
export function redactValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === "string") return redactStringValue(value)
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return value
  if (depth >= MAX_DEPTH) return REDACTED
  if (typeof value !== "object") return value

  const obj = value as Record<string, unknown>
  if (seen.has(obj)) return "[Circular]"
  seen.add(obj)

  if (Array.isArray(obj)) {
    return obj.map((item) => redactValue(item, depth + 1, seen))
  }
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(obj)) {
    out[key] = isForbiddenKey(key) ? REDACTED : redactValue(obj[key], depth + 1, seen)
  }
  return out
}

export type RedactableTelemetryEvent = {
  message: string
  [key: string]: unknown
}

/**
 * Terapkan redaksi ke SELURUH event telemetri. Dipanggil di `dispatch()`
 * sebelum event menyentuh buffer/sink/remote — tidak ada jalur pintas.
 */
export function redactTelemetryEvent<T extends RedactableTelemetryEvent>(event: T): T {
  try {
    const redacted = redactValue(event) as T
    // Pastikan message selalu string pasca-redaksi.
    if (typeof redacted.message !== "string") redacted.message = String(redacted.message ?? "")
    return redacted
  } catch {
    // Redaksi tidak boleh menggagalkan telemetri: kembalikan versi aman.
    return { ...event, message: REDACTED } as T
  }
}
