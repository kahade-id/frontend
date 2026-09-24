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
