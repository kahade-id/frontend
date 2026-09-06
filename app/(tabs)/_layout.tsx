/**
 * Kahade — Tabs Layout (kerangka navigasi utama).
 *
 * Expo Router `<Tabs>` dengan custom `tabBar` menggunakan
 * `<RouterBottomTabBar>` yang sudah ada di components/ui/bottom-tab-bar.tsx.
 *
 * Tab aktif:
 *   home          → Beranda
 *   transactions  → Transaksi
 *   wallet        → Dompet
 *   notifications → Notifikasi (badge unread dari GET /v1/notifications/unread-count)
 *   settings      → Setelan (label ringkas; nama aksesibilitas tetap Pengaturan)
 *
 * Badge unread di tab Notifikasi (store bersama `lib/unread-count.ts`):
 *   - Di-poll setiap kali layout mount (AppState focus) + interval 60 detik
 *     saat app aktif di foreground. Interval bukan WebSocket — badge tidak
 *     perlu real-time; 60 detik cukup dan hemat baterai.
 *   - Hanya tampil bila count > 0. Bila response null (bentuk tak dikenal,
 *     lihat readUnreadCount di notifications.ts) → pertahankan state
 *     sebelumnya, agar badge tidak salah hilang.
 *   - Error (network/auth) diabaikan secara diam-diam — badge cukup basi,
 *     tidak perlu error toast hanya karena poll gagal.
 *
 * Koneksi ke alur auth:
 *   welcome.tsx memanggil router.replace(ROUTES.home) → masuk ke tab ini.
 *   _layout.tsx root (app/_layout.tsx) memakai <Stack> — `(tabs)` terdaftar
 *   sebagai satu entry di stack navigasi, sehingga user tidak bisa back ke
 *   auth screen setelah masuk ke sini.
 *
 * Keputusan non-obvious:
 *   - `TAB_ROUTE_NAMES` dari routes.ts dipakai untuk urutan tab; ikut
 *     konstanta itu, bukan didefinisikan ulang di sini.
 *   - `headerShown: false` di screenOptions karena tiap tab screen membangun
 *     header-nya sendiri (atau tidak butuh header).
 *   - `tabBar` prop menerima props @react-navigation; RouterBottomTabBar
 *     mengadaptasinya tanpa mengimpor tipe navigation langsung (pola yang
 *     sudah ada di bottom-tab-bar.tsx).
 *   - AppState listener + interval keduanya diperlukan: AppState supaya badge
 *     langsung update saat user kembali dari background; interval supaya
 *     badge fresh selama user aktif.
 *   - Store eksternal (useSyncExternalStore) bukan state lokal: layar
 *     Notifikasi & push handler bisa menurunkan angka tanpa poll ulang.
 */
import { useCallback, type ComponentProps } from "react"
import { Tabs } from "expo-router"
import { Bell, CardsThree, House, ShoppingBag, Wallet } from "phosphor-react-native"

import { RouterBottomTabBar, type RouterBottomTabBarProps } from "@/components/ui/bottom-tab-bar"
import { TAB_ROUTE_NAMES, type TabRouteName } from "@/lib/routes"
import { useUnreadCount } from "@/lib/unread-count"


/** Props tabBar @react-navigation yang diteruskan ke <Tabs> Expo Router. */
type TabsTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0]

type TabVisualItem = Omit<RouterBottomTabBarProps["items"][string], "badge">

// ------------------------------------------------------------------
// Tab item definitions
// ------------------------------------------------------------------

/**
 * Peta name→item tab bar. Kunci HARUS cocok dengan TAB_ROUTE_NAMES dan
 * nama file di app/(tabs)/ (Expo Router route name = nama file tanpa ekstensi).
 */
const TAB_ITEMS: Record<TabRouteName, TabVisualItem> = {
  home: {
    label: "Beranda",
    icon: House,
    accessibilityLabel: "Tab Beranda",
  },
  transactions: {
    label: "Transaksi",
    icon: ShoppingBag,
    accessibilityLabel: "Tab Transaksi",
  },
  wallet: {
    label: "Dompet",
    icon: Wallet,
    accessibilityLabel: "Tab Dompet",
  },
  notifications: {
    label: "Notifikasi",
    icon: Bell,
    accessibilityLabel: "Tab Notifikasi",
  },
  settings: {
    label: "Setelan",
    icon: CardsThree,
    accessibilityLabel: "Tab Pengaturan",
  },
}

// ------------------------------------------------------------------
// Layout
// ------------------------------------------------------------------

export default function TabsLayout() {
  // Store bersama lib/unread-count (poll 60 d + AppState); layar Notifikasi
  // memanggil setUnreadCount/refreshUnreadCount setelah tandai dibaca → badge
  // hilang seketika tanpa menunggu poll berikutnya.
  const { count } = useUnreadCount()
  const hasUnread = (count ?? 0) > 0

  const renderTabBar = useCallback(
    (props: TabsTabBarProps) => {
      const itemsWithBadge: RouterBottomTabBarProps["items"] = {
        ...TAB_ITEMS,
        notifications: {
          ...TAB_ITEMS.notifications,
          badge: hasUnread,
        },
      }
      return (
        <RouterBottomTabBar
          state={props.state}
          navigation={props.navigation}
          items={itemsWithBadge}
        />
      )
    },
    [hasUnread],
  )

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={renderTabBar}
    >
      {TAB_ROUTE_NAMES.map((name) => (
        <Tabs.Screen key={name} name={name} />
      ))}
    </Tabs>
  )
}
