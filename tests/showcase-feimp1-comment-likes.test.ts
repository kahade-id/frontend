import { describe, expect, it } from "vitest"
import {
  clearShowcaseCommentLikes,
  resolveShowcaseCommentLike,
  toggleShowcaseCommentLike,
} from "@/lib/showcase-comment-likes"

describe("Like komentar lokal (FE-IMP-1 item 48)", () => {
  it("default: belum disukai, count 0", () => {
    clearShowcaseCommentLikes()
    expect(resolveShowcaseCommentLike("c1")).toEqual({ isLiked: false, likeCount: 0 })
  })

  it("toggle menaikkan lalu menurunkan count", () => {
    clearShowcaseCommentLikes()
    expect(toggleShowcaseCommentLike("c1")).toEqual({ isLiked: true, likeCount: 1 })
    expect(toggleShowcaseCommentLike("c1")).toEqual({ isLiked: false, likeCount: 0 })
  })

  it("count tidak pernah negatif saat override false tanpa base", () => {
    clearShowcaseCommentLikes()
    // override false hanya mungkin dari toggle ganda → aman
    toggleShowcaseCommentLike("c1")
    toggleShowcaseCommentLike("c1")
    expect(resolveShowcaseCommentLike("c1").likeCount).toBe(0)
  })

  it("base server (bila suatu hari backend mengirim) dihormati + delta", () => {
    clearShowcaseCommentLikes()
    expect(resolveShowcaseCommentLike("c2", { isLiked: false, likeCount: 5 })).toEqual({
      isLiked: false,
      likeCount: 5,
    })
    toggleShowcaseCommentLike("c2", { isLiked: false, likeCount: 5 })
    expect(resolveShowcaseCommentLike("c2", { isLiked: false, likeCount: 5 })).toEqual({
      isLiked: true,
      likeCount: 6,
    })
    toggleShowcaseCommentLike("c2", { isLiked: true, likeCount: 6 })
    expect(resolveShowcaseCommentLike("c2", { isLiked: true, likeCount: 6 })).toEqual({
      isLiked: false,
      likeCount: 5,
    })
  })

  it("base negatif / NaN difail-closed ke 0", () => {
    clearShowcaseCommentLikes()
    expect(resolveShowcaseCommentLike("c3", { likeCount: -10 })).toEqual({ isLiked: false, likeCount: 0 })
    expect(resolveShowcaseCommentLike("c4", { likeCount: NaN })).toEqual({ isLiked: false, likeCount: 0 })
  })

  it("komentar berbeda punya override independen", () => {
    clearShowcaseCommentLikes()
    toggleShowcaseCommentLike("a")
    expect(resolveShowcaseCommentLike("b").isLiked).toBe(false)
    expect(resolveShowcaseCommentLike("a").isLiked).toBe(true)
  })
})
