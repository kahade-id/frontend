/**
 * Audit chat F15 — jendela render daftar chat (ribuan ruang) dan batas join
 * socket untuk indikator mengetik.
 */
import { describe, expect, it } from "vitest"

import {
  CHAT_LIST_WINDOWING,
  TYPING_JOIN_MAX_ROOMS,
  limitTypingRoomIds,
} from "@/lib/chat-list-windowing"
import { FEED_LIST_WINDOWING } from "@/lib/list-windowing"

describe("CHAT_LIST_WINDOWING", () => {
  it("layar pertama terisi: initialNumToRender menutup 8–10 baris rapat + cadangan", () => {
    expect(CHAT_LIST_WINDOWING.initialNumToRender).toBeGreaterThanOrEqual(10)
    expect(CHAT_LIST_WINDOWING.initialNumToRender).toBeGreaterThan(FEED_LIST_WINDOWING.initialNumToRender)
  })

  it("jendela lebih sempit dari feed (tiap baris memegang gestur swipe) tapi cukup untuk fling", () => {
    expect(CHAT_LIST_WINDOWING.windowSize).toBeLessThan(FEED_LIST_WINDOWING.windowSize)
    expect(CHAT_LIST_WINDOWING.windowSize).toBeGreaterThanOrEqual(5)
  })

  it("batch lukis tidak menyumbat thread JS", () => {
    expect(CHAT_LIST_WINDOWING.maxToRenderPerBatch).toBeLessThanOrEqual(10)
    expect(CHAT_LIST_WINDOWING.updateCellsBatchingPeriod).toBeLessThanOrEqual(50)
  })

  it("tuning feed TIDAK berubah (daftar lain tidak terpengaruh)", () => {
    expect(FEED_LIST_WINDOWING).toEqual({ initialNumToRender: 6, maxToRenderPerBatch: 6, windowSize: 11 })
  })
})

describe("limitTypingRoomIds", () => {
  const ids = Array.from({ length: 1_000 }, (_, i) => `room-${i}`)

  it("hanya ruang teratas (urutan daftar dipertahankan) yang di-join", () => {
    const limited = limitTypingRoomIds(ids)
    expect(limited).toHaveLength(TYPING_JOIN_MAX_ROOMS)
    expect(limited[0]).toBe("room-0")
    expect(limited[TYPING_JOIN_MAX_ROOMS - 1]).toBe(`room-${TYPING_JOIN_MAX_ROOMS - 1}`)
  })

  it("daftar kecil tidak dipotong; batas kustom dan nol dihormati", () => {
    expect(limitTypingRoomIds(["a", "b"])).toEqual(["a", "b"])
    expect(limitTypingRoomIds(ids, 3)).toEqual(["room-0", "room-1", "room-2"])
    expect(limitTypingRoomIds(ids, 0)).toEqual([])
    expect(limitTypingRoomIds(ids, -5)).toEqual([])
  })

  it("batas wajar: ribuan ruang tidak berarti ribuan join", () => {
    expect(TYPING_JOIN_MAX_ROOMS).toBeLessThanOrEqual(100)
    expect(TYPING_JOIN_MAX_ROOMS).toBeGreaterThanOrEqual(20)
  })
})
