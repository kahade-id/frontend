/**
 * Kahade — <StepProgress> (§9.22 Stepper / Progress Indicator).
 *
 * Bar horizontal TIPIS untuk alur multi-step (checkout, KYC, buat transaksi
 * escrow — semua pattern Push §10). Fill `primary`, track `border-default`,
 * dan TANPA teks "Langkah X/Y" (§9.22) — cukup visual; angka langkah tetap
 * disampaikan ke screen reader lewat accessibilityValue.
 *
 * Dua bentuk:
 *   - kontinu (default): satu bar, fill dianimasikan ke `value` (0–1) atau
 *     `step/total`. Dipakai di bawah <Header>.
 *   - `segmented`: N ruas terpisah gap-1 (onboarding/story). Ruas ke-N
 *     terisi penuh untuk langkah yang sudah lewat; tidak ada animasi parsial.
 *
 * Beda dengan <ProgressBar>: ProgressBar untuk KEMAJUAN DATA (upload,
 * persen dana) dengan label/persen dan tinggi 8px; StepProgress untuk
 * POSISI DALAM ALUR — 2px (`h-[2px]`), tanpa radius (menempel ke tepi bawah
 * header, garis lurus lebih "institusional" §5), tanpa label.
 *
 * Animasi width tidak didukung native driver → `useNativeDriver: false`,
 * pengecualian yang sama dengan ProgressBar (elemen kecil, jarang berubah).
 */
import { useEffect, useRef } from "react"
import { Animated, Easing, View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

export type StepProgressProps = Omit<ViewProps, "children"> & {
  /** 0–1. Alternatif: step + total. */
  value?: number
  /** Langkah aktif 1-based */
  step?: number
  total?: number
  /** N ruas terpisah, bukan satu bar */
  segmented?: boolean
  className?: string
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export function StepProgress({ value, step, total, segmented = false, className, ...rest }: StepProgressProps) {
  const ratio = clamp01(value ?? (step != null && total ? step / total : 0))
  const anim = useRef(new Animated.Value(ratio)).current
  // Reduce Motion (audit #2): progres esensial tetap tampil, tanpa gerakan
  // -> lompat ke nilai akhir.
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    Animated.timing(anim, {
      toValue: ratio,
      duration: motionDuration(reducedMotion, tokens.motion.duration.base),
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: false,
    }).start()
  }, [ratio, anim, reducedMotion])

  const a11y = {
    accessibilityRole: "progressbar" as const,
    accessibilityLabel:
      step != null && total ? `Langkah ${step} dari ${total}` : `Progres ${Math.round(ratio * 100)} persen`,
    accessibilityValue: { min: 0, max: 100, now: Math.round(ratio * 100) },
  }

  if (segmented && total) {
    const current = step ?? Math.round(ratio * total)
    return (
      <View className={cn("w-full flex-row gap-1", className)} {...a11y} {...rest}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} className={cn("h-[2px] flex-1", i < current ? "bg-primary" : "bg-border")} />
        ))}
      </View>
    )
  }

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })

  return (
    <View className={cn("h-[2px] w-full bg-border", className)} {...a11y} {...rest}>
      {/* Animated.View tidak di-interop NativeWind: className di View dalam */}
      <Animated.View style={{ height: "100%", width }}>
        <View className="h-full w-full bg-primary" />
      </Animated.View>
    </View>
  )
}
