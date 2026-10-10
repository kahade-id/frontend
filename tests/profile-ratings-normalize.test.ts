/**
 * Audit profil 2026-10-10 — kontrak `GET /v1/users/:username/ratings`.
 *
 *  P-01: backend mengirim `giver: { username, avatarUrl }` → dibaca sebagai
 *        `authorUsername`/`authorAvatarUrl` (dulu semua ulasan "Pengguna").
 *  P-02: `reply` adalah OBJEK `{ content, createdAt, replier }` → `replies[]`
 *        (dulu objek jadi child <Text> → crash tab Ulasan).
 *  P-11: `hidden: true` (privasi pemilik) terbaca; distribusi 0 bukan data.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock("@/lib/api/client", () => ({
  http: { get: mocks.get },
  seg: (value: string) => encodeURIComponent(value),
}))

import {
  firstRatingReply,
  getPublicRatings,
  normalizePublicRating,
  parsePublicRatingSummary,
  readMyRatings,
  readPublicRatingsHidden,
  type Rating,
} from "@/lib/api/ratings"

beforeEach(() => vi.resetAllMocks())

const backendItem = {
  id: "r1",
  stars: 5,
  comment: "Mantap",
  createdAt: "2026-10-01T00:00:00.000Z",
  giver: { username: "sari", avatarUrl: "https://cdn.kahade.id/a.jpg" },
  reply: {
    content: "Terima kasih!",
    createdAt: "2026-10-02T00:00:00.000Z",
    replier: { username: "budi", avatarUrl: null },
  },
} as unknown as Rating

describe("normalizePublicRating", () => {
  it("P-01: giver → authorUsername/authorAvatarUrl", () => {
    const r = normalizePublicRating(backendItem)
    expect(r.authorUsername).toBe("sari")
    expect(r.authorAvatarUrl).toBe("https://cdn.kahade.id/a.jpg")
  })

  it("P-02: reply objek → replies[0], field `reply` objek dibuang", () => {
    const r = normalizePublicRating(backendItem)
    expect(r.replies).toEqual([{ id: "", content: "Terima kasih!", createdAt: "2026-10-02T00:00:00.000Z" }])
    expect((r as { reply?: unknown }).reply).toBeUndefined()
    expect(firstRatingReply(r)).toEqual({ id: "", content: "Terima kasih!", createdAt: "2026-10-02T00:00:00.000Z" })
  })

  it("tidak menimpa authorUsername/replies yang sudah ada", () => {
    const r = normalizePublicRating({
      ...backendItem,
      authorUsername: "asli",
      replies: [{ id: "rep-1", content: "lama" }],
    })
    expect(r.authorUsername).toBe("asli")
    expect(r.replies?.[0]?.id).toBe("rep-1")
  })

  it("tanpa giver/reply: item tidak berubah", () => {
    const plain = { id: "r2", stars: 3, createdAt: "2026-10-01T00:00:00.000Z" } as Rating
    expect(normalizePublicRating(plain)).toEqual(plain)
  })
})

describe("firstRatingReply", () => {
  it("menerima bentuk objek mentah tanpa crash", () => {
    const item = firstRatingReply({ reply: { content: "ok", createdAt: "2026-10-02" } } as unknown as Rating)
    expect(item).toEqual({ id: "", content: "ok", createdAt: "2026-10-02" })
  })
  it("objek tanpa content → content kosong (bukan objek)", () => {
    const item = firstRatingReply({ reply: { replier: {} } } as unknown as Rating)
    expect(item?.content).toBe("")
  })
})

describe("getPublicRatings", () => {
  it("menormalkan daftar `ratings` di body dan mempertahankan agregat", async () => {
    mocks.get.mockResolvedValue({
      ratings: [backendItem],
      total: 1,
      averageRating: 4.5,
      totalRatingCount: 7,
      distribution: { "1": 0, "2": 0, "3": 0, "4": 1, "5": 6 },
    })
    const body = await getPublicRatings("budi", { page: 1, limit: 20 })
    const { items } = readMyRatings(body)
    expect(items[0]?.authorUsername).toBe("sari")
    expect(items[0]?.replies?.[0]?.content).toBe("Terima kasih!")
    expect(readPublicRatingsHidden(body)).toBe(false)
    const summary = parsePublicRatingSummary(body)
    expect(summary?.averageRating).toBe(4.5)
    expect(summary?.hidden).toBe(false)
    expect(summary?.distribution.total).toBe(7)
  })

  it("P-11: hidden: true terbaca di daftar maupun ringkasan", async () => {
    mocks.get.mockResolvedValue({
      ratings: [],
      total: 0,
      averageRating: null,
      totalRatingCount: null,
      distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
      hidden: true,
    })
    const body = await getPublicRatings("budi", { page: 1, limit: 20 })
    expect(readMyRatings(body).items).toEqual([])
    expect(readPublicRatingsHidden(body)).toBe(true)
    expect(parsePublicRatingSummary(body)?.hidden).toBe(true)
  })

  it("body array polos ikut dinormalkan", async () => {
    mocks.get.mockResolvedValue([backendItem])
    const body = await getPublicRatings("budi", { page: 1, limit: 20 })
    expect(readMyRatings(body).items[0]?.authorUsername).toBe("sari")
  })
})
