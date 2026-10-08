import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }))
vi.mock("@/lib/api/client", () => ({
  http: { get: mocks.get, post: mocks.post, delete: mocks.del },
  seg: (value: string) => encodeURIComponent(value),
}))
import { getShowcaseDetail, getShowcaseFeed, listShowcaseComments, likeShowcase } from "@/lib/api/showcase"
const work = { id: "work", title: "A", images: null, author: { userId: "u", username: "seller" } }
beforeEach(() => vi.resetAllMocks())
describe("Etalase API contract boundaries", () => {
  it("detail preserves optional bearer identity, encodes path, and disables view retries", async () => {
    mocks.get.mockResolvedValue(work)
    const result = await getShowcaseDetail("a/b?c")
    expect(mocks.get).toHaveBeenCalledWith("/v1/showcase/a%2Fb%3Fc", expect.objectContaining({ auth: "optional", retry: 0 }))
    expect(result.images).toEqual([])
  })
  it("feed enforces documented query limits", async () => {
    mocks.get.mockResolvedValue({ items: [work], hasMore: false })
    await getShowcaseFeed({ search: "x".repeat(101), category: "c".repeat(61) })
    const options = mocks.get.mock.calls[0][1]
    expect(options.auth).toBe("optional")
    expect(options.query.search).toHaveLength(100)
    expect(options.query.category).toHaveLength(60)
  })
  it.each([null, {}, "same"])("rejects missing, malformed, or non-advancing cursors %j", async nextCursor => {
    mocks.get.mockResolvedValue({ items: [work], hasMore: true, nextCursor })
    await expect(getShowcaseFeed({ cursor: "same" })).rejects.toMatchObject({ code: "PARSE" })
  })
  it("comments without entity identity are dropped, never trusted via array cast", async () => {
    // 2026-10-05: satu komentar rusak tidak meruntuhkan seluruh list —
    // entri tanpa author/id dibuang, komentar valid tetap tampil.
    mocks.get.mockResolvedValue({
      data: [
        { id: "bad", author: null },
        { id: "ok", content: "halo", author: { userId: "u", username: "seller" } },
      ],
      total: 2,
    })
    const page = await listShowcaseComments("work")
    expect(page.data.map((c) => c.id)).toEqual(["ok"])
  })
  it("mutation path encodes the item and final counts cannot become negative", async () => {
    mocks.post.mockResolvedValue({ liked: true, likeCount: -2 })
    expect(await likeShowcase("a/b")).toEqual({ liked: true, likeCount: 0 })
    expect(mocks.post).toHaveBeenCalledWith(
      "/v1/showcase/a%2Fb/like",
      undefined,
      // Item #27: aksi sosial boleh diantrekan saat offline.
      expect.objectContaining({ auth: "required", offlineBehavior: "enqueue-social" }),
    )
  })
})
