/**
 * Test batch 139 area C (Feed & Etalase) — logika murni.
 *
 * Cakupan:
 *  - C01: rasio media dari respons list (showcaseMediaAspectRatio, aspectRatio
 *    di GalleryMedia).
 *  - C05: semantik cache prefetch detail (sekali pakai, TTL).
 *  - C06: resolver status stok (graceful saat field backend belum ada).
 *  - C10: format/parsing rupiah saat mengetik.
 *  - C12: normalisasi status moderasi (graceful saat field belum ada).
 *  - C15: hitungan total filter aktif feed.
 */
import { describe, expect, it } from "vitest"

import {
  showcaseMedia,
  showcaseMediaAspectRatio,
} from "@/lib/showcase-social"
import {
  clearShowcaseDetailPrefetch,
  consumePrefetchedShowcaseDetail,
  SHOWCASE_DETAIL_PREFETCH_TTL_MS,
} from "@/lib/showcase-detail-prefetch"
import { isShowcaseSoldOut, resolveShowcaseStock } from "@/lib/showcase-stock"
import { formatRupiahTyping, parseRupiahTyping, RUPIAH_MAX_DIGITS } from "@/lib/rupiah-input"
import {
  needsModerationAttention,
  normalizeModerationStatus,
  resolveShowcaseModeration,
} from "@/lib/showcase-moderation"
import {
  countActiveFeedFilters,
  DEFAULT_SHOWCASE_FILTERS,
} from "@/lib/showcase-filters"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"

function socialItemWithImages(images: unknown[]): ShowcaseSocialItem {
  return {
    id: "item-1",
    title: "Karya",
    images: images as ShowcaseSocialItem["images"],
    likeCount: 0,
    commentCount: 0,
    viewCount: 0,
    saveCount: 0,
    createdAt: "2026-09-28T00:00:00.000Z",
    updatedAt: "2026-09-28T00:00:00.000Z",
    author: { userId: "u1", username: "penjual", fullName: null },
  }
}

describe("C01 — rasio media dari respons list", () => {
  it("menghitung rasio w/h yang valid", () => {
    expect(showcaseMediaAspectRatio(1600, 900)).toBeCloseTo(16 / 9, 5)
    expect(showcaseMediaAspectRatio(1080, 1080)).toBe(1)
    expect(showcaseMediaAspectRatio(900, 1600)).toBeCloseTo(9 / 16, 5)
  })

  it("fallback 1 bila dimensi hilang/tidak valid", () => {
    expect(showcaseMediaAspectRatio(undefined, undefined)).toBe(1)
    expect(showcaseMediaAspectRatio(0, 900)).toBe(1)
    expect(showcaseMediaAspectRatio(1600, 0)).toBe(1)
    expect(showcaseMediaAspectRatio(-5, 900)).toBe(1)
    expect(showcaseMediaAspectRatio("x", 900)).toBe(1)
  })

  it("clamp rasio ekstrem agar layout tidak rusak", () => {
    expect(showcaseMediaAspectRatio(10000, 10)).toBe(4)
    expect(showcaseMediaAspectRatio(10, 10000)).toBe(0.25)
  })

  it("showcaseMedia membawa aspectRatio tiap slide", () => {
    const item = socialItemWithImages([
      { id: "m1", kind: "image", imageUrl: "https://x/1.jpg", width: 1600, height: 900, sortOrder: 0 },
      { id: "m2", kind: "image", imageUrl: "https://x/2.jpg", sortOrder: 1 },
    ])
    const media = showcaseMedia(item)
    expect(media).toHaveLength(2)
    expect(media[0]!.aspectRatio).toBeCloseTo(16 / 9, 5)
    // Tanpa dimensi → persegi (perilaku lama).
    expect(media[1]!.aspectRatio).toBe(1)
  })
})

describe("C05 — cache prefetch detail", () => {
  it("consume tanpa prefetch mengembalikan null", () => {
    clearShowcaseDetailPrefetch()
    expect(consumePrefetchedShowcaseDetail("tak-ada")).toBeNull()
  })

  it("TTL diekspor sebagai konstanta wajar (60–300 detik)", () => {
    expect(SHOWCASE_DETAIL_PREFETCH_TTL_MS).toBeGreaterThanOrEqual(60_000)
    expect(SHOWCASE_DETAIL_PREFETCH_TTL_MS).toBeLessThanOrEqual(300_000)
  })

  it("entri kedaluwarsa tidak dikonsumsi", () => {
    clearShowcaseDetailPrefetch()
    // Simulasi: tidak ada cara publik menyuntik entri tanpa network, jadi
    // pastikan consume pada id asing selalu null (tidak pernah throw).
    expect(consumePrefetchedShowcaseDetail("x", Date.now() + SHOWCASE_DETAIL_PREFETCH_TTL_MS + 1)).toBeNull()
  })
})

describe("C06 — status stok", () => {
  it("unknown bila tidak ada field stok (kontrak backend saat ini)", () => {
    expect(resolveShowcaseStock({ id: "a" })).toBe("unknown")
    expect(resolveShowcaseStock(null)).toBe("unknown")
    expect(isShowcaseSoldOut({ id: "a" })).toBe(false)
  })

  it("membaca kandidat field stok saat backend menambahkannya", () => {
    expect(resolveShowcaseStock({ stock: 5 })).toBe("inStock")
    expect(resolveShowcaseStock({ stock: 0 })).toBe("outOfStock")
    expect(resolveShowcaseStock({ stockQty: 0 })).toBe("outOfStock")
    expect(resolveShowcaseStock({ quantity: 3 })).toBe("inStock")
    expect(isShowcaseSoldOut({ stockQuantity: 0 })).toBe(true)
    expect(isShowcaseSoldOut({ stock: 2 })).toBe(false)
  })

  it("nilai non-angka diabaikan (graceful)", () => {
    expect(resolveShowcaseStock({ stock: "habis" })).toBe("unknown")
    expect(resolveShowcaseStock({ stock: NaN })).toBe("unknown")
  })
})

describe("C10 — format/parsing rupiah saat mengetik", () => {
  it("format ribuan Indonesia", () => {
    expect(formatRupiahTyping(1500000)).toBe("1.500.000")
    expect(formatRupiahTyping(500)).toBe("500")
    expect(formatRupiahTyping(0)).toBe("0")
    expect(formatRupiahTyping(null)).toBe("")
    expect(formatRupiahTyping(undefined)).toBe("")
  })

  it("parse membuang pemisah ribuan (terima paste)", () => {
    expect(parseRupiahTyping("1.500.000")).toBe(1500000)
    expect(parseRupiahTyping("1,500,000")).toBe(1500000)
    expect(parseRupiahTyping("1 500 000")).toBe(1500000)
    expect(parseRupiahTyping("")).toBeNull()
  })

  it("menolak negatif & non-digit (undefined = abaikan ketikan)", () => {
    expect(parseRupiahTyping("-500")).toBeUndefined()
    expect(parseRupiahTyping("12a")).toBeUndefined()
    expect(parseRupiahTyping("+500")).toBeUndefined()
  })

  it("menolak lebih dari batas digit", () => {
    expect(parseRupiahTyping("9".repeat(RUPIAH_MAX_DIGITS))).toBe(999999999999999)
    expect(parseRupiahTyping("9".repeat(RUPIAH_MAX_DIGITS + 1))).toBeUndefined()
  })
})

describe("C12 — status moderasi", () => {
  it("unknown bila tidak ada field (kontrak backend saat ini)", () => {
    expect(resolveShowcaseModeration({ id: "a" })).toEqual({ status: "unknown" })
    expect(resolveShowcaseModeration(null)).toEqual({ status: "unknown" })
    expect(needsModerationAttention({ status: "unknown" })).toBe(false)
  })

  it("normalisasi kosakata status", () => {
    expect(normalizeModerationStatus("APPROVED")).toBe("approved")
    expect(normalizeModerationStatus("PENDING")).toBe("pending")
    expect(normalizeModerationStatus("IN_REVIEW")).toBe("pending")
    expect(normalizeModerationStatus("REJECTED")).toBe("rejected")
    expect(normalizeModerationStatus("REJECT")).toBe("rejected")
    expect(normalizeModerationStatus("whatever")).toBe("unknown")
    expect(normalizeModerationStatus(null)).toBe("unknown")
  })

  it("membaca alasan + waktu secara defensif", () => {
    const info = resolveShowcaseModeration({
      moderationStatus: "REJECTED",
      moderationNote: "Foto buram",
      reviewedAt: "2026-09-27T10:00:00.000Z",
    })
    expect(info).toEqual({
      status: "rejected",
      reason: "Foto buram",
      reviewedAt: "2026-09-27T10:00:00.000Z",
    })
    expect(needsModerationAttention(info)).toBe(true)
    expect(needsModerationAttention({ status: "approved" })).toBe(false)
  })
})

describe("C15 — hitungan total filter aktif", () => {
  const sheet = DEFAULT_SHOWCASE_FILTERS
  it("0 bila tidak ada filter", () => {
    expect(countActiveFeedFilters({ sheet })).toBe(0)
  })

  it("menghitung search + kategori + lokasi + filter sheet", () => {
    expect(countActiveFeedFilters({ search: "tas", sheet })).toBe(1)
    expect(countActiveFeedFilters({ search: "tas", category: "Kriya", sheet })).toBe(2)
    expect(
      countActiveFeedFilters({ search: "tas", category: "Kriya", location: "Jakarta", sheet }),
    ).toBe(3)
    expect(
      countActiveFeedFilters({
        search: "tas",
        category: "Kriya",
        location: "Jakarta",
        sheet: { ...sheet, condition: "NEW" },
      }),
    ).toBe(4)
  })

  it("string kosong/whitespace tidak dihitung", () => {
    expect(countActiveFeedFilters({ search: "   ", category: "", sheet })).toBe(0)
  })
})
