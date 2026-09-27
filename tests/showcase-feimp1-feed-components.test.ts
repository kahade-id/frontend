/**
 * FE-IMP-1 komponen feed — test unit untuk logika murni yang ditambah:
 * - item 47: parser tab feed (`parseShowcaseFeedTab`)
 * - item 48: like komentar lokal (`resolveShowcaseCommentLike`, `toggleShowcaseCommentLike`)
 * - item 49/160: urutan komentar (`sortShowcaseComments`)
 * - item 56: cache status follow (`getFollowStatus`, `setFollowStatus`, `invalidateFollowStatus`)
 */
import { describe, expect, it } from "vitest"

import { parseShowcaseFeedTab } from "@/lib/ui-prefs"
import {
  clearShowcaseCommentLikes,
  resolveShowcaseCommentLike,
  toggleShowcaseCommentLike,
} from "@/lib/showcase-comment-likes"
import { sortShowcaseComments } from "@/lib/showcase-social"
import {
  clearFollowStatusCache,
  peekFollowStatus,
  setFollowStatus,
} from "@/lib/follow-status"

describe("item 47 — parseShowcaseFeedTab fail-closed", () => {
  it("menerima empat tab yang sah", () => {
    expect(parseShowcaseFeedTab("forYou")).toBe("forYou")
    expect(parseShowcaseFeedTab("following")).toBe("following")
    expect(parseShowcaseFeedTab("latest")).toBe("latest")
    expect(parseShowcaseFeedTab("popular")).toBe("popular")
  })

  it("nilai asing/undefined/null jatuh ke forYou", () => {
    expect(parseShowcaseFeedTab("viral")).toBe("forYou")
    expect(parseShowcaseFeedTab(undefined)).toBe("forYou")
    expect(parseShowcaseFeedTab(null)).toBe("forYou")
    expect(parseShowcaseFeedTab("")).toBe("forYou")
    expect(parseShowcaseFeedTab(42)).toBe("forYou")
  })
})

describe("item 48 — like komentar lokal sesi", () => {
  it("toggle tanpa base → likeCount 0→1→0, tidak pernah negatif", () => {
    clearShowcaseCommentLikes()
    const cid = "comment-test-1"
    expect(resolveShowcaseCommentLike(cid)).toEqual({ isLiked: false, likeCount: 0 })
    expect(toggleShowcaseCommentLike(cid)).toEqual({ isLiked: true, likeCount: 1 })
    expect(toggleShowcaseCommentLike(cid)).toEqual({ isLiked: false, likeCount: 0 })
  })

  it("base dari server: delta ±1 diterapkan pada baseCount", () => {
    clearShowcaseCommentLikes()
    const cid = "comment-test-2"
    expect(resolveShowcaseCommentLike(cid, { isLiked: true, likeCount: 7 })).toEqual({
      isLiked: true,
      likeCount: 7,
    })
    expect(toggleShowcaseCommentLike(cid, { isLiked: true, likeCount: 7 })).toEqual({
      isLiked: false,
      likeCount: 6,
    })
  })

  it("likeCount tidak bisa negatif bila base tidak valid", () => {
    clearShowcaseCommentLikes()
    const cid = "comment-test-3"
    expect(resolveShowcaseCommentLike(cid, { likeCount: -5 })).toEqual({
      isLiked: false,
      likeCount: 0,
    })
  })
})

describe("item 49/160 — sortShowcaseComments", () => {
  const mk = (id: string, createdAt: string) => ({ id, createdAt })

  it("newest: terbaru dulu", () => {
    const list = [
      mk("a", "2026-09-26T10:00:00Z"),
      mk("b", "2026-09-28T10:00:00Z"),
      mk("c", "2026-09-27T10:00:00Z"),
    ]
    expect(sortShowcaseComments(list, "newest").map((c) => c.id)).toEqual(["b", "c", "a"])
  })

  it("oldest: terlama dulu", () => {
    const list = [
      mk("a", "2026-09-26T10:00:00Z"),
      mk("b", "2026-09-28T10:00:00Z"),
      mk("c", "2026-09-27T10:00:00Z"),
    ]
    expect(sortShowcaseComments(list, "oldest").map((c) => c.id)).toEqual(["a", "c", "b"])
  })

  it("createdAt tidak valid diperlakukan sebagai paling tua", () => {
    const list = [mk("a", "tidak-valid"), mk("b", "2026-09-28T10:00:00Z")]
    expect(sortShowcaseComments(list, "oldest").map((c) => c.id)).toEqual(["a", "b"])
    expect(sortShowcaseComments(list, "newest").map((c) => c.id)).toEqual(["b", "a"])
  })

  it("waktu seri dipecah lewat id secara deterministik", () => {
    const list = [mk("b", "2026-09-28T10:00:00Z"), mk("a", "2026-09-28T10:00:00Z")]
    expect(sortShowcaseComments(list, "newest").map((c) => c.id)).toEqual(["b", "a"])
    expect(sortShowcaseComments(list, "oldest").map((c) => c.id)).toEqual(["a", "b"])
  })

  it("tidak mengubah array asli", () => {
    const list = [mk("a", "2026-09-28T10:00:00Z"), mk("b", "2026-09-26T10:00:00Z")]
    sortShowcaseComments(list, "oldest")
    expect(list[0]?.id).toBe("a")
  })
})

describe("item 56 — cache status follow", () => {
  it("set/peek/clear round-trip (tidak memicu fetch)", () => {
    const username = "follow-cache-test"
    clearFollowStatusCache()
    // Belum pernah disentuh → undefined (bukan null "tak diketahui").
    expect(peekFollowStatus(username)).toBeUndefined()
    setFollowStatus(username, true)
    expect(peekFollowStatus(username)).toBe(true)
    // Set ulang dengan nilai sama → tidak berubah, tidak error.
    setFollowStatus(username, true)
    expect(peekFollowStatus(username)).toBe(true)
    setFollowStatus(username, false)
    expect(peekFollowStatus(username)).toBe(false)
    clearFollowStatusCache()
    expect(peekFollowStatus(username)).toBeUndefined()
  })
})
