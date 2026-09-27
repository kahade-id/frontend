/**
 * Workstream C — bubble DM 1:1 tanpa avatar+nama lawan bicara.
 *
 * Backend hanya mengenal ChatRoomType ORDER/INQUIRY; DM "Kirim Pesan"
 * dibuat sebagai INQUIRY tanpa order. Admin hanya bisa masuk ke ruang
 * ber-order (sengketa) → DM 1:1 = tanpa `orderId` dan bukan ORDER.
 */
import { describe, expect, it } from "vitest"

import { isOneToOneChatRoom, type ChatRoom } from "@/lib/api/chat"

const base: ChatRoom = {
  id: "r1",
  unreadCount: 0,
  updatedAt: new Date().toISOString(),
}

describe("isOneToOneChatRoom", () => {
  it("DM: INQUIRY tanpa orderId → 1:1 (avatar+nama disembunyikan)", () => {
    expect(isOneToOneChatRoom({ ...base, type: "INQUIRY", orderId: null })).toBe(true)
    expect(isOneToOneChatRoom({ ...base, type: "INQUIRY" })).toBe(true)
  })

  it("ruang transaksi: ORDER + orderId → bukan 1:1 (identitas tetap tampil)", () => {
    expect(
      isOneToOneChatRoom({ ...base, type: "ORDER", orderId: "order-123" }),
    ).toBe(false)
  })

  it("tipe ORDER tanpa orderId tetap dianggap ruang (bukan 1:1)", () => {
    expect(isOneToOneChatRoom({ ...base, type: "ORDER" })).toBe(false)
  })

  it("INQUIRY ber-order (bila ada) → bukan 1:1", () => {
    expect(
      isOneToOneChatRoom({ ...base, type: "INQUIRY", orderId: "order-123" }),
    ).toBe(false)
  })

  it("alias lama `roomType` tetap dibaca", () => {
    expect(isOneToOneChatRoom({ ...base, roomType: "INQUIRY" })).toBe(true)
    expect(
      isOneToOneChatRoom({ ...base, roomType: "ORDER", orderId: "o1" }),
    ).toBe(false)
  })

  it("room null/undefined → false (perilaku lama: identitas tampil)", () => {
    expect(isOneToOneChatRoom(null)).toBe(false)
    expect(isOneToOneChatRoom(undefined)).toBe(false)
  })

  it("tanpa info tipe & tanpa orderId → dianggap 1:1", () => {
    expect(isOneToOneChatRoom({ ...base })).toBe(true)
  })
})
