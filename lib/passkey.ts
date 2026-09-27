/**
 * Kahade — klien WebAuthn/passkey (GAP-A: G033, G041, G043).
 *
 * PENTING — batasan platform (jujur, sesuai G033):
 *  - WebAuthn adalah API browser (`navigator.credentials`). Di React Native
 *    (Android/iOS) API ini TIDAK tersedia, sehingga alur passkey penuh hanya
 *    berjalan di **web** (expo web). Di native, fungsi di sini mengembalikan
 *    `supported: false` dan UI menampilkan penjelasan + opsi masuk lain
 *    (kata sandi / OTP WhatsApp) — bukan klaim palsu "passkey native".
 *  - Private key TIDAK PERNAH dikirim ke server: yang dikirim hanya
 *    attestation (pendaftaran) / assertion (login) hasil authenticator (G041).
 *
 * Implementasi memakai Web Authentication API mentah (tanpa dependency
 * @simplewebauthn/browser) agar tidak menambah dependency frontend:
 * konversi base64url ↔ Uint8Array dan JSON options ditangani di sini,
 * mengikuti format PublicKeyCredentialCreationOptionsJSON /
 * PublicKeyCredentialRequestOptionsJSON dari @simplewebauthn/server.
 */
import { Platform } from "react-native"

/** Hasil deteksi kapabilitas passkey di perangkat ini. */
export type PasskeyCapability = {
  /** true hanya bila Platform.OS === 'web' dan browser mendukung WebAuthn */
  supported: boolean
  /** Conditional mediation (autofill passkey) tersedia — web saja (G041/G043) */
  conditionalMediation: boolean
  /** Platform authenticator dengan verifikasi user (Touch ID/Face ID/Windows Hello) */
  platformAuthenticator: boolean
}

export function getPasskeyCapabilitySync(): Omit<PasskeyCapability, "conditionalMediation" | "platformAuthenticator"> {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return { supported: false }
  }
  return { supported: typeof (window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential !== "undefined" }
}

export async function getPasskeyCapability(): Promise<PasskeyCapability> {
  const base = getPasskeyCapabilitySync()
  if (!base.supported) {
    return { supported: false, conditionalMediation: false, platformAuthenticator: false }
  }
  const PKC = (window as unknown as { PublicKeyCredential: any }).PublicKeyCredential
  let conditionalMediation = false
  let platformAuthenticator = false
  try {
    if (typeof PKC.isConditionalMediationAvailable === "function") {
      conditionalMediation = await PKC.isConditionalMediationAvailable()
    }
  } catch {
    conditionalMediation = false
  }
  try {
    if (typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      platformAuthenticator = await PKC.isUserVerifyingPlatformAuthenticatorAvailable()
    }
  } catch {
    platformAuthenticator = false
  }
  return { supported: true, conditionalMediation, platformAuthenticator }
}

// ── base64url ────────────────────────────────────────────────────────

export function base64UrlToBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/")
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function bytesToBase64Url(bytes: Uint8Array | ArrayBuffer): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunk))
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

// ── Registrasi ───────────────────────────────────────────────────────

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

function toCreationOptions(json: RegistrationOptionsJSON): PublicKeyCredentialCreationOptions {
  return {
    rp: json.rp as PublicKeyCredentialRpEntity,
    user: {
      id: base64UrlToBytes(json.user.id),
      name: json.user.name,
      displayName: json.user.displayName ?? json.user.name,
    } as PublicKeyCredentialUserEntity,
    challenge: base64UrlToBytes(json.challenge),
    pubKeyCredParams: json.pubKeyCredParams as PublicKeyCredentialParameters[],
    timeout: json.timeout,
    excludeCredentials: (json.excludeCredentials ?? []).map((c) => ({
      id: base64UrlToBytes(c.id),
      type: c.type as PublicKeyCredentialType,
      transports: c.transports as AuthenticatorTransport[],
    })),
    authenticatorSelection: json.authenticatorSelection as AuthenticatorSelectionCriteria | undefined,
    attestation: json.attestation as AttestationConveyancePreference | undefined,
    extensions: json.extensions,
  }
}

/**
 * Daftarkan passkey baru. Mengembalikan attestation JSON untuk
 * POST /v1/auth/passkey/register/verify.
 */
export async function startPasskeyRegistration(
  optionsJSON: RegistrationOptionsJSON,
): Promise<RegistrationResponseJSON> {
  if (!getPasskeyCapabilitySync().supported) {
    throw new PasskeyError("NOT_SUPPORTED", "Perangkat ini tidak mendukung passkey.")
  }
  let credential: Credential | null
  try {
    credential = await navigator.credentials.create({ publicKey: toCreationOptions(optionsJSON) })
  } catch (err) {
    throw toPasskeyError(err)
  }
  if (!credential) throw new PasskeyError("CANCELLED", "Pendaftaran passkey dibatalkan.")
  const pkc = credential as unknown as {
    id: string
    rawId: ArrayBuffer
    type: string
    response: {
      attestationObject: ArrayBuffer
      clientDataJSON: ArrayBuffer
      getTransports?: () => string[]
    }
    getClientExtensionResults: () => Record<string, unknown>
  }
  return {
    id: pkc.id,
    rawId: bytesToBase64Url(pkc.rawId),
    type: pkc.type,
    response: {
      attestationObject: bytesToBase64Url(pkc.response.attestationObject),
      clientDataJSON: bytesToBase64Url(pkc.response.clientDataJSON),
      transports: pkc.response.getTransports?.() ?? [],
    },
    clientExtensionResults: pkc.getClientExtensionResults() ?? {},
  }
}

// ── Autentikasi ──────────────────────────────────────────────────────

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

function toRequestOptions(
  json: AuthenticationOptionsJSON,
): PublicKeyCredentialRequestOptions {
  return {
    challenge: base64UrlToBytes(json.challenge),
    timeout: json.timeout,
    rpId: json.rpId,
    allowCredentials: (json.allowCredentials ?? []).map((c) => ({
      id: base64UrlToBytes(c.id),
      type: c.type as PublicKeyCredentialType,
      transports: c.transports as AuthenticatorTransport[],
    })),
    userVerification: json.userVerification,
    extensions: json.extensions,
  }
}

export type StartAuthenticationOpts = {
  /**
   * true → mediasi conditional (autofill passkey di kolom username) —
   * hanya bila browser mendukung (G041). Native: selalu false.
   */
  conditional?: boolean
}

/**
 * Minta assertion passkey. Mengembalikan assertion JSON untuk
 * POST /v1/auth/passkey/auth/verify.
 */
export async function startPasskeyAuthentication(
  optionsJSON: AuthenticationOptionsJSON,
  opts: StartAuthenticationOpts = {},
): Promise<AuthenticationResponseJSON> {
  if (!getPasskeyCapabilitySync().supported) {
    throw new PasskeyError("NOT_SUPPORTED", "Perangkat ini tidak mendukung passkey.")
  }
  const requestOptions: CredentialRequestOptions = { publicKey: toRequestOptions(optionsJSON) }
  if (opts.conditional) {
    // Conditional mediation = autofill; browser menampilkan saran passkey
    // di kolom username tanpa dialog modal (G041/G043).
    ;(requestOptions as unknown as { mediation: string }).mediation = "conditional"
  }
  let credential: Credential | null
  try {
    credential = await navigator.credentials.get(requestOptions)
  } catch (err) {
    throw toPasskeyError(err)
  }
  if (!credential) throw new PasskeyError("CANCELLED", "Masuk dengan passkey dibatalkan.")
  const pkc = credential as unknown as {
    id: string
    rawId: ArrayBuffer
    type: string
    response: {
      authenticatorData: ArrayBuffer
      clientDataJSON: ArrayBuffer
      signature: ArrayBuffer
      userHandle: ArrayBuffer | null
    }
    getClientExtensionResults: () => Record<string, unknown>
  }
  return {
    id: pkc.id,
    rawId: bytesToBase64Url(pkc.rawId),
    type: pkc.type,
    response: {
      authenticatorData: bytesToBase64Url(pkc.response.authenticatorData),
      clientDataJSON: bytesToBase64Url(pkc.response.clientDataJSON),
      signature: bytesToBase64Url(pkc.response.signature),
      userHandle: pkc.response.userHandle ? bytesToBase64Url(pkc.response.userHandle) : null,
    },
    clientExtensionResults: pkc.getClientExtensionResults() ?? {},
  }
}

// ── Error mapping (Bahasa Indonesia) ─────────────────────────────────

export class PasskeyError extends Error {
  code: "NOT_SUPPORTED" | "CANCELLED" | "NOT_ALLOWED" | "SECURITY" | "UNKNOWN"
  constructor(
    code: "NOT_SUPPORTED" | "CANCELLED" | "NOT_ALLOWED" | "SECURITY" | "UNKNOWN",
    message: string,
  ) {
    super(message)
    this.name = "PasskeyError"
    this.code = code
  }
}

function toPasskeyError(err: unknown): PasskeyError {
  const name = (err as { name?: string })?.name ?? ""
  if (name === "NotAllowedError") {
    return new PasskeyError(
      "CANCELLED",
      "Anda membatalkan atau waktu habis. Coba lagi bila ingin masuk dengan passkey.",
    )
  }
  if (name === "SecurityError") {
    return new PasskeyError(
      "SECURITY",
      "Browser menolak passkey di halaman ini (kemungkinan origin tidak sesuai). Coba di aplikasi web resmi Kahade.",
    )
  }
  if (name === "NotSupportedError") {
    return new PasskeyError("NOT_SUPPORTED", "Perangkat atau browser ini tidak mendukung passkey.")
  }
  return new PasskeyError("UNKNOWN", (err as Error)?.message || "Gagal memproses passkey. Coba lagi.")
}
