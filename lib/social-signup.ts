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
 *
 * Audit Auth 2026-10-10 (#FE-S2): token punya UMUR lokal. Sebelumnya token
 * yang ditinggalkan (user menekan "Lanjutkan daftar" lalu batal) tetap hidup
 * di memori tanpa batas dan dipakai DIAM-DIAM oleh registrasi berikutnya di
 * perangkat yang sama — akun orang lain tertaut ke Google/Apple pengguna
 * sebelumnya. Kini token kedaluwarsa setelah `PENDING_SOCIAL_SIGNUP_TTL_MS`
 * dan `clearSession()` juga membersihkannya.
 */

/** Selaras dengan TTL temp token backend (5 menit) + margin alur registrasi. */
export const PENDING_SOCIAL_SIGNUP_TTL_MS = 10 * 60 * 1000

let pendingLinkToken: string | null = null
let pendingIssuedAt = 0

export function setPendingSocialSignup(linkToken: string, now: number = Date.now()): void {
  pendingLinkToken = linkToken
  pendingIssuedAt = now
}

export function getPendingSocialSignup(now: number = Date.now()): string | null {
  if (!pendingLinkToken) return null
  if (now - pendingIssuedAt > PENDING_SOCIAL_SIGNUP_TTL_MS) {
    clearPendingSocialSignup()
    return null
  }
  return pendingLinkToken
}

export function clearPendingSocialSignup(): void {
  pendingLinkToken = null
  pendingIssuedAt = 0
}
