/**
 * Kahade — state reset kata sandi sementara (auth-rework 2026-09-26).
 *
 * Menyimpan `tempToken` dari `verify-otp` (status `password_reset`) untuk
 * layar reset-password → `POST /v1/auth/reset-password`. Module-level memory,
 * BUKAN SecureStore dan BUKAN route params — alasan yang sama seperti
 * `lib/registration.ts`: short-lived, tidak perlu bertahan dari restart, dan
 * kredensial tidak boleh lewat URL.
 */
export type PasswordResetState = {
  /** Temp token dari `POST /v1/auth/verify-otp` (status `password_reset`). */
  tempToken: string
  /** Nomor HP E.164 yang sedang direset — untuk ditampilkan kembali. */
  phoneNumber: string
}

let state: PasswordResetState | null = null

/** Simpan state reset. Menimpa state sebelumnya bila ada. */
export function setPasswordResetState(data: PasswordResetState): void {
  state = data
}

/** Baca state reset aktif. `null` bila tidak ada alur yang berjalan. */
export function getPasswordResetState(): PasswordResetState | null {
  return state
}

/** Hapus state — dipanggil setelah reset berhasil, atau user membatalkan. */
export function clearPasswordResetState(): void {
  state = null
}

/** Reset memori (dipakai test). */
export function resetPasswordResetStateForTest(): void {
  state = null
}
