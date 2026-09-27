/**
 * Kahade — domain `passkey` (GAP-A: G026–G050).
 *
 * Endpoint: POST /v1/auth/passkey/register/options|verify,
 *           POST /v1/auth/passkey/auth/options|verify (publik),
 *           GET/PATCH/DELETE /v1/auth/passkey[/:id],
 *           POST /v1/auth/passkey/recover.
 *
 * Keputusan non-obvious:
 *  - Endpoint auth/* memakai `auth: "none"` seperti login: 401 dari assertion
 *    salah TIDAK boleh memicu refresh token (lihat client.ts).
 *  - verifyAuthLogin menormalisasi `requires2FA` backend → `requiresTwoFactor`
 *    mengikuti kontrak LoginResult di lib/api/auth.ts, dan menyimpan token
 *    via startSession persis seperti login() — satu jalur sesi.
 *  - Re-auth (password/mfaCode/otpCode/reauthToken) diteruskan apa adanya ke
 *    backend; validasi silang (mana yang wajib) milik server.
 */
import { http } from "@/lib/api/client"
import {
  asRecord,
  invalidResponse,
  pickBoolean,
  pickString,
} from "@/lib/api/response"
import { getDeviceId, getDeviceInfo, startSession } from "@/lib/api/session"
import type { LoginResult } from "@/lib/api/auth"

export type PasskeySummary = {
  id: string
  deviceName: string
  deviceType: string | null
  createdAt: string
  lastUsedAt: string | null
}

export type PasskeyOptionsBundle<T> = {
  challengeId: string
  options: T
}

export type PasskeyReauth = {
  password?: string
  mfaCode?: string
  otpCode?: string
  reauthToken?: string
}

export type PasskeyLoginResult =
  | ({ requiresTwoFactor?: false; requiresPhoneMigration?: false } & Record<string, unknown>)
  | { requiresTwoFactor: true; tempToken: string }
  | { requiresPhoneMigration: true; migrationToken: string }

async function persistTokens(result: Record<string, unknown>): Promise<void> {
  const token = (result?.accessToken ?? result?.access_token) as string | undefined
  const refresh = (result?.refreshToken ?? result?.refresh_token) as string | undefined
  if (typeof token !== "string" || !token.trim()) throw invalidResponse("passkey/tokens")
  await startSession({ accessToken: token, refreshToken: refresh })
}

// ── Registrasi ───────────────────────────────────────────────────────

export async function getRegisterOptions(
  dto: PasskeyReauth & { deviceName?: string },
  signal?: AbortSignal,
): Promise<PasskeyOptionsBundle<unknown>> {
  const result = await http.post<PasskeyOptionsBundle<unknown>, PasskeyReauth & { deviceName?: string }>(
    "/v1/auth/passkey/register/options",
    dto,
    { auth: "required", signal },
  )
  if (!asRecord(result)) throw invalidResponse("passkey/register/options")
  return result
}

export async function verifyRegistration(
  dto: { challengeId: string; attestation: unknown; deviceName?: string },
  signal?: AbortSignal,
): Promise<PasskeySummary> {
  const result = await http.post<PasskeySummary, { challengeId: string; attestation: unknown; deviceName?: string }>("/v1/auth/passkey/register/verify", dto, {
    auth: "required",
    signal,
  })
  if (!asRecord(result)) throw invalidResponse("passkey/register/verify")
  return result
}

// ── Login ────────────────────────────────────────────────────────────

export async function getAuthOptions(
  dto: { username?: string } = {},
  signal?: AbortSignal,
): Promise<PasskeyOptionsBundle<unknown>> {
  const result = await http.post<PasskeyOptionsBundle<unknown>, { username?: string }>(
    "/v1/auth/passkey/auth/options",
    dto,
    { auth: "none", signal },
  )
  if (!asRecord(result)) throw invalidResponse("passkey/auth/options")
  return result
}

/**
 * Verifikasi assertion & terbitkan sesi. Menangani 3 cabang seperti login():
 * token langsung (disimpan), requiresTwoFactor (→ layar kode 2FA),
 * requiresPhoneMigration (→ alur migrasi).
 */
export async function verifyAuthLogin(dto: {
  challengeId: string
  assertion: unknown
}): Promise<PasskeyLoginResult> {
  const body = { ...dto, deviceId: await getDeviceId(), deviceInfo: getDeviceInfo() }
  const result = await http.post<LoginResult, { deviceId: string; deviceInfo: string; challengeId: string; assertion: unknown }>("/v1/auth/passkey/auth/verify", body, { auth: "none" })
  if (!asRecord(result)) throw invalidResponse("passkey/auth/verify")
  const record = asRecord(result) ?? {}

  const requiresMigration =
    pickBoolean(record, ["requiresPhoneMigration", "requires_phone_migration"]) ??
    (result as { requiresPhoneMigration?: boolean }).requiresPhoneMigration
  const migrationToken = pickString(record, ["migrationToken", "migration_token"])
  if (requiresMigration) {
    if (typeof migrationToken !== "string" || !migrationToken)
      throw invalidResponse("passkey/migrationToken")
    return { requiresPhoneMigration: true, migrationToken }
  }

  // Backend mengirim `requires2FA`; frontend memakai `requiresTwoFactor`.
  const requires2fa =
    pickBoolean(record, ["requiresTwoFactor", "requires_two_factor", "requires2FA", "requires_2fa"]) ??
    (result as { requires2FA?: boolean }).requires2FA
  const tempToken = pickString(record, ["tempToken", "temp_token"])
  if (requires2fa) {
    if (typeof tempToken !== "string" || !tempToken) throw invalidResponse("passkey/tempToken")
    return { requiresTwoFactor: true, tempToken }
  }

  await persistTokens(record)
  return result as PasskeyLoginResult
}

// ── Manajemen ────────────────────────────────────────────────────────

export async function listPasskeys(signal?: AbortSignal): Promise<PasskeySummary[]> {
  const result = await http.get<{ items: PasskeySummary[] }>("/v1/auth/passkey", {
    auth: "required",
    signal,
  })
  if (!asRecord(result)) throw invalidResponse("passkey/list")
  return Array.isArray(result.items) ? result.items : []
}

export async function renamePasskey(
  id: string,
  dto: PasskeyReauth & { deviceName: string },
): Promise<PasskeySummary> {
  const result = await http.patch<PasskeySummary, PasskeyReauth & { deviceName: string }>(`/v1/auth/passkey/${id}`, dto, {
    auth: "required",
  })
  if (!asRecord(result)) throw invalidResponse("passkey/rename")
  return result
}

export async function revokePasskey(id: string, dto: PasskeyReauth): Promise<{ message: string }> {
  const result = await http.delete<{ message: string }, PasskeyReauth>(`/v1/auth/passkey/${id}`, {
    auth: "required",
    body: dto,
  })
  if (!asRecord(result)) throw invalidResponse("passkey/revoke")
  return result
}

// ── Recovery (G039) ──────────────────────────────────────────────────

export type PasskeyRecoverResult = {
  message: string
  newDevice?: boolean
  reauthToken?: string
  expiresIn?: number
}

export async function recoverPasskey(dto: {
  step: "request" | "verify"
  otpCode?: string
  deviceId?: string
}): Promise<PasskeyRecoverResult> {
  const body = { ...dto, deviceId: dto.deviceId ?? (await getDeviceId()) }
  const result = await http.post<PasskeyRecoverResult, { step: "request" | "verify"; otpCode?: string; deviceId: string }>("/v1/auth/passkey/recover", body, {
    auth: "required",
  })
  if (!asRecord(result)) throw invalidResponse("passkey/recover")
  return result
}

// ── Kebijakan (G044) ─────────────────────────────────────────────────

export async function getPasskeyPolicy(signal?: AbortSignal): Promise<{ requiredFor: string[] }> {
  const result = await http.get<{ requiredFor: string[] }>("/v1/auth/passkey/policy/required-for", {
    auth: "required",
    signal,
  })
  if (!asRecord(result)) throw invalidResponse("passkey/policy")
  return result
}
