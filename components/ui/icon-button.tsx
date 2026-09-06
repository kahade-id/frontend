/**
 * Kahade — <IconButton> (§9.1 "Icon button").
 *
 * Button persegi hanya-ikon untuk header action, close, back, more.
 * Varian sama dengan Button (primary/secondary/ghost/destructive), default
 * `ghost` karena 90% pemakaiannya adalah aksi header/inline.
 *
 * Keputusan non-obvious:
 *   - `accessibilityLabel` WAJIB (bukan optional): tanpa label, tombol ikon
 *     tidak terbaca screen reader. Ini enforcement di level tipe.
 *   - Ukuran visual sm=40 / md=48 mengikuti Button agar sejajar rapi di
 *     baris yang sama; ikon di dalamnya sm=20 / md=24 (§7). Karena 40 < 44pt
 *     (iOS) / 48dp (Android), `sm` mendapat `hitSlop` space[1] (4px) tak
 *     terlihat -> area sentuh efektif 48x48 tanpa mengubah tampilan. Pola
 *     sama dengan <Switch>. Pemanggil tetap bisa override lewat prop hitSlop.
 *   - Ghost/secondary memakai ikon tone "default" (text-tertiary) sesuai
 *     aturan warna ikon §7; `active` menaikkan ke text-primary + weight fill
 *     untuk state selected (mis. tab/filter aktif).
 *   - `rounded-sm` (6px) default; `shape="pill"` -> rounded-full untuk
 *     FAB-like/close di dalam banner. Tidak ada radius lain.
 */
import { View } from "react-native"

import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { tokens } from "@/lib/tokens"
import { Icon, type IconComponent, type IconTone, type IconWeightProp } from "@/components/ui/icon"
import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Spinner } from "@/components/ui/spinner"

export type IconButtonVariant = "primary" | "secondary" | "ghost" | "destructive"
export type IconButtonSize = "sm" | "md"

export type IconButtonProps = Omit<
  PressableScaleProps,
  "children" | "className" | "accessibilityLabel"
> & {
  icon: IconComponent
  /** Wajib — dibaca screen reader sebagai nama tombol */
  accessibilityLabel: string
  variant?: IconButtonVariant
  size?: IconButtonSize
  /** State selected: ikon text-primary + weight fill (§7) */
  active?: boolean
  loading?: boolean
  shape?: "square" | "pill"
  weight?: IconWeightProp
  className?: string
}

const variantBox: Record<IconButtonVariant, string> = {
  primary: "bg-primary",
  secondary: "bg-transparent border border-border",
  ghost: "bg-transparent",
  destructive: "bg-danger",
}

const sizeBox: Record<IconButtonSize, string> = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
}

export function IconButton({
  icon,
  accessibilityLabel,
  variant = "ghost",
  size = "md",
  active = false,
  loading = false,
  shape = "square",
  weight,
  disabled,
  className,
  containerClassName,
  ...rest
}: IconButtonProps) {
  const isDisabled = disabled || loading
  const solid = variant === "primary" || variant === "destructive"
  const tone: IconTone = solid ? "inverse" : active ? "active" : "default"

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!isDisabled, busy: loading, selected: active }}
      disabled={isDisabled}
      // sm 40px -> 48px efektif (44pt iOS / 48dp Android); md sudah 48.
      hitSlop={size === "sm" ? { top: tokens.space[1], bottom: tokens.space[1], left: tokens.space[1], right: tokens.space[1] } : undefined}
      containerClassName={cn(
        "self-start",
        shape === "pill" ? "rounded-full" : "rounded-sm",
        focusRing,
        containerClassName,
      )}
      className={cn(
        "items-center justify-center",
        shape === "pill" ? "rounded-full" : "rounded-sm",
        sizeBox[size],
        variantBox[variant],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === "sm" ? "sm" : "md"} tone={solid ? "inverse" : "active"} />
      ) : (
        <View accessible={false}>
          <Icon
            icon={icon}
            size={size === "sm" ? "sm" : "md"}
            tone={tone}
            active={!solid && active}
            weight={weight}
          />
        </View>
      )}
    </PressableScale>
  )
}
