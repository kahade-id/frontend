/**
 * Kahade — <PinInput> + <PinDots> (§9.21 PIN, §8 "tidak ada shake").
 *
 * Input PIN numerik berbasis <PinPad> (bukan keyboard OS) dengan indikator
 * titik. Dua mode:
 *   - "enter" : satu langkah, `onComplete(pin)` saat panjang terpenuhi.
 *   - "setup" : dua langkah — buat PIN lalu ulangi. Bila cocok ->
 *               `onComplete(pin)`; bila tidak -> error, kembali ke langkah 1.
 *
 * Keputusan non-obvious:
 *   - Nilai PIN TIDAK pernah dirender sebagai teks (hanya dots) dan tidak
 *     masuk ke accessibilityLabel — hanya jumlah digit terisi yang diumumkan.
 *   - Error tidak memicu shake (§8); dots berubah `bg-danger` + helper text.
 *     Dots dikosongkan otomatis setelah `errorText` berubah supaya user
 *     langsung bisa mengetik ulang tanpa menghapus manual.
 *   - Haptic hanya di momen kritikal (§8): sukses & gagal, bukan per digit.
 *   - Dot terisi = `bg-primary`, kosong = `border-border-control`. Dot kosong
 *     adalah indikator state non-teks (berapa digit tersisa), jadi outline-nya
 *     wajib >= 3:1 (WCAG 1.4.11, audit #6). Ukuran 12px (space.3) dengan
 *     gap 16px: cukup lega untuk 6 digit di lebar 320.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { View, type ViewProps } from "react-native"

import { PinPad, type PinPadProps } from "@/components/ui/pin-pad"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { haptic } from "@/lib/haptics"

export const PIN_DEFAULT_LENGTH = 6

// ------------------------------------------------------------------
// PinDots — indikator saja, bisa dipakai terpisah (mis. di PinSheet)
// ------------------------------------------------------------------
export type PinDotsProps = Omit<ViewProps, "children"> & {
  length: number
  filled: number
  error?: boolean
  className?: string
}

export function PinDots({ length, filled, error = false, className, ...rest }: PinDotsProps) {
  return (
    <View accessible={false}
      accessibilityRole="progressbar"
      accessibilityLabel={`${filled} dari ${length} digit terisi`}
      accessibilityValue={{ min: 0, max: length, now: filled }}
      className={cn("flex-row items-center justify-center gap-4", className)}
      {...rest}
    >
      {Array.from({ length }).map((_, i) => {
        const on = i < filled
        return (
          <View
            key={i}
            className={cn(
              "h-3 w-3 rounded-full",
              error ? (on ? "bg-danger" : "border border-border-error") : on ? "bg-primary" : "border border-border-control",
            )}
          />
        )
      })}
    </View>
  )
}

// ------------------------------------------------------------------
// PinInput
// ------------------------------------------------------------------
export type PinInputMode = "enter" | "setup"

export type PinInputLabels = {
  create: string
  confirm: string
  mismatch: string
}

const DEFAULT_LABELS: PinInputLabels = {
  create: "Buat PIN baru",
  confirm: "Ulangi PIN Anda",
  mismatch: "PIN tidak cocok. Silakan buat ulang.",
}

export type PinInputProps = Omit<ViewProps, "children"> &
  Pick<PinPadProps, "onBiometric"> & {
    mode?: PinInputMode
    length?: number
    /** Dipanggil saat PIN final terbentuk (enter: 1x; setup: setelah cocok) */
    onComplete: (pin: string) => void
    /** Error dari luar (mis. "PIN salah" dari server) — mengosongkan input */
    errorText?: string
    helperText?: string
    /** Judul di atas dots; default mengikuti langkah pada mode setup */
    title?: string
    disabled?: boolean
    labels?: Partial<PinInputLabels>
    className?: string
  }

export function PinInput({
  mode = "enter",
  length = PIN_DEFAULT_LENGTH,
  onComplete,
  onBiometric,
  errorText,
  helperText,
  title,
  disabled = false,
  labels,
  className,
  ...rest
}: PinInputProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const [value, setValue] = useState("")
  const [step, setStep] = useState<1 | 2>(1)
  const [first, setFirst] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | undefined>()
  const completeRef = useRef(onComplete)
  completeRef.current = onComplete
  // Timer "satu frame" sebelum finish — dibersihkan saat unmount agar
  // onComplete tidak dipanggil setelah layar berpindah.
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (finishTimer.current) clearTimeout(finishTimer.current)
    },
    [],
  )

  const error = errorText ?? localError

  // Error dari luar -> kosongkan supaya user langsung ketik ulang
  useEffect(() => {
    if (errorText) {
      setValue("")
      haptic("error")
    }
  }, [errorText])

  const finish = useCallback(
    (pin: string) => {
      if (mode === "enter") {
        completeRef.current(pin)
        return
      }
      if (step === 1) {
        setFirst(pin)
        setStep(2)
        setValue("")
        return
      }
      if (pin === first) {
        haptic("success")
        completeRef.current(pin)
      } else {
        haptic("error")
        setLocalError(t.mismatch)
        setFirst(null)
        setStep(1)
        setValue("")
      }
    },
    [mode, step, first, t.mismatch],
  )

  const onDigit = useCallback(
    (d: string) => {
      if (disabled || value.length >= length) return
      setLocalError(undefined)
      const next = value + d
      setValue(next)
      if (next.length === length) {
        // Beri satu frame agar dot terakhir terlihat terisi sebelum lanjut
        if (finishTimer.current) clearTimeout(finishTimer.current)
        finishTimer.current = setTimeout(() => {
          finishTimer.current = null
          finish(next)
        }, 60)
      }
    },
    [disabled, value, length, finish],
  )

  const onBackspace = useCallback(() => {
    if (disabled) return
    setLocalError(undefined)
    setValue((v) => v.slice(0, -1))
  }, [disabled])

  const heading = title ?? (mode === "setup" ? (step === 1 ? t.create : t.confirm) : undefined)

  return (
    <View className={cn("w-full items-center gap-8", className)} {...rest}>
      <View className="items-center gap-4">
        {heading ? (
          <Text accessibilityHint="Ketuk untuk detail" variant="h3" className="text-center">
            {heading}
          </Text>
        ) : null}
        <PinDots length={length} filled={value.length} error={!!error} />
        {error || helperText ? (
          <Text variant="caption" tone={error ? "danger" : "secondary"} className="text-center">
            {error ?? helperText}
          </Text>
        ) : null}
      </View>

      <PinPad
        onDigit={onDigit}
        onBackspace={onBackspace}
        onBiometric={mode === "enter" ? onBiometric : undefined}
        disabled={disabled}
      />
    </View>
  )
}
