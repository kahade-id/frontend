import { beforeEach, describe, expect, it } from "vitest"

import {
  STORY_LIFETIME_MS,
  STORY_TEXT_MAX,
  isStoryActive,
  storyRemainingMs,
  type Story,
  type StoryTray,
} from "@/lib/api/story"
import {
  STORY_SEGMENT_MS,
  clampIndex,
  remainingSegmentMs,
  stepBack,
  stepForward,
  tapActionAt,
} from "@/lib/story/playback"
import {
  addPendingStoryLocal,
  getStoryLocalState,
  hideStoryLocal,
  markAuthorSeenLocal,
  markStorySeenLocal,
  resetStoryLocalState,
  runOptimistic,
  setMutedLocal,
  setReactionLocal,
} from "@/lib/story/local-state"
import { applyTrayOverlay, sortTrayOthers } from "@/lib/story/tray"
import {
  askStockPrefill,
  buildCreateInput,
  emptyStoryDraft,
  formatPriceSticker,
  parsePriceInput,
  validateStoryDraft,
} from "@/lib/story/compose"

const author = (id: string) => ({ userId: id, username: id, fullName: id, avatarUrl: null })

function story(overrides: Partial<Story> = {}): Story {
  const now = Date.now()
  return {
    id: "s1",
    author: author("a"),
    kind: "text",
    mediaUrl: null,
    thumbnailUrl: null,
    durationMs: null,
    text: "hai",
    backgroundColor: "#1F2937",
    productTags: [],
    priceSticker: null,
    askStock: null,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + STORY_LIFETIME_MS).toISOString(),
    viewed: false,
    viewCount: 0,
    myReaction: null,
    audience: null,
    ...overrides,
  }
}

beforeEach(() => resetStoryLocalState())

describe("playback", () => {
  it("zona tap: kiri mundur, kanan maju, tengah diam", () => {
    expect(tapActionAt(0.1)).toBe("back")
    expect(tapActionAt(0.5)).toBe("none")
    expect(tapActionAt(0.9)).toBe("forward")
    expect(tapActionAt(Number.NaN)).toBe("none")
  })

  it("maju: pindah story, lalu penulis berikutnya, lalu tutup", () => {
    expect(stepForward(0, 3, true)).toEqual({ kind: "index", index: 1 })
    expect(stepForward(2, 3, true)).toEqual({ kind: "next-author" })
    expect(stepForward(2, 3, false)).toEqual({ kind: "close" })
  })

  it("mundur: di story pertama kembali ke penulis sebelumnya, atau tetap", () => {
    expect(stepBack(2, false)).toEqual({ kind: "index", index: 1 })
    expect(stepBack(0, true)).toEqual({ kind: "prev-author" })
    expect(stepBack(0, false)).toEqual({ kind: "index", index: 0 })
  })

  it("sisa durasi setelah tekan-tahan dihitung dari fraksi yang sudah lewat", () => {
    expect(remainingSegmentMs(0)).toBe(STORY_SEGMENT_MS)
    expect(remainingSegmentMs(0.4)).toBe(3000)
    expect(remainingSegmentMs(1)).toBe(0)
    expect(remainingSegmentMs(5)).toBe(0)
  })

  it("clampIndex membatasi ke rentang valid", () => {
    expect(clampIndex(-3, 4)).toBe(0)
    expect(clampIndex(9, 4)).toBe(3)
    expect(clampIndex(1.7, 4)).toBe(1)
    expect(clampIndex(0, 0)).toBe(0)
  })
})

describe("kedaluwarsa (jam server)", () => {
  it("story aktif sebelum expiresAt, tidak aktif sesudahnya", () => {
    const s = story()
    expect(isStoryActive(s)).toBe(true)
    const later = Date.parse(s.expiresAt) + 1
    expect(isStoryActive(s, later)).toBe(false)
    expect(storyRemainingMs(s, later)).toBe(0)
  })
})

describe("compose", () => {
  it("harga: hanya digit, menolak nol dan melebihi batas", () => {
    expect(parsePriceInput("1.500.000")).toBe(1_500_000)
    expect(parsePriceInput("")).toBeNull()
    expect(parsePriceInput("0")).toBeNull()
    expect(parsePriceInput("9999999999")).toBeNull()
    expect(formatPriceSticker(350000)).toMatch(/^Rp 350.000$/)
  })

  it("validasi: foto wajib, teks wajib & batas panjang, tag maks", () => {
    const img = emptyStoryDraft("image")
    expect(validateStoryDraft(img)).toBe("media-required")
    expect(validateStoryDraft({ ...img, mediaId: "m1" })).toBeNull()

    const txt = emptyStoryDraft("text")
    expect(validateStoryDraft(txt)).toBe("text-required")
    expect(validateStoryDraft({ ...txt, text: "x".repeat(STORY_TEXT_MAX + 1) })).toBe("text-too-long")
    expect(validateStoryDraft({ ...txt, text: "ok", priceText: "abc" })).toBe("price-invalid")
    const tags = Array.from({ length: 6 }, (_, i) => ({ productId: `p${i}`, title: "", x: 0, y: 0 }))
    expect(validateStoryDraft({ ...txt, text: "ok", productTags: tags })).toBe("too-many-tags")
  })

  it("buildCreateInput menormalkan tag dan menyusun stiker harga", () => {
    const input = buildCreateInput({
      ...emptyStoryDraft("text"),
      text: "  Restock  ",
      priceText: "250000",
      askStock: true,
      askStockProductId: null,
      productTags: [{ productId: "p1", title: "A", x: 2, y: -1 }],
    })
    expect(input.text).toBe("Restock")
    expect(input.priceSticker).toEqual({ amount: 250000 })
    expect(input.askStock).toEqual({ productId: null })
    expect(input.productTags).toEqual([{ productId: "p1", x: 1, y: 0 }])
    expect(input.audience).toEqual({ mode: "all_savers" })
  })

  it("prefill Tanya Stok memasukkan nama produk bila ada", () => {
    expect(askStockPrefill("Sepatu Lari")).toContain("Sepatu Lari")
    expect(askStockPrefill(null)).not.toContain("{produk}")
  })
})

describe("overlay tray", () => {
  const tray: StoryTray = {
    own: null,
    others: [
      { author: author("a"), storyCount: 2, latestAt: "2026-10-08T10:00:00Z", hasUnseen: true, muted: false },
      { author: author("b"), storyCount: 1, latestAt: "2026-10-08T11:00:00Z", hasUnseen: false, muted: false },
      { author: author("c"), storyCount: 1, latestAt: "2026-10-08T12:00:00Z", hasUnseen: true, muted: false },
    ],
  }

  it("penulis yang sudah ditandai dilihat kehilangan ring belum-dilihat", () => {
    markAuthorSeenLocal("c", true)
    const out = applyTrayOverlay(tray, getStoryLocalState())
    expect(out.others.find((e) => e.author.userId === "c")?.hasUnseen).toBe(false)
  })

  it("bisu menurunkan ke bawah; urutan belum-dilihat lalu terbaru", () => {
    setMutedLocal("c", true)
    const out = applyTrayOverlay(tray, getStoryLocalState())
    expect(out.others.map((e) => e.author.userId)).toEqual(["a", "b", "c"])
    expect(sortTrayOthers(out.others)[2].author.userId).toBe("c")
  })

  it("hapus optimistis mengurangi jumlah dan membuang penulis yang habis", () => {
    hideStoryLocal("s-b", "b")
    const out = applyTrayOverlay(tray, getStoryLocalState())
    expect(out.others.find((e) => e.author.userId === "b")).toBeUndefined()
  })
})

describe("optimistic + rollback", () => {
  it("reaksi gagal → overlay dikembalikan ke keadaan semula", async () => {
    const result = await runOptimistic(
      () => setReactionLocal("s1", "🔥"),
      async () => {
        throw new Error("jaringan")
      },
    )
    expect(result.ok).toBe(false)
    expect(getStoryLocalState().reactions.has("s1")).toBe(false)
  })

  it("reaksi sukses → overlay tetap", async () => {
    const result = await runOptimistic(
      () => setReactionLocal("s1", "🔥"),
      async () => "ok",
    )
    expect(result.ok).toBe(true)
    expect(getStoryLocalState().reactions.get("s1")).toBe("🔥")
  })

  it("tandai dilihat gagal → rollback menghapus tanda", async () => {
    await runOptimistic(
      () => markStorySeenLocal("s9"),
      async () => {
        throw new Error("x")
      },
    )
    expect(getStoryLocalState().seenStoryIds.has("s9")).toBe(false)
  })

  it("unggahan pending bisa dibatalkan (rollback)", () => {
    const undo = addPendingStoryLocal({
      localId: "p1",
      kind: "text",
      mediaUri: null,
      text: "x",
      backgroundColor: null,
      createdAt: 0,
      status: "uploading",
      progress: null,
      error: null,
    })
    expect(getStoryLocalState().pending).toHaveLength(1)
    undo()
    expect(getStoryLocalState().pending).toHaveLength(0)
  })
})
