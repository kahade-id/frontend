// @vitest-environment jsdom
/**
 * Guard regresi PR #110 — "semua BottomSheet kontennya hilang, hanya title + X".
 *
 * Audit 2026-09-25: PR #110 membungkus isi sheet dalam ScrollView dengan
 * wrapper `min-h-0 flex-1 shrink`. `flex-1` = flex-basis 0, sedangkan root
 * sheet ber-height-AUTO (mengikuti konten, dibatasi maxHeight). Di Yoga —
 * mesin layout native RN — anak ber-basis-0 di dalam kontainer auto-height
 * dihitung 0px, sehingga wrapper → ScrollView → seluruh konten ikut 0:
 * sheet tampil, tapi yang terlihat hanya handle + judul + tombol X.
 *
 * Karena jsdom tidak menjalankan layout (mustahil memastikan tinggi 0px di
 * sini), guard ini mengunci tiga invarian yang menutup jalur regresinya:
 *   1. children benar-benar dirender ke pohon (portal/ScrollView tidak
 *      menelan konten) DAN berada di dalam sheet;
 *   2. kontrak flex wrapper dipaksa inline — `flexBasis: "auto"` +
 *      `flexGrow: 0` + `flexShrink: 1` + `minHeight: 0` (inline style menang
 *      atas className di RN maupun CSS, jadi `flex-1` yang ditambahkan
 *      kembali pun tak bisa menjatuhkan basis ke 0);
 *   3. sumber komponen: pembungkus <ScrollView> tidak mengandung `flex-1`.
 *
 * Angka perilaku tinggi (Yoga) diverifikasi simulasi terpisah (Yoga 3.2,
 * sama dengan RN 0.81): konten 500px → sheet 586px; konten 3000px → sheet
 * ter-cap maxHeight 720px dengan wrapper menyusut ke 634px (ScrollView
 * membatasi diri lalu men-scroll).
 */
import { cleanup, render, screen, within } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { Text } from "@/components/ui/text"

afterEach(cleanup)

function renderSheet(ui: ReactElement) {
  return render(
    <ThemeProvider>
      <PortalProvider>
        {ui}
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

/** Kontainer sheet (View accessibilityViewIsModal ber-accessibilityLabel judul). */
function sheetRoot(container: HTMLElement, label: string): HTMLElement {
  const sheet = container.querySelector(`[aria-label="${label}"]`)
  expect(sheet, "sheet root harus ada").toBeTruthy()
  return sheet as HTMLElement
}

/**
 * Wrapper area konten: satu-satunya elemen di dalam sheet yang kontrak flex-
 * nya dipaksa inline (lihat bottom-sheet.tsx).
 */
function contentWrapper(sheet: HTMLElement): HTMLElement {
  const wrapper = Array.from(sheet.querySelectorAll<HTMLElement>("div")).find(
    (el) => el.style.flexBasis === "auto" && el.style.flexShrink === "1",
  )
  expect(wrapper, "wrapper area konten (kontrak flex inline) harus ada").toBeTruthy()
  return wrapper!
}

describe("BottomSheet — isi tidak boleh hilang (audit 2026-09-25)", () => {
  it("merender children di dalam area konten sheet, bukan hanya judul + X", () => {
    const { container } = renderSheet(
      <BottomSheet visible title="Pilih bahasa" onRequestClose={() => {}}>
        <Text>ISI_SHEET</Text>
      </BottomSheet>,
    )

    // Anatomi header tetap utuh (tombol X memakai label sama dengan scrim —
    // batasi ke dalam sheet supaya skor 1).
    const sheet = sheetRoot(container, "Pilih bahasa")
    expect(within(sheet).getByLabelText("Tutup")).toBeTruthy()
    // Anak sheet tampil, lewat portal → PortalHost → ScrollView.
    const isi = screen.getByText("ISI_SHEET")
    expect(isi).toBeTruthy()
    expect(sheet.contains(isi), "konten harus berada di dalam sheet").toBe(true)
    // Dan tepat di dalam wrapper area konten (bukan di luar ScrollView).
    expect(contentWrapper(sheet).contains(isi)).toBe(true)
  })

  it("kontrak flex wrapper dipaksa inline: basis auto, tanpa basis 0", () => {
    const { container } = renderSheet(
      <BottomSheet visible title="Judul" onRequestClose={() => {}}>
        <Text>ISI</Text>
      </BottomSheet>,
    )

    const wrapper = contentWrapper(sheetRoot(container, "Judul"))
    // Invarian anti-collapse: basis auto (BUKAN 0), grow 0, shrink 1.
    expect(wrapper.style.flexBasis).toBe("auto")
    expect(wrapper.style.flexGrow).toBe("0")
    expect(wrapper.style.flexShrink).toBe("1")
    // min-height eksplisit: di CSS, auto minimum size memblokir shrink.
    expect(wrapper.style.minHeight).toBe("0px")
  })

  it("sumber: pembungkus <ScrollView> dilarang memakai flex-1 (basis 0)", () => {
    const src = readFileSync(
      resolve(process.cwd(), "components/ui/bottom-sheet.tsx"),
      "utf8",
    )
    const scrollIdx = src.indexOf("<ScrollView")
    expect(scrollIdx, "BottomSheet harus memakai ScrollView").toBeGreaterThan(-1)
    // <View pembungkus yang membuka tepat sebelum <ScrollView
    const viewIdx = src.lastIndexOf("<View", scrollIdx)
    const openTag = src.slice(viewIdx, src.indexOf(">", viewIdx) + 1)
    expect(openTag).toContain("min-h-0")
    expect(openTag, "wrapper konten tidak boleh kembali memakai flex-1").not.toContain("flex-1")
  })

  it("footer sticky tetap dirender sebagai saudara area scroll", () => {
    const { container } = renderSheet(
      <BottomSheet visible title="Konfirmasi" onRequestClose={() => {}} footer={<Text>CTA_LANJUT</Text>}>
        <Text>ISI</Text>
      </BottomSheet>,
    )

    const sheet = sheetRoot(container, "Konfirmasi")
    const cta = within(sheet).getByText("CTA_LANJUT")
    expect(cta).toBeTruthy()
    const wrapper = contentWrapper(sheet)
    // Footer di LUAR wrapper konten (saudara), agar tidak ikut ter-scroll.
    expect(wrapper.contains(cta)).toBe(false)
    expect(cta.parentElement?.contains(wrapper) ?? false).toBe(false)
  })
})
