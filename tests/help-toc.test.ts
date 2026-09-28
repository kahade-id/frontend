/**
 * Test murni — daftar isi artikel (F03).
 */
import { describe, expect, it } from "vitest"

import { parseArticleHeadings, stripInlineMarkup } from "@/lib/help-toc"

describe("parseArticleHeadings", () => {
  it("mengekstrak heading level 1–3 dengan indeks berurutan", () => {
    const content = "# Judul\n\nTeks.\n\n## Bagian A\n\n### Sub A.1\n\n## Bagian B"
    const toc = parseArticleHeadings(content)
    expect(toc).toEqual([
      { index: 0, level: 1, text: "Judul" },
      { index: 1, level: 2, text: "Bagian A" },
      { index: 2, level: 3, text: "Sub A.1" },
      { index: 3, level: 2, text: "Bagian B" },
    ])
  })

  it("mengabaikan heading level 4+ dan baris biasa", () => {
    const content = "#### Terlalu dalam\n\n- bullet # bukan heading\n\nParagraf biasa"
    expect(parseArticleHeadings(content)).toEqual([])
  })

  it("mengabaikan heading tanpa spasi setelah #", () => {
    expect(parseArticleHeadings("#bukanheading")).toEqual([])
  })

  it("membersihkan inline markup dari label", () => {
    const toc = parseArticleHeadings("## Cara **top-up** via `QRIS`")
    expect(toc[0].text).toBe("Cara top-up via QRIS")
  })

  it("kosong untuk konten tanpa heading", () => {
    expect(parseArticleHeadings("hanya paragraf\n\ntanpa heading")).toEqual([])
    expect(parseArticleHeadings("")).toEqual([])
  })
})

describe("stripInlineMarkup", () => {
  it("membersihkan bold/italic/code/link", () => {
    expect(stripInlineMarkup("**tebal** dan *miring* dan `kode` dan [tautan](https://x.id)")).toBe(
      "tebal dan miring dan kode dan tautan",
    )
  })
})
