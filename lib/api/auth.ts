/**
 * Kahade — domain `auth` (26 endpoint, tag "auth" di kahade-api-mobile.json).
 *
 * Tipe REQUEST diimpor dari lib/api/types.ts (dihasilkan dari spec — persis).
 *
 * Tipe RESPONSE: spec TIDAK punya schema response untuk auth (hanya
 * `200: { description: "" }`). Bentuk di bawah adalah kontrak MINIMAL yang
 * dibutuhkan alur klien (mis. login harus mengembalikan accessToken atau
 * tempToken 2FA) dan ditandai `// UNVERIFIED`. Saat backend membagikan contoh
 * response, cocokkan di sini — pemakai modul ini tidak perlu berubah.
 *
 * Keputusan non-obvious:
 *   - `deviceId`/`deviceInfo` di LoginDto, Verify2faLoginDto, VerifyPhoneOtpDto,
 *     PhoneRegisterDto DIISI OTOMATIS dari session.ts. Screen hanya mengirim
 *     kredensial; parameter bertipe `Omit<Dto, "deviceId" | "deviceInfo">`
 *     supaya tidak ada yang lupa/menyimpang dari deviceId per-install.
 *   - Endpoint yang mengembalikan access token (login, verify-2fa, verify-otp,
 *     phone-register) LANGSUNG menyimpannya ke SecureStore di sini, bukan di
 *     screen — satu tempat, tidak ada jalur login yang lupa menyimpan token.
 *   - Semua endpoint auth publik memakai `auth: "none"` agar 401 dari
 *     password salah TIDAK memicu refresh token (lihat client.ts).
 *   - `logout()` membersihkan sesi lokal MESKI request gagal (offline) —
 *     user yang menekan "Keluar" harus benar-benar keluar.
 */
import { http } from "@/lib/api/client"
import { asRecord as responseRecord, invalidResponse, stringList } from "@/lib/api/response"
import { clearSession, getDeviceId, getDeviceInfo, startSession } from "@/lib/api/session"
import type {
  ChangePasswordDto,
  CorrectEmailDto,
  Disable2faDto,
  Enable2faDto,
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  PhoneRegisterDto,
  RegisterDto,
  RequestOtpDto,
  ResendVerificationDto,
  ResetPasswordDto,
  SetUsernameDto,
  Setup2faDto,
  Verify2faLoginDto,
  VerifyEmailDto,
  VerifyPasswordDto,
  VerifyPhoneOtpDto,
} from "@/lib/api/types"

// ------------------------------------------------------------------
// Tipe response — UNVERIFIED (tidak ada di spec; lihat catatan header)
// ------------------------------------------------------------------

/** Pasangan token; `refreshToken` hanya ada bila backend mengirimnya di body (default: cookie). */
export type AuthTokens = {
  accessToken: string
  refreshToken?: string
  /** Detik hingga access token kedaluwarsa */
  expiresIn?: number
}

/** Ringkasan user yang lazim ikut di response login. */
export type AuthUser = {
  id: string
  email?: string
  username?: string | null
  fullName?: string
  emailVerified?: boolean
  phoneNumber?: string | null
}

/**
 * Login bisa berakhir di 2 cabang: sukses penuh (token) atau butuh 2FA
 * (tempToken untuk `/2fa/verify-login`). Discriminated union agar screen
 * wajib menangani keduanya.
 */
export type LoginResult =
  | ({ requiresTwoFactor?: false; user?: AuthUser } & AuthTokens)
  | { requiresTwoFactor: true; tempToken: string; user?: AuthUser }

/** Hasil verify-otp telepon: sudah punya akun → token; belum → tempToken untuk phone-register. */
export type VerifyOtpResult =
  | ({ isNewUser?: false; user?: AuthUser } & AuthTokens)
  | { isNewUser: true; tempToken: string }

export type CaptchaChallenge = {
  captchaId: string
  /** Gambar puzzle (data URL / URL) */
  image: string
  /** Potongan puzzle yang harus digeser ke posisi X (0–100) */
  piece?: string
  expiresAt?: string
}

export type OtpMethod = RequestOtpDto["method"]
export type OtpMethodsResult = { methods: OtpMethod[] }

export type TwoFactorStatus = { enabled: boolean; backupCodesRemaining?: number }

export type TwoFactorSetup = {
  secret: string
  /** otpauth:// URI untuk QR authenticator */
  otpauthUrl: string
  qrCode?: string
}

export type BackupCodes = { backupCodes: string[] }


export type MessageResult = { message: string }

export type CsrfToken = { csrfToken: string }

// ------------------------------------------------------------------
// Helper internal
// ------------------------------------------------------------------

type WithoutDevice<T> = Omit<T, "deviceId" | "deviceInfo">

async function withDevice<T extends { deviceId?: string; deviceInfo?: string }>(
  dto: WithoutDevice<T>,
): Promise<T> {
  return { ...dto, deviceId: await getDeviceId(), deviceInfo: getDeviceInfo() } as T
}

async function persistTokens(result: Record<string, unknown>): Promise<void> {
  const token = (result?.accessToken ?? result?.access_token ?? result?.token) as string | undefined
  const refresh = (result?.refreshToken ?? result?.refresh_token) as string | undefined
  if (typeof token !== "string" || !token.trim())
    throw invalidResponse("auth/tokens")
  await startSession({ accessToken: token, refreshToken: refresh })
}

// ------------------------------------------------------------------
// Captcha & CSRF
// ------------------------------------------------------------------

export async function generateCaptcha() {
  const result = await http.post<CaptchaChallenge>("/v1/auth/captcha/generate", undefined, { auth: "none" })
  return {
    ...result,
    captchaId: result.captchaId ?? (result as any).captcha_id,
    expiresAt: result.expiresAt ?? (result as any).expires_at,
  }
}

export async function getCsrfToken() {
  const result = await http.get<CsrfToken>("/v1/auth/csrf-token", { auth: "none" })
  return {
    ...result,
    csrfToken: result.csrfToken ?? (result as any).csrf_token,
  }
}

// ------------------------------------------------------------------
// Registrasi email
// ------------------------------------------------------------------

export async function register(dto: RegisterDto) {
  const body = await withDevice<RegisterDto & { deviceId?: string; deviceInfo?: string }>(dto)
  const result = await http.post<MessageResult & { user?: AuthUser }, any>("/v1/auth/register", body, {
    auth: "none",
  })
  return result
}

export function verifyEmail(dto: VerifyEmailDto) {
  return http.post<MessageResult, VerifyEmailDto>("/v1/auth/verify-email", dto, { auth: "none" })
}

/** Varian tautan email: `GET /v1/auth/verify-email?email=&token=` */
export function verifyEmailByLink(query: { email: string; token: string }) {
  return http.get<MessageResult>("/v1/auth/verify-email", { query, auth: "none" })
}

export function resendVerification(dto: ResendVerificationDto) {
  return http.post<MessageResult, ResendVerificationDto>("/v1/auth/resend-verification", dto, {
    auth: "none",
  })
}

export function correctEmail(dto: CorrectEmailDto) {
  return http.post<MessageResult, CorrectEmailDto>("/v1/auth/correct-email", dto, { auth: "none" })
}

// ------------------------------------------------------------------
// Registrasi / login via nomor telepon (OTP)
// ------------------------------------------------------------------

/** Semua metode yang dikenal spec (`RequestOtpDto.method` enum) — urutan = urutan tampil default. */
export const OTP_METHODS: readonly OtpMethod[] = ["SMS", "WHATSAPP"]

function isOtpMethod(value: unknown): value is OtpMethod {
  return typeof value === "string" && (OTP_METHODS as readonly string[]).includes(value)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * Normalisasi response `otp-methods` — UNVERIFIED (spec hanya `200: ""`).
 * Menerima bentuk yang lazim dari NestJS: `["SMS","WHATSAPP"]`,
 * `{ methods: [...] }`, `{ data: [...] }`, atau array objek
 * `{ method|id|name|value, enabled?|available? }`. Nilai di luar enum spec
 * dibuang, duplikat dirapikan, urutan mengikuti backend. Hasil kosong berarti
 * "backend tidak menawarkan apa pun" — pemanggil yang memutuskan fallback.
 */
export function normalizeOtpMethods(raw: unknown): OtpMethod[] {
  const rec = asRecord(raw)
  const list = Array.isArray(raw) ? raw : (rec?.methods ?? rec?.data ?? rec?.availableMethods ?? rec?.available_methods)
  if (!Array.isArray(list)) return []

  const out: OtpMethod[] = []
  for (const item of list) {
    let candidate: unknown = item
    const obj = asRecord(item)
    if (obj) {
      if (obj.enabled === false || obj.is_enabled === false || obj.available === false || obj.is_available === false) continue
      candidate = obj.method ?? obj.id ?? obj.name ?? obj.value
    }
    const upper = typeof candidate === "string" ? candidate.toUpperCase() : candidate
    if (isOtpMethod(upper) && !out.includes(upper)) out.push(upper)
  }
  return out
}

export async function getOtpMethods(): Promise<OtpMethodsResult> {
  const raw = await http.get<unknown>("/v1/auth/otp-methods", { auth: "none" })
  return { methods: normalizeOtpMethods(raw) }
}

export async function requestOtp(dto: RequestOtpDto) {
  const body = await withDevice<RequestOtpDto & { deviceId?: string; deviceInfo?: string }>(dto)
  const result = await http.post<MessageResult & { expiresIn?: number; cooldownSeconds?: number }, any>(
    "/v1/auth/request-otp",
    body,
    { auth: "none" },
  )
  return {
    ...result,
    expiresIn: result.expiresIn ?? (result as any).expires_in,
    cooldownSeconds: result.cooldownSeconds ?? (result as any).cooldown_seconds,
  }
}

export async function verifyOtp(dto: WithoutDevice<VerifyPhoneOtpDto>) {
  const body = await withDevice<VerifyPhoneOtpDto>(dto)
  const result = await http.post<VerifyOtpResult, VerifyPhoneOtpDto>("/v1/auth/verify-otp", body, {
    auth: "none",
  })
  if (!responseRecord(result)) throw invalidResponse("verify-otp")
  
  const isNew = result.isNewUser ?? (result as any).is_new_user
  const tempToken = (result as any).tempToken ?? (result as any).temp_token

  if (isNew) {
    if (typeof tempToken !== "string" || !tempToken)
      throw invalidResponse("verify-otp/tempToken")
    return { ...result, isNewUser: true, tempToken }
  } else {
    await persistTokens(result)
  }
  return result
}

export async function phoneRegister(dto: Omit<PhoneRegisterDto, "deviceId">) {
  const body: PhoneRegisterDto = { ...dto, deviceId: await getDeviceId() }
  const result = await http.post<AuthTokens & { user?: AuthUser }, PhoneRegisterDto>(
    "/v1/auth/phone-register",
    body,
    {
      auth: "none",
    },
  )
  await persistTokens(result)
  return result
}

/** Dipanggil setelah login sosial/telepon yang belum punya username (butuh Bearer). */
export function setUsername(dto: SetUsernameDto) {
  return http.post<AuthUser, SetUsernameDto>("/v1/auth/set-username", dto, { auth: "required" })
}

// ------------------------------------------------------------------
// Login / 2FA / sesi
// ------------------------------------------------------------------

export async function login(dto: WithoutDevice<LoginDto>) {
  const body = await withDevice<LoginDto>(dto)
  const result = await http.post<LoginResult, LoginDto>("/v1/auth/login", body, { auth: "none" })
  if (!responseRecord(result)) throw invalidResponse("login")
  
  // Normalize response keys that might be snake_case
  const requires2fa = result.requiresTwoFactor ?? (result as any).requires_two_factor
  const tempToken = (result as any).tempToken ?? (result as any).temp_token

  if (requires2fa) {
    if (typeof tempToken !== "string" || !tempToken)
      throw invalidResponse("login/tempToken")
    return { ...result, requiresTwoFactor: true, tempToken }
  } else {
    await persistTokens(result)
  }
  return result
}

export async function verify2faLogin(dto: WithoutDevice<Verify2faLoginDto>) {
  const body = await withDevice<Verify2faLoginDto>(dto)
  const result = await http.post<AuthTokens & { user?: AuthUser }, Verify2faLoginDto>(
    "/v1/auth/2fa/verify-login",
    body,
    { auth: "none" },
  )
  await persistTokens(result)
  return result
}

/**
 * Keluar. Request ke server best-effort; sesi lokal SELALU dibersihkan.
 * Pemanggil bertanggung jawab memanggil `unregisterPushDevice()` SEBELUM ini
 * (endpoint itu butuh access token yang akan dihapus di sini).
 */
export async function logout(dto: LogoutDto = {}): Promise<void> {
  try {
    await http.post<MessageResult | undefined, LogoutDto>("/v1/auth/logout", dto, {
      auth: "optional",
      responseType: "void",
    })
  } catch (err) {
    if (__DEV__) console.warn("[kahade/api] logout server gagal (sesi lokal tetap dihapus):", err)
  } finally {
    await clearSession()
  }
}

// ------------------------------------------------------------------
// Password
// ------------------------------------------------------------------

export async function forgotPassword(dto: ForgotPasswordDto) {
  const body = await withDevice<ForgotPasswordDto & { deviceId?: string; deviceInfo?: string }>(dto)
  return http.post<MessageResult, any>("/v1/auth/forgot-password", body, {
    auth: "none",
  })
}

export async function resetPassword(dto: ResetPasswordDto) {
  const body = await withDevice<ResetPasswordDto & { deviceId?: string; deviceInfo?: string }>(dto)
  return http.post<MessageResult, any>("/v1/auth/reset-password", body, {
    auth: "none",
  })
}

/** Re-auth sebelum aksi sensitif (ubah email, hapus akun). */
export function verifyPassword(dto: VerifyPasswordDto) {
  return http.post<{ valid: boolean } | MessageResult, VerifyPasswordDto>(
    "/v1/auth/verify-password",
    dto,
    {
      auth: "required",
    },
  )
}

export function changePassword(dto: ChangePasswordDto) {
  return http.post<MessageResult, ChangePasswordDto>("/v1/auth/change-password", dto, {
    auth: "required",
  })
}

// ------------------------------------------------------------------
// 2FA (TOTP)
// ------------------------------------------------------------------

export async function get2faStatus() {
  const result = await http.get<TwoFactorStatus>("/v1/auth/2fa/status", { auth: "required" })
  return {
    ...result,
    backupCodesRemaining: result.backupCodesRemaining ?? (result as any).backup_codes_remaining,
  }
}

export async function setup2fa(dto: Setup2faDto) {
  const result = await http.post<TwoFactorSetup, Setup2faDto>("/v1/auth/2fa/setup", dto, { auth: "required" })
  return {
    ...result,
    otpauthUrl: result.otpauthUrl ?? (result as any).otpauth_url,
    qrCode: result.qrCode ?? (result as any).qr_code,
  }
}

export async function enable2fa(dto: Enable2faDto) {
  const result = await http.post<BackupCodes & Partial<MessageResult>, Enable2faDto>("/v1/auth/2fa/enable", dto, {
    auth: "required",
  })
  return {
    ...result,
    backupCodes: stringList(result.backupCodes ?? (result as any).backup_codes),
  }
}

/** Kirim OTP email yang dibutuhkan `Disable2faDto.emailOtpCode`. */
export function request2faDisableOtp() {
  return http.post<MessageResult>("/v1/auth/2fa/request-disable-otp", undefined, {
    auth: "required",
  })
}

export function disable2fa(dto: Disable2faDto) {
  return http.post<MessageResult, Disable2faDto>("/v1/auth/2fa/disable", dto, { auth: "required" })
}

/** Spec memakai `Setup2faDto` (password) sebagai body regenerate. */
export async function regenerateBackupCodes(dto: Setup2faDto) {
  const result = await http.post<BackupCodes, Setup2faDto>("/v1/auth/2fa/backup-codes/regenerate", dto, {
    auth: "required",
  })
  return {
    ...result,
    backupCodes: stringList(result.backupCodes ?? (result as any).backup_codes),
  }
}
