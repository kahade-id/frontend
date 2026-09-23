/**
 * Regresi indikator <Tabs> (§9.16) — bug "garis tab aktif tidak muncul dan
 * posisinya kelewat ke kanan" (profil: Etalase / Tanya Jawab / Ulasan /
 * Tentang).
 *
 * Akar masalahnya: indikator dirender sebagai <Animated.View> REANIMATED
 * dengan className. Reanimated mengirim lib yang sudah ter-compile dengan
 * `react/jsx-runtime` (bukan jsx-runtime NativeWind), jadi className itu tidak
 * pernah menjadi style:
 *   - `bg-primary` hilang -> garis aktif tidak terlihat sama sekali;
 *   - `absolute bottom-0 left-0` hilang -> indikator jadi anak flex biasa yang
 *     memakan lebar strip, sehingga onLayout tiap tab tergeser ke kanan sebesar
 *     lebar indikator (dan lebar tab menyusut).
 *
 * Test ini mengunci kontrak yang membuat kedua gejala itu tidak bisa kembali:
 * geometri indikator = style biasa pada wrapper (position absolute, tidak
 * memakan tempat), dan garisnya digambar oleh <View> anak (elemen yang
 * di-interop NativeWind). Ditambah pemeriksaan numerik posisi: indikator harus
 * persis di bawah tab aktif, bukan bergeser.
 *
 * jsdom tidak punya engine layout, jadi geometri disuntik: ResizeObserver
 * (dipakai react-native-web untuk memicu onLayout) dan getBoundingClientRect
 * dipalsukan sebagai strip 400px berisi 4 tab @100px — sama seperti yang
 * dilihat <Tabs> di perangkat.
 */
import { render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ReactNode, ComponentType } from "react"
vi.mock("@/components/ui/icon", () => ({ Icon: ({ icon: Glyph }: { icon: ComponentType }) => <Glyph /> }))
vi.mock("@/components/ui/text", () => ({ Text: ({ variant, children }: { variant: string; children: ReactNode }) => <span data-variant={variant}>{children}</span> }))

import { Tabs, type TabItem } from "@/components/ui/tabs"

const ITEMS: TabItem[] = [
  { value: "content", label: "Etalase" },
  { value: "questions", label: "Tanya Jawab" },
  { value: "ratings", label: "Ulasan" },
  { value: "about", label: "Tentang" },
]

const TAB_W = 100
const STRIP_W = TAB_W * ITEMS.length
const STRIP_H = 48

/** Geometri tiruan: strip 400px, 4 tab @100px, x = indeks × 100. */
function geometryOf(el: Element): { left: number; width: number; height: number } {
  const role = el.getAttribute?.("role")
  if (role === "tablist") return { left: 0, width: STRIP_W, height: STRIP_H }
  if (role === "tab") {
    const siblings = el.parentElement?.querySelectorAll(':scope > [role="tab"]')
    const index = siblings ? Array.from(siblings).indexOf(el) : 0
    return { left: index * TAB_W, width: TAB_W, height: STRIP_H }
  }
  return { left: 0, width: 0, height: 0 }
}

const OFFSET_PROPS = ["offsetWidth", "offsetHeight", "offsetLeft", "offsetTop"] as const
const originalOffsets = new Map<string, PropertyDescriptor | undefined>()

beforeEach(() => {
  // react-native-web memicu onLayout lewat ResizeObserver, lalu mengukur dengan
  // `node.offsetWidth/offsetLeft` + rantai offsetParent (UIManager.getRect),
  // dan melaporkan x = left(node) - left(parentNode). jsdom punya
  // ResizeObserver maupun layout, jadi keduanya dipalsukan.
  class ResizeObserverStub {
    private callback: (entries: { target: Element }[]) => void
    constructor(callback: (entries: { target: Element }[]) => void) {
      this.callback = callback
    }
    observe(target: Element) {
      queueMicrotask(() => this.callback([{ target }]))
    }
    unobserve() {}
    disconnect() {}
  }
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub

  for (const prop of OFFSET_PROPS) {
    originalOffsets.set(prop, Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop))
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        const { left, width, height } = geometryOf(this)
        if (prop === "offsetWidth") return width
        if (prop === "offsetHeight") return height
        if (prop === "offsetLeft") return left
        return 0 // offsetTop: strip satu baris
      },
    })
  }
})

afterEach(() => {
  delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver
  for (const [prop, descriptor] of originalOffsets) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, prop, descriptor)
  }
  originalOffsets.clear()
})

/** Strip tab = satu-satunya elemen ber-role tablist; indikator anak pertamanya. */
function renderTabs(value: string) {
  const view = render(<Tabs items={ITEMS} value={value} onChange={() => {}} />)
  const strip = view.container.querySelector('[role="tablist"]') as HTMLElement | null
  expect(strip).not.toBeNull()
  const indicator = strip!.firstElementChild as HTMLElement
  expect(indicator).not.toBeNull()
  return { ...view, strip: strip as HTMLElement, indicator }
}

describe("<Tabs> indikator aktif", () => {
  it("diposisikan absolute lewat style biasa (bukan className) sehingga tidak memakan lebar strip", () => {
    const { indicator } = renderTabs("content")
    const style = indicator.style
    expect(style.position).toBe("absolute")
    expect(style.bottom).toBe("0px")
    expect(style.left).toBe("0px")
    expect(style.height).toBe("2px")
    // z-index juga wajib inline: class `z-10` tidak diproses di elemen ini.
    expect(style.zIndex).toBe("10")
  })

  it("menggambar garisnya lewat <View> anak — elemen yang di-interop NativeWind", () => {
    const { indicator } = renderTabs("content")
    // Sebelum perbaikan Animated.View indikator self-closing: tidak ada anak
    // yang menggambar apa pun, jadi garis aktif tidak pernah terlihat.
    const paint = indicator.firstElementChild
    expect(paint).not.toBeNull()
    expect(paint!.tagName).toBe("DIV")
  })

  it("tidak ikut dihitung sebagai tab (4 item = 4 tab)", () => {
    const { strip } = renderTabs("content")
    expect(strip.querySelectorAll('[role="tab"]')).toHaveLength(ITEMS.length)
  })

  it("duduk persis di bawah tab aktif (x = offset tab, lebar = lebar tab)", async () => {
    const { indicator } = renderTabs("ratings") // index 2 -> x 200, lebar 100
    await waitFor(() => {
      expect(indicator.style.width).toBe(`${TAB_W}px`)
      expect(indicator.style.transform).toMatch(/translateX\(200px\)/)
    })
  })

  it("berpindah ke tab tujuan saat tab aktif berubah", async () => {
    const { indicator, rerender } = renderTabs("content")
    await waitFor(() => expect(indicator.style.transform).toMatch(/translateX\(0px\)/))

    rerender(<Tabs items={ITEMS} value="about" onChange={() => {}} />)
    await waitFor(() => expect(indicator.style.transform).toMatch(/translateX\(300px\)/))
  })
})

it("feed label sizing is opt-in; profile labels keep the body variant", () => {
  const { container, rerender } = render(<Tabs items={ITEMS} value="content" onChange={() => {}} />)
  expect(container.querySelector('[data-variant=bodyLarge]')).toBeNull()
  expect(container.querySelectorAll('[data-variant=body]').length).toBe(4)
  rerender(<Tabs items={ITEMS} value="content" onChange={() => {}} activeIconOnly largeLabels />)
  expect(container.querySelectorAll('[data-variant=bodyLarge]').length).toBe(4)
  rerender(<Tabs items={ITEMS} value="content" onChange={() => {}} />)
  expect(container.querySelector('[data-variant=bodyLarge]')).toBeNull()
})

it("active-only icons collapse inactive slots and move to the selected tab", async () => {
  const { Sparkle } = await import("phosphor-react-native")
  const items = ITEMS.map(item => ({ ...item, icon: Sparkle }))
  const { container, rerender } = render(<Tabs items={items} value="content" onChange={() => {}} activeIconOnly />)
  const slots = () => Array.from(container.querySelectorAll('[data-icon="Sparkle"]')).map(icon => icon.parentElement as HTMLElement)
  await waitFor(() => expect(slots().map(slot => slot.style.width)).toEqual(["24px", "0px", "0px", "0px"]))
  rerender(<Tabs items={items} value="ratings" onChange={() => {}} activeIconOnly />)
  await waitFor(() => expect(slots().map(slot => slot.style.width)).toEqual(["0px", "0px", "24px", "0px"]))
  expect(slots().map(slot => slot.style.opacity)).toEqual(["0", "0", "1", "0"])
})
