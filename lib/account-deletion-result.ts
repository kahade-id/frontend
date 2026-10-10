/**
 * Kahade — hasil permintaan hapus akun yang baru dikirim (Audit Auth
 * 2026-10-10, #FE-S16).
 *
 * Masalah: `POST /v1/users/me/delete-request` MENCABUT semua sesi di server
 * dan layar `/delete-account` langsung `clearSession()`. Rute itu ada di
 * `AUTHENTICATED_SCREENS`, jadi begitu token hilang `Stack.Protected`
 * mencabut layarnya — tampilan "kode referensi + tanggal hapus permanen +
 * cara membatalkan" tidak pernah terlihat (hanya toast 4 detik), lalu root
 * layout mengalihkan ke `/login?next=/delete-account`. Pengguna kehilangan
 * satu-satunya kode yang dibutuhkan untuk membatalkan penghapusan.
 *
 * Solusi: hasilnya disimpan di memori modul SEBELUM sesi dibersihkan, lalu
 * ditampilkan oleh layar PUBLIK `/deletion-status` (yang memang menangani
 * status/pembatalan pra-login). Memori modul (bukan SecureStore): kode
 * referensi hanya perlu bertahan satu navigasi; setelah dibaca sekali ia
 * dibuang agar tidak tampil lagi untuk pengguna berikutnya di perangkat ini.
 */
import type { DeletionRequestResult } from "@/lib/api/account-deletion"

let pending: DeletionRequestResult | null = null

export function setPendingDeletionResult(result: DeletionRequestResult): void {
  pending = result
}

/** Ambil & buang hasil yang tertunda (sekali baca). */
export function takePendingDeletionResult(): DeletionRequestResult | null {
  const value = pending
  pending = null
  return value
}

export function clearPendingDeletionResult(): void {
  pending = null
}
