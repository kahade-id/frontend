/**
 * Kahade — state sementara login 2FA (antara Login → Verify 2FA).
 *
 * `POST /v1/auth/login` mengembalikan `{ requiresTwoFactor: true, tempToken }`
 * bila akun memakai TOTP. tempToken itu harus dikirim ke
 * `POST /v1/auth/2fa/verify-login` bersama kode. Disimpan di memori modul —
 * SAMA polanya dengan `lib/registration.ts` — bukan lewat route params:
 * param muncul di URL/deeplink (web + log navigasi) dan tempToken adalah
 * kredensial berumur pendek.
 *
 * Hilang saat app di-restart — itu memang yang diinginkan (user harus login
 * ulang; tempToken pun sudah kedaluwarsa).
 */

export type PendingTwoFactorLogin = {
  tempToken: string
  /** Email yang dipakai login — hanya untuk ditampilkan di layar verifikasi. */
  email: string
}

let pending: PendingTwoFactorLogin | null = null

export function setPendingTwoFactorLogin(data: PendingTwoFactorLogin): void {
  pending = data
}

export function getPendingTwoFactorLogin(): PendingTwoFactorLogin | null {
  return pending
}

export function clearPendingTwoFactorLogin(): void {
  pending = null
}
