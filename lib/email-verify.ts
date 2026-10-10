/**
 * Kahade — email yang baru diganti, menunggu verifikasi (Audit Auth
 * 2026-10-10, #FE-I9).
 *
 * `change-email` dulu membawa alamat baru ke `/verify-email` lewat ROUTE
 * PARAM — di web alamat email (PII) masuk history browser & header Referer.
 * Pola yang sama dengan holder lain (lib/registration.ts, dsb.): memori modul,
 * dibaca sekali oleh layar verifikasi, dibersihkan setelah dipakai.
 */
let pendingEmail: string | null = null

export function setPendingVerifyEmail(email: string | null): void {
  pendingEmail = email && email.trim() ? email.trim() : null
}

/** Ambil & bersihkan (sekali pakai). */
export function takePendingVerifyEmail(): string | null {
  const value = pendingEmail
  pendingEmail = null
  return value
}
