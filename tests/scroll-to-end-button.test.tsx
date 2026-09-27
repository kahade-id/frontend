/**
 * UI POLISH chat 2026-09-27 — tombol back-to-bottom (<ScrollToEndButton>).
 *
 * Kontrak yang dikunci (presentasi & interaksi saja):
 *  - Circle KOMPAK 40dp: `h-10 w-10 rounded-full` + ikon panah-bawah di tengah
 *    (`items-center justify-center`) — dicek dari prop className, BUKAN
 *    snapshot rapuh.
 *  - Shadow lembut: pembungkus memakai elevation "medium" (boxShadow ter-render).
 *  - Target sentuh efektif 44dp lewat hitSlop (visual tetap 40dp, konvensi UI-C005).
 *  - Tidak menutupi konten chat: dirender in-flow (tanpa position absolute/
 *    fixed di sepanjang rantai ke kontainer).
 *  - `visible=false` → tidak dirender sama sekali (tidak ada lapisan
 *    transparan penahan ketukan).
 *
 * Catatan stub: di env test ini react-native-web MEMBUANG prop `className`
 * (tidak sampai ke DOM), jadi kontrak ukuran dikunci lewat mock
 * <PressableScale> yang menangkap className/containerClassName/hitSlop ke
 * atribut data-* — tanpa mengubah komponen aslinya.
 */
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"

vi.mock("@/components/ui/pressable-scale", () => ({
  PressableScale: ({
    testID,
    accessibilityLabel,
    className,
    containerClassName,
    hitSlop,
    children,
  }: Record<string, any>) => (
    <div
      data-testid={testID}
      aria-label={accessibilityLabel}
      data-classname={className ?? ""}
      data-container-classname={containerClassName ?? ""}
      data-hitslop={JSON.stringify(hitSlop ?? null)}
    >
      {children}
    </div>
  ),
}))

// Import SETELAH vi.mock (hoisted otomatis oleh vitest, tapi ditulis di sini
// agar urutan baca jelas).
import { ScrollToEndButton } from "@/components/ui/scroll-to-end-button"

// Vitest tidak menyalakan `globals`, jadi auto-cleanup RTL tidak aktif.
afterEach(cleanup)

function renderButton(visible = true) {
  const onPress = vi.fn()
  const ui: ReactElement = (
    <ThemeProvider>
      <ScrollToEndButton visible={visible} onPress={onPress} label="Gulir ke pesan terbaru" />
    </ThemeProvider>
  )
  const result = render(ui)
  return { ...result, onPress }
}

/** className mengandung token sebagai kata utuh (bukan substring). */
function hasToken(classAttr: string, token: string): boolean {
  return new RegExp(`(^|\\s)${token}(\\s|$)`).test(classAttr)
}

describe("<ScrollToEndButton>: circle kompak", () => {
  it("berupa circle 40dp: h-10 w-10 rounded-full", () => {
    const { container } = renderButton()
    const btn = screen.getByTestId("scroll-to-end-button")
    const cls = btn.getAttribute("data-classname") ?? ""
    expect(hasToken(cls, "h-10")).toBe(true)
    expect(hasToken(cls, "w-10")).toBe(true)
    expect(hasToken(cls, "rounded-full")).toBe(true)
    const containerCls = btn.getAttribute("data-container-classname") ?? ""
    expect(hasToken(containerCls, "rounded-full")).toBe(true)
    expect(container.querySelector('[data-icon="CaretDown"]')).toBeTruthy()
  })

  it("ikon panah-bawah di tengah & tombol hanya berisi ikon (kompak, bukan pill berlabel)", () => {
    renderButton()
    const btn = screen.getByTestId("scroll-to-end-button")
    const cls = btn.getAttribute("data-classname") ?? ""
    expect(hasToken(cls, "items-center")).toBe(true)
    expect(hasToken(cls, "justify-center")).toBe(true)
    // Satu ikon, tanpa teks — versi pill lebar akan merender label teks.
    expect(btn.querySelectorAll('[data-icon="CaretDown"]')).toHaveLength(1)
    expect(btn.textContent).toBe("")
  })

  it("shadow lembut: pembungkus memakai boxShadow (elevation medium)", () => {
    renderButton()
    const btn = screen.getByTestId("scroll-to-end-button")
    const shadowWrap = btn.parentElement as HTMLElement | null
    expect(shadowWrap).toBeTruthy()
    const style = shadowWrap!.getAttribute("style") ?? ""
    expect(style).toMatch(/box-shadow/)
  })

  it("target sentuh efektif 44dp lewat hitSlop (visual tetap 40dp)", () => {
    renderButton()
    const btn = screen.getByTestId("scroll-to-end-button")
    const hitSlop = JSON.parse(btn.getAttribute("data-hitslop") ?? "null")
    // hitSlopToReach(40, 40) → 2dp di tiap sisi = 44dp efektif (UI-C005).
    expect(hitSlop).toEqual({ top: 2, right: 2, bottom: 2, left: 2 })
  })

  it("label aksesibilitas dari pemanggil", () => {
    renderButton()
    expect(screen.getByTestId("scroll-to-end-button").getAttribute("aria-label")).toBe(
      "Gulir ke pesan terbaru",
    )
  })

  it("tidak menutupi konten: tanpa position absolute/fixed di rantai ke kontainer", () => {
    const { container } = renderButton()
    let el: HTMLElement | null = screen.getByTestId("scroll-to-end-button")
    while (el && el !== container) {
      const pos = (el.style?.position ?? "").toLowerCase()
      expect(pos).not.toMatch(/^(absolute|fixed)$/)
      el = el.parentElement
    }
  })

  it("visible=false → tidak dirender sama sekali", () => {
    renderButton(false)
    expect(screen.queryByTestId("scroll-to-end-button")).toBeNull()
  })
})
