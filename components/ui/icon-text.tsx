/**
 * Kahade — <IconText> pasangan ikon + teks (§7 gap 8px, warna ikon default).
 *
 * Pola paling sering di UI: ikon Phosphor kecil di kiri teks pendek —
 * meta di kartu transaksi ("🕓 3 Sep 2026, 14:30" — dengan Clock, bukan
 * emoji), baris keunggulan di onboarding, hint di bawah input. Komponen ini
 * menetapkan aturan §7 sekali:
 *   - gap ikon→teks = 8px (`gap-2`, tokens.icon.textGap)
 *   - ikon default `text-tertiary`, teks default `text-secondary`
 *   - ikon 20px (sm) untuk body 14/16; 16px (xs) untuk caption/label
 *
 * Kenapa `items-center`, bukan `items-baseline` (non-obvious): §7 meminta
 * ikon align ke baseline teks, tetapi SVG tidak punya baseline di RN —
 * `items-baseline` akan menempelkan dasar kotak SVG ke baseline huruf dan
 * ikon terlihat "melayang". Dengan line-height spacious (22px untuk body 14)
 * dan ikon 20px, `items-center` menghasilkan posisi optik yang sama dengan
 * baseline-align secara visual. Untuk teks multi-baris, `alignTop` menaruh
 * ikon sejajar baris pertama lewat padding setinggi (lineHeight - icon)/2 —
 * dihitung dari tokens, bukan angka bebas.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Icon, type IconComponent, type IconSize, type IconTone } from "@/components/ui/icon"
import { Text, type TextProps, type TextTone, type TextVariant } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type IconTextProps = Omit<ViewProps, "children"> & {
  icon: IconComponent
  children: ReactNode
  variant?: TextVariant
  tone?: TextTone
  weight?: TextProps["weight"]
  iconTone?: IconTone
  /** Default mengikuti variant: caption/label -> xs (16), lainnya sm (20) */
  iconSize?: IconSize
  /** Ikon aktif (fill + text-primary) */
  active?: boolean
  numberOfLines?: number
  /** Ikon sejajar baris PERTAMA untuk teks multi-baris */
  alignTop?: boolean
  /** Ikon di kanan teks */
  reverse?: boolean
  className?: string
}

export function IconText({
  icon,
  children,
  variant = "body",
  tone = "secondary",
  weight,
  iconTone,
  iconSize,
  active = false,
  numberOfLines,
  alignTop = false,
  reverse = false,
  className,
  ...rest
}: IconTextProps) {
  const size: IconSize = iconSize ?? (variant === "caption" || variant === "label" ? "xs" : "sm")
  const iconPx = tokens.icon.size[size]
  const lineHeight = tokens.typography[variant].lineHeight
  // Offset agar pusat ikon = pusat baris pertama teks; turunan token, bukan konstanta
  const topOffset = alignTop ? Math.max(0, (lineHeight - iconPx) / 2) : 0

  return (
    <View accessible={false}
      className={cn(
        "flex-row gap-2",
        reverse && "flex-row-reverse",
        alignTop ? "items-start" : "items-center",
        className,
      )}
      {...rest}
    >
      <View className="shrink-0" style={alignTop ? { paddingTop: topOffset } : undefined}>
        <Icon icon={icon} size={size} tone={iconTone} active={active} />
      </View>
      <Text
        variant={variant}
        tone={tone}
        weight={weight}
        numberOfLines={numberOfLines}
        className="shrink"
      >
        {children}
      </Text>
    </View>
  )
}
