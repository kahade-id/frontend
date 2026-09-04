/**
 * Kahade — <OtpInput> (§9.3).
 *
 * Deretan kotak digit (default 6) untuk OTP / PIN. Digit tampil dalam
 * JetBrains Mono (Mono Large, letter-spacing +0.5px §3.2). Kotak aktif =
 * `border-focus`; error = semua kotak `border-error` + helper text, TANPA
 * shake (§8).
 *
 * Keputusan non-obvious:
 *   - Satu <TextInput> tersembunyi menampung seluruh nilai; kotak-kotak hanya
 *     tampilan. Pola ini membuat paste "123456", autofill SMS
 *     (`autoComplete="one-time-code"` / `textContentType="oneTimeCode"`),
 *     dan backspace lintas kotak bekerja tanpa manajemen fokus per-kotak —
 *     yang rapuh di web (react-native-web) dan Android.
 *   - Input tersembunyi tetap 1x1 dan `opacity-0` (bukan display none) agar
 *     masih bisa menerima fokus dan memunculkan keyboard di semua platform.
 *   - `secure` menampilkan dot (●) untuk PIN; nilai asli tetap di state.
 *   - Kotak 48x56 (w-12 h-14): lebar cukup untuk satu glyph mono 24px,
 *     tinggi menyamai Input berlabel agar sejajar dalam satu form.
 */
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react"
import { Pressable, TextInput, View, type ViewProps } from "react-native"

import { useTheme } from "@/components/theme-provider"
import { FieldHelper } from "@/components/ui/field"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type OtpInputHandle = { focus: () => void; blur: () => void; clear: () => void }

export type OtpInputProps = Omit<ViewProps, "children"> & {
  length?: number
  value?: string
  defaultValue?: string
  onChange?: (code: string) => void
  /** Dipanggil sekali saat semua digit terisi */
  onComplete?: (code: string) => void
  /** Tampilkan dot alih-alih digit (PIN) */
  secure?: boolean
  errorText?: string
  helperText?: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(function OtpInput(
  {
    length = 6,
    value,
    defaultValue = "",
    onChange,
    onComplete,
    secure = false,
    errorText,
    helperText,
    disabled = false,
    autoFocus = false,
    className,
    ...rest
  },
  ref,
) {
  const { mode } = useTheme()
  const inputRef = useRef<TextInput>(null)
  const [internal, setInternal] = useState(defaultValue)
  const [focused, setFocused] = useState(false)
  const code = (value ?? internal).slice(0, length)
  const hasError = !!errorText

  const handleChange = useCallback(
    (raw: string) => {
      const next = raw.replace(/\D/g, "").slice(0, length)
      if (value === undefined) setInternal(next)
      onChange?.(next)
      if (next.length === length) onComplete?.(next)
    },
    [length, onChange, onComplete, value],
  )

  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      clear: () => handleChange(""),
    }),
    [handleChange],
  )

  // Kotak aktif = posisi karakter berikutnya (atau kotak terakhir saat penuh)
  const activeIndex = Math.min(code.length, length - 1)

  return (
    <View className={cn("w-full gap-2", className)} {...rest}>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        disabled={disabled}
        accessibilityRole="none"
        className={cn("flex-row justify-between gap-2", disabled && "opacity-disabled")}
      >
        {Array.from({ length }, (_, i) => {
          const char = code[i]
          const isActive = focused && i === activeIndex && !disabled
          return (
            <View
              key={i}
              className={cn(
                "h-14 w-12 items-center justify-center rounded-sm bg-background",
                hasError
                  ? "border-error border-border-error"
                  : isActive
                    ? "border-focus border-border-focus"
                    : "border border-border",
              )}
            >
              {char ? (
                <Text variant="monoLarge" tone="primary">
                  {secure ? "\u25CF" : char}
                </Text>
              ) : isActive ? (
                // Caret sederhana: garis 1.5px setinggi digit, warna border-focus
                <View className="h-6 w-[1.5px] bg-border-focus" />
              ) : null}
            </View>
          )
        })}
      </Pressable>

      {/* Input nyata — tersembunyi tapi tetap fokusable */}
      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        maxLength={length}
        keyboardType="number-pad"
        inputMode="numeric"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        caretHidden
        allowFontScaling={false}
        selectionColor={tokens.colors[mode].primary}
        accessibilityLabel={`Kode ${length} digit`}
        accessibilityState={{ disabled }}
        className="absolute h-1 w-1 opacity-0"
      />

      <FieldHelper helperText={helperText} errorText={errorText} />
    </View>
  )
})
