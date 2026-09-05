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
 *     lihat readUnreadCount di notifications.ts) → badge disembunyikan,
 *     BUKAN dianggap 0, agar badge tidak salah hilang.
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
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { AppState, type AppStateStatus } from "react-native"
import { Tabs } from "expo-router"
import {
  House,
  ArrowsLeftRight,
  Wallet,
  Bell,
  GearSix,
} from "phosphor-react-native"

import { RouterBottomTabBar, type RouterBottomTabBarProps } from "@/components/ui/bottom-tab-bar"
import { getUnreadCount, readUnreadCount } from "@/lib/api/notifications"
import { TAB_ROUTE_NAMES } from "@/lib/routes"

/** Interval poll badge (ms) — 60 detik cukup, hemat baterai. */
const BADGE_POLL_INTERVAL_MS = 60_000

// ------------------------------------------------------------------
// Hook: unread count
// ------------------------------------------------------------------

/**
 * Poll `GET /v1/notifications/unread-count` dan kembalikan boolean badge.
 * null = belum diketahui (jangan tampilkan badge); 0 = tidak ada; >0 = tampilkan.
 */
function useUnreadBadge(): boolean {
  const [hasUnread, setHasUnread] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCount = useCallback(async () => {
    try {
      const body = await getUnreadCount()
      const count = readUnreadCount(body)
      // null = bentuk tak dikenal → biarkan state sebelumnya
      if (count !== null) setHasUnread(count > 0)
    } catch {
      // Error jaringan/auth diabaikan — badge cukup basi
    }
  }, [])

  useEffect(() => {
    void fetchCount()

    intervalRef.current = setInterval(() => void fetchCount(), BADGE_POLL_INTERVAL_MS)

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") void fetchCount()
    })

    return () => {
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
const TAB_ITEMS = {
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
    // badge diisi dinamis di TabBar
    accessibilityLabel: "Tab Notifikasi",
  },
  settings: {
    label: "Pengaturan",
    icon: GearSix,
    accessibilityLabel: "Tab Pengaturan",
  },
} as const satisfies Record<
  (typeof TAB_ROUTE_NAMES)[number],
  Omit<RouterBottomTabBarProps["items"][string], "badge">
>

// ------------------------------------------------------------------
// Layout
// ------------------------------------------------------------------

export default function TabsLayout() {
  const hasUnread = useUnreadBadge()

  const renderTabBar = useCallback(
    (props: Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0]) => {
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
      {/*
        Urutan Tabs.Screen menentukan urutan di state.routes — HARUS sesuai
        urutan TAB_ROUTE_NAMES agar RouterBottomTabBar menampilkan tab dalam
        urutan yang benar.
      */}
      <Tabs.Screen name="home" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="settings" />
    </Tabs>
  )
}
