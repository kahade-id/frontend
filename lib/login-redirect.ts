/**
 * Kahade — tujuan setelah login (guest mode web).
 *
 * Saat pengunjung web menyentuh layar yang butuh akun, ia diarahkan ke
 * ajakan login dengan `next` (path tujuan). Modul memori ini meneruskan
 * `next` melewati alur login / 2FA sampai tiba di Welcome/Beranda — sama
 * seperti lib/two-factor-login.ts yang membawa tempToken antar layar.
 *
 * Tidak disimpan persisten: kegunaannya hanya dalam satu rangkaian login;
 * reload memulai konteks baru dengan aman di Beranda tamu.
 */
let pendingNext: string | null = null

export function setPendingNext(path: string | null | undefined): void {
  pendingNext = path && path.startsWith("/") ? path : null
}

/** Ambil & bersihkan tujuan tertunda. */
export function takePendingNext(): string | null {
  const value = pendingNext
  pendingNext = null
  return value
}

export function peekPendingNext(): string | null {
  return pendingNext
}
