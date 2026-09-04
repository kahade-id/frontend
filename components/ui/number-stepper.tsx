/**
 * Kahade — <NumberStepper> (§9.2 turunan; kontrol angka −/+).
 *
 * Kontrol kuantitas: tombol Minus | nilai | tombol Plus dalam satu kotak
 * outlined (radius sm, border-control — outline form control wajib >= 3:1,
 * WCAG 1.4.11 / audit #6) setinggi Input tanpa label (h-12).
 * Dipakai untuk jumlah barang di rincian escrow, jumlah termin, dsb.
 *
 * Bukan "Stepper" §9.22 — itu progress indicator multi-step (kelompok
 * Navigasi). Nama `NumberStepper` dipilih supaya tidak tertukar.
 *
 * Keputusan non-obvious:
 *   - Nilai dirender dalam JetBrains Mono (`monoBody`) karena berdiri sendiri
 *     sebagai angka, bukan bagian kalimat (§3.1). Lebar minimum kolom nilai
 *     dikunci (`min-w-12`) agar kotak tidak melebar/menyempit saat digit
 *     bertambah — konsisten dengan "presisi" §1.
 *   - Tombol −/+ adalah <PressableScale> masing-masing (bukan IconButton)
 *     supaya tidak membawa border/bg sendiri: pemisah visual cukup dari
 *     <Divider vertical> di dalam kotak. Disabled di batas min/max memakai
 *     `opacity-disabled` (bukan warna solid) sesuai §9.1.
 *   - `editable` mengubah kolom tengah jadi TextInput numerik; nilai
 *     di-commit saat blur/submit, lalu di-clamp ke [min,max] dan dibulatkan
 *     ke kelipatan `step`. Saat mengetik tidak di-clamp supaya user bisa
 *     menghapus semua digit sementara.
 *   - Tahan-tekan (long press) mengulang increment tiap 100ms setelah delay
 *     bawaan RN — pola umum stepper, tanpa haptic (§8: tap ringan tidak
 *     pakai haptic).
 *   - `outlineStyle: none` untuk web mengikuti Input (§11).
 */
import { Minus, Plus } from "phosphor-react-native"
import { useCallback, useEffect, useRef, useState } from "react"
import { Platform, TextInput, View, type ViewProps } from "react-native"

import { useTheme } from "@/components/theme-provider"
import { Divider } from "@/components/ui/divider"
import { Field, type FieldProps } from "@/components/ui/field"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatNumber } from "@/lib/format"
import { tokens } from "@/lib/tokens"

export type NumberStepperProps = Omit<ViewProps, "children"> &
  Pick<FieldProps, "label" | "helperText" | "errorText" | "reserveHelperSpace" | "required"> & {
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
    step?: number
    /** Kolom tengah bisa diketik langsung */
    editable?: boolean
    disabled?: boolean
    /** Sufiks pendek setelah angka, mis. "pcs" — dirender Sofia Sans, bukan Mono */
    suffix?: string
    /** Lebar penuh (default) atau mengikuti konten */
    fullWidth?: boolean
    /** Label a11y untuk keseluruhan kontrol (default: `label`) */
    accessibilityLabel?: string
    className?: string
    containerClassName?: string
  }

const REPEAT_INTERVAL_MS = 100

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function snap(n: number, step: number, min: number) {
  // Bulatkan ke kelipatan step relatif terhadap min supaya min selalu sah
  const k = Math.round((n - min) / step)
  return min + k * step
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  editable = false,
  disabled = false,
  suffix,
  fullWidth = true,
  label,
  required,
  helperText,
  errorText,
  reserveHelperSpace,
  accessibilityLabel,
  className,
  containerClassName,
  ...rest
}: NumberStepperProps) {
  const { mode } = useTheme()
  const palette = tokens.colors[mode]

  const hasError = !!errorText
  const canDec = !disabled && value - step >= min
  const canInc = !disabled && value + step <= max

  const commit = useCallback(
    (next: number) => {
      const safe = clamp(snap(next, step, min), min, max)
      if (safe !== value) onChange(safe)
    },
    [max, min, onChange, step, value],
  )

  // --- Long-press repeat -------------------------------------------------
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const latest = useRef(value)
  latest.current = value

  const stopRepeat = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
  }, [])

  const startRepeat = useCallback(
    (dir: 1 | -1) => {
      stopRepeat()
      timer.current = setInterval(() => {
        const next = latest.current + dir * step
        if (next < min || next > max) return stopRepeat()
        onChange(next)
      }, REPEAT_INTERVAL_MS)
    },
    [max, min, onChange, step, stopRepeat],
  )

  useEffect(() => stopRepeat, [stopRepeat])

  // --- Editable center ---------------------------------------------------
  const [draft, setDraft] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const shown = draft ?? formatNumber(value)

  const handleBlur = useCallback(() => {
    setFocused(false)
    if (draft != null) {
      const parsed = Number.parseInt(draft.replace(/[^\d-]/g, ""), 10)
      if (!Number.isNaN(parsed)) commit(parsed)
      setDraft(null)
    }
  }, [commit, draft])

  const stepButton = (dir: 1 | -1) => {
    const enabled = dir === 1 ? canInc : canDec
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={dir === 1 ? "Tambah" : "Kurangi"}
        disabled={!enabled}
        onPress={() => commit(value + dir * step)}
        onLongPress={() => startRepeat(dir)}
        onPressOut={stopRepeat}
        containerClassName="h-full"
        className="h-full w-12 items-center justify-center"
      >
        <Icon icon={dir === 1 ? Plus : Minus} size="sm" weight="bold" tone="active" />
      </PressableScale>
    )
  }

  return (
    <Field
      label={label}
      required={required}
      helperText={helperText}
      errorText={errorText}
      reserveHelperSpace={reserveHelperSpace}
      disabled={disabled}
      className={cn(fullWidth ? "w-full" : "self-start", containerClassName)}
      {...rest}
    >
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityValue={{ min, max, now: value, text: `${formatNumber(value)}${suffix ? ` ${suffix}` : ""}` }}
        accessibilityState={{ disabled }}
        className={cn(
          "h-12 flex-row items-stretch overflow-hidden rounded-sm bg-background",
          hasError
            ? "border-error border-border-error"
            : focused
              ? "border-focus border-border-focus"
              : "border border-border-control",
          fullWidth ? "w-full" : "self-start",
          disabled && "opacity-disabled",
          className,
        )}
      >
        {stepButton(-1)}
        <Divider orientation="vertical" />

        <View className={cn("min-w-12 flex-row items-center justify-center gap-1 px-3", fullWidth && "flex-1")}>
          {editable ? (
            <TextInput
              value={shown}
              editable={!disabled}
              keyboardType="number-pad"
              inputMode="numeric"
              returnKeyType="done"
              selectTextOnFocus
              allowFontScaling={false}
              onFocus={() => setFocused(true)}
              onBlur={handleBlur}
              onChangeText={(t) => setDraft(t.replace(/[^\d]/g, ""))}
              onSubmitEditing={handleBlur}
              selectionColor={palette.primary}
              cursorColor={palette.primary}
              accessibilityLabel={label ?? "Jumlah"}
              className={cn(
                "min-w-8 text-center font-mono-500 text-monoBody text-text-primary",
                Platform.OS === "web" && "outline-none",
              )}
              style={Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : undefined}
            />
          ) : (
            <Text variant="monoBody" tone="primary" numberOfLines={1}>
              {shown}
            </Text>
          )}
          {suffix ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {suffix}
            </Text>
          ) : null}
        </View>

        <Divider orientation="vertical" />
        {stepButton(1)}
      </View>
    </Field>
  )
}
