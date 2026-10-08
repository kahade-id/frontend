/**
 * Audit chat G19 — keadaan "belum ada pesan": ilustrasi + panduan singkat.
 */
import { cleanup, render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { ChatEmptyThread } from "@/components/ui/chat-empty-thread"

afterEach(cleanup)

const inTheme = (ui: ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>)

describe("<ChatEmptyThread>", () => {
  it("ilustrasi (SVG dekoratif) + judul + panduan + petunjuk kirim", () => {
    const { container } = inTheme(<ChatEmptyThread name="Toko Maju" />)
    expect(container.querySelector("svg")).toBeTruthy()
    expect(screen.getByText("Belum ada pesan")).toBeTruthy()
    expect(screen.getByText(/Sapa Toko Maju untuk memulai percakapan/)).toBeTruthy()
    expect(screen.getByText(/Ketuk \+ untuk foto, berkas, atau lokasi\. Tahan mikrofon untuk pesan suara\./)).toBeTruthy()
  })

  it("tanpa nama: sapaan generik", () => {
    inTheme(<ChatEmptyThread />)
    expect(screen.getByText(/Sapa lawan bicara Anda untuk memulai percakapan/)).toBeTruthy()
  })

  it("pesan untuk diri sendiri: panduan berbeda, tanpa sapaan", () => {
    inTheme(<ChatEmptyThread selfChat />)
    expect(screen.getByText("Simpan catatan, tautan, atau foto untuk diri sendiri di sini.")).toBeTruthy()
    expect(screen.queryByText(/Sapa/)).toBeNull()
  })

  it("ilustrasi disembunyikan dari pembaca layar (dekoratif) — react-native-web tidak memetakan prop ini ke DOM, jadi dikunci di sumber", () => {
    const source = readFileSync(
      resolve(__dirname, "../components/ui/chat-empty-thread.tsx"),
      "utf8",
    )
    const wrapper = source.slice(source.indexOf("accessibilityElementsHidden") - 80)
    expect(wrapper).toContain('importantForAccessibility="no-hide-descendants"')
    expect(wrapper.indexOf("<Svg")).toBeGreaterThan(wrapper.indexOf("accessibilityElementsHidden"))
    // Judul tetap terbaca (role header) dan keseluruhan adalah ringkasan.
    expect(source).toContain('accessibilityRole="summary"')
    expect(source).toContain('accessibilityRole="header"')
  })

  it("tidak menyebut istilah internal yang dilarang produk", () => {
    const { container } = inTheme(<ChatEmptyThread name="Budi" />)
    for (const banned of ["escrow", "rekber", "ditahan", "penahanan"]) {
      expect(container.textContent?.toLowerCase().includes(banned)).toBe(false)
    }
  })
})
