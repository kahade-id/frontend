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
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import Svg, { Circle } from "react-native-svg"

import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { useTheme } from "@/components/theme-provider"
import { useIconColor, type IconTone } from "./icon"
import { Text } from "./text"

export type ProgressRingTone = "primary" | "success" | "danger" | "warning" | "info"

export type ProgressRingProps = Omit<ViewProps, "children"> & {
  /** 0–100 */
  value: number
  /** Diameter px. Default 48. */
  size?: number
  /** Ketebalan stroke px. Default 4. */
  strokeWidth?: number
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
}

export function ProgressRing({
  value,
  size = 48,
  strokeWidth = 4,
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

  // NaN-safe: a NaN here becomes NaN in `strokeDashoffset`, which react-native-svg rejects.
  const pct = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const dashOffset = c * (1 - pct / 100)

  return (
    <View
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
        <Circle
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
