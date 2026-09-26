/**
 * Kahade — batas Etalase yang berasal dari KEBIJAKAN PRODUK, bukan kontrak.
 *
 * M-03 (audit 2026-09-24): angka 8 dulu hidup sebagai konstanta lokal di layar
 * manajemen; sekarang satu sumber untuk seluruh alur (pilih foto, hitung slot,
 * nonaktifkan tombol). Kontrak `AttachShowcaseImagesDto` hanya mendeklarasikan
 * `fileKeys: string[]` tanpa `maxItems`, jadi nilai ini TIDAK bisa diturunkan
 * dari `API_CONSTRAINTS` — kalau backend menetapkan batasnya, pindahkan angka
 * ini ke `scripts/gen-api-constraints.mjs` dan tarik dari sana.
 */
export const SHOWCASE_MAX_IMAGES = 8
/** Benefit 7 Kahade+ ("custom etalase"): anggota aktif boleh memakai lebih banyak foto. */
export const SHOWCASE_MAX_IMAGES_PLUS = 18

/**
 * Batas foto dinamis dari status langganan — SATU-SATUNYA cara menentukan
 * limit di UI. Baca `useKahadePlus().isActive` di komponen, teruskan hasilnya
 * ke sini; jangan membaca store dari fungsi non-hook ini.
 */
export function getShowcasePhotoLimit(isPlusActive: boolean): number {
  return isPlusActive ? SHOWCASE_MAX_IMAGES_PLUS : SHOWCASE_MAX_IMAGES
}
/** S6: maks 5MB per foto — selaras backend `UploadPurpose.SHOWCASE_IMAGE`. */
export const SHOWCASE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
