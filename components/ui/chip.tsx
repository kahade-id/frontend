/**
 * Kahade — <Chip> + <ChipGroup> (§9.25 Chip / Filter Tag).
 *
 * Tag yang bisa di-tap untuk filter cepat (riwayat transaksi, kategori).
 * Radius `full` (pill), outline style konsisten dengan Badge outline.
 * Selected: fill `primary` + teks `primary-foreground` (invert otomatis di
 * dark mode). Tinggi 32px (h-8) — cukup rapat untuk baris horizontal scroll,
 * hit area diperluas ke 44 lewat `hitSlop` vertikal.
 *
 * Keputusan non-obvious:
 *   - Border chip selected memakai `border-primary` (bukan border-focus) agar
 *     tidak ada garis abu terlihat di tepi fill hitam; secara warna identik
 *     di kedua mode karena primary == border-focus.
 *   - `onRemove` (ikon X) untuk chip "filter aktif" yang bisa dilepas —
 *     hanya ikon yang tappable terpisah, sisanya toggle.
 *   - ChipGroup: multi-select by default (§9.25); `single` untuk pola
 *     segmented ringan. Layout `flex-wrap` dengan gap-2; untuk scroll
 *     horizontal, bungkus sendiri dengan ScrollView horizontal.
 */
import { X } from "phosphor-react-native"
import type { ReactNode } from "react"
import { Pressable, View, type ViewProps } from "react-native"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type ChipProps = Omit<PressableScaleProps, "children" | "className"> & {
  children: ReactNode
  selected?: boolean
  icon?: IconComponent
  /** Tampilkan ikon X yang memanggil onRemove */
  onRemove?: () => void
  disabled?: boolean
  className?: string
}

export function Chip({
  children,
  selected = false,
  icon,
  onRemove,
  disabled = false,
  className,
  containerClassName,
  ...rest
}: ChipProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      hitSlop={{ top: 6, bottom: 6 }}
      containerClassName={cn("self-start", containerClassName)}
      className={cn(
        "h-8 flex-row items-center gap-1 rounded-full px-3",
        selected ? "border border-primary bg-primary" : "border border-border bg-transparent",
        className,
      )}
      {...rest}
    >
      {icon ? <Icon icon={icon} size="xs" tone={selected ? "inverse" : "default"} /> : null}
      <Text
        variant="label"
        tone={selected ? "inverse" : "primary"}
        numberOfLines={1}
        className={cn(icon && "ml-1")}
      >
        {children}
      </Text>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          disabled={disabled}
          hitSlop={tokens.space[2]}
          accessibilityRole="button"
          accessibilityLabel="Hapus filter"
          className="ml-1"
        >
          <Icon icon={X} size="xs" weight="bold" tone={selected ? "inverse" : "default"} />
        </Pressable>
      ) : null}
    </PressableScale>
  )
}

// ------------------------------------------------------------------

export type ChipOption<V extends string = string> = {
  value: V
  label: string
  icon?: IconComponent
  disabled?: boolean
}

export type ChipGroupProps<V extends string = string> = Omit<ViewProps, "children"> & {
  options: readonly ChipOption<V>[]
  value: V[]
  onChange: (next: V[]) => void
  /** Hanya satu chip aktif (deselect dengan tap ulang) */
  single?: boolean
  disabled?: boolean
  className?: string
}

export function ChipGroup<V extends string = string>({
  options,
  value,
  onChange,
  single = false,
  disabled = false,
  className,
  ...rest
}: ChipGroupProps<V>) {
  const toggle = (v: V) => {
    const has = value.includes(v)
    if (single) return onChange(has ? [] : [v])
    onChange(has ? value.filter((x) => x !== v) : [...value, v])
  }

  return (
    <View className={cn("flex-row flex-wrap gap-2", className)} {...rest}>
      {options.map((o) => (
        <Chip
          key={o.value}
          icon={o.icon}
          selected={value.includes(o.value)}
          disabled={disabled || o.disabled}
          onPress={() => toggle(o.value)}
        >
          {o.label}
        </Chip>
      ))}
    </View>
  )
}
