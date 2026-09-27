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
  it("GET /v1/showcase/saved memakai auth required + query page/limit (kontrak backend BE-IMP)", async () => {
    mocks.get.mockResolvedValue({
      data: [],
      total: 0,
      page: 2,
      limit: 20,
      totalPages: 0,
      hasNext: false,
      hasPrev: true,
    })
    const page = await getSavedShowcases({ page: 2, limit: 20 })
    expect(mocks.get).toHaveBeenCalledWith(
      "/v1/showcase/saved",
      expect.objectContaining({ auth: "required", query: { page: 2, limit: 20 } }),
    )
    expect(page).toMatchObject({ data: [], page: 2, total: 0, hasNext: false, hasPrev: true })
  })

  it("parse entry: kartu feed + savedAt, item rusak dilewati per-item", async () => {
    mocks.get.mockResolvedValue({
      data: [
        { item: work, savedAt: "2026-09-28T00:00:00.000Z" },
        { item: { id: "bad", title: "x", images: null, author: null }, savedAt: "2026-09-28T00:00:00.000Z" },
      ],
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    })
    const page = await getSavedShowcases()
    expect(page.data).toHaveLength(1)
    expect(page.data[0].item.id).toBe("work")
    expect(page.data[0].savedAt).toBe("2026-09-28T00:00:00.000Z")
  })

  it("entry datar (backend merge item + savedAt) juga diparse", async () => {
    mocks.get.mockResolvedValue({
      data: [{ ...work, savedAt: "2026-09-28T00:00:00.000Z" }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    })
    const page = await getSavedShowcases()
    expect(page.data).toHaveLength(1)
    expect(page.data[0].item.id).toBe("work")
    expect(page.data[0].savedAt).toBe("2026-09-28T00:00:00.000Z")
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
