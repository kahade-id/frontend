/**
 * Kahade — tipe & helper filter feed etalase (batch 19, item 14).
 *
 * Dipisah dari <ShowcaseFilterSheet> agar bisa di-unit-test tanpa runtime
 * React Native (pola yang sama dipakai lib/wallet-history-grouping.ts).
 *
 * ── KONTRAK TIM A PENDING ──
 * Nilai enum di sini adalah kosakata UI draf; nama query param API final
 * menunggu kontrak backend TIM A (jangan kirim ke API sebelum kontrak).
 *
 * `PriceRange` sengaja didefinisikan ulang di sini (bukan import dari
 * components/ui/currency-range-field) agar modul ini tetap MURNI — tidak
 * menyeret rantai import react-native ke unit test. Strukturnya identik
 * dengan `CurrencyRange` sehingga assignment antar keduanya aman.
 */
import { formatRupiah } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"

export type PriceRange = { min: number | null; max: number | null }

/** Kondisi barang. */
export type ShowcaseConditionFilter = "ALL" | "NEW" | "USED"
/** Rating penjual minimum. */
export type ShowcaseRatingFilter = "ALL" | "4" | "4_5"

export type ShowcaseFeedFilters = {
  condition: ShowcaseConditionFilter
  minRating: ShowcaseRatingFilter
  price: PriceRange
}

export const DEFAULT_SHOWCASE_FILTERS: ShowcaseFeedFilters = {
  condition: "ALL",
  minRating: "ALL",
  price: { min: null, max: null },
}

/** True bila tidak ada filter aktif (untuk badge tombol funnel). */
export function isDefaultShowcaseFilters(f: ShowcaseFeedFilters): boolean {
  return (
    f.condition === "ALL" &&
    f.minRating === "ALL" &&
    f.price.min == null &&
    f.price.max == null
  )
}

/**
 * Jumlah dimensi filter yang aktif — badge di tombol funnel.
 * (Hanya filter sheet: kondisi, rating, harga.)
 */
export function showcaseFilterBadgeCount(f: ShowcaseFeedFilters): number {
  let n = 0
  if (f.condition !== "ALL") n += 1
  if (f.minRating !== "ALL") n += 1
  if (f.price.min != null || f.price.max != null) n += 1
  return n
}

/**
 * C15 (batch 139): jumlah TOTAL filter aktif di feed — filter sheet +
 * pencarian + kategori + lokasi. Dipakai badge tombol funnel supaya pengguna
 * tidak lupa filter harga/kategori masih aktif.
 */
export function countActiveFeedFilters(input: {
  search?: string
  category?: string
  location?: string
  sheet: ShowcaseFeedFilters
}): number {
  let n = showcaseFilterBadgeCount(input.sheet)
  if (input.search?.trim()) n += 1
  if (input.category?.trim()) n += 1
  if (input.location?.trim()) n += 1
  return n
}

/**
 * Label ringkas filter aktif untuk chip (kontrak final Tim A #D).
 * Murni — unit-testable.
 */
export function describeSheetFilters(f: ShowcaseFeedFilters): string {
  const parts: string[] = []
  // UX-23 (audit etalase 2026-10-10): tiap bagian diterjemahkan SEBELUM
  // digabung — string gabungan "Baru · Rating 4+" tidak pernah cocok kamus.
  if (f.condition === "NEW") parts.push(translate("Baru"))
  else if (f.condition === "USED") parts.push(translate("Bekas"))
  if (f.minRating === "4") parts.push(translate("Rating 4+"))
  else if (f.minRating === "4_5") parts.push(translate("Rating 4,5+"))
  const { min, max } = f.price
  if (min != null && max != null) parts.push(`${formatRupiah(min)}–${formatRupiah(max)}`)
  else if (min != null) parts.push(`≥ ${formatRupiah(min)}`)
  else if (max != null) parts.push(`≤ ${formatRupiah(max)}`)
  return parts.join(" · ")
}
