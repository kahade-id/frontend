/**
 * Kahade — <ShowcaseFilterSheet> (batch 19, item 14 — UI DRAF).
 *
 * Panel filter feed etalase: kondisi (Baru/Bekas), rating penjual minimum,
 * dan rentang harga. Memakai pola filter yang sudah ada:
 * - <ChipGroup single> seperti <WalletHistoryFilterSheet>,
 * - <CurrencyRangeField> untuk harga,
 * - draf: pilihan belum mengubah apa pun sampai "Terapkan" ditekan.
 *
 * ── KONTRAK TIM A PENDING ──
 * Sheet ini MENGEMBALIKAN nilai draf bertipe (`onApply`) — ia TIDAK
 * memetakan ke query param API dan TIDAK dipasang ke feed tab. Nama param
 * query (condition? rating? priceMin?) adalah kontrak backend TIM A; menebak
 * nama param = request 400/diam-diam diabaikan. Setelah kontrak diterima,
 * pemanggil memetakan `ShowcaseFeedFilters` → query param di
 * `lib/api/showcase.ts` lalu memasang sheet + tombol funnel di feed.
 */
import { useEffect, useState } from "react"
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
  type PriceRange,
  type ShowcaseConditionFilter,
  type ShowcaseFeedFilters,
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
  type ShowcaseRatingFilter,
} from "@/lib/showcase-filters"

const CONDITION_OPTIONS: ReadonlyArray<{ value: ShowcaseConditionFilter; label: string }> = [
  { value: "ALL", label: "Semua kondisi" },
  { value: "NEW", label: "Baru" },
  { value: "USED", label: "Bekas" },
]

const RATING_OPTIONS: ReadonlyArray<{ value: ShowcaseRatingFilter; label: string }> = [
  { value: "ALL", label: "Semua rating" },
  { value: "4", label: "4+ ke atas" },
  { value: "4_5", label: "4,5+ ke atas" },
]

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
  useLanguage()
  const [draft, setDraft] = useState<ShowcaseFeedFilters>(initial)

  // Tiap dibuka, draf = filter yang sedang diterapkan (bukan sisa draf lama).
  useEffect(() => {
    if (visible) setDraft(initial)
  }, [visible, initial])

  const setCondition = (next: ShowcaseConditionFilter[]) =>
    setDraft((d) => ({ ...d, condition: next[0] ?? "ALL" }))
  const setRating = (next: ShowcaseRatingFilter[]) =>
    setDraft((d) => ({ ...d, minRating: next[0] ?? "ALL" }))
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

  // UX-23 (audit etalase 2026-10-10): label opsi diterjemahkan di sini —
  // konstanta modul tidak lewat `translate()` sehingga chip tetap Indonesia
  // di UI English.
  const conditionOptions = CONDITION_OPTIONS.map((o) => ({ ...o, label: translate(o.label) }))
  const ratingOptions = RATING_OPTIONS.map((o) => ({ ...o, label: translate(o.label) }))
  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title={translate("Filter etalase")}
      footer={
        <View className="flex-row gap-2">
          <Button variant="secondary" onPress={resetDraft} className="flex-1">
            {translate("Atur ulang")}
          </Button>
          <Button
            onPress={apply}
            className="flex-1"
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
