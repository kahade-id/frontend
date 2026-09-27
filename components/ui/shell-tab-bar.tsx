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
import { useCallback, useMemo } from "react"
import { usePathname, useRouter } from "expo-router"
import { QrCode } from "phosphor-react-native"

import {
  BottomTabBar,
  type BottomTabItem,
} from "@/components/ui/bottom-tab-bar"
import { haptic } from "@/lib/haptics"
import { ROUTES } from "@/lib/routes"
import { useLanguage, translate } from "@/lib/i18n"
import { useChatUnreadCountState } from "@/lib/chat-unread-count"
import {
  SHELL_TABS,
  isShellTabPath,
  shellTabForPath,
  type ShellTabKey,
} from "@/lib/shell-tabs"
import { useUnreadCountState } from "@/lib/unread-count"

export { isShellTabPath }

export function ShellTabBar() {
  // Daftarkan bahasa aktif supaya label ikut re-render saat bahasa berganti.
  useLanguage()
  const pathname = usePathname()
  const router = useRouter()
  const unread = useUnreadCountState()
  const chatUnread = useChatUnreadCountState()

  const activeKey = useMemo<ShellTabKey | null>(() => {
    const tab = shellTabForPath(pathname)
    return tab ? tab.key : null
  }, [pathname])

  const items = useMemo<BottomTabItem<string>[]>(() => {
    return SHELL_TABS.map((tab) => ({
      key: tab.key,
      label: translate(tab.label),
      icon: tab.icon,
      accessibilityLabel: translate(tab.accessibilityLabel),
      badge:
        tab.key === "chat"
          ? (chatUnread.count ?? 0) > 0
          : tab.key === "notifications"
            ? (unread.count ?? 0) > 0
            : false,
    }))
  }, [unread.count, chatUnread.count])

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
    router.push(ROUTES.scan)
  }, [router])

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
