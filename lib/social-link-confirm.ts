/**
 * Kahade — token konfirmasi tautan sosial tertunda (Login sosial → Tautkan Akun).
 *
 * `POST /v1/auth/social/login` mengembalikan `{ requiresLink: true,
 * linkToken }` (bukan identitas baru) bila email sosial sudah dipakai akun
 * Kahade lain. User membuktikan kepemilikan akun lama via kata sandi (+2FA)
 * di layar `/social-link-confirm`, lalu `POST /v1/auth/social/link/confirm`
 * menautkan identitas sosial.
 *
 * Disimpan di memori modul — pola yang SAMA dengan lib/two-factor-login.ts
 * dan lib/social-signup.ts: token sekali-pakai TIDAK boleh lewat route params
 * (muncul di URL/deeplink web + log navigasi). BATCH4-B4.
 *
 * BATCH4-B3 (anti stale): token dibersihkan setiap kali layar dibuka TANPA
 * token segar, dan setelah confirm selesai/gagal-definitif — token basi tidak
 * pernah dipakai diam-diam untuk menautkan identitas yang salah.
 *
 * Hilang saat app di-restart — user mengulang login sosial (fail-closed).
 */

export type PendingSocialLinkConfirm = {
  linkToken: string
  /** Email tersamar — hanya untuk ditampilkan di layar konfirmasi. */
  maskedEmail?: string
  provider: string
}

let pending: PendingSocialLinkConfirm | null = null

export function setPendingSocialLinkConfirm(data: PendingSocialLinkConfirm): void {
  pending = data
}

export function getPendingSocialLinkConfirm(): PendingSocialLinkConfirm | null {
  return pending
}

export function clearPendingSocialLinkConfirm(): void {
  pending = null
}
