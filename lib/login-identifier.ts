/**
 * Kahade — penyimpanan identifier login selama sesi formulir (Batch 139, A01).
 *
 * Masalah: setelah login gagal, identifier bertahan (state lokal). Tapi bila
 * user membuka tautan bantuan ("Lupa kata sandi?") lalu kembali, layar login
 * me-remount dan identifier hilang — user harus mengetik ulang.
 *
 * Solusi: simpan nilai NON-RAHASIA (identifier) di memori modul selama sesi
 * formulir. Dibaca ulang saat layar login di-mount; dibersihkan saat login
 * BERHASIL (sesi formulir selesai). Kata sandi TIDAK PERNAH disimpan di sini.
 *
 * Memori modul (bukan SecureStore/persist): identifier login memang
 * non-rahasia, dan nilai ini tidak boleh bertahan setelah app ditutup —
 * "selama sesi formulir" sesuai spesifikasi item.
 */

let pendingIdentifier = ""

/** Baca identifier yang tersimpan dari sesi formulir sebelumnya. */
export function getLoginIdentifier(): string {
  return pendingIdentifier
}

/** Simpan identifier non-rahasia selama sesi formulir. */
export function setLoginIdentifier(identifier: string): void {
  pendingIdentifier = identifier
}

/** Bersihkan — dipanggil saat login berhasil (sesi formulir selesai). */
export function clearLoginIdentifier(): void {
  pendingIdentifier = ""
}
