/**
 * Test batch 139 area C — ronde 3 (Feed & Etalase), logika murni.
 *
 * Cakupan:
 *  - C02: kunci cache posisi, guard pemulihan (anchor), pemilihan anchor.
 *  - C03: rekonsiliasi daftar (refresh ganti, more gabung).
 *  - C09: moveMediaToFront / moveMediaItem / canSetAsCover.
 *  - C10: validasi relasi harga min–maks.
 *  - C13: transisi optimistis like/save.
 *  - C14: findShowcaseComment + batas pencarian halaman deep link.
 */
import { describe, expect, it } from "vitest"

import {
  buildFeedPositionKey,
  isFeedPositionRestorable,
  selectTopVisibleAnchor,
} from "@/lib/showcase-feed-position"
import { reconcileFeedItems } from "@/lib/showcase-feed-logic"
import {
  canSetAsCover,
  moveMediaItem,
  moveMediaToFront,
} from "@/lib/showcase-media-order"
import { isPriceRangeValid } from "@/lib/rupiah-input"
import { findShowcaseComment, optimisticToggleState, shouldFetchNextCommentPage } from "@/lib/showcase-social"
import type {
  ShowcaseCommentWithReplies,
  ShowcaseSocialItem,
} from "@/lib/api/showcase"

function feedItem(id: string): ShowcaseSocialItem {
  return {
    id,
    title: `Karya ${id}`,
    images: [],
    likeCount: 0,
    commentCount: 0,
    viewCount: 0,
    saveCount: 0,
    createdAt: "2026-09-28T00:00:00.000Z",
    updatedAt: "2026-09-28T00:00:00.000Z",
    author: { userId: "u1", username: "penjual", fullName: null },
  }
}

function comment(id: string, replies: string[] = []): ShowcaseCommentWithReplies {
  return {
    id,
    showcaseId: "s1",
    content: `komentar ${id}`,
    createdAt: "2026-09-28T00:00:00.000Z",
    author: { userId: "u1", username: "a", fullName: null },
    replies: replies.map((rid) => ({
      id: rid,
      showcaseId: "s1",
      parentId: id,
      content: `balasan ${rid}`,
      createdAt: "2026-09-28T00:00:00.000Z",
      author: { userId: "u2", username: "b", fullName: null },
    })),
  }
}

describe("C02 — cache posisi scroll feed", () => {
  it("kunci unik per tab × filter × revision", () => {
    const a = buildFeedPositionKey("latest", 3, { q: "tas" })
    const b = buildFeedPositionKey("popular", 3, { q: "tas" })
    const c = buildFeedPositionKey("latest", 4, { q: "tas" })
    const d = buildFeedPositionKey("latest", 3, { q: "sepatu" })
    const e = buildFeedPositionKey("latest", 3, { q: "tas" })
    expect(new Set([a, b, c, d]).size).toBe(4)
    expect(a).toBe(e)
  })

  it("tidak pulihkan bila tak ada simpanan / offset nol", () => {
    expect(isFeedPositionRestorable(undefined, ["x"])).toBe(false)
    expect(isFeedPositionRestorable({ offset: 0, anchorId: null }, ["x"])).toBe(false)
    expect(isFeedPositionRestorable({ offset: -10, anchorId: null }, ["x"])).toBe(false)
  })

  it("pulihkan bila tanpa anchor (offset positif)", () => {
    expect(isFeedPositionRestorable({ offset: 420, anchorId: null }, [])).toBe(true)
  })

  it("pulihkan hanya bila anchor masih ada di dataset", () => {
    const saved = { offset: 420, anchorId: "a2" }
    expect(isFeedPositionRestorable(saved, ["a1", "a2", "a3"])).toBe(true)
    expect(isFeedPositionRestorable(saved, ["a1", "a3"])).toBe(false)
    expect(isFeedPositionRestorable(saved, new Set(["a2"]))).toBe(true)
    expect(isFeedPositionRestorable(saved, new Set(["zz"]))).toBe(false)
  })

  it("anchor = item terlihat berindeks terkecil", () => {
    const items = [feedItem("a"), feedItem("b"), feedItem("c")]
    const top = selectTopVisibleAnchor([
      { item: items[2], index: 5 },
      { item: items[0], index: 2 },
      { item: items[1], index: 3 },
    ])
    expect(top?.id).toBe("a")
  })

  it("anchor null bila tidak ada item terlihat", () => {
    expect(selectTopVisibleAnchor([])).toBeNull()
  })
})

describe("C03 — refresh tidak mengosongkan feed", () => {
  const oldItems = [feedItem("a"), feedItem("b")]
  const fresh = [feedItem("b"), feedItem("c")]

  it("refresh/initial: daftar diganti data baru", () => {
    expect(reconcileFeedItems("refresh", oldItems, fresh).map((i) => i.id)).toEqual(["b", "c"])
    expect(reconcileFeedItems("initial", oldItems, fresh).map((i) => i.id)).toEqual(["b", "c"])
  })

  it("refresh tidak memutasi array lama", () => {
    const prev = [...oldItems]
    reconcileFeedItems("refresh", oldItems, fresh)
    expect(oldItems.map((i) => i.id)).toEqual(prev.map((i) => i.id))
  })

  it("more: halaman baru digabung, posisi lama dipertahankan, dedup", () => {
    const merged = reconcileFeedItems("more", oldItems, [feedItem("b"), feedItem("c")])
    expect(merged.map((i) => i.id)).toEqual(["a", "b", "c"])
  })
})

describe("C09 — urutan & sampul media", () => {
  const list = ["m1", "m2", "m3", "m4"]

  it("moveMediaToFront memindahkan ke indeks 0, sisanya bergeser", () => {
    expect(moveMediaToFront(list, 2)).toEqual(["m3", "m1", "m2", "m4"])
  })

  it("moveMediaToFront tak valid → salinan tanpa perubahan", () => {
    expect(moveMediaToFront(list, 0)).toEqual(list)
    expect(moveMediaToFront(list, 9)).toEqual(list)
    expect(moveMediaToFront(list, -1)).toEqual(list)
    // tidak memutasi aslinya
    expect(list).toEqual(["m1", "m2", "m3", "m4"])
  })

  it("moveMediaItem memindahkan dari→ke dua arah", () => {
    expect(moveMediaItem(list, 0, 3)).toEqual(["m2", "m3", "m4", "m1"])
    expect(moveMediaItem(list, 3, 0)).toEqual(["m4", "m1", "m2", "m3"])
    expect(moveMediaItem(list, 1, 2)).toEqual(["m1", "m3", "m2", "m4"])
  })

  it("moveMediaItem tak valid / sama → tanpa perubahan", () => {
    expect(moveMediaItem(list, 1, 1)).toEqual(list)
    expect(moveMediaItem(list, -1, 2)).toEqual(list)
    expect(moveMediaItem(list, 1, 9)).toEqual(list)
    expect(list).toEqual(["m1", "m2", "m3", "m4"])
  })

  it("canSetAsCover hanya untuk indeks > 0 yang valid", () => {
    expect(canSetAsCover(4, 2)).toBe(true)
    expect(canSetAsCover(4, 0)).toBe(false)
    expect(canSetAsCover(4, 4)).toBe(false)
  })
})

describe("C10 — validasi relasi harga min–maks", () => {
  it("valid bila salah satu/belum diisi", () => {
    expect(isPriceRangeValid(null, null)).toBe(true)
    expect(isPriceRangeValid(undefined, 1000)).toBe(true)
    expect(isPriceRangeValid(500, null)).toBe(true)
  })

  it("valid bila min <= maks (termasuk sama)", () => {
    expect(isPriceRangeValid(1000, 2000)).toBe(true)
    expect(isPriceRangeValid(1500, 1500)).toBe(true)
    expect(isPriceRangeValid(0, 0)).toBe(true)
  })

  it("tidak valid bila min > maks", () => {
    expect(isPriceRangeValid(2000, 1000)).toBe(false)
    expect(isPriceRangeValid(1, 0)).toBe(false)
  })
})

describe("C13 — optimistic like/save dengan rollback", () => {
  it("toggle on: status dibalik, hitungan +1", () => {
    expect(optimisticToggleState({ active: false, count: 5 })).toEqual({ active: true, count: 6 })
  })

  it("toggle off: status dibalik, hitungan -1", () => {
    expect(optimisticToggleState({ active: true, count: 5 })).toEqual({ active: false, count: 4 })
  })

  it("hitungan dijepit di 0 (tidak negatif)", () => {
    expect(optimisticToggleState({ active: true, count: 0 })).toEqual({ active: false, count: 0 })
  })

  it("rollback = terapkan ulang snapshot sebelumnya", () => {
    const previous = { active: false, count: 5 }
    const optimistic = optimisticToggleState(previous)
    expect(optimistic).toEqual({ active: true, count: 6 })
    // hook mengembalikan `previous` apa adanya saat gagal:
    expect(previous).toEqual({ active: false, count: 5 })
  })
})

describe("C14 — fokus komentar deep link", () => {
  const comments = [comment("c1", ["r1", "r2"]), comment("c2"), comment("c3", ["r3"])]

  it("menemukan komentar root", () => {
    const found = findShowcaseComment(comments, "c2")
    expect(found?.root.id).toBe("c2")
    expect(found?.reply).toBeNull()
  })

  it("menemukan balasan beserta root-nya", () => {
    const found = findShowcaseComment(comments, "r3")
    expect(found?.root.id).toBe("c3")
    expect(found?.reply?.id).toBe("r3")
  })

  it("null bila tidak ada / daftar kosong", () => {
    expect(findShowcaseComment(comments, "hilang")).toBeNull()
    expect(findShowcaseComment([], "c1")).toBeNull()
  })

  it("lanjut cari bila target belum ketemu & masih ada halaman (bounded)", () => {
    const base = {
      commentId: "r9",
      focusDone: false,
      targetFound: false,
      commentsStatus: "idle",
      maxPages: 5,
    }
    expect(shouldFetchNextCommentPage({ ...base, commentsPage: 1 })).toBe(true)
    expect(shouldFetchNextCommentPage({ ...base, commentsPage: 4 })).toBe(true)
  })

  it("berhenti: ketemu / selesai fokus / halaman habis / batas tercapai", () => {
    const base = {
      commentId: "r9",
      focusDone: false,
      targetFound: false,
      commentsStatus: "idle",
      commentsPage: 2,
      maxPages: 5,
    }
    expect(shouldFetchNextCommentPage({ ...base, targetFound: true })).toBe(false)
    expect(shouldFetchNextCommentPage({ ...base, focusDone: true })).toBe(false)
    expect(shouldFetchNextCommentPage({ ...base, commentId: undefined })).toBe(false)
    expect(shouldFetchNextCommentPage({ ...base, commentsStatus: "loading" })).toBe(false)
    expect(shouldFetchNextCommentPage({ ...base, commentsStatus: "end" })).toBe(false)
    expect(shouldFetchNextCommentPage({ ...base, commentsPage: 5 })).toBe(false)
    expect(shouldFetchNextCommentPage({ ...base, commentsPage: 9 })).toBe(false)
  })
})
