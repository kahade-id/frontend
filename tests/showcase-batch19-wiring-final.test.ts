/**
 * Batch 19 — wiring kontrak final Tim A (2026-09-28): A–F.
 *
 * Mengunci perilaku PURE / mock-HTTP (tidak butuh backend):
 * - A: `parseShowcaseMedia` objek final — kind hilang = image; kind asing
 *   dibuang; spin360 tanpa groupKey/groupOrder dibuang; video memakai
 *   thumbnailUrl sebagai cover (`showcaseMedia`).
 * - B: validasi `media[]` create — video tanpa thumbnailFileKey ditolak
 *   (fail closed) via `uploadShowcaseVideo`? (XHR — tidak di-test di sini;
 *   kontrak error copy dikunci di bawah bila tersedia).
 * - C: `saveShowcase`/`unsaveShowcase` → path & parse; `getShowcaseLikers`/
 *   `getShowcaseSavers` → parse `at` dari likedAt/savedAt.
 * - D: `sameFeedFilter` mencakup condition & minSellerRating;
 *   `describeSheetFilters` label chip.
 * - E: validasi sisi klien create/update highlight (tanpa network);
 *   path & body CRUD; parse preview publik.
 * - F: `parsePublicRatingSummary` — distribution {"1".."5"} + averageRating;
 *   tanpa distribution → null (fail closed).
 */
import { describe, expect, it, vi, beforeEach } from "vitest"

// `@/lib/api/client` tidak bisa di-parse vitest (dependensi native
// transitif) — pola yang sama dipakai tests/showcase-api-contract.test.ts.
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}))
vi.mock("@/lib/api/client", () => ({
  http: { get: mocks.get, post: mocks.post, patch: mocks.patch, delete: mocks.del },
  seg: (value: string) => encodeURIComponent(value),
}))

import {
  parseShowcaseMedia,
  saveShowcase,
  unsaveShowcase,
  getShowcaseLikers,
  getShowcaseSavers,
} from "@/lib/api/showcase"
import { showcaseMedia, showcaseSpin360Groups } from "@/lib/showcase-social"
import { sameFeedFilter } from "@/lib/showcase-feed-logic"
import { describeSheetFilters } from "@/lib/showcase-filters"
import {
  createHighlight,
  updateHighlight,
  deleteHighlight,
  readProfileHighlights,
  listMyHighlights,
} from "@/lib/api/showcase-highlights"
import { parsePublicRatingSummary } from "@/lib/api/ratings"

beforeEach(() => {
  mocks.get.mockReset()
  mocks.post.mockReset()
  mocks.patch.mockReset()
  mocks.del.mockReset()
})

// ── A: parser media final ──────────────────────────────────────────────

describe("parseShowcaseMedia — kontrak final (A)", () => {
  it("kind hilang = image (kompatibilitas payload lama)", () => {
    const out = parseShowcaseMedia([{ id: "m1", imageUrl: "https://x/1.jpg" }])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: "m1", kind: "image", imageUrl: "https://x/1.jpg" })
  })
  it("kind asing eksplisit dibuang (fail closed)", () => {
    const out = parseShowcaseMedia([
      { id: "m1", kind: "hologram", imageUrl: "https://x/1.jpg" },
      { id: "m2", kind: "image", imageUrl: "https://x/2.jpg" },
    ])
    expect(out.map((m) => m.id)).toEqual(["m2"])
  })
  it("spin360 tanpa groupKey/groupOrder dibuang", () => {
    const out = parseShowcaseMedia([
      { id: "s1", kind: "spin360", imageUrl: "https://x/s1.jpg" },
      {
        id: "s2",
        kind: "spin360",
        imageUrl: "https://x/s2.jpg",
        groupKey: "g1",
        groupOrder: 0,
      },
    ])
    expect(out.map((m) => m.id)).toEqual(["s2"])
  })
  it("video menyimpan thumbnailUrl + durationSec", () => {
    const out = parseShowcaseMedia([
      {
        id: "v1",
        kind: "video",
        imageUrl: "https://x/v.mp4",
        thumbnailUrl: "https://x/v.jpg",
        durationSec: 42,
      },
    ])
    expect(out[0]).toMatchObject({
      kind: "video",
      thumbnailUrl: "https://x/v.jpg",
      durationSec: 42,
    })
  })
})

describe("showcaseMedia — video memakai thumbnail sebagai poster (A)", () => {
  it("entri video → url = file video, posterUrl = thumbnailUrl", () => {
    const item = {
      id: "it1",
      images: [
        { id: "v1", kind: "video", imageUrl: "https://x/v.mp4", thumbnailUrl: "https://x/v.jpg" },
      ],
    } as never
    const media = showcaseMedia(item)
    expect(media[0]).toMatchObject({ kind: "video", url: "https://x/v.mp4", posterUrl: "https://x/v.jpg" })
  })
})

describe("showcaseSpin360Groups — grup dari images[] (A)", () => {
  it("mengelompokkan per groupKey, urut groupOrder; grup <2 frame dibuang", () => {
    const item = {
      id: "it1",
      images: [
        { id: "s2", kind: "spin360", imageUrl: "https://x/2.jpg", groupKey: "g1", groupOrder: 1 },
        { id: "s1", kind: "spin360", imageUrl: "https://x/1.jpg", groupKey: "g1", groupOrder: 0 },
        { id: "t1", kind: "spin360", imageUrl: "https://x/3.jpg", groupKey: "g2", groupOrder: 0 },
        { id: "t2", kind: "spin360", imageUrl: "https://x/4.jpg", groupKey: "g2", groupOrder: 1 },
        { id: "u1", kind: "spin360", imageUrl: "https://x/5.jpg", groupKey: "g3", groupOrder: 0 },
      ],
    } as never
    const groups = showcaseSpin360Groups(item)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toEqual(["https://x/1.jpg", "https://x/2.jpg"])
    expect(groups[1]).toEqual(["https://x/3.jpg", "https://x/4.jpg"])
  })
})

// ── C: save / likers / savers ──────────────────────────────────────────

describe("saveShowcase / unsaveShowcase (C)", () => {
  it("POST /v1/showcase/:id/save → { saved, saveCount }", async () => {
    mocks.post.mockResolvedValue({ saved: true, saveCount: 6 })
    const res = await saveShowcase("abc", 5)
    expect(mocks.post).toHaveBeenCalledWith(
      "/v1/showcase/abc/save",
      undefined,
      expect.objectContaining({ auth: "required" }),
    )
    expect(res).toEqual({ saved: true, saveCount: 6 })
  })
  it("DELETE /v1/showcase/:id/save → { saved:false, saveCount }", async () => {
    mocks.del.mockResolvedValue({ saved: false, saveCount: 4 })
    const res = await unsaveShowcase("abc", 5)
    expect(mocks.del).toHaveBeenCalledWith(
      "/v1/showcase/abc/save",
      expect.objectContaining({ auth: "required" }),
    )
    expect(res).toEqual({ saved: false, saveCount: 4 })
  })
  it("respons tanpa saveCount → fallbackCount (tidak menampilkan 0 palsu)", async () => {
    mocks.post.mockResolvedValue({ saved: true })
    const res = await saveShowcase("abc", 5)
    expect(res.saveCount).toBe(5)
  })
})

describe("getShowcaseLikers / getShowcaseSavers (C)", () => {
  const page = {
    data: [
      { userId: "u1", username: "budi", fullName: "Budi", avatarUrl: null, likedAt: "2026-09-28T10:00:00Z" },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  }
  it("likers: publik, `at` dari likedAt", async () => {
    mocks.get.mockResolvedValue(page)
    const res = await getShowcaseLikers("abc")
    expect(mocks.get).toHaveBeenCalledWith(
      "/v1/showcase/abc/likers",
      expect.objectContaining({ auth: "optional" }),
    )
    expect(res.data[0]).toMatchObject({ userId: "u1", at: "2026-09-28T10:00:00Z" })
  })
  it("savers: auth required, `at` dari savedAt", async () => {
    mocks.get.mockResolvedValue({
      ...page,
      data: [{ userId: "u2", username: "siti", fullName: null, savedAt: "2026-09-27T10:00:00Z" }],
    })
    const res = await getShowcaseSavers("abc")
    expect(mocks.get).toHaveBeenCalledWith(
      "/v1/showcase/abc/savers",
      expect.objectContaining({ auth: "required" }),
    )
    expect(res.data[0]).toMatchObject({ userId: "u2", at: "2026-09-27T10:00:00Z" })
  })
})

// ── D: filter feed ─────────────────────────────────────────────────────

describe("sameFeedFilter — condition & rating ikut identitas (D)", () => {
  it("condition berbeda → filter berbeda (kursor di-reset)", () => {
    expect(sameFeedFilter({ condition: "baru" }, { condition: "bekas" })).toBe(false)
    expect(sameFeedFilter({ condition: "baru" }, { condition: "baru" })).toBe(true)
  })
  it("minSellerRating berbeda → filter berbeda", () => {
    expect(sameFeedFilter({ minSellerRating: 4 }, { minSellerRating: 4.5 })).toBe(false)
    expect(sameFeedFilter({ minSellerRating: 4 }, { minSellerRating: 4 })).toBe(true)
  })
  it("harga tetap ikut identitas", () => {
    expect(sameFeedFilter({ minPrice: 100 }, { minPrice: 200 })).toBe(false)
  })
})

describe("describeSheetFilters — label chip (D)", () => {
  it("kondisi + rating + rentang harga", () => {
    expect(
      describeSheetFilters({ condition: "NEW", minRating: "4_5", price: { min: 10000, max: 50000 } }),
    ).toContain("Baru")
  })
  it("filter default → label kosong", () => {
    expect(
      describeSheetFilters({ condition: "ALL", minRating: "ALL", price: { min: null, max: null } }),
    ).toBe("")
  })
})

// ── E: highlights CRUD ─────────────────────────────────────────────────

describe("createHighlight — validasi sisi klien (E)", () => {
  it("judul kosong → tolak tanpa network", async () => {
    await expect(createHighlight({ title: "   ", productIds: ["p1"] })).rejects.toThrow(
      "Judul highlight tidak boleh kosong",
    )
    expect(mocks.post).not.toHaveBeenCalled()
  })
  it("judul > 80 karakter → tolak", async () => {
    await expect(createHighlight({ title: "x".repeat(81), productIds: ["p1"] })).rejects.toThrow(
      "maksimal 80 karakter",
    )
    expect(mocks.post).not.toHaveBeenCalled()
  })
  it("productIds kosong → tolak", async () => {
    await expect(createHighlight({ title: "Promo", productIds: [] })).rejects.toThrow(
      "minimal 1 produk",
    )
    expect(mocks.post).not.toHaveBeenCalled()
  })
  it("productIds duplikat → tolak", async () => {
    await expect(createHighlight({ title: "Promo", productIds: ["p1", "p1"] })).rejects.toThrow(
      "duplikat",
    )
    expect(mocks.post).not.toHaveBeenCalled()
  })
  it("> 50 produk → tolak", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `p${i}`)
    await expect(createHighlight({ title: "Promo", productIds: ids })).rejects.toThrow(
      "Maksimal 50 produk",
    )
    expect(mocks.post).not.toHaveBeenCalled()
  })
  it("valid → POST /v1/highlights dengan title ter-trim", async () => {
    mocks.post.mockResolvedValue({
      id: "h1",
      title: "Promo",
      coverUrl: null,
      productIds: ["p1"],
      productCount: 1,
      createdAt: "2026-09-28T00:00:00Z",
      updatedAt: "2026-09-28T00:00:00Z",
    })
    const res = await createHighlight({ title: "  Promo  ", productIds: ["p1"] })
    expect(mocks.post).toHaveBeenCalledWith(
      "/v1/highlights",
      { title: "Promo", productIds: ["p1"] },
      expect.objectContaining({ auth: "required" }),
    )
    expect(res).toMatchObject({ id: "h1", title: "Promo", productIds: ["p1"] })
  })
})

describe("updateHighlight / deleteHighlight (E)", () => {
  it("PATCH /v1/highlights/:id", async () => {
    mocks.patch.mockResolvedValue({
      id: "h1",
      title: "Baru",
      productIds: ["p1", "p2"],
      productCount: 2,
      createdAt: "",
      updatedAt: "",
    })
    const res = await updateHighlight("h1", { title: "Baru", productIds: ["p1", "p2"] })
    expect(mocks.patch).toHaveBeenCalledWith(
      "/v1/highlights/h1",
      { title: "Baru", productIds: ["p1", "p2"] },
      expect.objectContaining({ auth: "required" }),
    )
    expect(res.title).toBe("Baru")
  })
  it("DELETE /v1/highlights/:id", async () => {
    mocks.del.mockResolvedValue(undefined)
    await deleteHighlight("h1")
    expect(mocks.del).toHaveBeenCalledWith(
      "/v1/highlights/h1",
      expect.objectContaining({ auth: "required" }),
    )
  })
})

describe("readProfileHighlights / listMyHighlights (E)", () => {
  it("preview publik: coverUrl + previewImageUrls", async () => {
    mocks.get.mockResolvedValue({
      data: [
        {
          id: "h1",
          title: "Promo",
          coverUrl: null,
          productCount: 3,
          previewImageUrls: ["https://x/1.jpg", "https://x/2.jpg"],
        },
      ],
    })
    const res = await readProfileHighlights("budi")
    expect(mocks.get).toHaveBeenCalledWith(
      "/v1/users/budi/highlights",
      expect.objectContaining({ auth: "optional" }),
    )
    expect(res[0]).toMatchObject({ id: "h1", title: "Promo", productCount: 3 })
    expect(res[0].previewImageUrls).toHaveLength(2)
  })
  it("milik sendiri: productIds penuh", async () => {
    mocks.get.mockResolvedValue({
      data: [
        {
          id: "h1",
          title: "Promo",
          coverUrl: "https://x/c.jpg",
          productIds: ["p1", "p2"],
          productCount: 2,
          createdAt: "",
          updatedAt: "",
        },
      ],
    })
    const res = await listMyHighlights()
    expect(mocks.get).toHaveBeenCalledWith(
      "/v1/highlights",
      expect.objectContaining({ auth: "required" }),
    )
    expect(res[0].productIds).toEqual(["p1", "p2"])
  })
})

// ── F: rating distribution ─────────────────────────────────────────────

describe("parsePublicRatingSummary (F)", () => {
  it('distribution {"1".."5"} → counts [1..5] + total', () => {
    const s = parsePublicRatingSummary({
      data: [],
      distribution: { "1": 2, "2": 1, "3": 0, "4": 3, "5": 10 },
      averageRating: 4.4,
    })
    expect(s?.distribution.counts).toEqual([2, 1, 0, 3, 10])
    expect(s?.distribution.total).toBe(16)
    expect(s?.averageRating).toBe(4.4)
  })
  it("tanpa distribution → null (fail closed)", () => {
    expect(parsePublicRatingSummary({ data: [] })).toBeNull()
    expect(parsePublicRatingSummary(null)).toBeNull()
    expect(parsePublicRatingSummary({ distribution: "rusak" })).toBeNull()
  })
  it("nilai non-numerik diabaikan → 0", () => {
    const s = parsePublicRatingSummary({
      distribution: { "1": "banyak", "5": 7 },
    })
    expect(s?.distribution.counts).toEqual([0, 0, 0, 0, 7])
    expect(s?.averageRating).toBeNull()
  })
})
