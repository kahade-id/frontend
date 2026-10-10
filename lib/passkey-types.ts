/**
 * Kahade — tipe & error bersama klien passkey (overhaul auth 2026-10-10, bagian 5).
 *
 * Modul ini ADA supaya lib/passkey.ts (jalur WebAuthn/web) dan
 * lib/passkey-native.ts (seam provider native) bisa berbagi tipe dan
 * `PasskeyError` TANPA siklus impor. Arah impornya satu jalur:
 *
 *   lib/passkey.ts ──▶ lib/passkey-native.ts ──▶ lib/passkey-types.ts
 *          └────────────────────────────────────▶ lib/passkey-types.ts
 *
 * Semua konsumen lama tetap mengimpor dari "@/lib/passkey" (tipe dan errornya
 * di-re-export di sana), jadi tidak ada satu pun pemanggil yang ikut berubah.
 *
 * Bentuk JSON mengikuti @simplewebauthn/server
 * (`PublicKeyCredential{Creation,Request}OptionsJSON`) — base64URL tanpa
 * padding. Kontrak backend TIDAK berubah baik seam native menyala maupun
 * tidak: yang bertukar hanya SIAPA yang menghasilkan attestation/assertion
 * (browser via WebAuthn, atau Credential Manager / ASAuthorization di native).
 */

/** Hasil deteksi kapabilitas passkey di perangkat ini. */
export type PasskeyCapability = {
  /** true bila ADA jalur passkey yang bisa dipakai: WebAuthn (web) atau provider native */
  supported: boolean
  /** Conditional mediation (autofill passkey) tersedia — web saja (G041/G043) */
  conditionalMediation: boolean
  /** Platform authenticator dengan verifikasi user (Touch ID/Face ID/Windows Hello) */
  platformAuthenticator: boolean
  /**
   * Alasan bila `supported` false. UI memakainya untuk penjelasan SPESIFIK
   * ("passkey belum tersedia di aplikasi native ini") alih-alih satu pesan
   * generik untuk semua penyebab — aturan "error spesifik, bukan generik".
   */
  reason?: PasskeyUnsupportedReason
}

/**
 * Kenapa tidak ada jalur passkey. Enam alasan pertama milik seam native
 * (lib/passkey-native.ts), yang terakhir milik jalur web.
 */
export type PasskeyUnsupportedReason =
  | "NOT_NATIVE"
  | "DISABLED"
  | "MODULE_MISSING"
  | "PROVIDER_INCOMPLETE"
  | "RUNTIME_ERROR"
  | "WEB_UNSUPPORTED"

// ── Registrasi ────────────────────────────────────────────────────────

export type RegistrationOptionsJSON = {
  rp: { name: string; id?: string }
  user: { id: string; name: string; displayName?: string }
  challenge: string
  pubKeyCredParams: { type: string; alg: number }[]
  timeout?: number
  excludeCredentials?: { id: string; type: string; transports?: string[] }[]
  authenticatorSelection?: Record<string, unknown>
  attestation?: string
  extensions?: Record<string, unknown>
}

export type RegistrationResponseJSON = {
  id: string
  rawId: string
  type: string
  response: {
    attestationObject: string
    clientDataJSON: string
    transports?: string[]
  }
  clientExtensionResults: Record<string, unknown>
}

// ── Autentikasi ───────────────────────────────────────────────────────

export type AuthenticationOptionsJSON = {
  challenge: string
  timeout?: number
  rpId?: string
  allowCredentials?: { id: string; type: string; transports?: string[] }[]
  userVerification?: UserVerificationRequirement
  extensions?: Record<string, unknown>
}

export type AuthenticationResponseJSON = {
  id: string
  rawId: string
  type: string
  response: {
    authenticatorData: string
    clientDataJSON: string
    signature: string
    userHandle?: string | null
  }
  clientExtensionResults: Record<string, unknown>
}

export type StartAuthenticationOpts = {
  /**
   * true → mediasi conditional (autofill passkey di kolom username) —
   * hanya bila browser mendukung (G041). Native: diabaikan (sheet sistem
   * muncul sendiri).
   */
  conditional?: boolean
}

// ── Error ─────────────────────────────────────────────────────────────

export type PasskeyErrorCode =
  | "NOT_SUPPORTED"
  | "CANCELLED"
  | "NOT_ALLOWED"
  | "SECURITY"
  | "UNKNOWN"

/**
 * Error passkey dengan KODE, supaya UI bisa memilih copy: dibatalkan pengguna
 * (diam), tidak didukung (jelaskan + tawarkan metode lain), atau gagal
 * (tawarkan coba lagi). Pesan sudah Bahasa Indonesia — bukan pesan mentah SDK.
 */
export class PasskeyError extends Error {
  code: PasskeyErrorCode
  constructor(code: PasskeyErrorCode, message: string) {
    super(message)
    this.name = "PasskeyError"
    this.code = code
  }
}
