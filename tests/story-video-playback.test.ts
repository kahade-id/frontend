/**
 * Story video & geser antar penulis (2026-10-10) — logika murni.
 *
 * - segmentDurationMs: video memakai durasi server (dibatasi 1–60 dtk) HANYA
 *   bila pemutar tersedia; foto/teks/APK lama = 5 dtk.
 * - swipeAuthorAction: geser ≥ 30% lebar atau flick ≥ 800 px/dtk; arah tanpa
 *   tetangga = "none" (viewer memantulkan).
 * - createFeedCache: TTL, LRU, dan dedup permintaan bersamaan (prefetch +
 *   buka manual = satu request).
 * - setPendingProgressLocal: dibulatkan 2 desimal; nilai sama tidak commit.
 */
import { beforeEach, describe, expect, it } from "vitest"

import { createFeedCache } from "@/lib/story/feed-cache"
import {
  addPendingStoryLocal,
  getStoryLocalState,
  resetStoryLocalState,
  setPendingProgressLocal,
  setPendingStatusLocal,
} from "@/lib/story/local-state"
import {
  STORY_SEGMENT_MS,
  SWIPE_AUTHOR_VELOCITY,
  segmentDurationMs,
  swipeAuthorAction,
} from "@/lib/story/playback"

describe("segmentDurationMs", () => {
  it("foto/teks = 5 dtk apa pun durationMs", () => {
    expect(segmentDurationMs({ kind: "image", durationMs: 20_000 })).toBe(STORY_SEGMENT_MS)
    expect(segmentDurationMs({ kind: "text", durationMs: null })).toBe(STORY_SEGMENT_MS)
  })

  it("video memakai durasi server, dibatasi 1–60 dtk", () => {
    expect(segmentDurationMs({ kind: "video", durationMs: 12_345 })).toBe(12_345)
    expect(segmentDurationMs({ kind: "video", durationMs: 500 })).toBe(1_000)
    expect(segmentDurationMs({ kind: "video", durationMs: 90_000 })).toBe(60_000)
  })

  it("video tanpa durasi / pemutar tak tersedia → 5 dtk (poster)", () => {
    expect(segmentDurationMs({ kind: "video", durationMs: null })).toBe(STORY_SEGMENT_MS)
    expect(segmentDurationMs({ kind: "video", durationMs: 0 })).toBe(STORY_SEGMENT_MS)
    expect(segmentDurationMs({ kind: "video", durationMs: 15_000 }, { videoPlayable: false })).toBe(STORY_SEGMENT_MS)
  })
})

describe("swipeAuthorAction", () => {
  const both = { hasNext: true, hasPrev: true }

  it("jarak ≥ 30% lebar → pindah; kurang → none", () => {
    expect(swipeAuthorAction(-120, 0, 400, both)).toBe("next")
    expect(swipeAuthorAction(120, 0, 400, both)).toBe("prev")
    expect(swipeAuthorAction(-100, 0, 400, both)).toBe("none")
  })

  it("flick cepat cukup walau jarak pendek", () => {
    expect(swipeAuthorAction(-30, -SWIPE_AUTHOR_VELOCITY, 400, both)).toBe("next")
    expect(swipeAuthorAction(30, SWIPE_AUTHOR_VELOCITY, 400, both)).toBe("prev")
  })

  it("arah tanpa tetangga → none (pantul)", () => {
    expect(swipeAuthorAction(-300, 0, 400, { hasNext: false, hasPrev: true })).toBe("none")
    expect(swipeAuthorAction(300, 0, 400, { hasNext: true, hasPrev: false })).toBe("none")
  })

  it("nilai tak hingga/NaN → none", () => {
    expect(swipeAuthorAction(Number.NaN, 0, 400, both)).toBe("none")
    expect(swipeAuthorAction(-300, Number.POSITIVE_INFINITY, 400, both)).toBe("none")
  })
})

describe("createFeedCache", () => {
  it("TTL: segar di dalam jendela, null setelahnya", () => {
    const cache = createFeedCache<string>({ ttlMs: 1_000 })
    cache.set("a", "A", 0)
    expect(cache.get("a", 500)).toBe("A")
    expect(cache.get("a", 1_500)).toBeNull()
    expect(cache.peek("a")).toBeNull()
  })

  it("LRU: melebihi kapasitas membuang yang paling lama tidak disentuh", () => {
    const cache = createFeedCache<number>({ max: 2 })
    cache.set("a", 1)
    cache.set("b", 2)
    cache.get("a") // a menjadi paling baru
    cache.set("c", 3)
    expect(cache.peek("b")).toBeNull()
    expect(cache.peek("a")).toBe(1)
    expect(cache.size()).toBe(2)
  })

  it("load: permintaan bersamaan untuk kunci sama = satu fetcher", async () => {
    const cache = createFeedCache<string>()
    let calls = 0
    let resolve!: (v: string) => void
    const fetcher = () => {
      calls++
      return new Promise<string>((r) => {
        resolve = r
      })
    }
    const p1 = cache.load("x", fetcher)
    const p2 = cache.load("x", fetcher)
    expect(cache.isLoading("x")).toBe(true)
    resolve("X")
    await expect(p1).resolves.toBe("X")
    await expect(p2).resolves.toBe("X")
    expect(calls).toBe(1)
    expect(cache.isLoading("x")).toBe(false)
    // Kini dari cache — fetcher tidak dipanggil lagi.
    await expect(cache.load("x", fetcher)).resolves.toBe("X")
    expect(calls).toBe(1)
  })

  it("load gagal → tidak ada entri, permintaan berikutnya mencoba lagi", async () => {
    const cache = createFeedCache<string>()
    let calls = 0
    const failing = () => {
      calls++
      return Promise.reject(new Error("x"))
    }
    await expect(cache.load("y", failing)).rejects.toThrow("x")
    expect(cache.peek("y")).toBeNull()
    await expect(cache.load("y", failing)).rejects.toThrow("x")
    expect(calls).toBe(2)
  })

  it("invalidate: satu kunci atau semua", () => {
    const cache = createFeedCache<number>()
    cache.set("a", 1)
    cache.set("b", 2)
    cache.invalidate("a")
    expect(cache.peek("a")).toBeNull()
    expect(cache.peek("b")).toBe(2)
    cache.invalidate()
    expect(cache.size()).toBe(0)
  })
})

describe("progress unggahan story", () => {
  beforeEach(() => resetStoryLocalState())

  function pending() {
    addPendingStoryLocal({
      localId: "p1",
      kind: "video",
      mediaUri: "file:///v.mp4",
      text: null,
      backgroundColor: null,
      createdAt: 0,
      status: "uploading",
      progress: null,
      error: null,
    })
  }

  it("dibulatkan 2 desimal & dijepit 0..1; nilai sama tidak memicu revisi state", () => {
    pending()
    setPendingProgressLocal("p1", 0.123456)
    expect(getStoryLocalState().pending[0]?.progress).toBe(0.12)
    const before = getStoryLocalState()
    setPendingProgressLocal("p1", 0.1249)
    expect(getStoryLocalState()).toBe(before) // tidak ada commit untuk perubahan tak terlihat
    setPendingProgressLocal("p1", 7)
    expect(getStoryLocalState().pending[0]?.progress).toBe(1)
    setPendingProgressLocal("p1", Number.NaN)
    expect(getStoryLocalState().pending[0]?.progress).toBe(0)
  })

  it("gagal menyimpan pesan & mengosongkan progress; ulang menghapus pesan", () => {
    pending()
    setPendingProgressLocal("p1", 0.5)
    setPendingStatusLocal("p1", "failed", "Koneksi lambat, coba lagi")
    const failed = getStoryLocalState().pending[0]
    expect(failed?.status).toBe("failed")
    expect(failed?.error).toBe("Koneksi lambat, coba lagi")
    expect(failed?.progress).toBeNull()
    setPendingStatusLocal("p1", "uploading")
    expect(getStoryLocalState().pending[0]?.error).toBeNull()
  })
})
