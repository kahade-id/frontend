/**
 * StatusIndicator — titik status + label teks ("Online", "Menunggu
 * pembayaran", "Sengketa"). Lebih ringan dari Badge: tanpa border/fill,
 * cocok di dalam ListItem meta atau header kartu (§9 Display, "Status").
 *
 * Keputusan non-obvious:
 *   - Memakai <Dot> yang sudah ada untuk titik agar ukuran dan tone konsisten;
 *     komponen ini hanya menambah label + opsi `pulse`.
 *   - `pulse` (untuk "live"/"sedang diproses") diimplementasikan dengan
 *     Animated.loop opacity (native driver), bukan scale, karena scale pada
 *     elemen 8px terlihat pecah di Android. Durasi motion.duration.slow ×2
 *     supaya tidak mengganggu — animasi ini informatif, bukan dekoratif.
 *   - Tone "neutral" default: warna semantik hanya bila status memang
 *     bermakna (success/danger/warning), sesuai §4.
 */
import { useEffect, useRef } from "react"
import { Animated, Easing, View, type ViewProps } from "react-native"

import { Dot, type DotTone } from "@/components/ui/dot"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { motion } from "@/lib/tokens"

export type StatusIndicatorTone = Extract<DotTone, "neutral" | "primary" | "success" | "danger" | "warning" | "info">

export type StatusIndicatorProps = Omit<ViewProps, "children"> & {
  label: string
  tone?: StatusIndicatorTone
  /** Kedip halus — untuk status yang sedang berjalan (live) */
  pulse?: boolean
  size?: "sm" | "md"
  className?: string
}

const toneText: Record<StatusIndicatorTone, string> = {
  neutral: "text-text-secondary",
  primary: "text-text-primary",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  info: "text-info",
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

  useEffect(() => {
    if (!pulse) {
      opacity.setValue(1)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: motion.duration.slow * 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: motion.duration.slow * 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse, opacity])

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
      <Text variant={size === "sm" ? "caption" : "body-sm"} weight="medium" className={toneText[tone]}>
        {label}
      </Text>
    </View>
  )
}
