/**
 * Kahade — <ShowcaseFilterSheet> (batch 19, item 14).
 *
 * Panel filter feed etalase: kondisi (Baru/Bekas), rating penjual minimum,
 * jenis produk (audit Search 2026-10-10, S-29), dan rentang harga. Memakai
 * pola filter yang sudah ada:
 * - <ChipGroup single> seperti <WalletHistoryFilterSheet>,
 * - <CurrencyRangeField> untuk harga,
 * - draf: pilihan belum mengubah apa pun sampai "Terapkan" ditekan.
 *
 * Sheet ini MENGEMBALIKAN nilai bertipe (`onApply`); pemetaan ke query param
 * backend (`condition`, `minSellerRating`, `minPrice`/`maxPrice`,
 * `productType`) hidup di `components/showcase-feed-tab.tsx`.
 *
 * S-30: label opsi lewat `translate` dan dihitung ulang saat bahasa berganti
 * (sebelumnya konstanta modul berbahasa Indonesia).
 */
import { useEffect, useMemo, useState } from "react"
import { View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { ChipGroup } from "@/components/ui/chip"
import { CurrencyRangeField } from "@/components/ui/currency-range-field"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import {
  DEFAULT_SHOWCASE_FILTERS,
  showcaseProductTypeLabel,
  showcaseProductTypeOf,
  type PriceRange,
  type ShowcaseConditionFilter,
  type ShowcaseFeedFilters,
  type ShowcaseProductTypeUiFilter,
  type ShowcaseRatingFilter,
} from "@/lib/showcase-filters"

// Tipe & helper filter draf tinggal di lib/showcase-filters.ts (murni,
// unit-testable); sheet ini hanya presentasi. Re-export agar pemanggil cukup
// import dari satu tempat.
export {
  DEFAULT_SHOWCASE_FILTERS,
  isDefaultShowcaseFilters,
  showcaseFilterBadgeCount,
  type PriceRange,
  type ShowcaseConditionFilter,
  type ShowcaseFeedFilters,
  type ShowcaseProductTypeUiFilter,
  type ShowcaseRatingFilter,
} from "@/lib/showcase-filters"

const PRODUCT_TYPE_VALUES: readonly ShowcaseProductTypeUiFilter[] = ["ALL", "FISIK", "JASA", "DIGITAL", "LAINNYA"]

export type ShowcaseFilterSheetProps = {
  visible: boolean
  onRequestClose: () => void
  /** Filter yang sedang diterapkan — dijadikan draf setiap sheet dibuka. */
  initial: ShowcaseFeedFilters
  /** Dipanggil dengan draf saat "Terapkan" ditekan. */
  onApply: (filters: ShowcaseFeedFilters) => void
}

export function ShowcaseFilterSheet({
  visible,
  onRequestClose,
  initial,
  onApply,
}: ShowcaseFilterSheetProps) {
  // i18n: label mengikuti bahasa aktif.
  const language = useLanguage()
  const conditionOptions = useMemo<ReadonlyArray<{ value: ShowcaseConditionFilter; label: string }>>(
    () => [
      { value: "ALL", label: translate("Semua kondisi") },
      { value: "NEW", label: translate("Baru") },
      { value: "USED", label: translate("Bekas") },
    ],
    [language],
  )
  const ratingOptions = useMemo<ReadonlyArray<{ value: ShowcaseRatingFilter; label: string }>>(
    () => [
      { value: "ALL", label: translate("Semua rating") },
      { value: "4", label: translate("4+ ke atas") },
      { value: "4_5", label: translate("4,5+ ke atas") },
    ],
    [language],
  )
  const productTypeOptions = useMemo<ReadonlyArray<{ value: ShowcaseProductTypeUiFilter; label: string }>>(
    () => PRODUCT_TYPE_VALUES.map((value) => ({ value, label: showcaseProductTypeLabel(value) })),
    [language],
  )
  const [draft, setDraft] = useState<ShowcaseFeedFilters>(initial)

  // Tiap dibuka, draf = filter yang sedang diterapkan (bukan sisa draf lama).
  useEffect(() => {
    if (visible) setDraft(initial)
  }, [visible, initial])

  const setCondition = (next: ShowcaseConditionFilter[]) =>
    setDraft((d) => ({ ...d, condition: next[0] ?? "ALL" }))
  const setRating = (next: ShowcaseRatingFilter[]) =>
    setDraft((d) => ({ ...d, minRating: next[0] ?? "ALL" }))
  const setProductType = (next: ShowcaseProductTypeUiFilter[]) =>
    setDraft((d) => ({ ...d, productType: next[0] ?? "ALL" }))
  const setPrice = (price: PriceRange) => setDraft((d) => ({ ...d, price }))

  const resetDraft = () => setDraft(DEFAULT_SHOWCASE_FILTERS)
  // P2-03 (audit non-escrow 2026-10-03): cegah terapkan rentang invalid
  // (min > max) — CurrencyRangeField sudah menampilkan peringatan, tapi
  // tombol Terapkan tetap jalan dan menghasilkan feed kosong tanpa penjelasan.
  const priceInvalid =
    draft.price.min != null && draft.price.max != null && draft.price.min > draft.price.max
  const apply = () => {
    if (priceInvalid) return
    onApply(draft)
    onRequestClose()
  }

  // UX-23 (audit etalase 2026-10-10): label opsi diterjemahkan di useMemo di
  // atas — konstanta modul tidak lewat `translate()` sehingga chip tetap
  // Indonesia di UI English.
  return (
    <BottomSheet
      // VI-09: sheet berisi input harga — geser di atas keyboard seperti sheet lain.
      avoidKeyboard
      visible={visible}
      onRequestClose={onRequestClose}
      title={translate("Filter etalase")}
      footer={
        <View className="flex-row gap-2">
          {/* VI-05: `className` jatuh ke kotak dalam — lebar dibagi lewat containerClassName. */}
          <Button variant="secondary" onPress={resetDraft} containerClassName="flex-1">
            {translate("Atur ulang")}
          </Button>
          <Button
            onPress={apply}
            containerClassName="flex-1"
            disabled={priceInvalid}
            accessibilityHint={
              priceInvalid
                ? translate("Perbaiki rentang harga dulu")
                : translate("Terapkan filter")
            }
          >
            {translate("Terapkan")}
          </Button>
        </View>
      }
    >
      <View className="gap-5">
        <View className="gap-2">
          <Text variant="label" weight={600} tone="secondary">
            {translate("Jenis produk")}
          </Text>
          <ChipGroup
            accessibilityLabel={translate("Saring berdasarkan jenis produk")}
            single
            options={productTypeOptions}
            value={[showcaseProductTypeOf(draft)]}
            onChange={setProductType}
          />
        </View>

        <View className="gap-2">
          <Text variant="label" weight={600} tone="secondary">
            {translate("Kondisi barang")}
          </Text>
          <ChipGroup
            accessibilityLabel={translate("Saring berdasarkan kondisi barang")}
            single
            options={conditionOptions}
            value={[draft.condition]}
            onChange={setCondition}
          />
        </View>

        <View className="gap-2">
          <Text variant="label" weight={600} tone="secondary">
            {translate("Rating penjual")}
          </Text>
          <ChipGroup
            accessibilityLabel={translate("Saring berdasarkan rating penjual minimum")}
            single
            options={ratingOptions}
            value={[draft.minRating]}
            onChange={setRating}
          />
        </View>

        <CurrencyRangeField
          value={draft.price}
          onChange={setPrice}
          label={translate("Rentang harga")}
          labels={{
            from: translate("Harga minimum"),
            to: translate("Harga maksimum"),
            invalid: translate("Harga minimum tidak boleh lebih besar dari maksimum"),
          }}
        />
      </View>
    </BottomSheet>
  )
}
