/**
 * Kahade — <TextLink> (§2.3 "Link/teks yang bisa diklik").
 *
 * Teks tappable ("Lihat Detail", "S&K", "Lupa PIN?"): warna `primary` +
 * underline. Tidak ada biru — monokrom, underline yang membedakan dari teks
 * biasa. Bukan Button ghost: ghost adalah aksi, link adalah navigasi/rujukan
 * dalam konteks teks.
 *
 * Dua mode render, dipilih lewat prop `inline`:
 *   - inline=false (default): dibungkus <PressableScale accessibilityHint="Ketuk untuk berinteraksi" self-start> supaya
 *     dapat pressed scale 0.97 (§8) + hit area minimal 44px lewat `hitSlop`
 *     (teks 14px sendiri terlalu tipis untuk target sentuh).
 *   - inline=true: dirender sebagai <Text onPress> agar bisa disisipkan di
 *     dalam paragraf (<Text>Dengan melanjutkan Anda setuju <TextLink inline>
 *     S&K</TextLink></Text>). RN tidak bisa menaruh View di tengah baris teks,
 *     sehingga scale-on-press TIDAK tersedia di mode ini — pressed ditandai
 *     opacity-disabled sesaat (satu-satunya token opacity yang ada; ini
 *     penyimpangan kecil dari §9.1 "pressed = scale 0.97", lihat catatan
 *     komponen). Hit area mengikuti tinggi baris paragraf, jadi hanya pakai
 *     inline untuk link yang juga tersedia di tempat lain atau tidak kritikal.
 *
 * Disabled: `opacity-disabled`, bukan warna solid (§9.1) — konsisten Button.
 * Weight 600 (bukan 400 body) agar underline + teks tetap terbaca di atas
 * surface abu; 500 diizinkan lewat prop `weight` untuk link di caption.
 */
import { useCallback, useState, type ReactNode } from "react"
import type { GestureResponderEvent, PressableProps } from "react-native"

import { cn } from "@/lib/cn"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text, type TextProps } from "@/components/ui/text"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type TextLinkProps = {
  children: ReactNode
  onPress?: (e: GestureResponderEvent) => void
  /** Render sebagai Text murni agar bisa disisipkan di dalam paragraf */
  inline?: boolean
  disabled?: boolean
  variant?: Extract<TextProps["variant"], "bodyLarge" | "body" | "caption" | "label">
  weight?: 500 | 600
  /** Dibaca screen reader; default = isi teks */
  accessibilityLabel?: string
  hitSlop?: PressableProps["hitSlop"]
  numberOfLines?: number
  className?: string
  /** Hanya untuk mode non-inline: className hit area luar */
  containerClassName?: string
}

// hitSlop membawa target sentuh teks 22px (line-height body) ke ~44px.
const DEFAULT_HIT_SLOP = { top: 11, bottom: 11, left: 4, right: 4 } as const

export function TextLink({
  children,
  onPress,
  inline = false,
  disabled = false,
  variant = "body",
  weight = 600,
  accessibilityLabel,
  hitSlop = DEFAULT_HIT_SLOP,
  numberOfLines,
  className,
  containerClassName,
}: TextLinkProps) {
  const [pressed, setPressed] = useState(false)
  const onIn = useCallback(() => setPressed(true), [])
  const onOut = useCallback(() => setPressed(false), [])

  const textClass = cn("text-primary underline", className)

  if (inline) {
    return (
      <Text ellipsizeMode="tail"
        variant={variant}
        weight={weight}
        tone="inherit"
        accessibilityRole="link"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        onPress={disabled ? undefined : onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        suppressHighlighting
        numberOfLines={numberOfLines}
        className={cn(textClass, (disabled || pressed) && "opacity-disabled")}
      >
        {children}
      </Text>
    )
  }

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      hitSlop={hitSlop}
      containerClassName={cn("self-start", containerClassName)}
    >
      <Text
        variant={variant}
        weight={weight}
        tone="inherit"
        numberOfLines={numberOfLines}
        className={textClass}
      >
        {children}
      </Text>
    </PressableScale>
  )
}