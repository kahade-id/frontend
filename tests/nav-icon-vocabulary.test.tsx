/**
 * Kosakata ikon header Etalase & bottom navbar (revisi 2026-09-27, redesign
 * navigasi mobile).
 *
 *   - Header Etalase: tombol menu = Equals (ikon equal, buka drawer),
 *     cari = MagnifyingGlass, keduanya weight regular (bukan bold/fill).
 *     Pensil & lonceng DIHAPUS dari header (pensil → tombol (+) bar;
 *     lonceng → tab Notifikasi). Revisi 2026-09-27: hamburger List → Equals
 *     atas permintaan produk.
 *   - Bottom navbar TETAP: Etalase = CardsThree, Transaksi = ShoppingBag,
 *     Pesan = ChatCenteredText, Notifikasi = BellSimple.
 *
 * Glif dikunci lewat `data-icon` stub Phosphor, bukan snapshot SVG.
 */
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ShowcaseHeader } from "@/components/ui/showcase-header"
import { ShellTabBar } from "@/components/ui/shell-tab-bar"
import { resetAppModeForTest, setAppMode } from "@/lib/app-mode"
import { resetUiPrefsForTest } from "@/lib/ui-prefs"
import { __setPathname } from "./stubs/expo-router"

vi.mock("@/lib/use-auth-session", () => ({
  useAuthSession: () => ({ token: null, restoring: false, error: null, retry: () => undefined }),
}))

const TABS = [
  { value: "forYou" as const, label: "Untuk Anda" },
  { value: "following" as const, label: "Mengikuti" },
  { value: "latest" as const, label: "Terbaru" },
  { value: "popular" as const, label: "Populer" },
]

function iconsIn(el: Element): { name: string | null; weight: string | null }[] {
  return Array.from(el.querySelectorAll("[data-icon]")).map((node) => ({
    name: node.getAttribute("data-icon"),
    weight: node.getAttribute("data-weight"),
  }))
}

beforeEach(() => {
  resetAppModeForTest()
  resetUiPrefsForTest()
  __setPathname("/showcase")
  if (typeof window !== "undefined" && !window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    })
  }
})

afterEach(cleanup)

describe("kosakata ikon header Etalase", () => {
  it("tombol menu & cari = Equals / MagnifyingGlass, weight regular; tanpa pensil & lonceng", () => {
    render(
      <ThemeProvider>
        <ShowcaseHeader kind="forYou" onKindChange={() => undefined} tabs={TABS} />
      </ThemeProvider>,
    )

    const menu = iconsIn(screen.getByRole("button", { name: "Menu" }))
    const search = iconsIn(screen.getByRole("button", { name: "Cari" }))

    expect(menu).toEqual([{ name: "Equals", weight: "regular" }])
    expect(search).toEqual([{ name: "MagnifyingGlass", weight: "regular" }])
    // Pensil pindah ke tombol (+) bar; lonceng pindah ke tab Notifikasi.
    expect(screen.queryByRole("button", { name: "Buat karya baru" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Notifikasi" })).toBeNull()
    expect(menu.concat(search).some((icon) => icon.weight === "bold")).toBe(false)
  })
})

function renderShell() {
  return render(
    <ThemeProvider>
      <PortalProvider>
        <ShellTabBar />
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

describe("kosakata ikon bottom navbar", () => {
  it("empat tab memakai CardsThree / ShoppingBag / ChatCenteredText / BellSimple — di kedua mode", () => {
    for (const mode of ["commerce", "wallet"] as const) {
      setAppMode(mode)
      const { container, unmount } = renderShell()
      const names = iconsIn(container).map((icon) => icon.name)
      expect(names).toContain("CardsThree")
      expect(names).toContain("ShoppingBag")
      expect(names).toContain("ChatCenteredText")
      expect(names).toContain("BellSimple")
      // Kosakata lama tidak boleh muncul di bar.
      expect(names).not.toContain("Wallet")
      expect(names).not.toContain("Percent")
      expect(names).not.toContain("Scroll")
      expect(names).not.toContain("SquaresFour")
      unmount()
    }
  })
})
