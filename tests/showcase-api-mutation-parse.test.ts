/**
 * AP-03 / AP-08 (audit etalase 2026-10-10):
 *  - respons mutasi komentar diparse (ack `{message}` tanpa author → error
 *    yang ditangani, bukan objek rusak yang dirender lalu TypeError);
 *  - kursor halaman koleksi tersimpan: "" atau tidak maju = tidak ada
 *    halaman berikut.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }))
vi.mock("@/lib/api/client", () => ({
  http: { get: mocks.get, post: mocks.post, patch: mocks.patch, delete: mocks.del },
  seg: (v: string) => encodeURIComponent(v),
}))

import { addShowcaseComment, getSavedShowcases, updateShowcaseComment } from "@/lib/api/showcase"

const comment = {
  id: "c1",
  showcaseId: "s1",
  content: "halo",
  createdAt: "2026-10-10T00:00:00.000Z",
  author: { userId: "USR-1", username: "a" },
}

beforeEach(() => vi.clearAllMocks())

describe("AP-03 respons mutasi komentar diparse", () => {
  it("POST komentar: respons valid → ShowcaseComment ternormalisasi", async () => {
    mocks.post.mockResolvedValue({ ...comment, likes: 3, userVote: 1 })
    const out = await addShowcaseComment("s1", { content: "halo" }, "key-1")
    expect(out).toMatchObject({ id: "c1", content: "halo", likes: 3, userVote: 1 })
    expect(out.author.username).toBe("a")
  })

  it("POST komentar: ack tanpa author → ditolak (bukan objek rusak ke daftar)", async () => {
    mocks.post.mockResolvedValue({ message: "ok" })
    await expect(addShowcaseComment("s1", { content: "halo" })).rejects.toBeTruthy()
  })

  it("PATCH komentar: diparse juga", async () => {
    mocks.patch.mockResolvedValue({ ...comment, content: "edit", updatedAt: "2026-10-10T01:00:00.000Z" })
    const out = await updateShowcaseComment("c1", "edit")
    expect(out.content).toBe("edit")
    expect(out.updatedAt).toBe("2026-10-10T01:00:00.000Z")
  })
})

describe("AP-08 kursor koleksi tersimpan", () => {
  it('nextCursor "" → null & hasNext false', async () => {
    mocks.get.mockResolvedValue({ data: [], total: 0, nextCursor: "" })
    const page = await getSavedShowcases({ limit: 20 })
    expect(page.nextCursor).toBeNull()
    expect(page.hasNext).toBe(false)
  })

  it("nextCursor yang sama dengan kursor yang diminta (tidak maju) → null", async () => {
    mocks.get.mockResolvedValue({ data: [], total: 0, nextCursor: "abc" })
    const page = await getSavedShowcases({ cursor: "abc", limit: 20 })
    expect(page.nextCursor).toBeNull()
    expect(page.hasNext).toBe(false)
  })

  it("nextCursor baru tetap diteruskan", async () => {
    mocks.get.mockResolvedValue({ data: [], total: 0, nextCursor: "def" })
    const page = await getSavedShowcases({ cursor: "abc", limit: 20 })
    expect(page.nextCursor).toBe("def")
    expect(page.hasNext).toBe(true)
  })
})

describe("BE-8 DELETE komentar → commentCount server", () => {
  it("commentCount angka diteruskan; tanpa commentCount → undefined (backend lama)", async () => {
    const { deleteShowcaseComment } = await import("@/lib/api/showcase")
    mocks.del.mockResolvedValue({ message: "Comment deleted", commentCount: 4 })
    await expect(deleteShowcaseComment("c1")).resolves.toEqual({ message: "Comment deleted", commentCount: 4 })
    mocks.del.mockResolvedValue({ message: "Comment deleted" })
    await expect(deleteShowcaseComment("c1")).resolves.toEqual({ message: "Comment deleted", commentCount: undefined })
    mocks.del.mockResolvedValue(undefined)
    await expect(deleteShowcaseComment("c1")).resolves.toEqual({ message: "", commentCount: undefined })
  })
})
