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
 *   - `success` (v2 signature moment): semua kotak beralih ke border accent +
 *     digit tone accent, tiap kotak "pop" spring playful ber-stagger 30ms.
 *     Reduced motion → hanya warna, tanpa pop. Error tetap prioritas.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Animated, TextInput, View, type ViewProps } from "react-native"

import { useTheme } from "@/components/theme-provider"
import { FieldHelper } from "@/components/ui/field"
import { useTransformAwarePressable } from "@/components/ui/gesture-pressable"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"

/** Selisih pop antar kotak sukses (ms) — total ~180ms untuk 6 digit. */
const SUCCESS_STAGGER_MS = 30
/** Scale awal pop sukses — kembali ke 1 via spring playful. */
const SUCCESS_POP_FROM = 0.92

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
  /** State berhasil: border+digit accent + pop stagger (v2) */
  success?: boolean
  errorText?: string
  helperText?: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

/** Satu kotak digit — pop spring sekali saat `success` berubah false→true. */
function DigitBox({
  index,
  char,
  secure,
  isActive,
  hasError,
  success,
}: {
  index: number
  char?: string
  secure: boolean
  isActive: boolean
  hasError: boolean
  success: boolean
}) {
  const scale = useRef(new Animated.Value(1)).current
  const reducedMotion = useReducedMotion()
  const prevSuccess = useRef(success)

  useEffect(() => {
    const justSucceeded = success && !prevSuccess.current
    prevSuccess.current = success
    if (!justSucceeded || reducedMotion) return
    scale.setValue(SUCCESS_POP_FROM)
    const anim = Animated.spring(scale, {
      toValue: 1,
      ...tokens.motion.springPlayful,
      delay: index * SUCCESS_STAGGER_MS,
      useNativeDriver: true,
    })
    anim.start()
    return () => anim.stop()
  }, [success, index, scale, reducedMotion])

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View
        className={cn(
          "h-14 w-12 items-center justify-center rounded-sm bg-background",
          hasError
            ? "border-error border-border-error"
            : success
              ? "border border-accent"
              : isActive
                ? "border-focus border-border-focus"
                : "border border-border-control",
        )}
      >
        {char ? (
          <Text variant="monoLarge" tone={success && !hasError ? "accent" : "primary"}>
            {secure ? "\u25CF" : char}
          </Text>
        ) : isActive ? (
          // Caret sederhana: garis 1.5px setinggi digit, warna border-focus
          <View className="h-6 w-[1.5px] bg-border-focus" />
        ) : null}
      </View>
    </Animated.View>
  )
}

export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(function OtpInput(
  {
    length = 6,
    value,
    defaultValue = "",
    onChange,
    onComplete,
    secure = false,
    success = false,
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
  // Dipakai di BottomSheet verifikasi email: proxy fokus wajib ikut aturan
  // hit-test Fabric (lihat reanimated-pressable-context.ts).
  const Pressable = useTransformAwarePressable()

  return (
    <View className={cn("w-full gap-2", className)} {...rest}>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        disabled={disabled}
        accessibilityRole="none"
        accessibilityLabel={`Kode ${length} digit, ${code.length} dari ${length} terisi`}
        accessibilityValue={{ text: `${code.length} dari ${length}` }}
        className={cn("flex-row justify-between gap-2 rounded-sm", disabled && "opacity-disabled", focusRing)}

      >
        {Array.from({ length }, (_, i) => (
          <DigitBox
            key={i}
            index={i}
            char={code[i]}
            secure={secure}
            isActive={focused && i === activeIndex && !disabled}
            hasError={hasError}
            success={success && !hasError}
          />
        ))}
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
        accessibilityLabel={`Kode ${length} digit, ${code.length} dari ${length} terisi`}
        accessibilityValue={{ text: `${code.length} dari ${length}` }}
        accessibilityState={{ disabled }}
        className="absolute h-1 w-1 opacity-0"
      />

      <FieldHelper helperText={helperText} errorText={errorText} />
    </View>
  )
})