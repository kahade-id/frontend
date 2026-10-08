/**
 * Audit chat B5 — status baca pesan saya (jam → centang → centang ganda)
 * harus ikut berubah secara realtime, tidak hanya saat ruang dibuka ulang.
 *
 * Dikunci:
 *   - status baca MONOTON: hasil GET /read-receipts yang tertinggal dari event
 *     socket tidak boleh menghapus centang ganda yang sudah tampil,
 *   - event baca MASSAL langsung menaikkan semua pesan saya yang terkonfirmasi
 *     hingga `readAt` (tanpa menunggu jaringan), pesan optimistis/lawan tidak,
 *   - event satu pesan hanya menaikkan pesan itu,
 *   - event sinkronisasi perangkat sendiri sampai ke layar dengan penanda
 *     `ownDeviceSync` (bukan lawan bicara membaca pesan saya).
 */
import { describe, expect, it } from "vitest"

import type { ChatMessage } from "@/lib/api/chat"
import {
  mergeReadIds,
  messagesReadByEvent,
  readIdsFromReceipts,
} from "@/lib/chat-read-receipts"
import { CHAT_SOCKET_EVENTS } from "@/lib/realtime/chat-events"
import { createChatRoomHandlers } from "@/lib/realtime/use-chat-room"

const t = (minute: number) => new Date(Date.UTC(2026, 9, 7, 8, minute)).toISOString()

function mine(id: string, minute: number, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id, messageType: "TEXT", fromUser: true, createdAt: t(minute), text: id, ...extra }
}

describe("mergeReadIds (monoton)", () => {
  it("menambah id baru dan TIDAK menghapus yang lama", () => {
    const prev = new Set(["a", "b"])
    const next = mergeReadIds(prev, ["c"])
    expect([...next].sort()).toEqual(["a", "b", "c"])
    // Receipts basi yang tidak memuat "b" tidak menghapusnya.
    expect(mergeReadIds(next, ["a"]).has("b")).toBe(true)
  })

  it("mengembalikan himpunan lama bila tak ada yang baru (bail-out tanpa render)", () => {
    const prev = new Set(["a"])
    expect(mergeReadIds(prev, ["a"])).toBe(prev)
    expect(mergeReadIds(prev, [])).toBe(prev)
    expect(mergeReadIds(prev, [""])).toBe(prev)
  })

  it("readIdsFromReceipts hanya yang isRead", () => {
    expect(
      readIdsFromReceipts([
        { messageId: "a", isRead: true },
        { messageId: "b", isRead: false },
        { messageId: "c", isRead: true },
      ]),
    ).toEqual(["a", "c"])
  })
})

describe("messagesReadByEvent", () => {
  const thread: ChatMessage[] = [
    mine("m1", 1),
    mine("m2", 2),
    mine("m3", 5),
    { id: "theirs", messageType: "TEXT", fromUser: false, createdAt: t(3), text: "x" },
    mine("temp-key", 6, { sendStatus: "sending" }),
    mine("m-deleted", 2, { isDeleted: true }),
  ]

  it("event satu pesan → hanya pesan itu, tanpa menyimpulkan lainnya", () => {
    expect(messagesReadByEvent(thread, { messageId: "m2", readAt: t(10) })).toEqual(["m2"])
  })

  it("baca massal → semua pesan SAYA yang terkonfirmasi hingga readAt", () => {
    expect(messagesReadByEvent(thread, { messageId: null, readAt: t(4) })).toEqual(["m1", "m2"])
    expect(messagesReadByEvent(thread, { messageId: null, readAt: t(10) })).toEqual(["m1", "m2", "m3"])
  })

  it("pesan lawan, bubble optimistis, dan pesan terhapus tidak pernah ikut", () => {
    const ids = messagesReadByEvent(thread, { messageId: null, readAt: t(60) })
    expect(ids).not.toContain("theirs")
    expect(ids).not.toContain("temp-key")
    expect(ids).not.toContain("m-deleted")
  })

  it("readAt tak terbaca → semua pesan saya yang terkonfirmasi (kontrak hook)", () => {
    expect(messagesReadByEvent(thread, { messageId: null, readAt: "x" })).toEqual(["m1", "m2", "m3"])
    expect(messagesReadByEvent(thread, { messageId: null })).toEqual(["m1", "m2", "m3"])
  })

  it("toleransi 1 detik terhadap jam server", () => {
    const edge = [mine("e", 5)]
    const at = new Date(Date.parse(t(5)) - 500).toISOString()
    expect(messagesReadByEvent(edge, { messageId: null, readAt: at })).toEqual(["e"])
  })
})

describe("event chat.read → callback layar", () => {
  const ROOM = "room-1"
  const ME = "user-me"
  const PEER = "user-peer"

  function collect() {
    const calls: Array<{ id: string | null; meta: unknown }> = []
    const handlers = createChatRoomHandlers(ROOM, ME, {
      onRead: (id, meta) => calls.push({ id, meta }),
    })
    return { calls, read: handlers[CHAT_SOCKET_EVENTS.READ] as (p: unknown) => void }
  }

  it("meneruskan readAt/markedCount dari lawan bicara", () => {
    const { calls, read } = collect()
    read({ roomId: ROOM, userId: PEER, readAt: t(4), markedCount: 3 })
    expect(calls).toEqual([
      { id: null, meta: { readAt: t(4), markedCount: 3, ownDeviceSync: false } },
    ])
  })

  it("event satu pesan membawa id-nya", () => {
    const { calls, read } = collect()
    read({ roomId: ROOM, userId: PEER, messageId: "m9", readAt: t(5) })
    expect(calls[0]?.id).toBe("m9")
  })

  it("gema milik sendiri diabaikan, KECUALI sinkron perangkat sendiri (ditandai ownDeviceSync)", () => {
    const { calls, read } = collect()
    read({ roomId: ROOM, userId: ME, readAt: t(4) })
    expect(calls).toHaveLength(0)
    read({ roomId: ROOM, userId: ME, readAt: t(4), isOwnDeviceSync: true })
    expect(calls).toHaveLength(1)
    expect((calls[0]?.meta as { ownDeviceSync: boolean }).ownDeviceSync).toBe(true)
  })

  it("ruang lain diabaikan", () => {
    const { calls, read } = collect()
    read({ roomId: "room-lain", userId: PEER, readAt: t(4) })
    expect(calls).toHaveLength(0)
  })
})
