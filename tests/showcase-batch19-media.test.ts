/**
 * Batch 19 — item 12/14/15/16: logika media kaya feed (tanpa kontrak TIM A).
 *
 * Mengunci perilaku PURE (tidak butuh kontrak backend):
 * - `spinFrameIndex`: drag horizontal → indeks frame 360° (wrap-around).
 * - `parseShowcaseMedia`: parser toleran — kind asing DIBUANG (bukan
 *   fail-open), entri tak lengkap dilewati, payload lama tanpa `media` aman.
 * - `showcaseFilterBadgeCount` / `isDefaultShowcaseFilters`: helper badge
 *   filter draf (item 14).
 * - `showcaseMedia`: prioritas media kaya, fallback ke images[] lama.
 */
import { describe, expect, it, vi } from "vitest"

// `@/lib/api/client` tidak bisa di-parse vitest (dependensi native
// transitif) — pola yang sama dipakai tests/showcase-api-contract.test.ts.
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }))
vi.mock("@/lib/api/client", () => ({
  http: { get: mocks.get, post: mocks.post, delete: mocks.del },
  seg: (value: string) => encodeURIComponent(value),
}))

import { parseShowcaseMedia, type ShowcaseSocialItem } from "@/lib/api/showcase"
import { showcaseMedia } from "@/lib/showcase-social"
import { spinFrameIndex } from "@/lib/spin360"
import {
  DEFAULT_SHOWCASE_FILTERS,
  isDefaultShowcaseFilters,
  showcaseFilterBadgeCount,
  type ShowcaseFeedFilters,
} from "@/lib/showcase-filters"

describe("spinFrameIndex (item 12)", () => {
  it("geser kanan penuh satu putaran → kembali ke frame awal", () => {
    expect(spinFrameIndex(0, 600, 36)).toBe(0)
  })
  it("setengah putaran dari frame 0 (36 frame) → frame 18", () => {
    expect(spinFrameIndex(0, 300, 36)).toBe(18)
  })
  it("geser kiri membungkus ke akhir (wrap-around)", () => {
    expect(spinFrameIndex(0, -300, 36)).toBe(18)
    expect(spinFrameIndex(2, -100, 36)).toBe(32)
  })
  it("frameCount 0 → 0 (tidak NaN/crash)", () => {
    expect(spinFrameIndex(5, 300, 0)).toBe(0)
  })
  it("indeks selalu dalam [0, frameCount)", () => {
    for (let dx = -1200; dx <= 1200; dx += 37) {
      const i = spinFrameIndex(7, dx, 24)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(24)
    }
  })
})

describe("parseShowcaseMedia — parser toleran (item 11/12/16)", () => {
  it("bukan array → []", () => {
    expect(parseShowcaseMedia(undefined)).toEqual([])
    expect(parseShowcaseMedia(null)).toEqual([])
    expect(parseShowcaseMedia({})).toEqual([])
  })
  it("image & video valid lolos; thumbnailUrl opsional dipertahankan", () => {
    const out = parseShowcaseMedia([
      { id: "a", kind: "image", imageUrl: "https://x.id/a.jpg" },
      { id: "b", kind: "video", imageUrl: "https://x.id/b.mp4", thumbnailUrl: "https://x.id/b.jpg" },
    ])
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ id: "a", kind: "image", imageUrl: "https://x.id/a.jpg" })
    expect(out[1]).toMatchObject({ kind: "video", thumbnailUrl: "https://x.id/b.jpg" })
  })
  it("spin360 butuh groupKey + groupOrder (kontrak final)", () => {
    expect(
      parseShowcaseMedia([{ id: "s", kind: "spin360", imageUrl: "https://x.id/1.jpg" }]),
    ).toEqual([])
    const out = parseShowcaseMedia([
      { id: "s1", kind: "spin360", imageUrl: "https://x.id/1.jpg", groupKey: "g1", groupOrder: 0 },
      { id: "s2", kind: "spin360", imageUrl: "https://x.id/2.jpg", groupKey: "g1", groupOrder: 1 },
    ])
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ kind: "spin360", groupKey: "g1", groupOrder: 0 })
  })
  it("kind asing DIBUANG — tidak fail-open ke image", () => {
    const out = parseShowcaseMedia([
      { id: "x", kind: "audio", url: "https://x.id/x.mp3" },
      { id: "y", kind: "VIDEO", url: "https://x.id/y.mp4" },
    ])
    expect(out).toEqual([])
  })
  it("video/image tanpa url DIBUANG", () => {
    expect(parseShowcaseMedia([{ id: "v", kind: "video" }])).toEqual([])
    expect(parseShowcaseMedia([{ id: "i", kind: "image", url: "" }])).toEqual([])
  })
  it("id hilang → fallback deterministik", () => {
    const out = parseShowcaseMedia([{ kind: "image", imageUrl: "https://x.id/a.jpg" }], "item-1")
    expect(out[0]?.id).toBe("item-1-media-0")
  })
})

describe("helper filter draf (item 14)", () => {
  const active: ShowcaseFeedFilters = {
    condition: "USED",
    minRating: "4_5",
    price: { min: 10000, max: null },
  }
  it("default → badge 0 & isDefault true", () => {
    expect(showcaseFilterBadgeCount(DEFAULT_SHOWCASE_FILTERS)).toBe(0)
    expect(isDefaultShowcaseFilters(DEFAULT_SHOWCASE_FILTERS)).toBe(true)
  })
  it("tiga dimensi aktif → badge 3", () => {
    expect(showcaseFilterBadgeCount(active)).toBe(3)
    expect(isDefaultShowcaseFilters(active)).toBe(false)
  })
  it("hanya harga maksimum → badge 1", () => {
    expect(
      showcaseFilterBadgeCount({ ...DEFAULT_SHOWCASE_FILTERS, price: { min: null, max: 50000 } }),
    ).toBe(1)
  })
})

describe("showcaseMedia — prioritas & fallback (item 11/16)", () => {
  const base = {
    id: "item-1",
    images: [{ id: "img-1", imageUrl: "https://x.id/lama.jpg", sortOrder: 0 }],
  } as unknown as ShowcaseSocialItem

  it("tanpa media → fallback ke images[] lama", () => {
    const out = showcaseMedia(base)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: "img-1", kind: "image", url: "https://x.id/lama.jpg" })
  })
  it("media kaya valid → dipakai, spin360 TIDAK jadi slide karosel", () => {
    const item = {
      ...base,
      images: [
        { id: "v1", kind: "video", imageUrl: "https://x.id/v.mp4", thumbnailUrl: "https://x.id/p.jpg", sortOrder: 0 },
        { id: "s1", kind: "spin360", imageUrl: "https://x.id/1.jpg", groupKey: "g1", groupOrder: 0, sortOrder: 1 },
        { id: "s2", kind: "spin360", imageUrl: "https://x.id/2.jpg", groupKey: "g1", groupOrder: 1, sortOrder: 2 },
      ],
    } as unknown as ShowcaseSocialItem
    const out = showcaseMedia(item)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: "v1", kind: "video" })
  })
  it("referensi stabil antar panggilan (memo galeri)", () => {
    expect(showcaseMedia(base)).toBe(showcaseMedia(base))
  })
})
