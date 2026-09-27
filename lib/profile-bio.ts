/**
 * Heuristik bio profil publik (item 61, mega-batch 2026-09-28).
 *
 * Murni — dipisah dari `app/user/[username].tsx` agar bisa di-unit-test
 * tanpa runtime React Native.
 */

/** Panjang bio di atas ambang ini mendapat toggle "Selengkapnya". */
export const BIO_PREVIEW_CHARS = 160

/**
 * Bio hanya mendapat tombol "Selengkapnya/Tutup" bila cukup panjang untuk
 * terpotong (numberOfLines=4) — bio pendek tidak perlu tombol mati.
 */
export function bioNeedsToggle(bio: string): boolean {
  return bio.length > BIO_PREVIEW_CHARS
}
