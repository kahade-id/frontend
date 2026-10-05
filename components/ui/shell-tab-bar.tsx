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
import { memo, startTransition, useCallback, useEffect, useMemo, useState } from "react"
import { Platform } from "react-native"
import { runWhenIdle } from "@/lib/idle"
import { usePathname, useRouter } from "expo-router"

import {
  PillTabBar,
  type PillTabItem,
} from "@/components/ui/pill-tab-bar"
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

  const items = useMemo<PillTabItem[]>(() => {
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

  // PERF-FIX (P2 nav): panaskan modul lazy tab tetangga saat idle — pindah
  // tab pertama kali tidak lagi cold-mount modul berat (chat 1237 baris,
  // notifikasi, transaksi). Dijalankan sekali, 2.5 dtk setelah bar tampil
  // dan setelah interaksi selesai; aman diulang (module cache).
  useEffect(() => {
    if (Platform.OS === "web") return
    let cancelled = false
    const timer = setTimeout(() => {
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

  return (
    <PillTabBar
      items={items}
      value={pendingKey ?? activeKey ?? ""}
      onChange={onChange}
      accessibilityLabel={translate("Navigasi utama")}
    />
  )
}

export const ShellTabBar = memo(ShellTabBarInner)
