/**
 * ProgressRing — progres melingkar untuk ringkasan kompak (mis. persentase
 * dana yang sudah dilepas, sisa waktu inspeksi).
 *
 * Keputusan:
 *   1. Digambar dengan react-native-svg (sudah menjadi dependency Phosphor)
 *      supaya identik di iOS/Android/web. SVG tidak menerima className, jadi
 *      warna stroke diambil dari `tokens.colors[mode]` + `useIconColor()` —
 *      ini pengecualian sah dari aturan "hanya className", bukan hardcode hex.
 *   2. Track memakai borderDefault, fill memakai textPrimary (monokrom) atau
 *      fill semantik. Tidak ada gradient/shadow (§6).
 *   3. Stroke linecap "butt" (bukan round) agar konsisten dengan estetika
 *      sharp/minim rounded §5.
 *   4. Children (biasanya <Text variant="monoBody">) di-center di tengah ring.
 *   5. Ring MENGISI dengan animasi (v2 signature moment, kurva enter, durasi
 *      `moment` 800ms) saat mount & tiap `value` berubah — bukan langsung
 *      penuh. Label persen/value SR langsung nilai akhir (yang ditonton
 *      hanya gerak ringnya). Instan saat reduced motion; matikan via
 *      `animated={false}`.
 */
import { useEffect, useRef, type ReactNode } from "react"
import { Animated, Easing, View, type ViewProps } from "react-native"
import Svg, { Circle } from "react-native-svg"

import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { useTheme } from "@/components/theme-provider"
import { useIconColor, type IconTone } from "./icon"
import { Text } from "./text"

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export type ProgressRingTone = "primary" | "success" | "danger" | "warning" | "info" | "accent"

export type ProgressRingProps = Omit<ViewProps, "children"> & {
  /** 0–100 */
  value: number
  /** Diameter px. Default 48. */
  size?: number
  /** Ketebalan stroke px. Default 4. */
  strokeWidth?: number
  /** Animasi mengisi (default true) — instan saat reduced motion */
  animated?: boolean
  tone?: ProgressRingTone
  /** Konten tengah; default menampilkan persen mono bila `showValue` */
  children?: ReactNode
  showValue?: boolean
  accessibilityLabel?: string
  className?: string
}

const toneToIconTone: Record<ProgressRingTone, IconTone> = {
  primary: "active",
  success: "success",
  danger: "danger",
  warning: "warning",
  info: "info",
  accent: "accent",
}

export function ProgressRing({
  value,
  size = 48,
  strokeWidth = 4,
  animated = true,
  tone = "primary",
  children,
  showValue = false,
  accessibilityLabel,
  className,
  ...rest
}: ProgressRingProps) {
  const { mode } = useTheme()
  const trackColor = tokens.colors[mode].borderDefault
  const fillColor = useIconColor(toneToIconTone[tone])
  const reducedMotion = useReducedMotion()

  // NaN-safe: a NaN here becomes NaN in `strokeDashoffset`, which react-native-svg rejects.
  const pct = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r

  // v2: nilai 0..100 dianimasikan (kurva enter, durasi moment). Reduced /
  // animated=false → setValue langsung. strokeDashoffset bukan transform/
  // opacity sehingga native driver tidak bisa dipakai — satu-satunya
  // Animated non-native di komponen ini, terisolasi di sini saja.
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!animated || reducedMotion) {
      anim.setValue(pct)
      return
    }
    const enter = tokens.motion.easing.enter
    const a = Animated.timing(anim, {
      toValue: pct,
      duration: tokens.motion.duration.moment,
      easing: Easing.bezier(enter[0], enter[1], enter[2], enter[3]),
      useNativeDriver: false,
    })
    a.start()
    return () => a.stop()
  }, [anim, pct, animated, reducedMotion])
  const dashOffset = anim.interpolate({ inputRange: [0, 100], outputRange: [c, 0] })

  return (
    <View
      /*
       * Ring progress = gambar + nilai. `accessible` membuat role=progressbar
       * dan accessibilityValue dibacakan sebagai satu elemen; tanpa itu RN
       * mengabaikan label/nilai dan hanya SVG dekoratif yang tersisa.
       */
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      accessibilityLabel={accessibilityLabel}
      className={cn("items-center justify-center", className)}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={fillColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="butt"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={dashOffset}
          // Mulai dari jam 12
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children ??
        (showValue ? (
          <Text variant={size >= 64 ? "monoBody" : "caption"} weight={600}>
            {Math.round(pct)}%
          </Text>
        ) : null)}
    </View>
  )
}
