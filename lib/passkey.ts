/**
 * Kahade — klien passkey: WebAuthn (web) + seam provider native (GAP-A G033/G041/G043).
 *
 * PENTING — batasan platform (jujur, sesuai G033):
 *  - WebAuthn adalah API browser (`navigator.credentials`). Di React Native
 *    (Android/iOS) API ini TIDAK tersedia, sehingga di native fungsi di sini
 *    mendelegasikan ke seam provider di lib/passkey-native.ts. Seam itu saat
 *    ini SENGAJA mati (provider publik belum bisa membawa options server),
 *    jadi native menjawab `supported: false` + `reason` spesifik dan UI
 *    menampilkan penjelasan jujur + opsi masuk lain (kata sandi / OTP
 *    WhatsApp) — bukan klaim palsu "passkey native".
 *  - Private key TIDAK PERNAH dikirim ke server: yang dikirim hanya
 *    attestation (pendaftaran) / assertion (login) hasil authenticator (G041).
 *  - Bentuk payload ke backend identik di kedua jalur (lihat
 *    lib/passkey-types.ts) — seam native tidak mengubah kontrak API.
 *
 * Implementasi web memakai Web Authentication API mentah (tanpa dependency
 * @simplewebauthn/browser) agar tidak menambah dependency frontend:
 * konversi base64url ↔ Uint8Array dan JSON options ditangani di sini,
 * mengikuti format PublicKeyCredentialCreationOptionsJSON /
 * PublicKeyCredentialRequestOptionsJSON dari @simplewebauthn/server.
 */
import { Platform } from "react-native"

import { PASSKEY_COPY } from "@/lib/passkey-instructions"
import {
  authenticateNativePasskey,
  probeNativePasskey,
  registerNativePasskey,
} from "@/lib/passkey-native"
import {
  PasskeyError,
  type AuthenticationOptionsJSON,
  type AuthenticationResponseJSON,
  type PasskeyCapability,
  type PasskeyUnsupportedReason,
  type RegistrationOptionsJSON,
  type RegistrationResponseJSON,
  type StartAuthenticationOpts,
} from "@/lib/passkey-types"

// Satu pintu masuk yang sama seperti sebelumnya: konsumen mengimpor tipe &
// error dari "@/lib/passkey", padahal definisinya kini di passkey-types.ts
// (supaya passkey.ts ↔ passkey-native.ts tidak membentuk siklus impor).
export { PasskeyError }
export type {
  AuthenticationOptionsJSON,
  AuthenticationResponseJSON,
  PasskeyCapability,
  PasskeyUnsupportedReason,
  RegistrationOptionsJSON,
  RegistrationResponseJSON,
  StartAuthenticationOpts,
}

/** Pesan jujur untuk browser tanpa WebAuthn (jalur web) — copy terkatalog. */
function webUnsupportedMessage(): string {
  return PASSKEY_COPY.unsupportedMessages.web
}

/**
 * Cek sinkron untuk frame pertama (layar kelola passkey tidak boleh berkedip).
 * SENGAJA web-only: ketersediaan provider native harus ditanya lewat modulnya
 * (async), jadi di native fungsi ini menjawab `supported: false` dan pemanggil
 * yang butuh kepastian memakai `getPasskeyCapability()`.
 */
export function getPasskeyCapabilitySync(): Omit<PasskeyCapability, "conditionalMediation" | "platformAuthenticator"> {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return { supported: false }
  }
  return { supported: typeof (window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential !== "undefined" }
}

export async function getPasskeyCapability(): Promise<PasskeyCapability> {
  // Native: satu-satunya jalur adalah provider di lib/passkey-native.ts.
  // `platformAuthenticator` = true bila provider tersedia, karena Credential
  // Manager / ASAuthorization memang authenticator platform (biometrik/kunci
  // layar). Conditional mediation adalah fitur WebAuthn → selalu false.
  if (Platform.OS !== "web") {
    const probe = await probeNativePasskey()
    return probe.available
      ? { supported: true, conditionalMediation: false, platformAuthenticator: true }
      : {
          supported: false,
          conditionalMediation: false,
          platformAuthenticator: false,
          reason: probe.reason as PasskeyUnsupportedReason,
        }
  }
  const base = getPasskeyCapabilitySync()
  if (!base.supported) {
    return {
      supported: false,
      conditionalMediation: false,
      platformAuthenticator: false,
      reason: "WEB_UNSUPPORTED",
    }
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
  // Native → seam provider. Ia melempar PasskeyError NOT_SUPPORTED dengan
  // alasan spesifik (DISABLED / MODULE_MISSING / PROVIDER_INCOMPLETE /
  // RUNTIME_ERROR) bila passkey memang belum bisa dipakai di build ini.
  if (Platform.OS !== "web") return registerNativePasskey(optionsJSON)
  if (!getPasskeyCapabilitySync().supported) {
    throw new PasskeyError("NOT_SUPPORTED", webUnsupportedMessage())
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

/**
 * Minta assertion passkey. Mengembalikan assertion JSON untuk
 * POST /v1/auth/passkey/auth/verify.
 */
export async function startPasskeyAuthentication(
  optionsJSON: AuthenticationOptionsJSON,
  opts: StartAuthenticationOpts = {},
): Promise<AuthenticationResponseJSON> {
  // Native → seam provider. `conditional` (autofill UI) adalah kemampuan
  // WebAuthn; di native sheet sistem muncul sendiri, jadi opsi itu tidak
  // diteruskan.
  if (Platform.OS !== "web") return authenticateNativePasskey(optionsJSON)
  if (!getPasskeyCapabilitySync().supported) {
    throw new PasskeyError("NOT_SUPPORTED", webUnsupportedMessage())
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
