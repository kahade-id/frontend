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
 *   - Tombol (+) di TENGAH (permintaan produk 2026-09-21): aksi membuat
 *     sesuatu — isi saldo, buat transaksi, tambah etalase — dikumpulkan di
 *     satu tombol, bukan disebar sebagai tab. Revisi 2026-09-23: tombol ini
 *     HIDUP DI DALAM tinggi bar (lingkaran 44px terpusat vertikal), bukan
 *     lagi lingkaran 48px yang mengambang melewati tepi atas bar. Tab yang
 *     tersisa (4) berbagi lebar yang dilepas slot tengah, jadi label tetap
 *     muat di 360dp; tab "showcase" dikeluarkan dari bar (lihat
 *     HIDDEN_TAB_ROUTES).
 *   - Ripple di tiap tab: bar ini permukaan sapuan jari (lihat PressableScale).
 *     Scale press tetap mati — item menempel satu sama lain, jadi animasi
 *     skala membuat tepi bar tampak "bernapas".
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
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Animated, Easing, View, type ViewProps } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router, type Href } from "expo-router"
import {
  CardsThree,
  Lightning,
  Plus,
  ShoppingBag,
  UserCircle,
  Wallet,
} from "phosphor-react-native"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { Avatar } from "@/components/ui/avatar"
import { NotificationDot } from "@/components/ui/badge"
import { Icon, type IconComponent } from "@/components/ui/icon"
import type { BottomTabBarProps as RNNBottomTabBarProps } from "@react-navigation/bottom-tabs"

import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRingInset } from "@/lib/focus-ring"
import { haptic } from "@/lib/haptics"
import { hitSlopToReach } from "@/lib/hit-slop"
import { translate, useLanguage } from "@/lib/i18n"
import { ROUTES, TAB_ROUTE_NAMES, type TabRouteName } from "@/lib/routes"
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
 * dialihkan ke profil publik milik sendiri (/user/[username]) oleh
 * ShellTabBar — bukan listener tabPress. Layar /discover tetap ada untuk
 * tautan langsung, hanya tidak lagi menjadi tujuan tab.
 *
 * Urutan mengikuti TAB_ROUTE_NAMES (guard di bawah mengunci kelengkapan
 * peta terhadap registri rute di compile-time).
 */
export const TAB_BAR_ITEMS: Record<TabRouteName, AppTabBarItem> = {
  // "home" DIHAPUS (2026-09-23): layar Beranda sudah tidak ada — tab pertama
  // kini Etalase (entri `showcase` di bawah), dan URL /home di-redirect ke
  // sana (app/home.tsx).
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
    // "Etalase" + CardsThree — SATU nama & ikon dengan slot primer mode
    // commerce (lib/app-mode.ts) dan switcher mode: tujuannya sama
    // (/showcase), jangan sampai tiga sebutan untuk satu tempat.
    label: "Etalase",
    icon: CardsThree,
    accessibilityLabel: "Tab Etalase",
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

/**
 * Rute tab yang TIDAK ditampilkan di bottom bar (permintaan produk
 * 2026-09-21). Peta di atas sengaja tetap lengkap — ia sumber kebenaran
 * label/ikon/rute, dan `showcase` masih dipakai untuk menavigasi ke
 * halamannya walau tidak lagi jadi tab.
 *
 * Kenapa dikeluarkan: lima tab + tombol (+) di tengah meninggalkan ±64dp per
 * tab di layar 360dp — label 12px terpotong dan target sentuh mepet. Empat
 * tab + satu tombol aksi adalah batas yang masih terbaca sekali lihat.
 */
export const HIDDEN_TAB_ROUTES: readonly TabRouteName[] = ["showcase"]

/** Rute tab yang dirender, urut TAB_ROUTE_NAMES (tanpa yang disembunyikan). */
export const VISIBLE_TAB_ROUTES: readonly TabRouteName[] = TAB_ROUTE_NAMES.filter(
  (name) => !HIDDEN_TAB_ROUTES.includes(name),
)

export type TabBarItemOverrides = Partial<Record<TabRouteName, Partial<AppTabBarItem>>>

/**
 * Peta `route.name → item` untuk prop `items` <RouterBottomTabBar>: route
 * tanpa entri di peta itu otomatis disembunyikan, jadi membuang kunci
 * "showcase" di sini cukup untuk mengeluarkannya dari bar.
 */
export function visibleTabBarItemMap(
  overrides: TabBarItemOverrides = {},
): Record<string, AppTabBarItem> {
  const map: Record<string, AppTabBarItem> = {}
  for (const name of VISIBLE_TAB_ROUTES) {
    map[name] = { ...TAB_BAR_ITEMS[name], ...overrides[name] }
  }
  return map
}

/**
 * Daftar item ber-`key` untuk <BottomTabBar> kustom (layar profil sendiri).
 * Satu sumber dengan peta di atas supaya kedua bar selalu identik.
 */
export function visibleTabBarItems(
  overrides: TabBarItemOverrides = {},
): BottomTabItem<TabRouteName>[] {
  return VISIBLE_TAB_ROUTES.map((name) => ({
    key: name,
    ...TAB_BAR_ITEMS[name],
    ...overrides[name],
  }))
}

/**
 * Isi sheet tombol (+): tiga aksi "membuat sesuatu" yang paling sering
 * dipakai. Dikelompokkan di satu tombol karena ketiganya bukan TEMPAT
 * (tab) melainkan aksi sesekali — menempatkannya sebagai tab membuat bar
 * penuh label yang jarang disentuh.
 */
export const CENTER_ACTION_ITEMS: readonly ActionSheetItem[] = [
  {
    key: "topup",
    label: "Isi saldo dompet",
    description: "Top up lewat bank, QRIS, atau gerai ritel",
    icon: Wallet,
    onPress: () => router.push(ROUTES.topup),
  },
  {
    key: "create-transaction",
    label: "Buat transaksi",
    description: "Jual atau beli dengan dana dijaga escrow",
    icon: Lightning,
    onPress: () => router.push(ROUTES.createTransaction),
  },
  {
    key: "add-showcase",
    label: "Tambah etalase",
    description: "Unggah karya atau produk ke etalase Anda",
    icon: CardsThree,
    onPress: () => router.push(ROUTES.showcaseManagement),
  },
]

export type BottomTabCenter = {
  icon: IconComponent
  accessibilityLabel: string
  accessibilityHint: string
  onPress: () => void
}

export type BottomTabBarProps<K extends string = string> = Omit<ViewProps, "children"> & {
  items: readonly BottomTabItem<K>[]
  value: K
  onChange: (key: K) => void
  /** Long-press (mis. buka menu cepat) */
  onLongPress?: (key: K) => void
  /**
   * Tombol (+) di tengah bar. `true` = pakai CENTER_ACTION_ITEMS bawaan;
   * atau kirim daftar aksi sendiri. Diabaikan bila `center` diisi —
   * shell mode memakai `center` supaya ikon dan aksi ikut mode.
   */
  centerAction?: boolean | readonly ActionSheetItem[]
  /** Tombol tengah kustom (posisi & bentuk tetap; ikon/aksi dari pemanggil). */
  center?: BottomTabCenter
  /**
   * Ganti nilai ini untuk memudarkan ikon/label slot (bukan menggeser
   * lingkaran tengah). Shell mengirim mode aktif.
   */
  motionKey?: string
  /** 1 = geser dari kanan, -1 = dari kiri. */
  motionDir?: 1 | -1
  /** Mount pertama ikut memudar bila shift mode masih segar (bar stack baru). */
  enterOnMount?: boolean
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

/**
 * Tombol aksi di tengah bar — quick menu (commerce) & scan/bayar (wallet).
 * Slot tetap 64px supaya tab di kiri dan kanannya berbagi sisa lebar dengan
 * sama (tidak digeser flex).
 *
 * Revisi 2026-09-23: tombol HIDUP DI DALAM tinggi bar (60px), bukan lagi
 * lingkaran yang mengambang 20px di atas tepi bar. Lingkaran 44px
 * (`h-11` = target sentuh minimum) dipusatkan vertikal — 8px napas di atas
 * dan bawahnya — sehingga bar tidak "ditembus" dan konten di belakang bar
 * tidak pernah tertutup tombol. `bg-primary` + ikon inverse tetap satu-
 * satunya elemen solid di bar, jadi tetap jelas itu aksi utama; kontrasnya
 * dengan latar bar sudah memisahkannya tanpa elevation (§6: elevasi untuk
 * FAB yang melayang di atas konten — tombol di dalam bar bukan FAB).
 */
function CenterGlyph({ icon, motionKey }: { icon: IconComponent; motionKey?: string }) {
  const reducedMotion = useReducedMotion()
  const opacity = useRef(new Animated.Value(1)).current
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (reducedMotion) {
      opacity.setValue(1)
      return
    }
    opacity.setValue(0)
    const enter = tokens.motion.easing.enter
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration: motionDuration(reducedMotion, tokens.motion.duration.fast),
      easing: Easing.bezier(enter[0], enter[1], enter[2], enter[3]),
      useNativeDriver: true,
    })
    anim.start()
    return () => anim.stop()
  }, [icon, motionKey, reducedMotion, opacity])

  return (
    <Animated.View style={{ opacity }}>
      <Icon icon={icon} size="md" tone="inverse" weight="bold" />
    </Animated.View>
  )
}

function CenterActionButton({
  onPress,
  icon = Plus,
  accessibilityLabel,
  accessibilityHint,
  motionKey,
}: {
  onPress: () => void
  icon?: IconComponent
  accessibilityLabel?: string
  accessibilityHint?: string
  motionKey?: string
}) {
  useLanguage()
  return (
    <View className="w-16 flex-col items-center justify-center">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? "Buat baru"}
        accessibilityHint={
          accessibilityHint ??
          translate("Membuka pilihan cepat: isi saldo, buat transaksi, atau tambah etalase")
        }
        scaleOnPress={false}
        ripple
        onPress={onPress}
        containerClassName={cn("rounded-full bg-primary", focusRingInset)}
        className="h-11 w-11 items-center justify-center rounded-full"
      >
        <CenterGlyph icon={icon} motionKey={motionKey} />
      </PressableScale>
    </View>
  )
}

/**
 * Crossfade slot kiri/kanan. Lingkaran tengah TIDAK ikut geser — hanya
 * glifnya yang memudar, supaya posisi tombol menonjol tetap.
 */
function ChromeFade({
  motionKey,
  dir,
  enterOnMount,
  children,
}: {
  motionKey?: string
  dir: 1 | -1
  enterOnMount?: boolean
  children: ReactNode
}) {
  const reducedMotion = useReducedMotion()
  const opacity = useRef(new Animated.Value(1)).current
  const translateX = useRef(new Animated.Value(0)).current
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      // Jangan memudarkan bar saat app baru dibuka — hanya saat mount
      // bertepatan dengan pergantian mode (layar stack yang baru didorong).
      if (!enterOnMount) return
    }
    if (!motionKey || reducedMotion) {
      opacity.setValue(1)
      translateX.setValue(0)
      return
    }
    opacity.setValue(0)
    translateX.setValue(dir * tokens.space[2])
    const enter = tokens.motion.easing.enter
    const duration = motionDuration(reducedMotion, tokens.motion.duration.fast)
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.bezier(enter[0], enter[1], enter[2], enter[3]),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration,
        easing: Easing.bezier(enter[0], enter[1], enter[2], enter[3]),
        useNativeDriver: true,
      }),
    ])
    anim.start()
    return () => anim.stop()
  }, [motionKey, dir, enterOnMount, reducedMotion, opacity, translateX])

  return (
    <Animated.View style={{ flex: 1, flexDirection: "row", opacity, transform: [{ translateX }] }}>
      {children}
    </Animated.View>
  )
}

export function BottomTabBar<K extends string = string>({
  items,
  value,
  onChange,
  onLongPress,
  centerAction,
  center,
  motionKey,
  motionDir = 1,
  enterOnMount,
  className,
  ...rest
}: BottomTabBarProps<K>) {
  const insets = useSafeAreaInsets()
  const [centerOpen, setCenterOpen] = useState(false)

  const actions = center
    ? undefined
    : centerAction === true
      ? CENTER_ACTION_ITEMS
      : centerAction
        ? centerAction
        : undefined

  // Slot tengah memecah daftar tab jadi dua kelompok; tanpa itu tombol (+)
  // hanya "sisa flex" dan bergeser tiap jumlah tab berubah.
  const showCenter = Boolean(center || actions)
  const splitAt = showCenter ? Math.ceil(items.length / 2) : items.length

  const renderTab = (item: BottomTabItem<K>) => {
    const active = item.key === value
    const isProfileTab = item.key === "discover" || item.avatarUrl !== undefined
    return (
      <PressableScale
        key={item.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={item.accessibilityLabel ?? item.label}
        scaleOnPress={false}
        ripple
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
  }

  return (
    <View
      accessibilityRole="tablist"
      className={cn("z-sticky w-full items-center border-t border-border bg-background", className)}
      style={{ paddingBottom: insets.bottom }}
      {...rest}
    >
      <View className="h-[60px] w-full flex-row md:max-w-content">
        {showCenter ? (
          <>
            <ChromeFade motionKey={motionKey} dir={motionDir} enterOnMount={enterOnMount}>
              {items.slice(0, splitAt).map(renderTab)}
            </ChromeFade>
            <CenterActionButton
              icon={center?.icon}
              accessibilityLabel={center?.accessibilityLabel}
              accessibilityHint={center?.accessibilityHint}
              motionKey={motionKey}
              onPress={() => {
                haptic("light")
                if (center) center.onPress()
                else setCenterOpen(true)
              }}
            />
            <ChromeFade motionKey={motionKey} dir={motionDir} enterOnMount={enterOnMount}>
              {items.slice(splitAt).map(renderTab)}
            </ChromeFade>
          </>
        ) : (
          items.map(renderTab)
        )}
      </View>

      {actions ? (
        <ActionSheet
          visible={centerOpen}
          onRequestClose={() => setCenterOpen(false)}
          title="Buat baru"
          description="Pilih yang mau Anda kerjakan."
          actions={actions}
        />
      ) : null}
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
  /**
   * Konfigurasi per route.name — route tanpa entri di sini disembunyikan.
   * Pakai `visibleTabBarItems()` untuk daftar bawaan (sudah membuang
   * HIDDEN_TAB_ROUTES) supaya tab yang tampil sama di setiap pemakai.
   */
  items: Readonly<Record<string, Omit<BottomTabItem, "key">>>
  /** Tombol (+) di tengah bar — lihat BottomTabBarProps.centerAction. */
  centerAction?: boolean | readonly ActionSheetItem[]
  className?: string
}

export function RouterBottomTabBar({ state, navigation, items, centerAction, className }: RouterBottomTabBarProps): ReactNode {
  const visible = state.routes.filter((r) => items[r.name])
  const current = state.routes[state.index]?.name ?? ""

  return (
    <BottomTabBar
      className={className}
      centerAction={centerAction}
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