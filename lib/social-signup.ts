/**
 * Kahade — token signup sosial tertunda (antara Login sosial → Register).
 *
 * `POST /v1/auth/social/login` mengembalikan `{ requiresLink: true,
 * isNewIdentity: true, linkToken }` bila identitas Google/Apple belum punya
 * akun Kahade. Registrasi TETAP nomor HP + OTP WhatsApp: user menyelesaikan
 * alur register biasa, dan linkToken (scope social_signup) dikirim bersama
 * `POST /v1/auth/phone-register` untuk menautkan akun sosial SETELAH nomor
 * terverifikasi.
 *
 * Disimpan di memori modul — pola yang sama dengan lib/two-factor-login.ts:
 * token berumur pendek tidak boleh lewat route params (muncul di URL/deeplink
 * web). Hilang saat app di-restart — user mengulang login sosial.
 */

let pendingLinkToken: string | null = null

export function setPendingSocialSignup(linkToken: string): void {
  pendingLinkToken = linkToken
}

export function getPendingSocialSignup(): string | null {
  return pendingLinkToken
}

export function clearPendingSocialSignup(): void {
  pendingLinkToken = null
}
