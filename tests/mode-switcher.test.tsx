/**
 * Regresi <ModeSwitcher> kompak (redesign 2026-09-23).
 *
 * Kontrak yang dikunci (permintaan produk "switcher kecil dan satu saja"):
 *   1. SATU radiogroup "Mode aplikasi" dengan dua radio — E-Commerce dan
 *      E-Wallet — tanpa memandang mode aktif (bukan dua kontrol, bukan tab).
 *   2. Radio mode AKTIF ber-`checked`; menekan mode aktif tidak menembak
 *      navigasi (tidak ada push/navigate tambahan).
 *   3. Menekan mode lain dari halaman etalase (/showcase) menavigasi ke
 *      halaman primer mode itu (/wallet) — pil ikon di header tetap
 *      mengganti isi shell, bukan sekadar hiasan.
 *   4. Ikon segmen memakai kosakata ikon etalase/dompet: CardsThree &
 *      Wallet (permintaan "ikon etalase cards_three").
 *
 * Geometri thumb (geser spring antar frame) tidak diuji di sini — itu
 * perilaku animasi, milik e2e; test ini mengunci struktur + navigasi.
 */
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ModeSwitcher } from "@/components/ui/mode-switcher"
import { resetAppModeForTest, getModeShift } from "@/lib/app-mode"
import { router } from "expo-router"
import { __setPathname } from "./stubs/expo-router"
import { resetUiPrefsForTest, getUiPrefsSnapshot } from "@/lib/ui-prefs"

const pushSpy = vi.spyOn(router, "push")
const navigateSpy = vi.spyOn(router, "navigate")

function renderSwitcher() {
  return render(
    <ThemeProvider>
      <PortalProvider>
        <ModeSwitcher />
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  resetAppModeForTest()
  resetUiPrefsForTest()
  __setPathname("/showcase")
  pushSpy.mockClear()
  navigateSpy.mockClear()
  if (typeof window !== "undefined" && !window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({ matches: false, media: query, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }),
    })
  }
})

afterEach(cleanup)

describe("<ModeSwitcher> kompak", () => {
  it("merender SATU radiogroup mode dengan dua radio", () => {
    renderSwitcher()
    expect(screen.getByRole("radiogroup", { name: "Mode aplikasi" })).toBeTruthy()
    expect(screen.getByRole("radio", { name: "E-Commerce" })).toBeTruthy()
    expect(screen.getByRole("radio", { name: "E-Wallet" })).toBeTruthy()
  })

  it("radio mode aktif ter-checked, memetik mode lain menavigasi ke primernya", () => {
    renderSwitcher()

    // Mode awal commerce: E-Commerce checked, E-Wallet tidak.
    expect(screen.getByRole("radio", { name: "E-Commerce" }).getAttribute("aria-checked")).toBe("true")
    expect(screen.getByRole("radio", { name: "E-Wallet" }).getAttribute("aria-checked")).toBe("false")

    act(() => {
      screen.getByRole("radio", { name: "E-Wallet" }).click()
    })

    // Preferensi berubah, navigasi ke primer wallet, shift tercatat.
    expect(getUiPrefsSnapshot().appMode).toBe("wallet")
    expect(navigateSpy).toHaveBeenCalledWith("/wallet")
    expect(getModeShift()?.to).toBe("wallet")
  })

  it("menekan mode yang sudah aktif tidak menavigasi", () => {
    renderSwitcher()
    act(() => {
      screen.getByRole("radio", { name: "E-Commerce" }).click()
    })
    expect(pushSpy).not.toHaveBeenCalled()
    expect(navigateSpy).not.toHaveBeenCalled()
    expect(getModeShift()).toBeNull()
  })

  it("ikon segmen = kosakata ikon etalase & dompet (CardsThree, Wallet)", () => {
    const { container } = renderSwitcher()
    const icons = Array.from(container.querySelectorAll("[data-icon]")).map((el) =>
      el.getAttribute("data-icon"),
    )
    expect(icons).toContain("CardsThree")
    expect(icons).toContain("Wallet")
  })
})
