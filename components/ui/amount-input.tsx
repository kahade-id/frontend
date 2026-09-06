/**
 * Kahade — <AmountInput> (§9.2 varian nominal, §13 format Rupiah).
 *
 * Field khusus nominal uang: prefix "Rp" tetap, digit JetBrains Mono Large
 * (24/32, letter-spacing +0.5) — sesuai §3.1 "nominal utama = Mono". Nilai
 * yang dikirim ke pemanggil adalah NUMBER bulat, tampilan diformat otomatis
 * `1.000.000` saat mengetik (§13: titik ribuan, tanpa desimal).
 *
 * Keputusan non-obvious:
 *   - Tidak memakai floating label: nominal biasanya satu-satunya field di
 *     layarnya (masukkan jumlah escrow) dan label statis di atas (FieldLabel)
 *     lebih jelas dari label yang melayang di atas digit besar.
 *   - `presets` (chip nominal cepat: 100rb, 500rb, 1jt) muncul di bawah field
 *     sebagai <Chip> — mengurangi typo digit besar, pola umum e-wallet.
 *   - Batas `min`/`max` divalidasi di sini hanya untuk MENAMPILKAN error
 *     (helper merah); pemanggil tetap harus validasi di submit.
 *   - Kursor/selection warna dari tokens lewat useTheme (prop RN non-style).
 *   - Tinggi 64 (h-16) supaya glyph mono 24px punya ruang bernapas (§1.5).
 */
import { forwardRef, useCallback, useState } from "react"
import { Platform, TextInput, View, type TextInputProps } from "react-native"

import { useTheme } from "@/components/theme-provider"
import { Chip } from "@/components/ui/chip"
import { Field, type FieldProps } from "@/components/ui/field"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { amountInputValue, formatRupiah, groupThousands } from "@/lib/format"
import { tokens } from "@/lib/tokens"

// `onChange` di-Omit dari TextInputProps: RN mendefinisikan
// `onChange?: (e: TextInputChangeEvent) => void`; tanpa Omit, intersection
// membuat parameter callback menjadi `number | TextInputChangeEvent`.
export type AmountInputProps = Omit<
  TextInputProps,
  "value" | "defaultValue" | "onChange" | "onChangeText" | "style" | "editable" | "keyboardType"
> &
  Pick<FieldProps, "label" | "helperText" | "errorText" | "reserveHelperSpace" | "required"> & {
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
    /** Nominal cepat, mis. [100000, 500000, 1000000] */
    presets?: number[]
    disabled?: boolean
    className?: string
    containerClassName?: string
  }

export const AmountInput = forwardRef<TextInput, AmountInputProps>(function AmountInput(
  {
    value,
    onChange,
    min,
    max,
    presets,
    label = "Nominal",
    required,
    helperText,
    errorText,
    reserveHelperSpace = true,
    disabled = false,
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

  const rangeError =
    min != null && value > 0 && value < min
      ? `Minimal ${formatRupiah(min)}`
      : max != null && value > max
        ? `Maksimal ${formatRupiah(max)}`
        : undefined
  const resolvedError = errorText ?? rangeError
  const hasError = !!resolvedError

  const handleChange = useCallback(
    (raw: string) => {
      // `amountInputValue` (lib/format) mengembalikan `null` untuk ketikan
      // yang tidak bisa menjadi nominal — nilai lama dipertahankan, sehingga
      // field tidak pernah berisi NaN dan tidak pernah tiba-tiba kosong.
      const next = amountInputValue(raw)
      if (next !== null) onChange(next)
    },
    [onChange],
  )

  return (
    <Field
      label={label}
      required={required}
      helperText={helperText}
      errorText={resolvedError}
      reserveHelperSpace={reserveHelperSpace}
      disabled={disabled}
      className={containerClassName}
    >
      <View
        className={cn(
          "h-16 w-full flex-row items-center rounded-sm bg-background",
          hasError
            ? "border-error border-border-error px-[15px]"
            : focused
              ? "border-focus border-border-focus px-[15px]"
              : "border border-border-control px-4",
          disabled && "opacity-disabled",
          className,
        )}
      >
        <Text variant="monoLarge" tone={value > 0 ? "primary" : "disabled"} className="mr-1">
          Rp
        </Text>
        <TextInput
          ref={ref}
          value={value > 0 ? groupThousands(value) : ""}
          onChangeText={handleChange}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          editable={!disabled}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="0"
          placeholderTextColor={palette.textSecondary}
          selectionColor={palette.primary}
          cursorColor={palette.primary}
          allowFontScaling={false}
          accessibilityLabel={label}
          accessibilityValue={{ text: formatRupiah(value) }}
          className={cn(
            "flex-1 font-mono-600 text-monoLarge text-text-primary",
            Platform.OS === "web" && "outline-none",
          )}
          style={Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : undefined}
          {...rest}
        />
      </View>

      {presets && presets.length > 0 ? (
        <View className="flex-row flex-wrap gap-2 pt-1">
          {presets.map((p) => (
            <Chip key={p} selected={value === p} disabled={disabled} onPress={() => onChange(p)}>
              {formatRupiah(p, { compact: true })}
            </Chip>
          ))}
        </View>
      ) : null}
    </Field>
  )
})
