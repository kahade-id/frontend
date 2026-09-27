/**
 * UI/UX audit Feed & Etalase (2026-09-27) — unit test untuk normalizer/logika
 * yang di-fix:
 * - UI-F006: `productStatusBadgeTone` — badge status produk kini bertone
 *   semantik (Draf/Aktif/Stok habis/Diarsipkan terbedakan visual).
 * - UI-F019: `normalizePriceFilter` — normalisasi input filter harga feed.
 */
import { describe, expect, it } from "vitest"

import {
  productStatusBadgeTone,
  type ProductStatus,
} from "../lib/api/products"
import { normalizePriceFilter } from "../lib/showcase-price-filter"

describe("productStatusBadgeTone (UI-F006)", () => {
  it("memetakan tiap status ke tone semantiknya", () => {
    expect(productStatusBadgeTone("ACTIVE")).toBe("success")
    expect(productStatusBadgeTone("OUT_OF_STOCK")).toBe("warning")
    expect(productStatusBadgeTone("DRAFT")).toBe("info")
    expect(productStatusBadgeTone("ARCHIVED")).toBe("neutral")
  })

  it("exhaustive: semua ProductStatus terpetakan (tidak ada default diam-diam)", () => {
    const statuses: ProductStatus[] = ["DRAFT", "ACTIVE", "OUT_OF_STOCK", "ARCHIVED"]
    for (const s of statuses) {
      expect(productStatusBadgeTone(s)).toMatch(/^(neutral|success|danger|warning|info|accent)$/)
    }
  })
})

describe("normalizePriceFilter (UI-F019)", () => {
  it("kosong = lepas (keduanya undefined)", () => {
    expect(normalizePriceFilter("", "")).toEqual({})
    expect(normalizePriceFilter("   ", "")).toEqual({ min: undefined, max: undefined })
  })

  it("hanya min atau hanya maks", () => {
    expect(normalizePriceFilter("50000", "")).toEqual({ min: 50000, max: undefined })
    expect(normalizePriceFilter("", "100000")).toEqual({ min: undefined, max: 100000 })
  })

  it("rentang valid min <= maks dipertahankan", () => {
    expect(normalizePriceFilter("50000", "100000")).toEqual({ min: 50000, max: 100000 })
    expect(normalizePriceFilter("50000", "50000")).toEqual({ min: 50000, max: 50000 })
  })

  it("min > maks: maks dibuang diam-diam (keputusan produk, bukan error)", () => {
    expect(normalizePriceFilter("100000", "50000")).toEqual({ min: 100000, max: undefined })
  })

  it("menerima format ketikan/paste Indonesia", () => {
    expect(normalizePriceFilter("1.500.000", "2.000.000")).toEqual({ min: 1500000, max: 2000000 })
    expect(normalizePriceFilter("Rp 5000", "")).toEqual({ min: 5000, max: undefined })
    expect(normalizePriceFilter(" 2500 ", "")).toEqual({ min: 2500, max: undefined })
  })

  it("nol adalah nilai valid (bukan 'kosong')", () => {
    expect(normalizePriceFilter("0", "")).toEqual({ min: 0, max: undefined })
  })

  it("tanpa digit = lepas", () => {
    expect(normalizePriceFilter("abc", "Rp")).toEqual({ min: undefined, max: undefined })
  })
})
