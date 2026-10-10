/**
 * Audit Pesan 2026-10-10 (daftar #4): sinyal lokal "ruang baru dibaca" dari
 * layar ruang ke daftar chat — badge baris nol seketika.
 */
import { afterEach, describe, expect, it } from "vitest"

import {
  __resetChatRoomReadListenersForTest,
  emitChatRoomRead,
  subscribeChatRoomRead,
} from "@/lib/chat-room-read-events"

afterEach(() => __resetChatRoomReadListenersForTest())

describe("chat-room-read-events", () => {
  it("pendengar menerima roomId; berhenti setelah unsubscribe", () => {
    const got: string[] = []
    const stop = subscribeChatRoomRead((id) => got.push(id))
    emitChatRoomRead("r1")
    stop()
    emitChatRoomRead("r2")
    expect(got).toEqual(["r1"])
  })
  it("roomId kosong diabaikan; pendengar yang melempar tidak menjatuhkan pemancar", () => {
    const got: string[] = []
    subscribeChatRoomRead(() => {
      throw new Error("boom")
    })
    subscribeChatRoomRead((id) => got.push(id))
    emitChatRoomRead("")
    emitChatRoomRead("r3")
    expect(got).toEqual(["r3"])
  })
})
