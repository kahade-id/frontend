/**
 * Audit Search & Explore 2026-10-10 — guard regresi untuk perbaikan murni
 * (tanpa runtime React Native):
 *   - S-29: filter jenis produk ikut identitas kursor, badge, dan label chip;
 *   - S-30: label chip filter tetap Indonesia saat bahasa sumber;
 *   - S-41: hasil `GET /v1/search?types=showcase` membawa gambar sampul & harga;
 *   - S-09: `hintCode` backend diparse ketat;
 *   - S-02/S-43: adapter riwayat — catat eksplisit & gagal jujur.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_SHOWCASE_FILTERS,
  countActiveFeedFilters,
  describeSheetFilters,
  isDefaultShowcaseFilters,
  showcaseFilterBadgeCount,
} from "@/lib/showcase-filters"
import { sameFeedFilter } from "@/lib/showcase-feed-logic"
import {
  clearSearchHistory,
  globalSearch,
  parseSearchHintCode,
  parseSearchShowcaseItem,
  recordSearchHistory,
} from "@/lib/api/search"
import { clearSession, setAccessToken } from "@/lib/api/session"
import { ROUTES } from "@/lib/routes"
import { getSearchEmptyStateCopy } from "@/lib/search-ui"

describe("S-29: filter jenis produk", () => {
  it("default = tanpa filter (productType ALL)", () => {
    expect(isDefaultShowcaseFilters(DEFAULT_SHOWCASE_FILTERS)).toBe(true)
    expect(showcaseFilterBadgeCount(DEFAULT_SHOWCASE_FILTERS)).toBe(0)
  })

  it("objek lama tanpa field productType tetap dianggap default", () => {
    const legacy = { condition: "ALL" as const, minRating: "ALL" as const, price: { min: null, max: null } }
    expect(isDefaultShowcaseFilters(legacy)).toBe(true)
    expect(describeSheetFilters(legacy)).toBe("")
  })

  it("jenis produk aktif menambah badge & label chip", () => {
    const f = { ...DEFAULT_SHOWCASE_FILTERS, productType: "JASA" as const }
    expect(isDefaultShowcaseFilters(f)).toBe(false)
    expect(showcaseFilterBadgeCount(f)).toBe(1)
    expect(countActiveFeedFilters({ sheet: f })).toBe(1)
    expect(describeSheetFilters(f)).toBe("Jasa")
  })

  it("label gabungan: kondisi · rating · jenis · harga (urutan tetap)", () => {
    const f = {
      condition: "NEW" as const,
      minRating: "4" as const,
      productType: "DIGITAL" as const,
      price: { min: 10000, max: null },
    }
    expect(describeSheetFilters(f)).toBe("Baru · Rating 4+ · Produk digital · ≥ Rp10.000")
  })

  it("productType ikut identitas himpunan hasil (kursor di-reset)", () => {
    expect(sameFeedFilter({ productType: "JASA" }, { productType: "FISIK" })).toBe(false)
    expect(sameFeedFilter({ productType: "JASA" }, { productType: "JASA" })).toBe(true)
    expect(sameFeedFilter({}, { productType: undefined })).toBe(true)
  })
})

describe("S-41: rich card hasil search showcase", () => {
  it("memetakan coverImageUrl, harga, dan counter", () => {
    const item = parseSearchShowcaseItem({
      id: "sc1",
      title: "Sepatu lari",
      userId: "USR-1",
      createdAt: "2026-10-10T00:00:00Z",
      coverImageUrl: "https://cdn/x.jpg",
      priceMin: 150000,
      priceMax: 200000,
      likeCount: 7,
      saveCount: 2,
    })
    expect(item).not.toBeNull()
    expect(item!.images).toEqual([{ id: "sc1:cover", kind: "image", imageUrl: "https://cdn/x.jpg", sortOrder: 0 }])
    expect(item!.coverImageUrl).toBe("https://cdn/x.jpg")
    expect(item!.priceMin).toBe(150000)
    expect(item!.priceMax).toBe(200000)
    expect(item!.likeCount).toBe(7)
    expect(item!.saveCount).toBe(2)
  })

  it("bentuk minimal lama tetap valid (tanpa gambar/harga)", () => {
    const item = parseSearchShowcaseItem({ id: "sc2", title: "x", userId: "USR-2", createdAt: "" })
    expect(item!.images).toEqual([])
    expect(item!.coverImageUrl).toBeNull()
    expect(item!.priceMin).toBeNull()
    expect(item!.likeCount).toBe(0)
  })

  it("nilai harga/counter negatif atau bukan angka dibuang", () => {
    const item = parseSearchShowcaseItem({ id: "sc3", userId: "u", priceMin: -5, likeCount: "7", coverImageUrl: "  " })
    expect(item!.priceMin).toBeNull()
    expect(item!.likeCount).toBe(0)
    expect(item!.images).toEqual([])
  })
})

describe("S-09: hintCode backend", () => {
  it("hanya menerima kode yang dikenal", () => {
    expect(parseSearchHintCode("HELP_CENTER_ONLY")).toBe("HELP_CENTER_ONLY")
    expect(parseSearchHintCode("NO_RESULTS")).toBe("NO_RESULTS")
    expect(parseSearchHintCode("LAINNYA")).toBeUndefined()
    expect(parseSearchHintCode(undefined)).toBeUndefined()
  })
})

describe("S-02/S-43: adapter riwayat pencarian (fetch di-stub)", () => {
  type FetchCall = { url: string; init: RequestInit }
  const calls: FetchCall[] = []
  function stubFetch(body: unknown) {
    calls.length = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init })
        return new Response(JSON.stringify({ success: true, data: body }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }),
    )
  }

  beforeEach(async () => {
    await setAccessToken("test-token")
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    clearSession()
  })

  it("recordSearchHistory: POST /v1/search/history dengan query ter-trim", async () => {
    stubFetch({ recorded: true })
    const res = await recordSearchHistory("  sepatu lari  ")
    expect(res).toEqual({ recorded: true })
    expect(calls).toHaveLength(1)
    expect(calls[0].init.method).toBe("POST")
    expect(calls[0].url).toContain("/v1/search/history")
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ query: "sepatu lari" })
  })

  it("recordSearchHistory: query < 2 huruf tidak menembak jaringan", async () => {
    stubFetch({ recorded: true })
    const res = await recordSearchHistory(" a ")
    expect(res).toEqual({ recorded: false })
    expect(calls).toHaveLength(0)
  })

  it("clearSearchHistory: `cleared:false` dari backend dilempar sebagai error", async () => {
    stubFetch({ cleared: false })
    await expect(clearSearchHistory()).rejects.toBeTruthy()
  })

  it("clearSearchHistory: `cleared:true` lolos", async () => {
    stubFetch({ cleared: true })
    await expect(clearSearchHistory()).resolves.toBeTruthy()
  })

  const EMPTY_RESULTS = { results: { users: [], orders: [], transactions: [], helpCenter: [] } }

  it("S-64: globalSearch recordHistory:false → ?recordHistory=false", async () => {
    stubFetch(EMPTY_RESULTS)
    await globalSearch({ q: "sepatu", recordHistory: false })
    expect(calls).toHaveLength(1)
    const url = new URL(calls[0].url)
    expect(url.searchParams.get("recordHistory")).toBe("false")
    expect(url.searchParams.get("q")).toBe("sepatu")
  })

  it("S-64: tanpa flag → param tidak dikirim (perilaku klien lama)", async () => {
    stubFetch(EMPTY_RESULTS)
    await globalSearch({ q: "sepatu" })
    const url = new URL(calls[0].url)
    expect(url.searchParams.has("recordHistory")).toBe(false)
  })
})

describe("Batch 2: rute & copy", () => {
  it("S-60: walletHistorySearch membawa q ter-trim; kosong = rute polos", () => {
    expect(ROUTES.walletHistorySearch("  topup  ")).toEqual({
      pathname: "/wallet-history",
      params: { q: "topup" },
    })
    expect(ROUTES.walletHistorySearch("   ")).toBe("/wallet-history")
  })

  it("S-59: empty state mutasi tidak menjanjikan pencarian nominal", () => {
    const copy = getSearchEmptyStateCopy("transactions")
    expect(copy.description).not.toMatch(/nominal/i)
    expect(copy.description.length).toBeGreaterThan(0)
  })
})
