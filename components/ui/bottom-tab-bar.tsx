/**
 * Kahade — <BottomTabBar> (§9.14 Bottom Tab Bar, §6.2 layer 10, §11 web).
 *
 * Navigasi utama antar layar (Beranda, Transaksi, Dompet, Notifikasi,
 * Pengaturan). Dua cara pakai:
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
 *     menyebut scale untuk Button. Sebagai gantinya ikon AKTIF membesar
 *     halus 1.15x via spring playful (v2) — penanda tab aktif yang terasa
 *     hidup tanpa menggeser layout (transform tidak reflow). Statis 1x
 *     saat reduced motion.
 *   - Label selalu tampil (bukan icon-only): 4–5 tab dengan label 12px muat
 *     di 360px, dan label menghilangkan tebak-tebakan ikon (§1 presisi).
 *   - Focus ring web wajib ada pada ELEMEN FOKUS (container Pressable),
 *     sehingga kelas `focusRingInset` dipasang di `containerClassName`,
 *     bukan `className` di inner View.
 *   - Hit target wajib ≥ 44pt (audit #1). Visual tab sudah setinggi 56px,
 *     tetapi ikon tetap diberi `hitSlop` agar label/ikon kecil tetap nyaman
 *     disentuh di web/mobile pada area tengah tab.
 */
import { useEffect, useRef, type ReactNode } from "react"
import { Animated, Easing, View, type ViewProps } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { Href } from "expo-router"
import {
  House,
  ImagesSquare,
  ShoppingBag,
  UserCircle,
  Wallet,
} from "phosphor-react-native"

import { Avatar } from "@/components/ui/avatar"
import { NotificationDot } from "@/components/ui/badge"
import { Icon, type IconComponent } from "@/components/ui/icon"
import type { BottomTabBarProps as RNNBottomTabBarProps } from "@react-navigation/bottom-tabs"

import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRingInset } from "@/lib/focus-ring"
import { hitSlopToReach } from "@/lib/hit-slop"
import { TAB_ROUTE_NAMES, type TabRouteName } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

export type BottomTabItem<K extends string = string> = {
  key: K
  label: string
  icon: IconComponent
  avatarUrl?: string | null
  avatarName?: string
  /** Titik merah "ada yang baru" (§9.14) */
  badge?: boolean
  accessibilityLabel?: string
}

// ------------------------------------------------------------------
// Item navigasi utama aplikasi (sumber tunggal)
// ------------------------------------------------------------------

export type AppTabBarItem = Omit<BottomTabItem<TabRouteName>, "key"> & {
  /** Rute tujuan saat item ditekan dari bar KUSTOM (di luar <Tabs>). */
  route: Href
}

/**
 * SATU sumber kebenaran visual bottom navigation (label + ikon + a11y +
 * rute). Dipakai dua tempat yang HARUS selalu identik:
 *   1. app/(tabs)/_layout.tsx — tab bar utama expo-router.
 *   2. app/user/[username].tsx — <BottomTabBar> kustom yang hanya dirender
 *      saat pengguna melihat profilnya SENDIRI.
 *
 * Slot "discover" (file app/(tabs)/discover.tsx) dibrandakan ulang sebagai
 * "Profil" (permintaan produk): label/ikon berganti, dan penekanan tab-nya
 * dialihkan ke profil publik milik sendiri (/user/[username]) — lihat
 * listener tabPress di _layout. Layar /discover tetap ada untuk tautan
 * langsung, hanya tidak lagi menjadi tujuan tab.
 *
 * Urutan mengikuti TAB_ROUTE_NAMES (guard di bawah mengunci kelengkapan
 * peta terhadap registri rute di compile-time).
 */
export const TAB_BAR_ITEMS: Record<TabRouteName, AppTabBarItem> = {
  home: {
    label: "Beranda",
    icon: House,
    accessibilityLabel: "Tab Beranda",
    route: "/home" as Href,
  },
  transactions: {
    label: "Transaksi",
    icon: ShoppingBag,
    accessibilityLabel: "Tab Transaksi",
    route: "/transactions" as Href,
  },
  wallet: {
    label: "Dompet",
    icon: Wallet,
    accessibilityLabel: "Tab Dompet",
    route: "/wallet" as Href,
  },
  showcase: {
    label: "Showcase",
    icon: ImagesSquare,
    accessibilityLabel: "Tab Showcase sosial",
    route: "/showcase" as Href,
  },
  discover: {
    label: "Profil",
    icon: UserCircle,
    accessibilityLabel: "Tab profil saya",
    route: "/discover" as Href,
  },
}

// Referensi agar urutan TAB_ROUTE_NAMES menjadi satu-satunya defisiensi urutan;
// bila suatu hari TAB_ROUTE_NAMES berubah, Record<> di atas ikut gagal kompilasi.
void TAB_ROUTE_NAMES

export type BottomTabBarProps<K extends string = string> = Omit<ViewProps, "children"> & {
  items: readonly BottomTabItem<K>[]
  value: K
  onChange: (key: K) => void
  /** Long-press (mis. buka menu cepat) */
  onLongPress?: (key: K) => void
  className?: string
}

/**
 * Tinggi visual tab bar (px) — harus sama dengan tinggi container di bawah
 * (60px). Satu sumber: layar yang perlu offset di atas tab bar
 * (FAB, sticky footer) mengimpor ini, bukan menyalin angka.
 * (Pola sama dengan HEADER_BAR_HEIGHT di header.tsx.)
 */
export const TAB_BAR_HEIGHT = 60

/**
 * Hit target: lebar tab ~72px di 360px/5 = 72 >44, tinggi 60 >44, tapi ikon 24 di tengah
 * tetap butuh slop 10 horizontal agar tap di antara ikon-label tidak miss.
 * Hitung eksplisit per sumbu, bukan asumsi tinggi saja.
 */
const TAB_ITEM_HIT_SLOP = hitSlopToReach(72, TAB_BAR_HEIGHT, 80)

/**
 * Scale ikon tab aktif (v2): 24px → 27.6px — cukup terlihat sebagai penanda,
 * tidak cukup besar untuk bertabrakan dengan label di bawahnya. Transform
 * tidak memicu reflow sehingga bar tidak bergeser antar tab.
 */
const ACTIVE_ICON_SCALE = 1.15

function TabIcon({ icon, active }: { icon: IconComponent; active: boolean }) {
  const scale = useRef(new Animated.Value(active ? ACTIVE_ICON_SCALE : 1)).current
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (reducedMotion) {
      scale.setValue(1)
      return
    }
    const exit = tokens.motion.easing.exit
    const anim = active
      ? Animated.spring(scale, {
          toValue: ACTIVE_ICON_SCALE,
          ...tokens.motion.springPlayful,
          useNativeDriver: true,
        })
      : Animated.timing(scale, {
          toValue: 1,
          duration: motionDuration(reducedMotion, tokens.motion.duration.fast),
          easing: Easing.bezier(exit[0], exit[1], exit[2], exit[3]),
          useNativeDriver: true,
        })
    anim.start()
    return () => anim.stop()
  }, [active, scale, reducedMotion])

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Icon icon={icon} size="md" active={active} />
    </Animated.View>
  )
}

/**
 * TabAvatar — foto profil pengguna di bottom tab bar.
 * Saat aktif (di halaman profil), lingkaran border 2px (1-3px) `border-primary`
 * menandakan tab sedang aktif.
 */
function TabAvatar({
  avatarUrl,
  name,
  active,
}: {
  avatarUrl?: string | null
  name?: string
  active: boolean
}) {
  return (
    <View
      className={cn(
        "h-7 w-7 items-center justify-center rounded-full border-badge",
        active ? "border-primary" : "border-transparent",
      )}
    >
      <Avatar
        source={avatarUrl ? { uri: avatarUrl } : undefined}
        name={name}
        size="xs"
        className="h-5 w-5"
      />
    </View>
  )
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
      <View className="h-[60px] w-full flex-row md:max-w-content">
        {items.map((item) => {
          const active = item.key === value
          const isProfileTab = item.key === "discover" || item.avatarUrl !== undefined
          return (
            <PressableScale
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.accessibilityLabel ?? item.label}
              scaleOnPress={false}
              hitSlop={TAB_ITEM_HIT_SLOP}
              onPress={() => onChange(item.key)}
              onLongPress={onLongPress ? () => onLongPress(item.key) : undefined}
              containerClassName={cn("flex-1 web:rounded-none", focusRingInset)}
              className="h-full items-center justify-center pt-2 pb-1 gap-1"
            >
              <View className="relative items-center justify-center">
                {isProfileTab ? (
                  <TabAvatar
                    avatarUrl={item.avatarUrl}
                    name={item.avatarName}
                    active={active}
                  />
                ) : (
                  <TabIcon icon={item.icon} active={active} />
                )}
                <NotificationDot visible={!!item.badge} />
              </View>
              <Text ellipsizeMode="tail"
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

/**
 * Subset tipe BottomTabBarProps @react-navigation — diambil dari tipe asli
 * (bukan ditulis ulang) supaya `navigation.emit` yang generik per event tetap
 * struktural-kompatibel saat diteruskan oleh expo-router <Tabs tabBar>.
 * (@react-navigation/bottom-tabs adalah dependency expo-router.)
 */
export type RouterTabBarState = Pick<RNNBottomTabBarProps["state"], "index" | "routes">
export type RouterTabBarNavigation = Pick<RNNBottomTabBarProps["navigation"], "emit" | "navigate">

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