/**
 * Kahade — <BottomTabBar> (§9.14 Bottom Tab Bar, §6.2 layer 10, §11 web).
 *
 * Navigasi utama antar layar (Beranda, Transaksi, Riwayat, Akun). Dua cara
 * pakai:
 *   - <BottomTabBar>       : controlled (items + value + onChange) untuk
 *                            preview/storybook atau navigasi kustom.
 *   - <RouterBottomTabBar> : adapter untuk prop `tabBar` di <Tabs> expo-
 *                            router; membaca state/descriptors navigasi
 *                            tanpa mengimpor tipe @react-navigation (struktur
 *                            minimal yang dibutuhkan saja) agar file ini
 *                            tetap kompilasi meski paket itu hanya transitif.
 *
 * Aturan §9.14 yang diterapkan eksplisit:
 *   - Icon inaktif `text-tertiary` (tone default Icon), aktif `text-primary`
 *     weight Fill (`active`).
 *   - Label inaktif `text-secondary` (BUKAN tertiary — AA untuk 12px), aktif
 *     text-primary weight 600.
 *   - Notification badge = <NotificationDot> merah solid tanpa angka di
 *     top-right ikon.
 *   - Dipertahankan di web pada lebar mobile; kolom dibatasi
 *     `md:max-w-content` (§11) agar item tidak terpencar di viewport lebar.
 *
 * Keputusan non-obvious:
 *   - Tinggi bar 56px (h-14) + paddingBottom safe-area (home indicator) via
 *     style runtime. `border-t border-border` sebagai pemisah (§6).
 *   - Tanpa scale press: item bersentuhan dan menempel tepi layar; §8 hanya
 *     menyebut scale untuk Button.
 *   - Label selalu tampil (bukan icon-only): 4–5 tab dengan label 12px muat
 *     di 360px, dan label menghilangkan tebak-tebakan ikon (§1 presisi).
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { NotificationDot } from "@/components/ui/badge"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type BottomTabItem<K extends string = string> = {
  key: K
  label: string
  icon: IconComponent
  /** Titik merah "ada yang baru" (§9.14) */
  badge?: boolean
  accessibilityLabel?: string
}

export type BottomTabBarProps<K extends string = string> = Omit<ViewProps, "children"> & {
  items: readonly BottomTabItem<K>[]
  value: K
  onChange: (key: K) => void
  /** Long-press (mis. buka menu cepat) */
  onLongPress?: (key: K) => void
  className?: string
}

export function BottomTabBar<K extends string = string>({
  items,
  value,
  onChange,
  onLongPress,
  className,
  ...rest
}: BottomTabBarProps<K>) {
  const insets = useSafeAreaInsets()

  return (
    <View
      accessibilityRole="tablist"
      className={cn("z-sticky w-full items-center border-t border-border bg-background", className)}
      style={{ paddingBottom: insets.bottom }}
      {...rest}
    >
      <View className="h-14 w-full flex-row md:max-w-content">
        {items.map((item) => {
          const active = item.key === value
          return (
            <PressableScale
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.accessibilityLabel ?? item.label}
              scaleOnPress={false}
              onPress={() => onChange(item.key)}
              onLongPress={onLongPress ? () => onLongPress(item.key) : undefined}
              containerClassName="flex-1"
              className="h-full items-center justify-center gap-1"
            >
              <View className="relative">
                <Icon icon={item.icon} size="md" active={active} />
                <NotificationDot visible={!!item.badge} />
              </View>
              <Text
                variant="caption"
                weight={active ? 600 : 500}
                tone={active ? "primary" : "secondary"}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </PressableScale>
          )
        })}
      </View>
    </View>
  )
}

// ------------------------------------------------------------------
// Adapter expo-router <Tabs tabBar={(p) => <RouterBottomTabBar {...p} items={…} />} />
// ------------------------------------------------------------------

/** Subset struktur BottomTabBarProps @react-navigation yang dibutuhkan */
export type RouterTabBarState = {
  index: number
  routes: readonly { key: string; name: string }[]
}
/**
 * `emit` @react-navigation bersifat generik per tipe event; di sini cukup
 * satu signature union (tabPress | tabLongPress) — cukup longgar agar
 * struktural-kompatibel dengan objek `navigation` asli tanpa mengimpor
 * tipenya, dan `defaultPrevented` hanya dibaca untuk tabPress.
 */
export type RouterTabBarNavigation = {
  emit: (e: {
    type: "tabPress" | "tabLongPress"
    target: string
    canPreventDefault?: boolean
  }) => { defaultPrevented: boolean }
  navigate: (name: string) => void
}

export type RouterBottomTabBarProps = {
  state: RouterTabBarState
  navigation: RouterTabBarNavigation
  /** Konfigurasi per route.name — route tanpa entri di sini disembunyikan */
  items: Readonly<Record<string, Omit<BottomTabItem, "key">>>
  className?: string
}

export function RouterBottomTabBar({ state, navigation, items, className }: RouterBottomTabBarProps): ReactNode {
  const visible = state.routes.filter((r) => items[r.name])
  const current = state.routes[state.index]?.name ?? ""

  return (
    <BottomTabBar
      className={className}
      value={current}
      items={visible.map((r) => ({ key: r.name, ...items[r.name]! }))}
      onChange={(name) => {
        const route = state.routes.find((r) => r.name === name)
        if (!route) return
        const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true })
        if (name !== current && !ev.defaultPrevented) navigation.navigate(name)
      }}
      onLongPress={(name) => {
        const route = state.routes.find((r) => r.name === name)
        if (route) navigation.emit({ type: "tabLongPress", target: route.key })
      }}
    />
  )
}
