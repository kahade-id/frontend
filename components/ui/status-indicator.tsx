/**
 * Kahade — <StatusIndicator> titik status + label (§2.3 semantic, §9.7
 * pelengkap Badge).
 *
 * "Online", "Menunggu pembayaran", "Sengketa". Lebih ringan dari Badge:
 * tanpa border/fill, cocok di meta ListItem atau header kartu.
 *
 * Keputusan non-obvious:
 *   - Memakai <Dot> untuk titik agar ukuran & tone konsisten; komponen ini
 *     hanya menambah label + opsi `pulse`.
 *   - Warna teks memakai tone `*-text` (success-text, danger-text, …) lewat
 *     prop `tone` Text, BUKAN `text-success` (= warna fill). Fill dirancang
 *     untuk bidang/ikon; kontras fill sebagai teks 12–14px tidak dijamin AA
 *     (§2.3 memisahkan kolom Fill vs Text/Icon).
 *   - `pulse` (status live/sedang diproses) = Animated.loop opacity native
 *     driver, bukan scale — scale pada elemen 8px terlihat pecah di Android.
 *     Durasi slow x2 dengan easing standar sistem (§8) supaya tidak
 *     mengganggu; ini informatif, bukan dekoratif.
 *   - Tone "neutral" default: warna semantik hanya bila status memang
 *     bermakna (§2.3 semantic eksklusif untuk status transaksi).
 */
import { useEffect, useRef } from "react"
import { Animated, Easing, View, type ViewProps } from "react-native"

import { Dot, type DotTone } from "@/components/ui/dot"
import { Text, type TextTone } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"

export type StatusIndicatorTone = Extract<
  DotTone,
  "neutral" | "primary" | "success" | "danger" | "warning" | "info"
>

export type StatusIndicatorProps = Omit<ViewProps, "children"> & {
  label: string
  tone?: StatusIndicatorTone
  /** Kedip halus — untuk status yang sedang berjalan (live) */
  pulse?: boolean
  size?: "sm" | "md"
  className?: string
}

const PULSE_MIN_OPACITY = 0.3

const textTone: Record<StatusIndicatorTone, TextTone> = {
  neutral: "secondary",
  primary: "primary",
  success: "success",
  danger: "danger",
  warning: "warning",
  info: "info",
}

export function StatusIndicator({
  label,
  tone = "neutral",
  pulse = false,
  size = "md",
  className,
  ...rest
}: StatusIndicatorProps) {
  const opacity = useRef(new Animated.Value(1)).current
  // Reduce Motion (audit #2): kedip berulang dimatikan; dot statis. Makna
  // "sedang berjalan" tetap ada di `label` yang dibaca screen reader.
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (!pulse || reducedMotion) {
      opacity.setValue(1)
      return
    }
    const easing = Easing.bezier(...tokens.motion.easing.standard)
    const half = tokens.motion.duration.slow * 2
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: PULSE_MIN_OPACITY,
          duration: half,
          easing,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 1, duration: half, easing, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse, opacity, reducedMotion])

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
      className={cn("flex-row items-center gap-2", className)}
      {...rest}
    >
      <Animated.View style={{ opacity }}>
        <Dot tone={tone} size={size === "sm" ? "sm" : "md"} />
      </Animated.View>
      <Text accessibilityHint="Ketuk untuk detail" variant={size === "sm" ? "caption" : "body"} weight={500} tone={textTone[tone]}>
        {label}
      </Text>
    </View>
  )
}
