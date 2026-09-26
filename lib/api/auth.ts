/**
 * Kahade — domain `auth` (tag "auth" di kahade-api-mobile.json).
 *
 * Tipe REQUEST diimpor dari lib/api/types.ts (dihasilkan dari spec — persis).
 * Spec auth di-selaras-kan dengan kontrak auth-rework (2026-09-26, frozen):
 * login pakai `identifier`, OTP hanya via WhatsApp customer-initiated,
 * registrasi via nomor HP + password (min 8, tanpa kompleksitas), lokasi
 * presisi opsional di semua request auth sensitif.
 *
 * Tipe RESPONSE: spec TIDAK punya schema response untuk auth (hanya
 * `200: { description: "" }`). Bentuk di bawah adalah kontrak MINIMAL yang
 * dibutuhkan alur klien dan ditandai `// UNVERIFIED`. Saat backend membagikan
 * contoh response, cocokkan di sini — pemakai modul ini tidak perlu berubah.
 *
 * Keputusan non-obvious:
 *   - `deviceId`/`deviceInfo` di LoginDto, Verify2faLoginDto, VerifyPhoneOtpDto,
 *     PhoneRegisterDto, MigratePhoneConfirmDto DIISI OTOMATIS dari session.ts.
 *     Screen hanya mengirim kredensial; parameter bertipe
 *     `Omit<Dto, "deviceId" | "deviceInfo">` supaya tidak ada yang
 *     lupa/menyimpang dari deviceId per-install.
 *   - Endpoint yang mengembalikan access token (login, verify-2fa, verify-otp
 *     existing_user, phone-register, migrate-phone/confirm) LANGSUNG
 *     menyimpannya ke SecureStore di sini, bukan di screen — satu tempat,
 *     tidak ada jalur login yang lupa menyimpan token.
 *   - Semua endpoint auth publik memakai `auth: "none"` agar 401 dari
 *     password salah TIDAK memicu refresh token (lihat client.ts).
 *   - `logout()` membersihkan sesi lokal MESKI request gagal (offline) —
 *     user yang menekan "Keluar" harus benar-benar keluar.
 *   - `location` (LocationDto) opsional di SEMUA request auth sensitif.
 *     Screen memanggil `getAuthLocation()` (lib/location.ts) — null bila izin
 *     ditolak/gagal, dan alur TIDAK boleh diblokir karenanya.
 */
import { http } from "@/lib/api/client"
import {
  asRecord as responseRecord,
  invalidResponse,
  pickBoolean,
  pickNumber,
  pickString,
  pickUnknown,
  readVerdict,
  stringList,
} from "@/lib/api/response"
import { clearSession, getDeviceId, getDeviceInfo, startSession } from "@/lib/api/session"
import type {
  ChangePasswordDto,
  ConfirmPhoneChangeDto,
  CorrectEmailDto,
  Disable2faDto,
  Enable2faDto,
  ForgotPasswordDto,
  LocationDto,
  LoginDto,
  LogoutDto,
  MigratePhoneConfirmDto,
  OtpTriggerRequestDto,
  PhoneRegisterDto,
  RegenerateBackupCodesDto,
  RequestPhoneChangeDto,
  ResendVerificationDto,
  ResetPasswordDto,
  SetUsernameDto,
  Setup2faDto,
  Verify2faLoginDto,
  VerifyEmailDto,
  VerifyPasswordDto,
  VerifyPhoneOtpDto,
} from "@/lib/api/types"

/** Lokasi presisi opsional yang dilampirkan ke request auth sensitif. */
export type { LocationDto }

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
 * Login bisa berakhir di 3 cabang: sukses penuh (token), butuh 2FA
 * (tempToken untuk `/2fa/verify-login`), atau akun lama yang WAJIB migrasi
 * tambah nomor HP (migrationToken untuk layar `/phone-migration`).
 * Discriminated union agar screen wajib menangani ketiganya.
 *
 * PENTING: cabang migrasi TIDAK menyimpan token — `persistTokens` tidak boleh
 * dipanggil sebelum cabang ini diperiksa (tidak ada accessToken di response).
 */
export type LoginResult =
  | ({ requiresTwoFactor?: false; requiresPhoneMigration?: false; user?: AuthUser } & AuthTokens)
  | { requiresTwoFactor: true; tempToken: string; user?: AuthUser }
  | { requiresPhoneMigration: true; migrationToken: string }

/**
 * Hasil verify-otp telepon (kontrak auth-rework): status eksplisit, bukan
 * boolean. `tempToken` dipakai langkah berikutnya sesuai status:
 *   - new_user → phone-register
 *   - password_reset → reset-password
 *   - migration_verified → migrate-phone/confirm
 *   - existing_user → token (disimpan otomatis)
 */
export type VerifyOtpStatus = "new_user" | "existing_user" | "password_reset" | "migration_verified"

export type VerifyOtpResult =
  | { status: "new_user"; tempToken: string }
  | ({ status: "existing_user"; user?: AuthUser } & AuthTokens)
  | { status: "password_reset"; tempToken: string }
  | { status: "migration_verified"; tempToken: string }

/**
 * Tantangan captcha backend = SLIDER, bukan gambar+kode.
 *
 * Bentuk asli dari `POST /v1/auth/captcha/generate` (diverifikasi live):
 *   `{ challengeId, targetX }` — `targetX` adalah posisi target dalam PERSEN
 *   (backend membangkitkannya di rentang 20–80). Jawaban yang dikirim kembali
 *   adalah posisi slider pengguna (`captchaAnswer`, 0–100); backend menerima
 *   selisih ≤4 poin, dan tantangan kedaluwarsa dalam 120 detik (Redis TTL) +
 *   minimal 800 ms sejak dibuat.
 *
 * Dulu tipe ini menuntut `captchaId` + `image` (captcha gambar teks) sehingga
 * `captchaId` SELALU undefined terhadap backend sekarang: setiap request yang
 * menyertakan captcha terkirim tanpa id dan dijawab 401 `CAPTCHA_REQUIRED`
 * ("Captcha verification is required") — persis pesan yang dilihat pengguna di
 * layar "Gagal mengirim kode" saat lupa password.
 */
export type CaptchaChallenge = {
  /** ID tantangan (`challengeId`; alias `captchaId` lama tetap dibaca) */
  captchaId: string
  /** Posisi target dalam persen (0–100) yang harus didekati slider */
  targetX: number
  expiresAt?: string
}

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
type WithoutDeviceId<T> = Omit<T, "deviceId">

/**
 * DTO auth backend TIDAK seragam soal field perangkat (forbidNonWhitelisted
 * aktif global — field ekstra = 400 "property X should not exist"):
 *   - login / verify-2fa / verify-phone-otp: deviceId (wajib) + deviceInfo (opsional)
 *   - otp-trigger / phone-register / migrate-phone/confirm: deviceId (wajib)
 *   - forgot-password / reset-password: TANPA deviceId/deviceInfo
 * withDevice/withDeviceId dipakai sesuai DTO masing-masing.
 */
async function withDeviceId<T extends { deviceId?: string }>(
  dto: WithoutDeviceId<T>,
): Promise<T> {
  return { ...dto, deviceId: await getDeviceId() } as T
}

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

export async function generateCaptcha(): Promise<CaptchaChallenge> {
  const raw = await http.post<unknown>("/v1/auth/captcha/generate", undefined, { auth: "none" })
  const outer = asRecord(raw)
  // Sebagian respons dibungkus `{ data: … }` sebelum envelope sukses dilepas.
  const result = asRecord(outer?.data) ?? outer
  if (!result) throw invalidResponse("captcha/generate")

  // D-04 (audit): tanpa cast — nilai diperiksa runtime oleh picker bertipe,
  // jadi salah nama field kembali menjadi `undefined` yang terlihat, bukan
  // nilai yang lolos lewat lubang tipe.
  const captchaId = pickString(result, ["challengeId", "challenge_id", "captchaId", "captcha_id"])
  const targetX = pickNumber(result, ["targetX", "target_x"])
  if (!captchaId || typeof targetX !== "number") throw invalidResponse("captcha/generate")

  return {
    captchaId,
    targetX,
    expiresAt: pickString(result, ["expiresAt", "expires_at"]),
  }
}

export async function getCsrfToken() {
  // The live backend derives the CSRF token from the authenticated user's
  // `sub` and `jti`; this route is protected even though it is under /auth.
  const result = await http.get<CsrfToken>("/v1/auth/csrf-token", { auth: "required" })
  const record = asRecord(result)
  return {
    ...result,
    csrfToken: pickString(record, ["csrfToken", "csrf_token"]) ?? result.csrfToken,
  }
}

// ------------------------------------------------------------------
// Registrasi email — DIHAPUS (kontrak auth-rework 2026-09-26).
//
// POST /v1/auth/register (email) dijawab backend dengan 410; registrasi
// kini HANYA via nomor HP: requestOtpTrigger(purpose="register") →
// verify-otp → phoneRegister. Fungsi `register()` dihapus — tidak ada
// pemanggil yang tersisa. Endpoint verifikasi email di bawah ini (untuk
// akun yang sudah punya email) tidak terdampak kontrak dan dipertahankan.
// ------------------------------------------------------------------

export function verifyEmail(dto: VerifyEmailDto, signal?: AbortSignal) {
  return http.post<MessageResult, VerifyEmailDto>("/v1/auth/verify-email", dto, { auth: "none", signal })
}

/** Varian tautan email: `GET /v1/auth/verify-email?email=&token=` */
export function verifyEmailByLink(query: { email: string; token: string }, signal?: AbortSignal) {
  return http.get<MessageResult>("/v1/auth/verify-email", { query, auth: "none", signal })
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * WhatsApp OTP trigger (customer-initiated conversation) — SATU-SATUNYA jalur
 * OTP (kontrak auth-rework 2026-09-26).
 *
 * Bot WhatsApp tidak mem-push OTP duluan (pola yang rawan dilaporkan dan
 * membekukan akun bot); user yang MEMINTA lewat chat akan dibalas OTP.
 * `requestOtpTrigger()` hanya menyiapkan permintaan tertunda + kode referensi
 * 12 hex (tidak ada pesan keluar sampai user mengirim pesan pemicunya
 * sendiri). Layar `/whatsapp-trigger` menampilkan deeplink wa.me dan
 * mem-polling status sampai backend membalas OTP.
 *
 * TIDAK ADA jalur kirim-langsung: `sendOtpDirect()` dan `requestOtp()`
 * dihapus — backend menjawab 410 untuk keduanya.
 */
export type OtpTriggerPurpose = OtpTriggerRequestDto["purpose"]

export type OtpTriggerRequestResult = {
  /** Kode referensi 12 hex uppercase - mengikat pesan pemicu ke nomor & sesi ini. */
  refCode: string
  /** Teks lengkap yang harus dikirim user (berisi refCode). */
  triggerText: string
  /** Deeplink wa.me yang sudah berisi teks pemicu. */
  whatsappUrl: string
  expiresInSeconds: number
  expiresAt: string
}

export type OtpTriggerPollStatus = "WAITING" | "COMPLETED" | "FAILED" | "EXPIRED"

/** Parser payload trigger — dipakai requestOtpTrigger & forgotPassword (bentuk sama). */
function parseOtpTriggerResult(raw: unknown, endpoint: string): OtpTriggerRequestResult {
  // Envelope sukses mungkin sudah dilepas client; bila masih ada, field
  // payload di `data` menimpa field envelope (spread terakhir menang).
  const outer = asRecord(raw) ?? {}
  const rec = { ...outer, ...(asRecord(outer.data) ?? {}) }
  const refCode = pickString(rec, ["refCode", "ref_code", "referenceCode"])
  const whatsappUrl = pickString(rec, ["whatsappUrl", "whatsapp_url", "waUrl", "deepLink"])
  let triggerText = pickString(rec, ["triggerText", "trigger_text"])
  if (!triggerText && whatsappUrl) {
    // Fallback: teks pemicu ada di query `text` deeplink wa.me.
    try {
      triggerText = new URL(whatsappUrl).searchParams.get("text") ?? undefined
    } catch {
      // URL tidak valid - ditangani oleh pengecekan di bawah.
    }
  }
  if (!refCode || !whatsappUrl || !triggerText) throw invalidResponse(endpoint)
  const expiresInSeconds = pickNumber(rec, ["expiresInSeconds", "expires_in"]) ?? 600
  return {
    refCode,
    triggerText,
    whatsappUrl,
    expiresInSeconds,
    expiresAt:
      pickString(rec, ["expiresAt", "expires_at"]) ??
      new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  }
}

export async function requestOtpTrigger(dto: {
  phoneNumber: string
  purpose: OtpTriggerPurpose
  migrationToken?: string
  location?: LocationDto
}) {
  const body = await withDeviceId<OtpTriggerRequestDto>({
    phoneNumber: dto.phoneNumber,
    purpose: dto.purpose,
    migrationToken: dto.migrationToken,
    location: dto.location,
  })
  const result = await http.post<unknown, Record<string, unknown>>(
    "/v1/auth/otp-trigger",
    body,
    { auth: "none" },
  )
  return parseOtpTriggerResult(result, "otp-trigger")
}

export type OtpTriggerStatusResult = {
  status: OtpTriggerPollStatus
  /** Tujuan OTP — echo backend; untuk validasi silang dengan alur lokal. */
  purpose?: OtpTriggerPurpose
}

export async function getOtpTriggerStatus(
  refCode: string,
  signal?: AbortSignal,
): Promise<OtpTriggerStatusResult> {
  const raw = await http.get<unknown>(`/v1/auth/otp-trigger/status/${encodeURIComponent(refCode)}`, {
    auth: "none",
    signal,
  })
  const outer = asRecord(raw) ?? {}
  const rec = { ...outer, ...(asRecord(outer.data) ?? {}) }
  const status = typeof rec?.status === "string" ? rec.status.toUpperCase() : ""
  if (status === "WAITING" || status === "COMPLETED" || status === "FAILED" || status === "EXPIRED") {
    const purposeRaw = typeof rec?.purpose === "string" ? rec.purpose : undefined
    const purpose = (
      purposeRaw === "register" ||
      purposeRaw === "login" ||
      purposeRaw === "forgot_password" ||
      purposeRaw === "migrate_phone"
        ? purposeRaw
        : undefined
    ) as OtpTriggerPurpose | undefined
    return { status: status as OtpTriggerPollStatus, purpose }
  }
  throw invalidResponse("otp-trigger/status")
}

export async function verifyOtp(dto: {
  phoneNumber: string
  code: string
  location?: LocationDto
}): Promise<VerifyOtpResult> {
  const body = await withDevice<VerifyPhoneOtpDto & { location?: LocationDto }>(dto)
  const result = await http.post<unknown, Record<string, unknown>>("/v1/auth/verify-otp", body, {
    auth: "none",
  })
  if (!responseRecord(result)) throw invalidResponse("verify-otp")

  const record = asRecord(result) ?? {}
  const statusRaw = pickString(record, ["status"])
  const status = (
    statusRaw === "new_user" ||
    statusRaw === "existing_user" ||
    statusRaw === "password_reset" ||
    statusRaw === "migration_verified"
      ? statusRaw
      : undefined
  ) as VerifyOtpStatus | undefined

  // Fallback defensif: backend lama mengirim boolean isNewUser.
  const legacyNew = status === undefined ? pickBoolean(record, ["isNewUser", "is_new_user"]) : undefined
  const resolved: VerifyOtpStatus | undefined =
    status ?? (legacyNew === undefined ? undefined : legacyNew ? "new_user" : "existing_user")
  if (!resolved) throw invalidResponse("verify-otp/status")

  const tempToken = pickString(record, ["tempToken", "temp_token"])
  if (resolved !== "existing_user") {
    if (typeof tempToken !== "string" || !tempToken)
      throw invalidResponse("verify-otp/tempToken")
    return { status: resolved, tempToken }
  }
  await persistTokens(record)
  // record sudah ternormalisasi sebagai Record; status eksplisit adalah
  // satu-satunya bentuk yang dipakai pemanggil.
  return { status: "existing_user" } as VerifyOtpResult
}

/**
 * Registrasi via nomor HP — DISDERHANAKAN (kontrak auth-rework).
 * Hanya: tempToken (dari verify-otp status new_user), nama lengkap, username
 * opsional (backend auto-generate bila kosong), password (min 8, tanpa
 * syarat kompleksitas), deviceId, lokasi opsional.
 *
 * Field lama (dateOfBirth, gender, email, pin, address, referralCode) tidak
 * lagi dikirim — backend 410/tidak mengenalnya. PIN wallet diatur belakangan
 * di Pengaturan (layar change-pin), bukan saat registrasi.
 */
export async function phoneRegister(dto: {
  tempToken: string
  fullName: string
  username?: string
  password: string
  location?: LocationDto
}) {
  const body: PhoneRegisterDto = {
    tempToken: dto.tempToken,
    fullName: dto.fullName,
    username: dto.username?.trim() ? dto.username.trim() : undefined,
    password: dto.password,
    deviceId: await getDeviceId(),
    location: dto.location,
  }
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

/**
 * Konfirmasi migrasi nomor HP (kontrak auth-rework — endpoint baru).
 * Dipanggil setelah verify-otp status `migration_verified`: menukar tempToken
 * menjadi sesi penuh (token disimpan otomatis).
 */
export async function confirmPhoneMigration(dto: {
  tempToken: string
  location?: LocationDto
}) {
  const body = await withDeviceId<MigratePhoneConfirmDto>({
    tempToken: dto.tempToken,
    location: dto.location,
  })
  const result = await http.post<
    AuthTokens & { user?: AuthUser; message?: string },
    MigratePhoneConfirmDto
  >("/v1/auth/migrate-phone/confirm", body, { auth: "none" })
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

export async function login(dto: WithoutDevice<LoginDto> & { location?: LocationDto }) {
  const body = await withDevice<LoginDto & { location?: LocationDto }>(dto)
  const result = await http.post<LoginResult, LoginDto>("/v1/auth/login", body, { auth: "none" })
  if (!responseRecord(result)) throw invalidResponse("login")

  // Normalize response keys that might be snake_case
  const record = asRecord(result) ?? {}

  // Cabang migrasi DIPERIKSA DULU: tidak ada accessToken di response ini,
  // jadi persistTokens() tidak boleh dipanggil sebelum cabang ini.
  const requiresMigration =
    pickBoolean(record, ["requiresPhoneMigration", "requires_phone_migration"]) ??
    (result as { requiresPhoneMigration?: boolean }).requiresPhoneMigration
  const migrationToken = pickString(record, ["migrationToken", "migration_token"])
  if (requiresMigration) {
    if (typeof migrationToken !== "string" || !migrationToken)
      throw invalidResponse("login/migrationToken")
    return { ...result, requiresPhoneMigration: true, migrationToken }
  }

  const requires2fa =
    pickBoolean(record, ["requiresTwoFactor", "requires_two_factor"]) ??
    (result as { requiresTwoFactor?: boolean }).requiresTwoFactor
  const tempToken = pickString(record, ["tempToken", "temp_token"])

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
// Password — kontrak auth-rework: reset via WhatsApp OTP, bukan email.
// ------------------------------------------------------------------

/**
 * Lupa kata sandi: HANYA nomor HP (`identifier`; email → 400).
 * Response = payload trigger WhatsApp yang sama seperti otp-trigger +
 * `{ via: "whatsapp_trigger" }`. Layar forgot-password langsung meneruskan
 * payload ini ke `/whatsapp-trigger` (tanpa request kedua).
 */
export async function forgotPassword(dto: { identifier: string; location?: LocationDto }) {
  const body: ForgotPasswordDto = {
    identifier: dto.identifier,
    location: dto.location,
  }
  const result = await http.post<unknown, ForgotPasswordDto>("/v1/auth/forgot-password", body, {
    auth: "none",
  })
  return { ...parseOtpTriggerResult(result, "forgot-password"), via: "whatsapp_trigger" as const }
}

/**
 * Reset kata sandi: tempToken dari verify-otp (status `password_reset`) +
 * kata sandi baru (min 8). Tidak ada lagi field email/otp/confirmPassword.
 */
export async function resetPassword(dto: {
  tempToken: string
  newPassword: string
  location?: LocationDto
}) {
  const body: ResetPasswordDto = {
    tempToken: dto.tempToken,
    newPassword: dto.newPassword,
    location: dto.location,
  }
  return http.post<MessageResult, ResetPasswordDto>("/v1/auth/reset-password", body, {
    auth: "none",
  })
}

/**
 * Re-auth sebelum aksi sensitif (ubah email, hapus akun).
 *
 * Dinormalisasi dengan alasan yang sama seperti `verifyWalletPin`: ini gerbang
 * keamanan. Bila backend menjawab `{ isValid: false }` dan respons hanya
 * di-cast, `res.valid` menjadi `undefined` dan pemanggil yang menulis
 * `if (res.valid === false)` akan MEMBIARKAN password yang salah lolos.
 * Fallback `false` = tanpa flag yang dikenal, dianggap tidak terverifikasi.
 */
export async function verifyPassword(dto: VerifyPasswordDto) {
  const raw = await http.post<unknown, VerifyPasswordDto>("/v1/auth/verify-password", dto, {
    auth: "required",
  })
  const { value, record } = readVerdict(raw, ["valid", "isValid", "is_valid", "verified"], false)
  return {
    valid: value,
    message: pickString(record, ["message"]),
  }
}

export function changePassword(dto: ChangePasswordDto) {
  return http.post<MessageResult, ChangePasswordDto>("/v1/auth/change-password", dto, {
    auth: "required",
  })
}

/** Normalize the deliberately small response shared by both phone-change steps. */
export function normalizePhoneChangeResult(raw: unknown): MessageResult {
  const record = responseRecord(raw)
  if (!record || typeof record.message !== "string" || !record.message.trim()) {
    throw invalidResponse("phone-change")
  }
  return { message: record.message }
}

/** Request a sensitive-action OTP. Device identity is already sent by the HTTP boundary header. */
export async function requestPhoneChange(dto: RequestPhoneChangeDto): Promise<MessageResult> {
  const result = await http.post<unknown, RequestPhoneChangeDto>(
    "/v1/auth/phone-change/request",
    dto,
    { auth: "required" },
  )
  return normalizePhoneChangeResult(result)
}

/** Confirming revokes all account sessions server-side, including the current session. */
export async function confirmPhoneChange(dto: ConfirmPhoneChangeDto): Promise<MessageResult> {
  const result = await http.post<unknown, ConfirmPhoneChangeDto>(
    "/v1/auth/phone-change/confirm",
    dto,
    { auth: "required" },
  )
  return normalizePhoneChangeResult(result)
}

// ------------------------------------------------------------------
// 2FA (TOTP)
// ------------------------------------------------------------------

export async function get2faStatus(signal?: AbortSignal) {
  const result = await http.get<TwoFactorStatus>("/v1/auth/2fa/status", { auth: "required", signal })
  return {
    ...result,
    backupCodesRemaining:
      pickNumber(asRecord(result), ["backupCodesRemaining", "backup_codes_remaining"]) ??
      result.backupCodesRemaining,
  }
}

export async function setup2fa(dto: Setup2faDto) {
  const result = await http.post<TwoFactorSetup, Setup2faDto>("/v1/auth/2fa/setup", dto, { auth: "required" })
  return {
    ...result,
    otpauthUrl: pickString(asRecord(result), ["otpauthUrl", "otpauth_url"]) ?? result.otpauthUrl,
    qrCode: pickString(asRecord(result), ["qrCode", "qr_code"]) ?? result.qrCode,
  }
}

export async function enable2fa(dto: Enable2faDto) {
  const result = await http.post<BackupCodes & Partial<MessageResult>, Enable2faDto>("/v1/auth/2fa/enable", dto, {
    auth: "required",
  })
  return {
    ...result,
    backupCodes: stringList(result.backupCodes ?? pickUnknown(asRecord(result), ["backup_codes"])),
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

/**
 * Body regenerate adalah `RegenerateBackupCodesDto` = `{ password, code }`,
 * dengan `code` = 6 digit TOTP (`minLength: 6`, `maxLength: 6`) dan KEDUA field
 * `required`.
 *
 * Komentar lama di sini berbunyi "Spec memakai `Setup2faDto` (password)" dan
 * layar hanya mengirim `{ password }`. Itu tidak lagi benar terhadap spec:
 * class-validator menolak dengan 400, sehingga membuat-ulang kode cadangan
 * selalu gagal — tepat di alur pemulihan 2FA, saat kode lama mungkin sudah
 * hilang. `code` kini wajib dari pemanggil.
 */
export async function regenerateBackupCodes(dto: RegenerateBackupCodesDto) {
  const result = await http.post<BackupCodes, RegenerateBackupCodesDto>(
    "/v1/auth/2fa/backup-codes/regenerate",
    dto,
    { auth: "required" },
  )
  return {
    ...result,
    backupCodes: stringList(result.backupCodes ?? pickUnknown(asRecord(result), ["backup_codes"])),
  }
}
