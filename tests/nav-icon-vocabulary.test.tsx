/**
 * Kosakata ikon header Etalase & bottom navbar (permintaan produk 2026-09-23).
 *
 *   - Header Etalase: pensil = PencilSimpleLine, lonceng = BellSimple,
 *     keduanya weight regular (bukan bold/fill).
 *   - Bottom navbar: Pesan = ChatCenteredText, History wallet = Scroll.
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
  it("pensil & lonceng = PencilSimpleLine / BellSimple, weight regular", () => {
    render(
      <ThemeProvider>
        <ShowcaseHeader kind="forYou" onKindChange={() => undefined} tabs={TABS} />
      </ThemeProvider>,
    )

    /*
      Revisi 2026-09-26 (item #10): ikon pensil kini MEMBUKA HALAMAN
      pembuatan karya (/showcase/create), bukan halaman kelola etalase —
      jadi labelnya "Buat karya baru". Glifnya tetap PencilSimpleLine.
    */
    const manage = iconsIn(screen.getByRole("button", { name: "Buat karya baru" }))
    const bell = iconsIn(screen.getByRole("button", { name: "Notifikasi" }))

    expect(manage).toEqual([{ name: "PencilSimpleLine", weight: "regular" }])
    expect(bell).toEqual([{ name: "BellSimple", weight: "regular" }])
    expect(manage.concat(bell).some((icon) => icon.weight === "bold")).toBe(false)
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
  it("mode commerce: slot pesan memakai ChatCenteredText", () => {
    setAppMode("commerce")
    __setPathname("/showcase")
    const { container } = renderShell()
    const names = iconsIn(container).map((icon) => icon.name)
    expect(names).toContain("ChatCenteredText")
    expect(names).not.toContain("Chats")
    expect(names).not.toContain("Scroll")
  })

  it("mode wallet: slot history memakai Scroll", () => {
    setAppMode("wallet")
    __setPathname("/wallet")
    const { container } = renderShell()
    const names = iconsIn(container).map((icon) => icon.name)
    expect(names).toContain("Scroll")
    expect(names).not.toContain("ClockCounterClockwise")
    expect(names).not.toContain("ChatCenteredText")
  })
})
