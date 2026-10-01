/**
 * Kahade — <ShellTabBar>: bottom navbar utama aplikasi.
 *
 * Struktur baru 2026-09-27 (redesign navigasi mobile): bar TETAP dan tidak
 * lagi mengikuti mode aplikasi —
 *
 *   Etalase | Transaksi | (QR) | Pesan | Notifikasi
 *
 * - Notifikasi kini tab sejati dengan badge unread (dulu lonceng di header).
 * - Tombol tengah kini ikon QR — ketuk langsung membuka pemindai /scan
 *   (revisi 2026-09-28). Sheet "Buat baru" pindah ke tombol (+) di header
 *   Etalase dan pensil di drawer (reusable <CreateSheet>).
 * - Switcher mode Wallet/Etalase pindah ke drawer/sidebar; `appMode` tidak
 *   lagi memengaruhi bar ini.
 *
 * Bar hanya dirender di empat halaman tab persis (root layout memeriksa
 * `isShellTabPath`), jadi setiap penekanan adalah perpindahan antar-tab:
 * `router.navigate` cukup — tidak ada logika park/leave-to-tab.
 */
import { useCallback, useEffect, useMemo } from "react"
import { InteractionManager, Platform } from "react-native"
import { usePathname, useRouter } from "expo-router"
import { QrCode } from "phosphor-react-native"

import {
  BottomTabBar,
  type BottomTabItem,
} from "@/components/ui/bottom-tab-bar"
import { haptic } from "@/lib/haptics"
import { ROUTES } from "@/lib/routes"
import { useLanguage, translate } from "@/lib/i18n"
import { useChatUnreadCountNumber } from "@/lib/chat-unread-count"
import {
  SHELL_TABS,
  isShellTabPath,
  shellTabForPath,
  type ShellTabKey,
} from "@/lib/shell-tabs"
import { useUnreadCountNumber } from "@/lib/unread-count"

export { isShellTabPath }

export function ShellTabBar() {
  // Daftarkan bahasa aktif supaya label ikut re-render saat bahasa berganti.
  useLanguage()
  const pathname = usePathname()
  const router = useRouter()
  const unreadCount = useUnreadCountNumber()
  const chatUnreadCount = useChatUnreadCountNumber()

  const activeKey = useMemo<ShellTabKey | null>(() => {
    const tab = shellTabForPath(pathname)
    return tab ? tab.key : null
  }, [pathname])

  const items = useMemo<BottomTabItem<string>[]>(() => {
    return SHELL_TABS.map((tab) => {
      // T5-005: badge tab Pesan & Notifikasi menampilkan ANGKA ("99+"
      // bila > 99), bukan cuma titik.
      const badgeCount =
        tab.key === "chat"
          ? (chatUnreadCount ?? 0)
          : tab.key === "notifications"
            ? (unreadCount ?? 0)
            : 0
      return {
        key: tab.key,
        label: translate(tab.label),
        icon: tab.icon,
        accessibilityLabel: translate(tab.accessibilityLabel),
        badge: badgeCount > 0,
        badgeCount,
      }
    })
  }, [unreadCount, chatUnreadCount])

  const onChange = useCallback(
    (key: string) => {
      const tab = SHELL_TABS.find((t) => t.key === key)
      if (!tab || tab.key === activeKey) return
      router.navigate(tab.href as never)
    },
    [router, activeKey],
  )

  const onScan = useCallback(() => {
    haptic("light")
    // PERF-FIX (P1 nav): dedup — jangan tumpuk /scan bila sudah di sana;
    // router.navigate kembali ke instance yang ada bila sudah di stack.
    if (pathname === ROUTES.scan) return
    router.navigate(ROUTES.scan)
  }, [router, pathname])

  // PERF-FIX (P2 nav): panaskan modul lazy tab tetangga saat idle — pindah
  // tab pertama kali tidak lagi cold-mount modul berat (chat 1237 baris,
  // notifikasi, transaksi). Dijalankan sekali, 2.5 dtk setelah bar tampil
  // dan setelah interaksi selesai; aman diulang (module cache).
  useEffect(() => {
    if (Platform.OS === "web") return
    let cancelled = false
    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        if (cancelled) return
        void import("@/components/screens/chat-tab-screen")
        void import("@/components/screens/notifications-tab-screen")
        void import("@/components/screens/transactions-tab-screen")
      })
    }, 2500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  return (
    <BottomTabBar
      items={items}
      value={activeKey ?? ""}
      onChange={onChange}
      center={{
        icon: QrCode,
        accessibilityLabel: translate("Pindai QR"),
        accessibilityHint: translate("Membuka pemindai kode QR"),
        onPress: onScan,
      }}
      // Coach mark sekali saja (2026-09-28): pengenal ikon QR yang baru.
      centerCoachMark={{
        id: "qr",
        message: translate("Ketuk untuk pindai QR"),
      }}
      accessibilityLabel={translate("Navigasi utama")}
    />
  )
}
