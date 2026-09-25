/**
 * Q-05 (audit 2026-09-24) — test yang selama ini DIRUJUK docblock
 * `lib/showcase-labels.ts` tapi tidak pernah ada.
 *
 * Yang dijaga:
 *  1. Tabel semantik label harga (min/max/hanya min/hanya max/kosong) — sumber
 *     kebenaran tunggal untuk feed, detail, galeri, dan manajemen.
 *  2. Batas foto per item (M-03: satu konstanta, bukan angka tersebar).
 *  3. Judul toast operasi komentar (D-01/U-07: satu modul label).
 */
import { describe, expect, it } from "vitest"

import { showcasePriceLabel, showcasePriceLabelOrFallback } from "@/lib/showcase-labels"
import { SHOWCASE_MAX_IMAGES } from "@/lib/showcase-limits"
import { SHOWCASE_COMMENT_MESSAGES } from "@/lib/showcase-comment-messages"
import { applyShowcaseCommentCountDelta } from "@/lib/showcase-social"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"

describe("showcasePriceLabel — satu implementasi untuk semua layar", () => {
  const cases: { name: string; input: { priceMin?: number | null; priceMax?: number | null }; expected: string | null }[] = [
    { name: "min < max → rentang dengan SATU prefiks Rp", input: { priceMin: 100_000, priceMax: 250_000 }, expected: "Rp 100.000 – 250.000" },
    { name: "min == max → harga pasti", input: { priceMin: 100_000, priceMax: 100_000 }, expected: "Rp 100.000" },
    // 2026-09-26: penjual yang menetapkan SATU harga cuma mengisi kolom
    // minimum → ini HARGA PASTI, bukan "mulai dari".
    { name: "hanya min → harga pasti (tanpa kata Mulai)", input: { priceMin: 100_000, priceMax: null }, expected: "Rp 100.000" },
    { name: "hanya max → Hingga", input: { priceMin: null, priceMax: 250_000 }, expected: "Hingga Rp 250.000" },
    { name: "nol = gratis (bukan angka telanjang)", input: { priceMin: 0, priceMax: 0 }, expected: "Gratis" },
    { name: "dua-duanya kosong → null", input: {}, expected: null },
    { name: "rentang terbalik (data lama) → pakai batas bawah", input: { priceMin: 250_000, priceMax: 100_000 }, expected: "Mulai Rp 250.000" },
  ]

  for (const testCase of cases) {
    it(`${testCase.name}`, () => {
      expect(showcasePriceLabel(testCase.input)).toBe(testCase.expected)
    })
  }

  it("fallback non-null untuk kartu yang butuh label", () => {
    expect(showcasePriceLabelOrFallback({})).toBeTruthy()
    expect(showcasePriceLabelOrFallback({ priceMin: 50_000 })).toBe("Rp 50.000")
  })
})

describe("SHOWCASE_MAX_IMAGES — satu konstanta untuk seluruh alur", () => {
  it("bernilai 8 dan bertipe angka (bukan string dari sumber lain)", () => {
    expect(SHOWCASE_MAX_IMAGES).toBe(8)
  })
})

describe("SHOWCASE_COMMENT_MESSAGES — label bersama detail & sheet", () => {
  it("memuat seluruh judul toast operasi komentar", () => {
    expect(Object.values(SHOWCASE_COMMENT_MESSAGES).sort()).toEqual([
      "Gagal membuka komentar",
      "Gagal memperbarui komentar",
      "Gagal mengirim komentar",
      "Gagal menyimpan komentar",
      "Komentar dihapus",
      "Komentar disembunyikan",
      "Komentar ditampilkan kembali",
    ].sort())
  })
})

describe("applyShowcaseCommentCountDelta — patch hitungan lintas layar", () => {
  const item = (id: string, commentCount: number) => ({ id, commentCount }) as ShowcaseSocialItem

  it("menerapkan delta per id dan tidak menyentuh item lain", () => {
    const list = [item("a", 1), item("b", 0)]
    const next = applyShowcaseCommentCountDelta(list, [{ id: "b", delta: 1 }])
    expect(next.map((entry) => entry.commentCount)).toEqual([1, 1])
    expect(next[0]).toBe(list[0])
  })

  it("mengembalikan array yang SAMA bila tidak ada yang cocok (hindari render ulang)", () => {
    const list = [item("a", 1)]
    expect(applyShowcaseCommentCountDelta(list, [{ id: "zz", delta: 1 }])).toBe(list)
    expect(applyShowcaseCommentCountDelta(list, [])).toBe(list)
  })

  it("tidak pernah menurunkan hitungan di bawah nol", () => {
    const next = applyShowcaseCommentCountDelta([item("a", 1)], [{ id: "a", delta: -5 }])
    expect(next[0].commentCount).toBe(0)
  })

  it("menjumlahkan beberapa event untuk id yang sama", () => {
    const next = applyShowcaseCommentCountDelta(
      [item("a", 1)],
      [{ id: "a", delta: 1 }, { id: "a", delta: 1 }, { id: "a", delta: -1 }],
    )
    expect(next[0].commentCount).toBe(2)
  })
})
