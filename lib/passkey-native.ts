/**
 * Kahade — seam passkey NATIVE (iOS/Android), overhaul auth 2026-10-10 bagian 5.
 *
 * WebAuthn (`navigator.credentials`) hanya ada di browser, jadi lib/passkey.ts
 * adalah jalur web. Di native butuh PROVIDER (modul Expo/native yang memanggil
 * ASAuthorizationPlatformPublicKeyCredentialProvider di iOS dan Credential
 * Manager di Android). Modul ini adalah satu-satunya tempat provider itu
 * disentuh — sisanya aplikasi tidak tahu apakah passkey datang dari WebAuthn
 * atau dari native.
 *
 * ── Status hari ini: seam terpasang, provider SENGAJA belum dinyalakan ──
 * Satu-satunya paket publik, `expo-passkeys@0.1.11`, tidak bisa dipakai apa
 * adanya untuk kontrak backend kita:
 *   1. API-nya `createPasskey(challenge, user, rp, timeout)` /
 *      `getPasskey(challenge, …)` — options server yang WAJIB dihormati
 *      (`pubKeyCredParams`, `excludeCredentials`, `authenticatorSelection`,
 *      `attestation`) tidak bisa diteruskan, dan Android-nya meng-hardcode
 *      `allowCredentials: []`, `userVerification: "required"`,
 *      `attestation: "direct"`. Assertion/attestation yang dihasilkan bisa
 *      ditolak server, dan penolakannya terlihat seperti "passkey rusak".
 *   2. `peerDependencies.expo: ^52` sementara repo ini SDK 58 + new
 *      architecture; README paketnya sendiri menyebut sisi iOS masih dalam
 *      pengembangan dan "won't work inside other projects".
 *   3. Ia mengembalikan base64 standar (bukan base64url) dan mengetik
 *      `PasskeyUserInfo.id` sebagai GUID little-endian, sementara backend
 *      mengirim user handle base64url — dua sumber bug sunyi.
 *
 * Karena itu:
 *   - `expo-passkeys` masuk `optionalDependencies` (bukan `dependencies`) dan
 *     DIKECUALIKAN dari autolinking di app.json → JS-nya bisa di-resolve
 *     bundler, native-nya tidak pernah ikut ter-build. Tidak ada risiko build
 *     iOS/Android karena paket yang tidak kompatibel.
 *   - `NATIVE_PASSKEY_ENABLED` default `false`. Menyalakannya tanpa provider
 *     yang mampu = memindahkan kegagalan dari "jujur tidak didukung" ke
 *     "gagal misterius saat masuk".
 *   - SETIAP kegagalan (flag mati, modul tidak ada, bentuk API tidak cocok,
 *     runtime melempar) menjadi KODE ALASAN, bukan crash dan bukan klaim
 *     sukses. UI menerjemahkan kode itu menjadi penjelasan spesifik.
 *
 * ── Cara menyalakan (saat provider yang benar tersedia) ──
 *   1. Hapus `"expo-passkeys"` dari `expo.autolinking.exclude` di app.json,
 *      atau ganti ke modul native sendiri dan sesuaikan `import()` di bawah.
 *   2. Pastikan provider menerima SATU objek options server dan mengembalikan
 *      attestation/assertion lengkap — `isProviderCapable()` di bawah adalah
 *      gerbangnya; bila API-nya berbeda, sesuaikan adaptor `toRegistration` /
 *      `toAuthentication`, bukan gerbangnya.
 *   3. Set `NATIVE_PASSKEY_ENABLED = true`, jalankan `npm run test`, lalu uji
 *      manual di perangkat (docs/auth-security-qa.md).
 *   4. Kontrak backend TIDAK berubah: endpoint dan payload tetap
 *      lib/api/passkey.ts (getRegisterOptions/verifyRegistration,
 *      getAuthOptions/verifyAuthLogin). Seam ini hanya menukar SIAPA yang
 *      menghasilkan attestation/assertion.
 */
import { Platform } from "react-native"

import { PASSKEY_COPY } from "@/lib/passkey-instructions"
import { logWarn } from "@/lib/telemetry"
import {
  PasskeyError,
  type AuthenticationOptionsJSON,
  type AuthenticationResponseJSON,
  type RegistrationOptionsJSON,
  type RegistrationResponseJSON,
} from "@/lib/passkey-types"

/** Kenapa passkey native tidak tersedia di perangkat ini. Selalu ada alasannya. */
export type NativePasskeyReason =
  /** Platform web — jalurnya WebAuthn di lib/passkey.ts, bukan seam ini. */
  | "NOT_NATIVE"
  /** Seam dimatikan sengaja (lihat docblock: provider publik belum mampu). */
  | "DISABLED"
  /** Paket provider tidak terpasang di build ini (opsional, bisa absen). */
  | "MODULE_MISSING"
  /** Paket ada, tapi bentuk API-nya tidak bisa membawa options server. */
  | "PROVIDER_INCOMPLETE"
  /** Provider melempar saat dipanggil/dimuat. */
  | "RUNTIME_ERROR"

export type NativePasskeyProbe = {
  available: boolean
  /** Selalu terisi bila `available` false — dipakai UI untuk copy spesifik. */
  reason?: NativePasskeyReason
}

/**
 * Saklar seam. `false` = aplikasi native JUJUR mengatakan passkey belum
 * tersedia di sini dan mengarahkan ke web / metode masuk lain.
 */
export const NATIVE_PASSKEY_ENABLED = false

/**
 * Nama paket provider. Satu tempat supaya gampang ditukar modul sendiri.
 *
 * Bertipe `string` (bukan literal) dengan sengaja: `import()` dengan specifier
 * non-literal tidak membuat TypeScript/Metro mengikat modulnya saat build,
 * jadi paket OPSIONAL yang tidak terpasang (install `--omit=optional`) tidak
 * bisa menggagalkan build — kegagalannya terjadi saat runtime dan ditangkap
 * `try/catch` di `loadProvider()`.
 */
const PROVIDER_MODULE: string = "expo-passkeys"

/**
 * Copy user-facing seam native.
 *
 * Object map di `lib/` (bukan literal di dalam fungsi) supaya terkatalog i18n
 * dan bisa diterjemahkan: pesan ini berakhir di Alert/Dialog, jadi pengguna
 * English harus melihat English.
 */
const NATIVE_PASSKEY_MESSAGES = {
  cancelled: "Passkey dibatalkan. Coba lagi bila ingin melanjutkan.",
  notAllowed: "Perangkat menolak permintaan passkey. Buka kunci layar lalu coba lagi.",
  noCredential:
    "Tidak ada passkey yang cocok di perangkat ini. Daftar passkey dulu, atau masuk dengan metode lain.",
  unknown: "Passkey perangkat gagal diproses. Coba lagi, atau masuk dengan metode lain.",
  missingField: "Respons passkey perangkat tidak lengkap. Coba lagi, atau masuk dengan metode lain.",
} as const

/**
 * Bentuk minimum yang kita terima dari provider: SATU objek options masuk,
 * SATU objek hasil keluar. Provider yang memecah options menjadi beberapa
 * argumen posisional tidak bisa menghormati pilihan server → ditolak.
 */
type NativePasskeyModule = {
  isAvailable?: () => boolean | Promise<boolean>
  createPasskey?: (...args: never[]) => Promise<unknown>
  getPasskey?: (...args: never[]) => Promise<unknown>
}

let cachedModule: NativePasskeyModule | null | undefined
let cachedProbe: NativePasskeyProbe | undefined

/** Bersihkan cache — dipakai test yang menukar ketersediaan provider. */
export function resetNativePasskeyCache(): void {
  cachedModule = undefined
  cachedProbe = undefined
}

/**
 * Provider boleh dipakai hanya bila ia menerima SATU argumen (objek options
 * server). `Function.length` = jumlah parameter sebelum default/rest, jadi
 * `createPasskey(challenge, user, rp, timeout)` → 4 (ditolak) dan
 * `createPasskey(options)` → 1 (diterima).
 */
export function isProviderCapable(mod: unknown): mod is NativePasskeyModule {
  const candidate = mod as NativePasskeyModule | null
  if (!candidate || typeof candidate !== "object") return false
  const { createPasskey, getPasskey } = candidate
  if (typeof createPasskey !== "function" || typeof getPasskey !== "function") return false
  return createPasskey.length <= 1 && getPasskey.length <= 1
}

async function loadProvider(): Promise<NativePasskeyModule | null> {
  if (cachedModule !== undefined) return cachedModule
  try {
    // Import dinamis + try/catch: paket ini OPTIONAL. Bila tidak terpasang
    // (mis. install dengan --no-optional) aplikasi tetap jalan.
    const mod = (await import(PROVIDER_MODULE)) as unknown
    const resolved = (mod as { default?: unknown }).default ?? mod
    cachedModule = isProviderCapable(resolved) ? (resolved as NativePasskeyModule) : null
  } catch {
    cachedModule = null
  }
  return cachedModule
}

/**
 * Periksa ketersediaan passkey native. Tidak pernah melempar.
 *
 * Hasilnya di-cache per proses: kemampuan perangkat tidak berubah selama
 * aplikasi hidup, dan tombol masuk tidak boleh menunggu probe berulang.
 */
export async function probeNativePasskey(): Promise<NativePasskeyProbe> {
  if (cachedProbe) return cachedProbe
  cachedProbe = await runProbe()
  return cachedProbe
}

async function runProbe(): Promise<NativePasskeyProbe> {
  if (Platform.OS === "web") return { available: false, reason: "NOT_NATIVE" }
  if (!NATIVE_PASSKEY_ENABLED) return { available: false, reason: "DISABLED" }
  const mod = await loadProvider()
  if (!mod) {
    // Tidak bisa membedakan "tidak terpasang" dari "bentuk API tidak cocok"
    // tanpa mencoba require dua kali; keduanya berarti provider tidak usable.
    return { available: false, reason: "PROVIDER_INCOMPLETE" }
  }
  try {
    if (typeof mod.isAvailable === "function") {
      const ok = await mod.isAvailable()
      if (!ok) return { available: false, reason: "RUNTIME_ERROR" }
    }
  } catch {
    return { available: false, reason: "RUNTIME_ERROR" }
  }
  return { available: true }
}

// ── Normalisasi encoding ───────────────────────────────────────────────
// Provider native lazim mengembalikan base64 STANDAR (RFC 4648 dengan `+`,
// `/`, dan padding `=`) sementara kontrak backend kita — mengikuti
// @simplewebauthn/server — memakai base64URL tanpa padding. Mengirim apa
// adanya membuat server gagal decode; karena itu semua nilai dikunci di sini.

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** base64 standar → base64url tanpa padding. Input base64url dibiarkan utuh. */
export function toBase64Url(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null
  // GUID (bentuk `PasskeyUserInfo.id` di expo-passkeys) → 16 byte mentah.
  // Backend mengirim user handle base64url, jadi GUID wajib dikonversi agar
  // id yang terdaftar cocok dengan yang diverifikasi server.
  if (GUID_RE.test(value)) {
    const hex = value.replace(/-/g, "")
    let binary = ""
    for (let i = 0; i < hex.length; i += 2) {
      binary += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16))
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  }
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Ambil field base64 wajib dari respons provider.
 *
 * Nama `field` masuk telemetri, bukan pesan layar: pesannya SATU kalimat tetap
 * (NATIVE_PASSKEY_MESSAGES.missingField) supaya kunci i18n-nya tidak beranak
 * per nama field, sementara tim tetap tahu field mana yang hilang.
 */
function requireB64(value: unknown, field: string): string {
  const normalized = toBase64Url(typeof value === "string" ? value : null)
  if (!normalized) {
    logWarn("passkey:native-response", { field })
    throw new PasskeyError("UNKNOWN", NATIVE_PASSKEY_MESSAGES.missingField)
  }
  return normalized
}

type RawResponse = {
  id?: unknown
  rawId?: unknown
  type?: unknown
  response?: Record<string, unknown>
  clientExtensionResults?: unknown
}

/**
 * Adaptor murni respons provider → kontrak backend. Diekspor supaya bisa diuji
 * TANPA provider native sungguhan (tidak ada simulator di CI); bentuk keluaran
 * inilah yang dikirim ke POST /v1/auth/passkey/register/verify.
 */
export function toRegistrationResponse(raw: unknown): RegistrationResponseJSON {
  const value = (raw ?? {}) as RawResponse
  const response = value.response ?? {}
  return {
    id: requireB64(value.id, "id kredensial"),
    rawId: requireB64(value.rawId ?? value.id, "rawId"),
    type: typeof value.type === "string" && value.type.length > 0 ? value.type : "public-key",
    response: {
      attestationObject: requireB64(response.attestationObject, "attestationObject"),
      clientDataJSON: requireB64(response.clientDataJSON, "clientDataJSON"),
      transports: Array.isArray(response.transports)
        ? (response.transports.filter((t) => typeof t === "string") as string[])
        : [],
    },
    clientExtensionResults:
      value.clientExtensionResults && typeof value.clientExtensionResults === "object"
        ? (value.clientExtensionResults as Record<string, unknown>)
        : {},
  }
}

/** Adaptor murni assertion provider → kontrak POST /v1/auth/passkey/auth/verify. */
export function toAuthenticationResponse(raw: unknown): AuthenticationResponseJSON {
  const value = (raw ?? {}) as RawResponse
  const response = value.response ?? {}
  return {
    id: requireB64(value.id, "id kredensial"),
    rawId: requireB64(value.rawId ?? value.id, "rawId"),
    type: typeof value.type === "string" && value.type.length > 0 ? value.type : "public-key",
    response: {
      authenticatorData: requireB64(response.authenticatorData, "authenticatorData"),
      clientDataJSON: requireB64(response.clientDataJSON, "clientDataJSON"),
      signature: requireB64(response.signature, "signature"),
      userHandle: toBase64Url(
        typeof response.userHandle === "string" ? response.userHandle : null,
      ),
    },
    clientExtensionResults:
      value.clientExtensionResults && typeof value.clientExtensionResults === "object"
        ? (value.clientExtensionResults as Record<string, unknown>)
        : {},
  }
}

/**
 * Error native → PasskeyError berbahasa Indonesia dengan KODE.
 *
 * Diekspor untuk test: pesan mentah SDK (sering Bahasa Inggris, sering memuat
 * nama kelas native) tidak boleh sampai ke layar — yang tampil adalah hasil
 * pemetaan ini.
 */
export function toNativePasskeyError(err: unknown): PasskeyError {
  if (err instanceof PasskeyError) return err
  const message = err instanceof Error ? err.message : String(err ?? "")
  // "User interaction interrupted" (Credential Manager Android) dan
  // ASAuthorizationCanceled (iOS) sama-sama berarti pengguna/system
  // menghentikan sheet — perlakukan seperti pembatalan (diam, tanpa Alert).
  if (/cancel|batal|ERR_CANCELED|interrupted/i.test(message)) {
    return new PasskeyError("CANCELLED", NATIVE_PASSKEY_MESSAGES.cancelled)
  }
  if (/not_allowed|NotAllowedError|user_verification|timeout/i.test(message)) {
    return new PasskeyError("NOT_ALLOWED", NATIVE_PASSKEY_MESSAGES.notAllowed)
  }
  if (/no_credential|not_found|NotFound/i.test(message)) {
    return new PasskeyError("UNKNOWN", NATIVE_PASSKEY_MESSAGES.noCredential)
  }
  return new PasskeyError("UNKNOWN", NATIVE_PASSKEY_MESSAGES.unknown)
}

async function capableProvider(): Promise<NativePasskeyModule> {
  const probe = await probeNativePasskey()
  if (!probe.available) {
    throw new PasskeyError("NOT_SUPPORTED", nativeUnsupportedMessage(probe.reason))
  }
  const mod = await loadProvider()
  if (!mod?.createPasskey || !mod?.getPasskey) {
    throw new PasskeyError("NOT_SUPPORTED", nativeUnsupportedMessage("PROVIDER_INCOMPLETE"))
  }
  return mod
}

/** Pesan jujur per alasan — dipakai UI tanpa harus merakit kalimat sendiri. */
export function nativeUnsupportedMessage(reason?: NativePasskeyReason): string {
  switch (reason) {
    case "NOT_NATIVE":
      return PASSKEY_COPY.unsupportedMessages.webauthn
    case "MODULE_MISSING":
    case "PROVIDER_INCOMPLETE":
    case "RUNTIME_ERROR":
    case "DISABLED":
      return PASSKEY_COPY.unsupportedMessages.native
    default:
      return PASSKEY_COPY.unsupportedMessages.default
  }
}

/**
 * Daftarkan passkey lewat provider native.
 * Bentuk keluaran SAMA dengan jalur web, jadi payload
 * POST /v1/auth/passkey/register/verify tidak berubah.
 */
export async function registerNativePasskey(
  options: RegistrationOptionsJSON,
): Promise<RegistrationResponseJSON> {
  const mod = await capableProvider()
  try {
    return toRegistrationResponse(await mod.createPasskey!(options as never))
  } catch (err) {
    throw toNativePasskeyError(err)
  }
}

/**
 * Minta assertion passkey lewat provider native.
 * `conditional` (autofill UI) adalah kemampuan WebAuthn; native memunculkan
 * sheet sistemnya sendiri, jadi opsi itu diabaikan di sini.
 */
export async function authenticateNativePasskey(
  options: AuthenticationOptionsJSON,
): Promise<AuthenticationResponseJSON> {
  const mod = await capableProvider()
  try {
    return toAuthenticationResponse(await mod.getPasskey!(options as never))
  } catch (err) {
    throw toNativePasskeyError(err)
  }
}
