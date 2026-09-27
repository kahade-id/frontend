/**
 * Kahade — <WalletHistoryFilterSheet>: panel filter Riwayat Dompet.
 *
 * Dibuka dari ikon funnel di header app/wallet-history.tsx. Berisi empat
 * dimensi filter; dua di antaranya server-side (jenis, rentang tanggal —
 * menjadi query key baru → refetch) dan dua client-side (arah dana, status —
 * diterapkan atas item yang sudah dimuat).
 *
 * Sheet bekerja dengan DRAF: pilihan di dalam sheet belum mengubah apa pun
 * sampai "Terapkan" ditekan — mengetuk chip jenis tidak boleh memicu
 * refetch beruntun tiap ketukan. "Atur ulang" mengembalikan draf ke default.
 */
import { useEffect, useState } from "react"
import { View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { ChipGroup } from "@/components/ui/chip"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n/translate"
import {
  DEFAULT_HISTORY_FILTERS,
  HISTORY_DIRECTION_FILTERS,
  HISTORY_RANGE_PRESETS,
  HISTORY_STATUS_FILTERS,
  type DirectionFilter,
  type StatusFilter,
  type WalletHistoryFilters,
} from "@/lib/wallet-history-grouping"
import { WALLET_TXN_FILTERS, type WalletTxnType } from "@/lib/wallet-labels"

export type WalletHistoryFilterSheetProps = {
  visible: boolean
  onRequestClose: () => void
  /** Filter yang sedang diterapkan — dijadikan draf setiap sheet dibuka. */
  initial: WalletHistoryFilters
  /** Dipanggil dengan draf saat "Terapkan" ditekan. */
  onApply: (filters: WalletHistoryFilters) => void
}

/**
 * Chip jenis transaksi: "Semua jenis" + satu chip per nilai enum yang
 * DITERIMA API. Nilai `value` dikirim persis sebagai query `type` —
 * JANGAN alias (backend menolak dengan 400; lihat lib/wallet-labels.ts).
 */
const TYPE_OPTIONS: ReadonlyArray<{ value: "ALL" | WalletTxnType; label: string }> = [
  { value: "ALL", label: "Semua jenis" },
  ...WALLET_TXN_FILTERS,
]

export function WalletHistoryFilterSheet({
  visible,
  onRequestClose,
  initial,
  onApply,
}: WalletHistoryFilterSheetProps) {
  const [draft, setDraft] = useState<WalletHistoryFilters>(initial)

  // Tiap dibuka, draf = filter yang sedang diterapkan (bukan sisa draf lama).
  useEffect(() => {
    if (visible) setDraft(initial)
  }, [visible, initial])

  const setDirection = (next: DirectionFilter[]) =>
    setDraft((d) => ({ ...d, direction: next[0] ?? "ALL" }))
  const setType = (next: Array<"ALL" | WalletTxnType>) =>
    setDraft((d) => ({ ...d, type: next[0] ?? "ALL" }))
  const setRangeDays = (next: string[]) =>
    setDraft((d) => ({ ...d, rangeDays: Number(next[0]) || d.rangeDays }))
  const setStatus = (next: StatusFilter[]) =>
    setDraft((d) => ({ ...d, status: next[0] ?? "ALL" }))

  const resetDraft = () => setDraft(DEFAULT_HISTORY_FILTERS)
  const apply = () => {
    onApply(draft)
    onRequestClose()
  }

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title={translate("Filter riwayat")}
      description={translate("Jenis dan rentang tanggal dimuat ulang dari server; arah, status, dan pencarian menyaring mutasi yang sudah dimuat.")}
      footer={
        <View className="flex-row gap-2">
          <Button variant="secondary" onPress={resetDraft} className="flex-1">
            {translate("Atur ulang")}
          </Button>
          <Button onPress={apply} className="flex-1">
            {translate("Terapkan")}
          </Button>
        </View>
      }
    >
      <View className="gap-5">
        <View className="gap-2">
          <Text variant="label" weight={600} tone="secondary">
            {translate("Arah dana")}
          </Text>
          <ChipGroup
            accessibilityLabel="Saring berdasarkan arah dana"
            single
            options={HISTORY_DIRECTION_FILTERS}
            value={[draft.direction]}
            onChange={setDirection}
          />
        </View>

        <View className="gap-2">
          <Text variant="label" weight={600} tone="secondary">
            {translate("Jenis transaksi")}
          </Text>
          <ChipGroup
            accessibilityLabel="Saring berdasarkan jenis transaksi"
            single
            options={TYPE_OPTIONS}
            value={[draft.type]}
            onChange={setType}
          />
        </View>

        <View className="gap-2">
          <Text variant="label" weight={600} tone="secondary">
            {translate("Rentang tanggal")}
          </Text>
          <ChipGroup
            accessibilityLabel="Saring berdasarkan rentang tanggal"
            single
            options={HISTORY_RANGE_PRESETS.map((days) => ({
              value: String(days),
              label: `${days} hari`,
            }))}
            value={[String(draft.rangeDays)]}
            onChange={setRangeDays}
          />
        </View>

        <View className="gap-2">
          <Text variant="label" weight={600} tone="secondary">
            {translate("Status")}
          </Text>
          <ChipGroup
            accessibilityLabel="Saring berdasarkan status"
            single
            options={HISTORY_STATUS_FILTERS}
            value={[draft.status]}
            onChange={setStatus}
          />
        </View>
      </View>
    </BottomSheet>
  )
}
