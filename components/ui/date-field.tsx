/**
 * Kahade — <DateField>.
 *
 * Field pemilih tanggal gaya filled (§9.2, konsisten dengan <Input>): trigger
 * berupa PressableScale `bg-surface` + `rounded-md`, resting tanpa border
 * outline (`border-transparent` 1.5px — lebar sama seperti focus/error agar
 * tidak ada layout jump), `border-focus` saat sheet terbuka, `border-error`
 * saat ada galat. Sheet kalender memakai <DatePickerSheet> yang sudah ada
 * (murni JS, OTA-compatible); state buka/tutup dikelola internal.
 *
 * Keputusan non-obvious:
 *   - `onChange` hanya dipanggil dengan Date (tidak pernah null) — persis
 *     kontrak <DatePickerSheet onSelect>. Pengosongan tanggal tetap urusan
 *     layar (reset form), bukan komponen ini.
 *   - `onClose` dipanggil setiap sheet tertutup (dipilih MAUPUN dibatalkan),
 *     karena <DatePickerSheet> selalu memanggil onRequestClose setelah
 *     onSelect. Layar yang butuh semantik "disentuh" (mis. error "pilih
 *     tanggal" hanya tampil setelah sheet pernah dibuka) memakai ini —
 *     urutan onChange → onClose dipertahankan agar perilakunya identik
 *     dengan pemakaian manual sebelumnya.
 *   - `scaleOnPress={false}` seperti <Select>: trigger field tidak memantul
 *     saat ditekan; yang berubah hanya border.
 */
import { CalendarBlank } from "phosphor-react-native"
import { useState } from "react"
import type { ViewProps } from "react-native"

import { Field, type FieldProps } from "@/components/ui/field"
import { DatePickerSheet } from "@/components/ui/date-picker-sheet"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { formatDateLong } from "@/lib/format"
import { useLanguage } from "@/lib/i18n"
import { translate } from "@/lib/i18n/translate"

export type DateFieldProps = Omit<ViewProps, "children"> &
  Pick<
    FieldProps,
    "label" | "required" | "helperText" | "errorText" | "reserveHelperSpace" | "disabled"
  > & {
    /** Tanggal terpilih (boleh null = belum pilih). */
    value: Date | null
    onChange: (date: Date) => void
    /** Dipanggil setiap sheet tertutup (dipilih maupun dibatalkan). */
    onClose?: () => void
    /** Teks saat belum ada tanggal terpilih. */
    placeholder?: string
    /** Judul sheet kalender. */
    title?: string
    /** Batas bawah inklusif — default mengikuti <DatePickerSheet> (besok). */
    minDate?: Date
    /** Batas atas inklusif — default mengikuti <DatePickerSheet> (+14 hari). */
    maxDate?: Date
    className?: string
    containerClassName?: string
  }

export function DateField({
  label,
  required,
  helperText,
  errorText,
  reserveHelperSpace,
  disabled = false,
  value,
  onChange,
  onClose,
  placeholder,
  title,
  minDate,
  maxDate,
  className,
  containerClassName,
  ...rest
}: DateFieldProps) {
  // G-07: panggil agar placeholder ikut bahasa aktif.
  useLanguage()
  const [open, setOpen] = useState(false)
  const hasError = !!errorText
  const placeholderText = placeholder ?? translate("Pilih tanggal")

  const handleClose = () => {
    setOpen(false)
    onClose?.()
  }

  return (
    <Field
      label={label}
      required={required}
      helperText={helperText}
      errorText={errorText}
      reserveHelperSpace={reserveHelperSpace}
      disabled={disabled}
      className={containerClassName}
      {...rest}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value ? formatDateLong(value) : placeholderText }}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        scaleOnPress={false}
        containerClassName={cn("w-full rounded-md", focusRing)}
        className={cn(
          "h-14 w-full flex-row items-center rounded-md bg-surface",
          hasError
            ? "border-[1.5px] border-border-error px-4"
            : open
              ? "border-[1.5px] border-border-focus px-4"
              : "border-[1.5px] border-transparent px-4",
          disabled && "opacity-disabled",
          className,
        )}
      >
        <Text
          variant="body"
          tone={value ? undefined : "tertiary"}
          numberOfLines={1}
          className="flex-1"
        >
          {value ? formatDateLong(value) : placeholderText}
        </Text>
        <Icon icon={CalendarBlank} size="sm" tone="default" />
      </PressableScale>
      <DatePickerSheet
        visible={open}
        onRequestClose={handleClose}
        value={value}
        onSelect={(date) => {
          onChange(date)
        }}
        title={title}
        minDate={minDate}
        maxDate={maxDate}
      />
    </Field>
  )
}
