/**
 * Kahade — <LanguagePicker> (GET/PUT /v1/settings/language, enum "id" | "en").
 *
 * Pemilih bahasa: daftar radio bergaya kartu dengan nama bahasa dalam
 * bahasa aslinya ("Bahasa Indonesia", "English") + label terjemahan kecil.
 *
 * Keputusan non-obvious:
 *   - Nama bahasa selalu ditulis dalam bahasanya sendiri (endonym) — user
 *     yang tidak paham bahasa aktif tetap bisa menemukan bahasanya.
 *   - Tidak memakai bendera: bendera = negara, bukan bahasa (§12 i18n-ready).
 *   - Varian `compact` merender <Select> untuk dipakai di form onboarding.
 */
import { Translate } from "phosphor-react-native"
import { useState } from "react"
import { View, type ViewProps } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { Select, SelectOptionList } from "@/components/ui/select"
import { cn } from "@/lib/cn"
import { LANGUAGES, type LanguageCode } from "@/lib/i18n"

/** Tipe kode bahasa pindah ke lib/i18n (dipakai store + API); re-ekspor di sini
 *  supaya pemakaian lama (`import { type LanguageCode } from ".../language-picker"`)
 *  tidak berubah. */
export type { LanguageCode } from "@/lib/i18n"

export type LanguageOption<C extends string = LanguageCode> = {
  code: C
  /** Nama dalam bahasa itu sendiri */
  nativeName: string
  /** Nama dalam bahasa UI aktif (opsional) */
  localizedName?: string
  disabled?: boolean
}

/**
 * Sumber daftar bahasa = LANGUAGES di lib/i18n (satu tempat untuk layar Bahasa
 * DAN form onboarding). `localizedName` TIDAK diterjemahkan di sini: ia lewat
 * <Text> komponen <Radio>, jadi kamus sudah menerapkannya saat render — dan
 * ikut berubah bila bahasa berganti (nilai module-level tidak akan pernah).
 */
export const DEFAULT_LANGUAGES: readonly LanguageOption[] = LANGUAGES.map((l) => ({
  code: l.code,
  nativeName: l.nativeName,
  localizedName: l.localizedName,
}))

export type LanguagePickerProps<C extends string = LanguageCode> = Omit<ViewProps, "children"> & {
  value: C | undefined
  onChange: (code: C) => void
  options?: readonly LanguageOption<C>[]
  /** Render sebagai Select + sheet, bukan daftar radio */
  compact?: boolean
  label?: string
  disabled?: boolean
  className?: string
}

export function LanguagePicker<C extends string = LanguageCode>({
  value,
  onChange,
  options = DEFAULT_LANGUAGES as unknown as readonly LanguageOption<C>[],
  compact = false,
  label = "Bahasa",
  disabled = false,
  className,
  ...rest
}: LanguagePickerProps<C>) {
  const [open, setOpen] = useState(false)

  if (compact) {
    const selectOptions = options.map((o) => ({
      value: o.code,
      label: o.nativeName,
      description: o.localizedName,
      disabled: o.disabled,
    }))
    return (
      <View className={cn("w-full", className)} {...rest}>
        <Select
          label={label}
          value={value}
          options={selectOptions}
          open={open}
          leftIcon={Translate}
          disabled={disabled}
          onPress={() => setOpen(true)}
        />
        <BottomSheet visible={open} onRequestClose={() => setOpen(false)} title={label} contentClassName="px-0">
          <SelectOptionList
            options={selectOptions}
            value={value}
            onSelect={(v) => {
              onChange(v)
              setOpen(false)
            }}
          />
        </BottomSheet>
      </View>
    )
  }

  return (
    <View className={cn("w-full", className)} {...rest}>
      <RadioGroup
        value={value}
        onChange={(v) => onChange(v as C)}
        variant="card"
        disabled={disabled}
        accessibilityLabel={label}
      >
        {options.map((o) => (
          <Radio key={o.code} value={o.code} label={o.nativeName} description={o.localizedName} disabled={o.disabled} />
        ))}
      </RadioGroup>
    </View>
  )
}