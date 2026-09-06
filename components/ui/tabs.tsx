/**
 * Kahade — <Tabs> underline (§9.16 Tabs).
 *
 * Tab konten dalam satu layar (mis. Riwayat: "Semua / Berjalan / Selesai").
 * Untuk 2–3 opsi yang bersifat toggle tampilan pakai <SegmentedControl>;
 * untuk navigasi antar layar pakai <BottomTabBar>.
 *
 * Keputusan non-obvious:
 *   - Indikator aktif = `border-b-focus` (1.5px) `border-primary` di item,
 *     di atas garis dasar `border-b border-border` container. Border, bukan
 *     View absolut yang dianimasikan: §8 tidak mendefinisikan sliding
 *     indicator dan §1 "tenang" — pindah tab cukup instan. Item aktif
 *     memakai `-mb-[1px]` agar garis 1.5px menimpa garis dasar 1px.
 *   - Label aktif text-primary 600, inaktif text-secondary 400 — mengikuti
 *     pemisahan eksplisit §9.14 (label inaktif = text-secondary, bukan
 *     tertiary, agar AA).
 *   - `count` opsional dirender pill kecil `rounded-full border-border` dengan
 *     angka Sofia tabular (bukan Mono — angka jumlah di UI, bukan data
 *     finansial §3.1). Pill adalah pengecualian radius.full yang diizinkan.
 *   - `scrollable` untuk > 4 tab: ScrollView horizontal dengan padding layar;
 *     default flex-1 rata lebar.
 *   - Tidak ada scale press: area tab lebar & bersentuhan; scale membuat
 *     tetangganya tampak bergeser.
 *   - Focus ring keyboard (web saja) `focusRingInset`: tab saling
 *     bersentuhan dan duduk di atas garis dasar, ring luar akan menabrak
 *     tetangga/garis; inset menjaga ring di dalam kotak tab.
 */
import { ScrollView, View, type ViewProps } from "react-native"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRingInset } from "@/lib/focus-ring"
import { formatNumber } from "@/lib/format"

export type TabItem<V extends string = string> = {
  value: V
  label: string
  icon?: IconComponent
  count?: number
  disabled?: boolean
}

export type TabsProps<V extends string = string> = Omit<ViewProps, "children"> & {
  items: readonly TabItem<V>[]
  value: V
  onChange: (value: V) => void
  /** Scroll horizontal untuk banyak tab (> 4) */
  scrollable?: boolean
  className?: string
}

export function Tabs<V extends string = string>({
  items,
  value,
  onChange,
  scrollable = false,
  className,
  ...rest
}: TabsProps<V>) {
  const row = (
    <View
      accessibilityRole="tablist"
      className={cn("flex-row border-b border-border", scrollable ? "px-6" : "w-full", className)}
      {...rest}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <PressableScale
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: !!item.disabled }}
            accessibilityLabel={item.count != null ? `${item.label}, ${item.count}` : item.label}
            scaleOnPress={false}
            disabled={item.disabled}
            onPress={() => onChange(item.value)}
            containerClassName={cn(scrollable ? "rounded-xs" : "flex-1 rounded-xs", focusRingInset)}
            className={cn(
              "h-12 flex-row items-center justify-center gap-2 px-4",
              active && "-mb-[1px] border-b-focus border-primary",
            )}
          >
            {item.icon ? <Icon icon={item.icon} size="sm" active={active} /> : null}
            <Text
              variant="body"
              weight={active ? 600 : 400}
              tone={active ? "primary" : "secondary"}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            {item.count != null ? (
              <View
                className={cn(
                  "min-w-5 items-center justify-center rounded-full border px-[6px] py-[1px]",
                  active ? "border-primary bg-primary" : "border-border bg-transparent",
                )}
              >
                <Text variant="caption" weight={500} tone={active ? "inverse" : "secondary"}>
                  {formatNumber(item.count)}
                </Text>
              </View>
            ) : null}
          </PressableScale>
        )
      })}
    </View>
  )

  if (!scrollable) return row

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="w-full">
      {row}
    </ScrollView>
  )
}
