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
 *   showcase      → Feed sosial karya/thread
 *   discover      → Penemuan pengguna
 *
 * Notifikasi dan Pengaturan kini menjadi layar Stack tanpa bottom navbar.
 * Unread tetap dipoll di layout ini, lalu badge tampil pada tombol Bell di
 * header Beranda di sebelah tombol Pesan.
 *
 * Badge unread Notifikasi (store bersama `lib/unread-count.ts`):
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
import { House, ImagesSquare, ShoppingBag, UsersThree, Wallet } from "phosphor-react-native"

import { RouterBottomTabBar, type RouterBottomTabBarProps } from "@/components/ui/bottom-tab-bar"
import { TAB_ROUTE_NAMES, type TabRouteName } from "@/lib/routes"
import { useAuthSession } from "@/lib/use-auth-session"
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
  showcase: {
    label: "Showcase",
    icon: ImagesSquare,
    accessibilityLabel: "Tab Showcase sosial",
  },
  discover: {
    label: "Discover",
    icon: UsersThree,
    accessibilityLabel: "Tab temukan pengguna",
  },
}

// ------------------------------------------------------------------
// Layout
// ------------------------------------------------------------------

export default function TabsLayout() {
  // Store bersama lib/unread-count (poll 60 d + AppState); layar Notifikasi
  // memanggil setUnreadCount/refreshUnreadCount setelah tandai dibaca → badge
  // hilang seketika tanpa menunggu poll berikutnya.
  // Tetap satu pemasangan poll unread; badge kini ditampilkan pada tombol
  // notifikasi di header Beranda, bukan pada bottom navigation.
  //
  // B-05 (audit): poll DIGATE sesi — tamu web yang membuka tab tidak lagi
  // menembak endpoint `auth:"required"` tiap 60 detik (badai 401 → refresh →
  // clearSession). Tanpa token tidak ada badge untuk ditampilkan pula.
  const session = useAuthSession()
  useUnreadCount({ enabled: Boolean(session.token) })

  const renderTabBar = useCallback(
    (props: TabsTabBarProps) => (
      <RouterBottomTabBar
        state={props.state}
        navigation={props.navigation}
        items={TAB_ITEMS}
      />
    ),
    [],
  )

  return (
    <Tabs
      // Rute awal EKSPLISIT: mengandalkan urutan deklarasi membuat tab pertama
      // yang "menang" bergantung pada implementasi navigator — app harus
      // selalu dibuka di Beranda, bukan di tab lain.
      initialRouteName="home"
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
