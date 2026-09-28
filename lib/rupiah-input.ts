/**
 * Kahade — format/parsing rupiah saat mengetik (C10, batch 139).
 *
 * Input harga menyimpan ANGKA di state, tetapi menampilkan teks berformat
 * "1.500.000" saat mengetik. Aturan:
 *  - hanya digit yang diterima (tanda minus/plus/huruf ditolak — nilai
 *    negatif tidak bisa diketik);
 *  - terima paste "1.000.000" / "1,000,000" / "1 000 000" (pemisah dibuang);
 *  - batas: minimum 0 (kontrak `CreateShowcaseItemDto`), maksimum 15 digit
 *    (batas input, ~999 triliun — jauh di atas harga wajar).
 *
 * Copy penjelasan batas diterjemahkan di call-site (modul ini murni agar
 * bisa di-unit-test tanpa runtime i18n).
 */
export const RUPIAH_MIN = 0
/** Panjang digit maksimum input harga (selaras maxLength=15 di form). */
export const RUPIAH_MAX_DIGITS = 15

/**
 * C10 (batch 139): validasi relasi harga min–maks — true bila valid
 * (salah satu kosong, atau min <= maks). Dipakai live saat mengetik di
 * create & kelola; pesan error diterjemahkan di call-site (modul ini murni
 * agar bisa di-unit-test tanpa runtime i18n).
 */
export function isPriceRangeValid(
  priceMin: number | null | undefined,
  priceMax: number | null | undefined,
): boolean {
  if (priceMin == null || priceMax == null) return true
  return priceMin <= priceMax
}

/**
 * Angka → teks ketikan berformat ribuan ("1500000" → "1.500.000").
 * `null` → "" (input kosong).
 */
export function formatRupiahTyping(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ""
  const digits = String(Math.trunc(Math.abs(value)))
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

/**
 * Teks ketikan → angka. Mengembalikan `null` untuk input kosong, atau
 * `undefined` bila input mengandung karakter tak valid (panggilannya harus
 * mengabaikan ketikan itu — bukan mengosongkan field).
 */
export function parseRupiahTyping(raw: string): number | null | undefined {
  const digits = raw.replace(/[\s.,]/g, "")
  if (digits === "") return null
  if (!/^\d+$/.test(digits)) return undefined
  if (digits.length > RUPIAH_MAX_DIGITS) return undefined
  const value = Number(digits)
  if (!Number.isSafeInteger(value)) return undefined
  return value
}
