import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }))
vi.mock("@/lib/api/client", () => ({
  http: { get: mocks.get, post: mocks.post, delete: mocks.del },
  seg: (value: string) => encodeURIComponent(value),
}))
import { getSavedShowcases, addSavedShowcase, removeSavedShowcase } from "@/lib/api/showcase"

const work = { id: "work", title: "A", images: null, author: { userId: "u", username: "seller" } }

beforeEach(() => vi.resetAllMocks())

describe("Saved collection backend contract (FE-IMP-1 item 54)", () => {
  it("GET /v1/showcase/saved memakai auth required + query offset/limit", async () => {
    mocks.get.mockResolvedValue({ data: [], offset: 10, limit: 20, total: 0, hasMore: false })
    const page = await getSavedShowcases({ offset: 10, limit: 20 })
    expect(mocks.get).toHaveBeenCalledWith(
      "/v1/showcase/saved",
      expect.objectContaining({ auth: "required", query: { offset: 10, limit: 20 } }),
    )
    expect(page).toMatchObject({ data: [], offset: 10, total: 0, hasMore: false })
  })

  it("parse entry: kartu feed + savedAt, item rusak dilewati per-item", async () => {
    mocks.get.mockResolvedValue({
      data: [
        { item: work, savedAt: "2026-09-28T00:00:00.000Z" },
        { item: { id: "bad", title: "x", images: null, author: null }, savedAt: "2026-09-28T00:00:00.000Z" },
      ],
      offset: 0,
      limit: 20,
      total: 2,
      hasMore: false,
    })
    const page = await getSavedShowcases()
    expect(page.data).toHaveLength(1)
    expect(page.data[0].item.id).toBe("work")
    expect(page.data[0].savedAt).toBe("2026-09-28T00:00:00.000Z")
  })

  it("hasMore fallback: offset+data < total", async () => {
    mocks.get.mockResolvedValue({
      data: [{ item: work, savedAt: "2026-09-28T00:00:00.000Z" }],
      offset: 0,
      limit: 20,
      total: 2,
    })
    const page = await getSavedShowcases()
    expect(page.hasMore).toBe(true)
  })

  it("POST/DELETE /v1/showcase/saved/:id memakai path ter-encode + auth required", async () => {
    mocks.post.mockResolvedValue(undefined)
    mocks.del.mockResolvedValue(undefined)
    await addSavedShowcase("a/b")
    expect(mocks.post).toHaveBeenCalledWith("/v1/showcase/saved/a%2Fb", {}, expect.objectContaining({ auth: "required" }))
    await removeSavedShowcase("a/b")
    expect(mocks.del).toHaveBeenCalledWith("/v1/showcase/saved/a%2Fb", expect.objectContaining({ auth: "required" }))
  })
})
