/**
 * Kahade — <Spinner> (§8 "Loading inline / pagination").
 *
 * Indicator kecil STANDAR untuk loading inline: monokrom `text-tertiary`,
 * 16–20px (tokens.motion.inlineSpinnerSize). Bukan logo brand — logo hanya
 * untuk momen full-screen/signature (splash, pull-to-refresh, page fetch).
 *
 * Memakai ActivityIndicator RN: prop `color`/`size` bukan style, jadi warna
 * di-resolve dari tokens via useTheme() (pengecualian yang sama dengan Icon).
 * Ukuran dibatasi ke rentang token; `size="sm"` (16) untuk di dalam Button
 * kecil, `"md"` (20) default.
 */
import { ActivityIndicator, View, type ViewProps } from "react-native"

import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type SpinnerTone = "default" | "inverse" | "active"

export type SpinnerProps = ViewProps & {
  size?: "sm" | "md"
  tone?: SpinnerTone
  className?: string
}

export function Spinner({ size = "md", tone = "default", className, ...rest }: SpinnerProps) {
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const color =
    tone === "inverse"
      ? palette.primaryForeground
      : tone === "active"
        ? palette.textPrimary
        : palette.textTertiary

  const px =
    size === "sm" ? tokens.motion.inlineSpinnerSize.min : tokens.motion.inlineSpinnerSize.max

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Memuat"
      className={cn("items-center justify-center", className)}
      style={{ width: px, height: px }}
      {...rest}
    >
      {/* ActivityIndicator "small" = 20px; transform scale mengecilkan ke 16 tanpa blur */}
      <ActivityIndicator
        size="small"
        color={color}
        style={px < 20 ? { transform: [{ scale: px / 20 }] } : undefined}
      />
    </View>
  )
}
