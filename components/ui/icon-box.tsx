/**
 * Kahade — <IconBox> (§7 ikon, §6 hierarki border).
 *
 * Ikon Phosphor di dalam kotak ber-fill + border — "leading visual" standar
 * untuk List Item, Empty State, kartu metode, langkah timeline. Memberi bobot
 * visual pada ikon tanpa shadow atau warna tambahan: kotak = surface + border,
 * ikon = text-tertiary (§7 warna ikon default).
 *
 * Varian:
 *   - "surface"  (default): bg-surface + border-default, ikon default/aktif.
 *   - "inverted" : bg-primary, ikon primary-foreground — untuk item terpilih
 *                  atau langkah aktif. Invert otomatis di dark mode.
 *   - "success" | "danger" | "warning" | "info": bgSoft + ikon fill semantik —
 *                  HANYA untuk status transaksi (§2.3), bukan kategori.
 *
 * Keputusan non-obvious:
 *   - Radius mengikuti ukuran: sm/md -> `rounded-sm` (6px), lg/xl -> `rounded-md`
 *     (8px, maksimum non-pill §5). `shape="circle"` untuk timeline/avatar-like.
 *   - Ukuran kotak 32/40/48/64 memetakan ke ikon 16/20/24/32 (§7 size scale)
 *     — rasio ~50% agar ikon punya ruang napas (§1.5).
 *   - Ikon di dalam box dianggap dekoratif (label ada di teks di sampingnya);
 *     kirim `accessibilityLabel` hanya jika box berdiri sendiri.
 */
import { View, type ViewProps } from "react-native"

import { Icon, type IconComponent, type IconTone, type IconWeightProp } from "@/components/ui/icon"
import { cn } from "@/lib/cn"

export type IconBoxSize = "sm" | "md" | "lg" | "xl"
export type IconBoxVariant = "surface" | "inverted" | "success" | "danger" | "warning" | "info"

export type IconBoxProps = Omit<ViewProps, "children"> & {
  icon: IconComponent
  size?: IconBoxSize
  variant?: IconBoxVariant
  shape?: "square" | "circle"
  /** Ikon text-primary + weight fill (varian surface saja) */
  active?: boolean
  weight?: IconWeightProp
  accessibilityLabel?: string
  className?: string
}

const sizeBox: Record<IconBoxSize, string> = {
  sm: "h-8 w-8 rounded-sm",
  md: "h-10 w-10 rounded-sm",
  lg: "h-12 w-12 rounded-md",
  xl: "h-16 w-16 rounded-md",
}

const sizeIcon: Record<IconBoxSize, "xs" | "sm" | "md" | "xl"> = {
  sm: "xs",
  md: "sm",
  lg: "md",
  xl: "xl",
}

const variantBox: Record<IconBoxVariant, string> = {
  surface: "bg-surface border border-border",
  inverted: "bg-primary border border-primary",
  success: "bg-success-soft",
  danger: "bg-danger-soft",
  warning: "bg-warning-soft",
  info: "bg-info-soft",
}

const variantTone: Record<IconBoxVariant, IconTone> = {
  surface: "default",
  inverted: "inverse",
  success: "success",
  danger: "danger",
  warning: "warning",
  info: "info",
}

export function IconBox({
  icon,
  size = "md",
  variant = "surface",
  shape = "square",
  active = false,
  weight,
  accessibilityLabel,
  className,
  ...rest
}: IconBoxProps) {
  const tone: IconTone = variant === "surface" && active ? "active" : variantTone[variant]

  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      className={cn(
        "items-center justify-center",
        sizeBox[size],
        shape === "circle" && "rounded-full",
        variantBox[variant],
        className,
      )}
      {...rest}
    >
      <Icon
        icon={icon}
        size={sizeIcon[size]}
        tone={tone}
        active={variant === "surface" && active}
        weight={weight}
      />
    </View>
  )
}
