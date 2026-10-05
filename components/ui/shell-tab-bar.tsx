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
 *   (revisi 2026-09-28; 2026-10-05: pensil drawer dihapus). Sheet "Buat baru"
 *   dibuka dari tombol (+) di tiap header halaman utama (reusable <CreateSheet>).
 * - Switcher mode Wallet/Etalase pindah ke drawer/sidebar; `appMode` tidak
 *   lagi memengaruhi bar ini.
 *
 * Bar hanya dirender di empat halaman tab persis (root layout memeriksa
 * `isShellTabPath`), jadi setiap penekanan adalah perpindahan antar-tab:
 * `router.navigate` cukup — tidak ada logika park/leave-to-tab.
 */
import { memo, startTransition, useCallback, useEffect, useMemo, useState } from "react"
import { Platform } from "react-native"
import { usePathname, useRouter } from "expo-router"
import { QrCode } from "phosphor-react-native"

import {
  BottomTabBar,
  type BottomTabItem,
} from "@/components/ui/bottom-tab-bar"
import { haptic } from "@/lib/haptics"
import { runWhenIdle } from "@/lib/idle"
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
import { emitShellTabReselect } from "@/lib/shell-tab-reselect"

export { isShellTabPath }

function ShellTabBarInner() {
  // Daftarkan bahasa aktif supaya label ikut re-render saat bahasa berganti.
  const language = useLanguage()
  const pathname = usePathname()
  const router = useRouter()
  const unreadCount = useUnreadCountNumber()
  const chatUnreadCount = useChatUnreadCountNumber()

  const activeKey = useMemo<ShellTabKey | null>(() => {
    const tab = shellTabForPath(pathname)
    return tab ? tab.key : null
  }, [pathname])

  const [pendingKey, setPendingKey] = useState<ShellTabKey | null>(null)
  useEffect(() => { setPendingKey(null) }, [pathname])
  useEffect(() => {
    if (!pendingKey) return
    // Reconcile if a guard/no-op prevents navigation (navigate returns no promise).
    const timer = setTimeout(() => setPendingKey(null), 1500)
    return () => clearTimeout(timer)
  }, [pendingKey])

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
  }, [unreadCount, chatUnreadCount, language])

  const onChange = useCallback(
    (key: string) => {
      const tab = SHELL_TABS.find((t) => t.key === key)
      if (!tab) return
      if (tab.key === activeKey && pendingKey === null) {
        emitShellTabReselect(tab.key)
        return
      }
      setPendingKey(tab.key)
      try {
        startTransition(() => router.navigate(tab.href as never))
      } catch (error) {
        setPendingKey(null)
        throw error
      }
    },
    [router, activeKey, pendingKey],
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
      // RN 0.88 menghapus `InteractionManager`. runWhenIdle (lib/idle.ts)
      // memeriksa ketersediaan global-nya — aman di native maupun jsdom.
      runWhenIdle(() => {
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

  const center = useMemo(() => ({
    icon: QrCode,
    accessibilityLabel: translate("Pindai QR"),
    accessibilityHint: translate("Membuka pemindai kode QR"),
    onPress: onScan,
  }), [onScan, language])
  const centerCoachMark = useMemo(() => ({
    id: "qr" as const,
    message: translate("Ketuk untuk pindai QR"),
  }), [language])

  return (
    <BottomTabBar
      items={items}
      value={pendingKey ?? activeKey ?? ""}
      onChange={onChange}
      center={center}
      centerCoachMark={centerCoachMark}
      accessibilityLabel={translate("Navigasi utama")}
    />
  )
}

export const ShellTabBar = memo(ShellTabBarInner)
