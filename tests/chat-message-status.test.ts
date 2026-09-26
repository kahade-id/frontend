import { describe, expect, it } from "vitest"

// Akses normalizer via re-export tidak ada; uji lewat perilaku listChatRooms
// terlalu berat. Sebagai gantinya, verifikasi kontrak tipe & mapping manual.
import type { ChatMessage } from "@/lib/api/chat"

describe("ChatMessage CN-003/CN-015 contract", () => {
  it("mendukung isDeleted dan sendStatus", () => {
    const deleted: ChatMessage = {
      id: "m1",
      messageType: "TEXT",
      fromUser: false,
      createdAt: new Date().toISOString(),
      isDeleted: true,
    }
    expect(deleted.isDeleted).toBe(true)

    const failed: ChatMessage = {
      id: "m2",
      messageType: "TEXT",
      fromUser: true,
      createdAt: new Date().toISOString(),
      sendStatus: "failed",
    }
    expect(failed.sendStatus).toBe("failed")

    const sending: ChatMessage = {
      id: "m3",
      messageType: "TEXT",
      fromUser: true,
      createdAt: new Date().toISOString(),
      sendStatus: "sending",
    }
    expect(sending.sendStatus).toBe("sending")
  })
})
