/**
 * Regresi 2026-09-27 — redesign navigasi mobile.
 *
 * Kontrak yang dikunci test ini:
 *   1. Bottom navbar TETAP: Etalase | Transaksi | (+) | Pesan | Notifikasi —
 *      tidak peduli mode tersimpan (commerce/wallet).
 *   2. Tab aktif mengikuti pathname (termasuk /notifications sebagai tab).
 *   3. Badge "Ada pembaruan" di tab Notifikasi saat unread notifikasi > 0;
 *      badge tab Pesan membaca unread CHAT (bukan total notifikasi).
 *   4. Tombol (+) membuka action sheet "Buat baru" berisi "Buat Karya"
 *      (pengambil-alih fungsi pensil lama → /showcase/create).
 *   5. Menekan tab lain memanggil `router.navigate` ke href tab itu.
 *
 * Dijalankan dengan vitest.components.config.ts (jsdom + react-native-web +
 * stub expo-router: `__setPathname`).
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { router } from "expo-router"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ShellTabBar } from "@/components/ui/shell-tab-bar"
import { resetAppModeForTest, setAppMode } from "@/lib/app-mode"
import { resetChatUnreadCount, setChatUnreadCount } from "@/lib/chat-unread-count"
import { resetUnreadCount, setUnreadCount } from "@/lib/unread-count"
import { resetUiPrefsForTest } from "@/lib/ui-prefs"
import { __setPathname } from "./stubs/expo-router"

const navigateSpy = vi.spyOn(router, "navigate")
const pushSpy = vi.spyOn(router, "push")

function renderBar() {
  return render(
    <ThemeProvider>
      <PortalProvider>
        <ShellTabBar />
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

function tabNames(): string[] {
  return screen
    .getAllByRole("tab")
    .map((el) => el.getAttribute("aria-label") ?? "")
}

beforeEach(() => {
  resetAppModeForTest()
  resetUiPrefsForTest()
  resetUnreadCount()
  resetChatUnreadCount()
  navigateSpy.mockClear()
  pushSpy.mockClear()
  __setPathname("/showcase")
})

afterEach(cleanup)

describe("<ShellTabBar> struktur tetap", () => {
  it("empat tab dengan urutan Etalase, Transaksi, Pesan, Notifikasi — mode commerce", () => {
    setAppMode("commerce")
    renderBar()
    expect(tabNames()).toEqual([
      "Tab Etalase",
      "Tab Transaksi",
      "Tab Pesan",
      "Tab Notifikasi",
    ])
    // Tab lama tidak boleh muncul di bar.
    expect(screen.queryByRole("tab", { name: "Tab Wallet" })).toBeNull()
    expect(screen.queryByRole("tab", { name: "Tab Promo" })).toBeNull()
    expect(screen.queryByRole("tab", { name: "Tab History" })).toBeNull()
    expect(screen.queryByRole("tab", { name: "Tab Lainnya" })).toBeNull()
  })

  it("struktur IDENTIK saat mode tersimpan = wallet", () => {
    setAppMode("wallet")
    renderBar()
    expect(tabNames()).toEqual([
      "Tab Etalase",
      "Tab Transaksi",
      "Tab Pesan",
      "Tab Notifikasi",
    ])
    expect(
      screen.getByRole("tab", { name: "Tab Etalase" }).getAttribute("aria-selected"),
    ).toBe("true")
  })

  it("tab aktif mengikuti pathname /notifications", () => {
    __setPathname("/notifications")
    renderBar()
    expect(
      screen.getByRole("tab", { name: "Tab Notifikasi" }).getAttribute("aria-selected"),
    ).toBe("true")
    expect(
      screen.getByRole("tab", { name: "Tab Etalase" }).getAttribute("aria-selected"),
    ).toBe("false")
  })

  it("menekan tab lain memanggil router.navigate ke href tab", () => {
    renderBar()
    fireEvent.click(screen.getByRole("tab", { name: "Tab Pesan" }))
    expect(navigateSpy).toHaveBeenCalledWith("/chat")
  })

  it("menekan tab aktif tidak menavigasi ulang", () => {
    renderBar()
    fireEvent.click(screen.getByRole("tab", { name: "Tab Etalase" }))
    expect(navigateSpy).not.toHaveBeenCalled()
  })
})

describe("<ShellTabBar> badge", () => {
  it("tab Notifikasi berbadge saat unread notifikasi > 0", () => {
    setUnreadCount(3)
    setChatUnreadCount(0)
    renderBar()
    const tab = screen.getByRole("tab", { name: "Tab Notifikasi" })
    expect(within(tab).getByLabelText("Ada pembaruan")).toBeTruthy()
  })

  it("tab Notifikasi TANPA badge saat unread = 0", () => {
    setUnreadCount(0)
    renderBar()
    const tab = screen.getByRole("tab", { name: "Tab Notifikasi" })
    expect(within(tab).queryByLabelText("Ada pembaruan")).toBeNull()
  })

  it("tab Pesan berbadge dari unread CHAT, bukan total notifikasi", () => {
    setUnreadCount(9)
    setChatUnreadCount(2)
    renderBar()
    const chatTab = screen.getByRole("tab", { name: "Tab Pesan" })
    expect(within(chatTab).getByLabelText("Ada pembaruan")).toBeTruthy()
  })

  it("tab Pesan tanpa badge saat chat unread = 0 walau notifikasi > 0", () => {
    setUnreadCount(9)
    setChatUnreadCount(0)
    renderBar()
    const chatTab = screen.getByRole("tab", { name: "Tab Pesan" })
    expect(within(chatTab).queryByLabelText("Ada pembaruan")).toBeNull()
  })
})

describe("<ShellTabBar> tombol (+)", () => {
  it("membuka sheet berisi Buat Karya yang menuju /showcase/create", async () => {
    renderBar()
    fireEvent.click(screen.getByRole("button", { name: "Buat baru" }))
    // Item aksi di ActionSheet ber-role "menuitem" (bukan "button"); nama
    // aksesibelnya mengandung deskripsi, jadi cocokkan parsial via regex.
    const item = await screen.findByRole("menuitem", { name: /Buat Karya/ })
    expect(item).toBeTruthy()
    fireEvent.click(item)
    expect(pushSpy).toHaveBeenCalledWith("/showcase/create")
  })
})
