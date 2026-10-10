/**
 * Audit Pesan 2026-10-10 (#9e): bintang/batal bintang OPTIMISTIS dengan
 * rollback per pesan — satu kegagalan tidak membatalkan yang lain.
 */
import { describe, expect, it, vi } from "vitest"

import type { ChatMessage } from "@/lib/api/chat"
import { applyStarChange } from "@/lib/chat-message-actions"

const msg = (id: string, isStarred = false): ChatMessage => ({
  id,
  messageType: "TEXT",
  fromUser: true,
  createdAt: "2026-10-10T10:00:00.000Z",
  text: id,
  isStarred,
})

function harness(initial: ChatMessage[]) {
  let state = initial
  const snapshots: ChatMessage[][] = []
  const setMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    state = updater(state)
    snapshots.push(state)
  }
  return { get: () => state, setMessages, snapshots }
}

describe("applyStarChange", () => {
  it("bintang diterapkan SEBELUM request pertama selesai (optimistis)", async () => {
    const h = harness([msg("a"), msg("b"), msg("c")])
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    const star = vi.fn(async () => {
      await gate
    })
    const pending = applyStarChange({
      roomId: "room",
      targets: [h.get()[0], h.get()[1]],
      wantStar: true,
      star,
      unstar: vi.fn(),
      setMessages: h.setMessages,
    })
    // Sinkron: sudah berbintang walau server belum menjawab.
    expect(h.get().map((m) => m.isStarred)).toEqual([true, true, false])
    release()
    const result = await pending
    expect(result.changed.map((m) => m.id)).toEqual(["a", "b"])
    expect(result.failed).toEqual([])
    expect(star).toHaveBeenCalledTimes(2)
  })

  it("hanya pesan yang ditolak server dikembalikan ke nilai semula", async () => {
    const h = harness([msg("a"), msg("b", true), msg("c")])
    const star = vi.fn(async (_room: string, id: string) => {
      if (id === "c") throw new Error("ditolak")
    })
    const result = await applyStarChange({
      roomId: "room",
      // "b" sudah berbintang; "c" akan ditolak → kembali ke false.
      targets: h.get(),
      wantStar: true,
      star,
      unstar: vi.fn(),
      setMessages: h.setMessages,
    })
    expect(h.get().map((m) => m.isStarred)).toEqual([true, true, false])
    expect(result.changed.map((m) => m.id)).toEqual(["a", "b"])
    expect(result.failed.map((f) => f.message.id)).toEqual(["c"])
  })

  it("batal bintang: rollback mengembalikan ke true hanya untuk yang gagal", async () => {
    const h = harness([msg("a", true), msg("b", true)])
    const unstar = vi.fn(async (_room: string, id: string) => {
      if (id === "a") throw new Error("offline")
    })
    await applyStarChange({
      roomId: "room",
      targets: h.get(),
      wantStar: false,
      star: vi.fn(),
      unstar,
      setMessages: h.setMessages,
    })
    expect(h.get().map((m) => m.isStarred)).toEqual([true, false])
  })

  it("tanpa target → tidak menyentuh state dan tidak memanggil server", async () => {
    const h = harness([msg("a")])
    const star = vi.fn()
    const result = await applyStarChange({
      roomId: "room",
      targets: [],
      wantStar: true,
      star,
      unstar: vi.fn(),
      setMessages: h.setMessages,
    })
    expect(result).toEqual({ changed: [], failed: [] })
    expect(h.snapshots).toEqual([])
    expect(star).not.toHaveBeenCalled()
  })
})
