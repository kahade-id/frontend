/**
 * Heuristik bio profil publik (item 61, mega-batch 2026-09-28).
 *
 * Murni — dipisah dari `app/user/[username].tsx` agar bisa di-unit-test
 * tanpa runtime React Native.
 */

/**
 * Panjang maksimum bio — KONTRAK backend `update-profile.dto.ts`
 * (`@MaxLength(160)`, RK-P07). Kedua layar edit (sheet inline & layar
 * lengkap) wajib memakai angka ini; dulu keduanya 500 sehingga bio 161–500
 * karakter lolos di klien lalu ditolak 400 saat simpan.
 */
export const BIO_MAX = 160

/** Panjang bio di atas ambang ini mendapat toggle "Selengkapnya". */
export const BIO_PREVIEW_CHARS = 100

/** Jumlah baris (newline) yang pasti melampaui potongan 4 baris. */
const BIO_PREVIEW_LINES = 4

/**
 * Bio hanya mendapat tombol "Selengkapnya/Tutup" bila cukup panjang untuk
 * terpotong (numberOfLines=4) — bio pendek tidak perlu tombol mati.
 * Ambang 100 karakter (dulu 160 = BIO_MAX, sehingga toggle TIDAK PERNAH
 * muncul) atau ≥4 baris eksplisit — bio ber-newline pendek pun terpotong.
 */
export function bioNeedsToggle(bio: string): boolean {
  if (bio.length > BIO_PREVIEW_CHARS) return true
  return bio.split("\n").length > BIO_PREVIEW_LINES
}
