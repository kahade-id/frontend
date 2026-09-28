/**
 * Kahade — domain `social` (GAP-A G001–G025): login & tautan akun
 * Google/Apple.
 *
 * Kontrak backend (auth.controller.ts, diverifikasi 2026-09-27):
 *   GET    /v1/auth/social/providers        → kemampuan provider
 *   POST   /v1/auth/social/login            → SocialLoginResult
 *   GET    /v1/auth/social                  → provider tertaut (auth)
 *   POST   /v1/auth/social/link             → SocialLinkResult (auth)
 *   POST   /v1/auth/social/link/confirm     → SocialLinkResult (publik, re-auth)
 *   DELETE /v1/auth/social/:provider        → void (auth)
 *
 * Keputusan produk: social login adalah METODE MASUK TAMBAHAN, bukan
 * registrasi alternatif — registrasi tetap nomor HP + OTP WhatsApp.
 * Identitas social tanpa akun tertaut → `linkRequired` → arahkan ke
 * pendaftaran/verifikasi nomor HP yang sudah terverifikasi.
 */

import { http } from "@/lib/api/client"
import {
  asRecord,
  invalidResponse,
  pickBoolean,
  pickString,
  readList,
} from "@/lib/api/response"
import { startSession } from "@/lib/api/session"

/**
 * Simpan token sesi dari hasil social login (sama pola dengan auth.ts).
 */
async function persistSocialTokens(record: Record<string, unknown>): Promise<void> {
  const accessToken = pickString(record, ["accessToken", "access_token", "token"])
  const refreshToken = pickString(record, ["refreshToken", "refresh_token"])
  if (!accessToken) throw invalidResponse("social/tokens")
  await startSession({ accessToken, refreshToken: refreshToken ?? undefined })
}

export type SocialProvider = "GOOGLE" | "APPLE"

/**
 * POST /v1/auth/apple/nonce — minta nonce terbitan server untuk Apple Sign-in.
 *
 * KONTRAK Wave 1 backend (BREAKING, 2026-09-28): backend HANYA menerima nonce
 * yang diterbitkannya sendiri. Nonce buatan klien 100% ditolak untuk Apple.
 * Alur wajib:
 *   1. requestAppleNonce() → nonce
 *   2. pakai nonce itu di Apple auth request (expo-apple-authentication / web)
 *   3. kirim nonce yang SAMA di socialLogin()/linkSocial()
 * Nonce hanya berlaku untuk satu percobaan; gagal/cancel → minta lagi.
 */
export async function requestAppleNonce(): Promise<string> {
  const raw = await http.post<unknown>("/v1/auth/apple/nonce", undefined, { auth: "none" })
  const record = asRecord(raw)
  const nonce = record ? pickString(record, ["nonce"]) : null
  if (!nonce) throw invalidResponse("apple/nonce")
  return nonce
}

export interface SocialProviderCapability {
  provider: SocialProvider
  enabled: boolean
  configured: boolean
  /** OAuth client ID publik dari server — dipakai untuk memulai alur OAuth. */
  appId?: string | null
}

/**
 * Bentuk hasil login sosial ternormalisasi. Server mengembalikan salah satu:
 *  - sesi penuh (accessToken/refreshToken) → langsung login;
 *  - requires2FA + tempToken → lanjut /verify-2fa;
 *  - requiresPhoneMigration + migrationToken → lanjut migrasi nomor;
 *  - requiresLink + isNewIdentity → identitas sosial baru: user WAJIB daftar
 *    nomor HP dulu (OTP WhatsApp); linkToken (scope social_signup) dibawa ke
 *    phone-register untuk ditautkan setelah nomor terverifikasi;
 *  - requiresLink (tanpa isNewIdentity) → konflik email: user membuktikan
 *    kepemilikan akun lama (password/2FA/OTP) lalu confirmSocialLink.
 */
export type SocialLoginResult =
  | { kind: "session"; accessToken: string; refreshToken: string; user?: unknown }
  | { kind: "twoFactor"; tempToken: string }
  | { kind: "phoneMigration"; migrationToken: string }
  | { kind: "linkRequired"; linkToken: string }
  | { kind: "confirmLink"; linkToken: string; maskedEmail?: string; provider: SocialProvider }

export interface LinkedSocialProvider {
  provider: SocialProvider
  linkedAt?: string
  lastUsedAt?: string
}

export interface SocialLinkResult {
  linked: boolean
  requiresConfirmation: boolean
  linkToken?: string
  maskedEmail?: string
}

/** GET /v1/auth/social/providers — provider mana yang bisa dipakai (G002). */
export async function getProviders(signal?: AbortSignal): Promise<SocialProviderCapability[]> {
  const raw = await http.get<unknown>("/v1/auth/social/providers", { auth: "none", signal })
  const list = readList<SocialProviderCapability>(raw, ["providers"])
  return list
    .filter((p) => p.provider === "GOOGLE" || p.provider === "APPLE")
    .map((p) => ({
      provider: p.provider,
      // `enabled` = terkonfigurasi di server; tanpa appId (OAuth client id)
      // aplikasi tidak bisa memulai alur OAuth → anggap tidak tersedia.
      enabled: p.enabled && !!p.appId,
      configured: !!p.appId,
      appId: p.appId,
    }))
}

/**
 * POST /v1/auth/social/login — tukar idToken provider menjadi sesi Kahade.
 * Token sesi langsung disimpan di SecureStore (sama seperti api.auth.login).
 */
export interface SocialLoginDto {
  provider: SocialProvider
  idToken: string
  nonce?: string
  deviceId?: string
  deviceInfo?: string
  location?: unknown
}

export async function socialLogin(dto: SocialLoginDto): Promise<SocialLoginResult> {
  const raw = await http.post<unknown, SocialLoginDto>("/v1/auth/social/login", dto, { auth: "none" })
  const record = asRecord(raw)
  if (!record) throw invalidResponse("social-login")

  if (pickBoolean(record, ["requiresLink"])) {
    const linkToken = pickString(record, ["linkToken"])
    if (!linkToken) throw invalidResponse("social-login/linkToken")
    if (pickBoolean(record, ["isNewIdentity"])) {
      // Identitas sosial baru: daftar nomor HP dulu, tautkan setelah verifikasi.
      return { kind: "linkRequired", linkToken }
    }
    // Konflik email: buktikan kepemilikan akun lama, lalu confirmSocialLink.
    const providerRaw = pickString(record, ["provider"])?.toUpperCase()
    const provider: SocialProvider = providerRaw === "APPLE" ? "APPLE" : "GOOGLE"
    return {
      kind: "confirmLink",
      linkToken,
      maskedEmail: pickString(record, ["maskedEmail"]),
      provider,
    }
  }
  const requires2fa = pickBoolean(record, ["requiresTwoFactor", "requires2FA"])
  if (requires2fa) {
    const tempToken = pickString(record, ["tempToken"])
    if (!tempToken) throw invalidResponse("social-login/tempToken")
    return { kind: "twoFactor", tempToken }
  }
  const requiresMigration = pickBoolean(record, ["requiresPhoneMigration"])
  if (requiresMigration) {
    const migrationToken = pickString(record, ["migrationToken"])
    if (!migrationToken) throw invalidResponse("social-login/migrationToken")
    return { kind: "phoneMigration", migrationToken }
  }
  const accessToken = pickString(record, ["accessToken"])
  const refreshToken = pickString(record, ["refreshToken"])
  if (!accessToken || !refreshToken) throw invalidResponse("social-login/tokens")
  await persistSocialTokens(record)
  return { kind: "session", accessToken, refreshToken, user: record.user }
}

/** GET /v1/auth/social — provider yang tertaut ke akun ini (G013). */
export function listLinked(signal?: AbortSignal): Promise<LinkedSocialProvider[]> {
  return http
    .get<unknown>("/v1/auth/social", { auth: "required", signal })
    .then((raw) => readList<LinkedSocialProvider>(raw, ["providers"]))
}

/**
 * POST /v1/auth/social/link — tautkan provider ke akun login (G014).
 * `reauth` = password / kode 2FA / token re-auth sesuai DTO backend.
 */
export interface SocialLinkDto {
  provider: SocialProvider
  idToken: string
  nonce?: string
  password?: string
  mfaCode?: string
  reauthToken?: string
}

export async function linkSocial(dto: SocialLinkDto): Promise<SocialLinkResult> {
  const raw = await http.post<unknown, SocialLinkDto>("/v1/auth/social/link", dto, { auth: "required" })
  const record = asRecord(raw)
  if (!record) throw invalidResponse("social-link")
  const requiresConfirmation = pickBoolean(record, ["requiresConfirmation"]) ?? false
  return {
    linked: pickBoolean(record, ["linked"]) ?? false,
    requiresConfirmation,
    linkToken: requiresConfirmation ? pickString(record, ["linkToken"]) : undefined,
    maskedEmail: pickString(record, ["maskedEmail"]),
  }
}

/**
 * POST /v1/auth/social/link/confirm — konfirmasi penautan saat email
 * bentrok (G014). Membutuhkan re-auth akun lama: `password` / `otpCode` /
 * `reauthToken` (salah satu) + `mfaCode` bila 2FA aktif.
 * Token sesi hasil penautan langsung disimpan (seperti login).
 */
export interface SocialConfirmLinkDto {
  linkToken: string
  password?: string
  mfaCode?: string
  otpCode?: string
  reauthToken?: string
}

export async function confirmSocialLink(dto: SocialConfirmLinkDto): Promise<SocialLinkResult> {
  const raw = await http.post<unknown, SocialConfirmLinkDto>("/v1/auth/social/link/confirm", dto, { auth: "none" })
  const record = asRecord(raw)
  if (!record) throw invalidResponse("social-link-confirm")
  const accessToken = pickString(record, ["accessToken"])
  if (accessToken) await persistSocialTokens(record)
  return {
    linked: pickBoolean(record, ["linked"]) ?? !!accessToken,
    requiresConfirmation: false,
    maskedEmail: pickString(record, ["maskedEmail"]),
  }
}

/** DELETE /v1/auth/social/:provider — lepas tautan (G018/G019). */
export function unlinkSocial(
  provider: SocialProvider,
  dto: { password?: string; mfaCode?: string; reauthToken?: string },
): Promise<void> {
  return http.delete<void, typeof dto>(`/v1/auth/social/${provider}`, {
    auth: "required",
    body: dto,
    responseType: "void",
  })
}
