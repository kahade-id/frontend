/**
 * Kahade — <ShellTabBar>: bottom navbar utama aplikasi.
 *
 * Struktur baru 2026-09-27 (redesign navigasi mobile): bar TETAP dan tidak
 * lagi mengikuti mode aplikasi —
 *
 *   Etalase | Transaksi | (+) | Pesan | Notifikasi
 *
 * - Notifikasi kini tab sejati dengan badge unread (dulu lonceng di header).
 * - Tombol tengah (+) membuka action sheet "buat baru" (mengambil alih fungsi
 *   pensil lama → /showcase/create).
 * - Switcher mode Wallet/Etalase pindah ke drawer/sidebar; `appMode` tidak
 *   lagi memengaruhi bar ini.
 *
 * Bar hanya dirender di empat halaman tab persis (root layout memeriksa
 * `isShellTabPath`), jadi setiap penekanan adalah perpindahan antar-tab:
 * `router.navigate` cukup — tidak ada logika park/leave-to-tab.
 */
import { useCallback, useMemo } from "react"
import { usePathname, useRouter } from "expo-router"

import {
  BottomTabBar,
  CENTER_ACTION_ITEMS,
  type BottomTabItem,
} from "@/components/ui/bottom-tab-bar"
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

  return (
    <BottomTabBar
      items={items}
      value={activeKey ?? ""}
      onChange={onChange}
      centerAction={CENTER_ACTION_ITEMS}
      accessibilityLabel={translate("Navigasi utama")}
    />
  )
}
