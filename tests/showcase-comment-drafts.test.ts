/**
 * Test draft komentar etalase per-item (lib/showcase-comment-drafts.ts).
 *
 * B2-SC-06: draft menyimpan {text, replyToId}; mengetik tidak menghapus
 * konteks reply; nilai persist lama (string mentah) tetap terbaca.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  __resetShowcaseCommentDraftsForTest,
  SHOWCASE_COMMENT_DRAFT_PERSIST_DEBOUNCE_MS,
  clearShowcaseCommentDraft,
  loadShowcaseCommentDraft,
  peekShowcaseCommentDraft,
  saveShowcaseCommentDraft,
  setShowcaseCommentDraftReply,
} from "@/lib/showcase-comment-drafts"
import { getRawItem, setRawItem, showcaseCommentDraftKey } from "@/lib/secure-storage"

beforeEach(() => {
  vi.useFakeTimers()
  __resetShowcaseCommentDraftsForTest()
})

afterEach(() => {
  vi.useRealTimers()
  __resetShowcaseCommentDraftsForTest()
})

async function flushPersist() {
  vi.advanceTimersByTime(SHOWCASE_COMMENT_DRAFT_PERSIST_DEBOUNCE_MS)
  await vi.advanceTimersByTimeAsync(0)
}

describe("showcase comment drafts", () => {
  it("menyimpan {text, replyToId} sinkron di memory", () => {
    saveShowcaseCommentDraft("item-a", "komentar", "cmt-1")
    expect(peekShowcaseCommentDraft("item-a")).toEqual({ text: "komentar", replyToId: "cmt-1" })
    expect(peekShowcaseCommentDraft("item-b")).toBeUndefined()
  })

  it("replyToId pulih dari storage setelah buka ulang", async () => {
    saveShowcaseCommentDraft("item-a", "balas ini", "cmt-9")
    await flushPersist()
    __resetShowcaseCommentDraftsForTest()
    expect(await loadShowcaseCommentDraft("item-a")).toEqual({ text: "balas ini", replyToId: "cmt-9" })
  })

  it("mengetik tidak menghapus konteks reply", () => {
    saveShowcaseCommentDraft("item-a", "awal", "cmt-1")
    saveShowcaseCommentDraft("item-a", "awal + lanjut")
    expect(peekShowcaseCommentDraft("item-a")).toEqual({ text: "awal + lanjut", replyToId: "cmt-1" })
  })

  it("setShowcaseCommentDraftReply update reply tanpa sentuh teks", async () => {
    saveShowcaseCommentDraft("item-a", "ketikan")
    setShowcaseCommentDraftReply("item-a", "cmt-5")
    expect(peekShowcaseCommentDraft("item-a")).toEqual({ text: "ketikan", replyToId: "cmt-5" })
    setShowcaseCommentDraftReply("item-a", null)
    expect(peekShowcaseCommentDraft("item-a")).toEqual({ text: "ketikan", replyToId: null })
    await flushPersist()
    __resetShowcaseCommentDraftsForTest()
    expect(await loadShowcaseCommentDraft("item-a")).toEqual({ text: "ketikan", replyToId: null })
  })

  it("nilai lama (string mentah) terbaca sebagai teks tanpa reply", async () => {
    await setRawItem(showcaseCommentDraftKey("item-a"), "draft lama")
    expect(await loadShowcaseCommentDraft("item-a")).toEqual({ text: "draft lama", replyToId: null })
  })

  it("clear menghapus memory + storage", async () => {
    saveShowcaseCommentDraft("item-a", "x", "cmt-1")
    await flushPersist()
    clearShowcaseCommentDraft("item-a")
    await vi.advanceTimersByTimeAsync(0)
    expect(peekShowcaseCommentDraft("item-a")).toBeUndefined()
    expect(await getRawItem(showcaseCommentDraftKey("item-a"))).toBeNull()
    expect(await loadShowcaseCommentDraft("item-a")).toBeNull()
  })
})
