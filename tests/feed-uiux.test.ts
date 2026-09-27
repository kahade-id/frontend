/**
 * UI/UX audit Feed & Etalase (2026-09-27) — unit test untuk normalizer/logika
 * yang di-fix:
 * - UI-F006: `productStatusBadgeTone` — badge status produk kini bertone
 *   semantik (Draf/Aktif/Stok habis/Diarsipkan terbedakan visual).
 * (UI-F019 `normalizePriceFilter` DIHAPUS 2026-09-28: tombol filter harga
 * dihilangkan dari feed Etalase — lib + test-nya ikut dibuang.)
 */
import { describe, expect, it } from "vitest"

import { shouldFireDoubleTapLike } from "../lib/showcase-like-guard"
import {
  productStatusBadgeTone,
  type ProductStatus,
} from "../lib/api/products"

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

describe("shouldFireDoubleTapLike (guard ketuk-ganda suka)", () => {
  it("menembak tepat sekali saat belum disukai dan tidak ada request berjalan", () => {
    expect(
      shouldFireDoubleTapLike({ liked: false, likePending: false, hasHandler: true }),
    ).toBe(true)
  })

  it("tidak menembak saat request like masih berjalan (debounce)", () => {
    expect(
      shouldFireDoubleTapLike({ liked: false, likePending: true, hasHandler: true }),
    ).toBe(false)
  })

  it("tidak menjadi unlike saat item sudah disukai", () => {
    expect(
      shouldFireDoubleTapLike({ liked: true, likePending: false, hasHandler: true }),
    ).toBe(false)
  })

  it("tidak menembak tanpa handler suka", () => {
    expect(
      shouldFireDoubleTapLike({ liked: false, likePending: false, hasHandler: false }),
    ).toBe(false)
  })

  it("pending + sudah disukai tetap tidak menembak", () => {
    expect(
      shouldFireDoubleTapLike({ liked: true, likePending: true, hasHandler: true }),
    ).toBe(false)
  })
})

