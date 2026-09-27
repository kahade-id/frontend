/**
 * Normalisasi input filter harga feed Etalase (DC-012).
 *
 * Dipisah dari `components/showcase-feed-tab.tsx` (UI-F019, audit UI/UX
 * 2026-09-27) supaya aturannya teruji unit tanpa runtime React Native.
 *
 * Aturan (tak berubah dari implementasi inline sebelumnya):
 * - hanya digit yang dipakai — "1.500.000", "Rp 5000", " 2500 " valid;
 * - kosong / tanpa digit = lepas (undefined);
 * - min > maks → maks DIBUANG diam-diam (keputusan produk: bukan error yang
 *   menghalangi pengguna menerapkan filter).
 */
export function normalizePriceFilter(
  minRaw: string,
  maxRaw: string,
): { min?: number; max?: number } {
  const toInt = (s: string): number | undefined => {
    const digits = s.replace(/[^0-9]/g, "")
    if (!digits) return undefined
    const n = Math.floor(Number(digits))
    return Number.isFinite(n) && n >= 0 ? n : undefined
  }
  const min = toInt(minRaw)
  const max = toInt(maxRaw)
  return {
    min,
    max: min !== undefined && max !== undefined && max < min ? undefined : max,
  }
}
