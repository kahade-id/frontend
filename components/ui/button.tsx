/**
 * Kahade — <Button> (§9.1).
 *
 * Varian: primary (solid), secondary (outline), ghost, destructive.
 * State  : default, pressed (scale 0.97 via PressableScale), disabled
 *          (opacity 40%), loading (spinner inline, label tetap menahan lebar).
 *
 * Keputusan non-obvious:
 *   - Radius `rounded-sm` (6px) — §5: button = sm. Bukan md.
 *   - Tinggi: sm=40 (h-10), md=48 (h-12) — keduanya kelipatan 4 dan >= 44
 *     target sentuh untuk md. Padding horizontal px-4 / px-5 dari tokens.
 *     `sm` mendapat `hitSlop` vertikal space[1] (4+40+4 = 48) agar memenuhi
 *     44pt/48dp tanpa mengubah tampilan (audit #1; sama dengan IconButton
 *     sm). Pemanggil bisa override lewat prop hitSlop.
 *   - Secondary memakai `border-border` (gray.400 / #3A3A3A), BUKAN
 *     border-focus: role focus disediakan untuk state fokus/aktif (§6.1),
 *     bukan resting outline. Hierarki: primary (solid) > secondary (outline)
 *     > ghost (teks saja) tetap jelas tanpa border hitam.
 *   - Destructive solid `bg-danger` dengan teks putih di light dan gray.950
 *     di dark: fill dark (#F87171) terlalu terang untuk teks putih (< AA),
 *     mengikuti logika invert yang sama dengan primary/primary-foreground.
 *   - Loading: label dirender dengan `opacity-0` (bukan di-unmount) agar
 *     lebar button tidak melompat saat spinner muncul; spinner absolute di
 *     tengah. `disabled` otomatis saat loading supaya tidak double-submit.
 *   - Ikon di Button pakai tone "inverse" untuk primary/destructive dan
 *     "active" untuk secondary/ghost — ikon di dalam button mengikuti warna
 *     label, bukan text-tertiary default.
 */
import type { ReactNode } from "react"
import { View } from "react-native"

import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { Icon, type IconComponent, type IconTone } from "@/components/ui/icon"
import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive"
export type ButtonSize = "sm" | "md"

export type ButtonProps = Omit<PressableScaleProps, "children" | "className"> & {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  /** Lebar penuh container (default) atau mengikuti konten */
  fullWidth?: boolean
  leftIcon?: IconComponent
  rightIcon?: IconComponent
  className?: string
}

const variantBox: Record<ButtonVariant, string> = {
  primary: "bg-primary",
  secondary: "bg-transparent border border-border",
  ghost: "bg-transparent",
  // Teks putih di light, gray.950 di dark (kontras di atas fill terang)
  destructive: "bg-danger",
}

const variantText: Record<ButtonVariant, string> = {
  primary: "text-primary-foreground",
  secondary: "text-text-primary",
  ghost: "text-text-primary",
  destructive: "text-white dark:text-gray-950",
}

const variantIconTone: Record<ButtonVariant, IconTone> = {
  primary: "inverse",
  secondary: "active",
  ghost: "active",
  destructive: "inverse",
}

const sizeBox: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 py-2 gap-2",
  md: "min-h-12 px-5 py-3 gap-2",
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = true,
  leftIcon,
  rightIcon,
  disabled,
  className,
  containerClassName,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading
  const iconSize = size === "sm" ? "xs" : "sm"

  // Ikon mengikuti warna label: tone "inverse" (= primary-foreground) adalah
  // putih di light dan hitam di dark — cocok untuk primary maupun destructive.
  const iconTone = variantIconTone[variant]

  return (
    <PressableScale accessibilityHint="Ketuk untuk berinteraksi"
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={size === "sm" ? { top: tokens.space[1], bottom: tokens.space[1], left: tokens.space[1], right: tokens.space[1] } : undefined}
      containerClassName={cn(fullWidth ? "w-full" : "self-start", containerClassName)}
      className={cn(
        "flex-row items-center justify-center rounded-sm",
        sizeBox[size],
        variantBox[variant],
        className,
      )}
      {...rest}
    >
      {/* Konten label — opacity-0 saat loading agar lebar tetap */}
      <View accessible={false}
        className={cn(
          "min-w-0 flex-shrink flex-row items-center justify-center gap-2",
          loading && "opacity-0",
        )}
      >
        {leftIcon ? <Icon icon={leftIcon} size={iconSize} tone={iconTone} /> : null}
        <Text ellipsizeMode="tail"
          variant={size === "sm" ? "label" : "body"}
          weight={600}
          tone="inherit"
          numberOfLines={undefined}
          className={cn("shrink text-center", variantText[variant])}
        >
          {children}
        </Text>
        {rightIcon ? <Icon icon={rightIcon} size={iconSize} tone={iconTone} /> : null}
      </View>

      {loading ? (
        <View className="absolute inset-0 items-center justify-center">
          <Spinner
            size={size === "sm" ? "sm" : "md"}
            tone={variant === "primary" || variant === "destructive" ? "inverse" : "active"}
          />
        </View>
      ) : null}
    </PressableScale>
  )
}
