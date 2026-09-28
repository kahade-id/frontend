/**
 * Kahade — pemilih kondisi barang (Baru/Bekas) untuk form Etalase.
 *
 * Mega-batch FE-IMP-1, item 53: kondisi BARU/BEKAS di form buat & ubah karya.
 * Nilai "" = belum dipilih (tidak dikirim ke backend — kontrak opsional).
 * RadioGroup butuh `value: string | undefined`, jadi "" dipetakan ke
 * undefined agar tidak ada opsi yang terpilih.
 */
import { View } from "react-native"

import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

import { Radio, RadioGroup } from "@/components/ui/radio"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"

export type ShowcaseConditionValue = "" | "BARU" | "BEKAS"

export function ShowcaseConditionInput({
  value,
  onChange,
  disabled = false,
}: {
  value: ShowcaseConditionValue
  onChange: (value: ShowcaseConditionValue) => void
  disabled?: boolean
}) {
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  return (
    <View className="gap-2">
      <Text variant="label" tone="primary">
        {translate("Kondisi barang (opsional)")}
      </Text>
      <RadioGroup
        value={value === "" ? undefined : value}
        onChange={(v) => {
          if (v === "BARU" || v === "BEKAS") onChange(v)
        }}
        disabled={disabled}
        variant="card"
        accessibilityLabel={translate("Kondisi barang")}
      >
        <Radio value="BARU" label={translate("Baru")} description={translate("Barang baru, belum pernah dipakai")} />
        <Radio value="BEKAS" label={translate("Bekas")} description={translate("Barang bekas/second, kondisi sesuai deskripsi")} />
      </RadioGroup>
      {/* Opsional → bisa dikosongkan lagi setelah dipilih. */}
      {value !== "" ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={translate("Kosongkan kondisi barang")}
          onPress={() => onChange("")}
          disabled={disabled}
          containerClassName="self-start rounded-sm"
        >
          <Text variant="caption" tone="secondary" weight={500} className="py-1 underline">
            {translate("Kosongkan pilihan")}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  )
}
