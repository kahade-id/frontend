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
 *   settings      → Pengaturan
 *
 * Badge unread di tab Notifikasi:
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
 *   - P5: mounted flag mencegah setState setelah komponen unmount (race
 *     condition bila fetchCount selesai setelah layout di-unmount).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { AppState, type AppStateStatus } from "react-native"
import { Tabs, type TabsProps } from "expo-router"
import { ArrowsLeftRight, Bell, GearSix, House, Wallet } from "phosphor-react-native"

import { RouterBottomTabBar, type RouterBottomTabBarProps } from "@/components/ui/bottom-tab-bar"
import { getUnreadCount, readUnreadCount } from "@/lib/api/notifications"
import { TAB_ROUTE_NAMES, type TabRouteName } from "@/lib/routes"

/** Interval poll badge (ms) — 60 detik cukup, hemat baterai. */
const BADGE_POLL_INTERVAL_MS = 60_000

type TabVisualItem = Omit<RouterBottomTabBarProps["items"][string], "badge">

// ------------------------------------------------------------------
// Hook: unread count
// ------------------------------------------------------------------

/**
 * Poll `GET /v1/notifications/unread-count` dan kembalikan boolean badge.
 * false = tidak ada unread / belum diketahui; true = tampilkan badge.
 *
 * P5: mounted flag mencegah setState pada komponen yang sudah unmount
 * (race condition saat fetchCount async selesai setelah cleanup).
 */
function useUnreadBadge(): boolean {
  const [hasUnread, setHasUnread] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  const fetchCount = useCallback(async () => {
    try {
      const body = await getUnreadCount()
      const count = readUnreadCount(body)
      if (mountedRef.current && count !== null) setHasUnread(count > 0)
    } catch {
      // Error jaringan/auth diabaikan — badge cukup basi
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void fetchCount()

    intervalRef.current = setInterval(() => void fetchCount(), BADGE_POLL_INTERVAL_MS)

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") void fetchCount()
    })

    return () => {
      mountedRef.current = false
      if (intervalRef.current) clearInterval(intervalRef.current)
      sub.remove()
    }
  }, [fetchCount])

  return hasUnread
}

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
    icon: ArrowsLeftRight,
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
    label: "Pengaturan",
    icon: GearSix,
    accessibilityLabel: "Tab Pengaturan",
  },
}

// ------------------------------------------------------------------
// Layout
// ------------------------------------------------------------------

export default function TabsLayout() {
  const hasUnread = useUnreadBadge()

  const renderTabBar = useCallback(
    (props: Parameters<NonNullable<TabsProps["tabBar"]>>[0]) => {
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
