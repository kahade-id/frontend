/**
 * Kahade — <PhoneInput> (§9.2 turunan; nomor HP Indonesia).
 *
 * Field nomor HP dengan prefix negara tetap "+62" di kiri (dipisah Divider
 * vertical), digit nasional di kanan. Label ditaruh DI ATAS lewat <Field>
 * (bukan floating seperti <Input>) karena prefix statis di dalam kotak akan
 * bertabrakan dengan label resting; tinggi kotak jadi h-12 seperti Input
 * tanpa label.
 *
 * Kontrak nilai (non-obvious):
 *   - `value` = digit nasional MENTAH tanpa 0 di depan ("81234567890").
 *     Tampilan diformat "812-3456-7890" saat render saja — state pemanggil
 *     tetap bersih untuk dikirim ke backend (`toE164Id(value)` -> "+6281…").
 *   - Input "0812…" atau "62812…" dari paste dinormalisasi otomatis
 *     (buang 0/62 di depan) — user Indonesia terbiasa mengetik 08xx.
 *   - Maks 12 digit nasional (operator ID: 9–12 digit). Validasi minimal
 *     (`isValidPhoneId`) diekspor, dipanggil pemanggil untuk `errorText`
 *     agar aturan validasi form tetap di satu tempat (form), bukan komponen.
 *
 * Nomor dirender JetBrains Mono (§3.1: "nomor rekening" — nomor HP adalah
 * data presisi sejenis). Prefix +62 juga Mono agar satu baseline/spasi.
 * `outlineStyle: none` di web mengikuti Input (§11).
 */
import { Phone } from "phosphor-react-native"
import { forwardRef, useCallback, useState } from "react"
import { Platform, TextInput, View, type TextInputProps } from "react-native"

import { useTheme } from "@/components/theme-provider"
import { Divider } from "@/components/ui/divider"
import { Field, type FieldProps } from "@/components/ui/field"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export const PHONE_ID_PREFIX = "+62"
const MAX_NATIONAL_DIGITS = 12
const MIN_NATIONAL_DIGITS = 9

/** "0812 3456 7890" / "+62812…" / "62812…" -> "81234567890" */
export function normalizePhoneId(raw: string): string {
  let d = raw.replace(/\D/g, "")
  if (d.startsWith("62")) d = d.slice(2)
  while (d.startsWith("0")) d = d.slice(1)
  return d.slice(0, MAX_NATIONAL_DIGITS)
}

/** "81234567890" -> "812-3456-7890" (tampilan di dalam field) */
export function formatNationalPhoneId(digits: string): string {
  const parts = [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7, MAX_NATIONAL_DIGITS)]
  return parts.filter(Boolean).join("-")
}

/** "81234567890" -> "+6281234567890" */
export function toE164Id(digits: string): string {
  return digits ? `${PHONE_ID_PREFIX}${digits}` : ""
}

export function isValidPhoneId(digits: string): boolean {
  return /^8\d{8,11}$/.test(digits) && digits.length >= MIN_NATIONAL_DIGITS
}

export type PhoneInputProps = Omit<
  TextInputProps,
  "style" | "editable" | "value" | "onChangeText" | "keyboardType" | "maxLength"
> &
  Pick<FieldProps, "label" | "helperText" | "errorText" | "reserveHelperSpace" | "required"> & {
    /** Digit nasional mentah tanpa 0 di depan */
    value: string
    onChangeText: (digits: string) => void
    disabled?: boolean
    /** Ikon kiri sebelum prefix (default Phone; kirim `null` untuk tanpa ikon) */
    leftIcon?: IconComponent | null
    className?: string
    containerClassName?: string
  }

export const PhoneInput = forwardRef<TextInput, PhoneInputProps>(function PhoneInput(
  {
    value,
    onChangeText,
    disabled = false,
    label = "Nomor HP",
    required,
    helperText,
    errorText,
    reserveHelperSpace,
    leftIcon = Phone,
    placeholder = "812-3456-7890",
    onFocus,
    onBlur,
    className,
    containerClassName,
    ...rest
  },
  ref,
) {
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const [focused, setFocused] = useState(false)
  const hasError = !!errorText

  const handleChange = useCallback(
    (t: string) => onChangeText(normalizePhoneId(t)),
    [onChangeText],
  )
  const handleFocus = useCallback<NonNullable<TextInputProps["onFocus"]>>(
    (e) => {
      setFocused(true)
      onFocus?.(e)
    },
    [onFocus],
  )
  const handleBlur = useCallback<NonNullable<TextInputProps["onBlur"]>>(
    (e) => {
      setFocused(false)
      onBlur?.(e)
    },
    [onBlur],
  )

  return (
    <Field
      label={label}
      required={required}
      helperText={helperText}
      errorText={errorText}
      reserveHelperSpace={reserveHelperSpace}
      disabled={disabled}
      className={containerClassName}
    >
      <View accessible={false}
        className={cn(
          "h-12 w-full flex-row items-center rounded-sm bg-background",
          hasError
            ? "border-error border-border-error px-[15px]"
            : focused
              ? "border-focus border-border-focus px-[15px]"
              : "border border-border-control px-4",
          disabled && "opacity-disabled",
          className,
        )}
      >
        {leftIcon ? (
          <View className="mr-2">
            {/* Ikon TIDAK ikut merah saat error (§7) */}
            <Icon icon={leftIcon} size="sm" tone={focused ? "active" : "default"} />
          </View>
        ) : null}

        {/* Prefix negara — statis, bukan bagian dari nilai */}
        <View className="h-full flex-row items-center gap-3 pr-3">
          <Text variant="monoBody" tone="secondary">
            {PHONE_ID_PREFIX}
          </Text>
          <Divider orientation="vertical" className="h-6" />
        </View>

        <TextInput
          ref={ref}
          value={formatNationalPhoneId(value)}
          editable={!disabled}
          keyboardType="phone-pad"
          inputMode="tel"
          autoComplete="tel-national"
          textContentType="telephoneNumber"
          // 12 digit + 2 tanda hubung
          maxLength={MAX_NATIONAL_DIGITS + 2}
          placeholder={placeholder}
          placeholderTextColor={palette.textSecondary}
          selectionColor={palette.primary}
          cursorColor={palette.primary}
          allowFontScaling={false}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChangeText={handleChange}
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          className={cn(
            "flex-1 font-mono-500 text-monoBody text-text-primary",
            disabled && "text-text-disabled",
            Platform.OS === "web" && "outline-none",
          )}
          style={Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : undefined}
          {...rest}
        />
      </View>
    </Field>
  )
})
