/**
 * Kahade — <SegmentedControl> (§9.16 Segmented Control).
 *
 * Toggle 2–4 opsi setara yang mengubah TAMPILAN data di tempat (mis.
 * "Sebagai Pembeli / Sebagai Penjual", "Bulan / Tahun"). Bukan untuk
 * navigasi konten panjang (pakai <Tabs>) dan bukan pilihan form yang
 * disimpan (pakai <RadioGroup>/<ChipGroup>).
 *
 * Keputusan non-obvious:
 *   - Container `rounded-sm border border-border bg-surface p-[2px]`; segmen
 *     aktif `bg-primary` + teks `primary-foreground` mengikuti bahasa Chip
 *     selected (§9.25) — di dark mode otomatis invert. Segmen inaktif
 *     transparan dengan text-secondary.
 *   - Radius segmen `rounded-xs` (4px) di dalam container 6px: selisih 2px =
 *     padding, sehingga sudut dalam tampak konsentris (bukan konstanta baru,
 *     turunan radius.sm - p).
 *   - Tinggi total 40px (h-10) = Button sm; segmen 36px.
 *   - Tanpa animasi geser (§1 tenang) dan tanpa scale press — PressableScale
 *     dipakai hanya untuk disabled-opacity & a11y yang seragam.
 *   - Role a11y "radiogroup"/"radio": semantik "satu dari N" lebih tepat
 *     untuk screen reader daripada "tab" (tidak mengganti panel konten).
 */
import { View, type ViewProps } from "react-native"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type SegmentItem<V extends string = string> = {
  value: V
  label: string
  icon?: IconComponent
  disabled?: boolean
}

export type SegmentedControlProps<V extends string = string> = Omit<ViewProps, "children"> & {
  items: readonly SegmentItem<V>[]
  value: V
  onChange: (value: V) => void
  disabled?: boolean
  className?: string
}

export function SegmentedControl<V extends string = string>({
  items,
  value,
  onChange,
  disabled = false,
  className,
  ...rest
}: SegmentedControlProps<V>) {
  return (
    <View
      accessibilityRole="radiogroup"
      className={cn(
        "h-10 w-full flex-row rounded-sm border border-border bg-surface p-[2px]",
        disabled && "opacity-disabled",
        className,
      )}
      {...rest}
    >
      {items.map((item) => {
        const active = item.value === value
        const isDisabled = disabled || item.disabled
        return (
          <PressableScale
            key={item.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, disabled: !!isDisabled }}
            accessibilityLabel={item.label}
            scaleOnPress={false}
            disabled={isDisabled}
            onPress={() => onChange(item.value)}
            containerClassName="flex-1"
            className={cn(
              "h-full flex-row items-center justify-center gap-2 rounded-xs px-3",
              active ? "bg-primary" : "bg-transparent",
            )}
          >
            {item.icon ? (
              <Icon icon={item.icon} size="xs" tone={active ? "inverse" : "default"} weight={active ? "fill" : "regular"} />
            ) : null}
            <Text
              variant="label"
              tone={active ? "inverse" : "secondary"}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </PressableScale>
        )
      })}
    </View>
  )
}
