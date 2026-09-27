/**
 * Kahade — <TransactionStatusSheet>: pilih status filter transaksi.
 *
 * Dibuka dari ikon funnel di header tab Transaksi (permintaan produk
 * 2026-09-27: filter cukup funnel saja, tanpa blok chip berlabel). Satu
 * dimensi — pilihan langsung diterapkan saat diketuk, sama seperti perilaku
 * chip sebelumnya (satu refetch per pilihan, bukan draf).
 */
import { View } from "react-native"
import { Check } from "phosphor-react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n/translate"

export type TransactionStatusOption = { label: string; value: string }

export type TransactionStatusSheetProps = {
  visible: boolean
  onRequestClose: () => void
  options: ReadonlyArray<TransactionStatusOption>
  value: string
  onSelect: (value: string) => void
}

export function TransactionStatusSheet({
  visible,
  onRequestClose,
  options,
  value,
  onSelect,
}: TransactionStatusSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title={translate("Filter status")}
      accessibilityLabel={translate("Pilih status transaksi")}
      padding="none"
    >
      <View accessibilityRole="menu" className="py-2">
        {options.map((opt) => {
          const selected = opt.value === value
          return (
            <PressableScale
              key={opt.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={opt.label}
              onPress={() => {
                onSelect(opt.value)
                onRequestClose()
              }}
              className="min-h-[52px] w-full flex-row items-center gap-3 px-5 py-3 active:bg-surface"
            >
              <Text variant="body" weight={selected ? 600 : 400} className="flex-1">
                {opt.label}
              </Text>
              {selected ? <Icon icon={Check} size="md" tone="active" weight="bold" /> : null}
            </PressableScale>
          )
        })}
      </View>
    </BottomSheet>
  )
}
