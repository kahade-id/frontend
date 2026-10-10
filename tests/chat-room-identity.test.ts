/**
 * Workstream C — bubble DM 1:1 tanpa avatar+nama lawan bicara.
 *
 * Backend hanya mengenal ChatRoomType ORDER/INQUIRY; DM "Kirim Pesan"
 * dibuat sebagai INQUIRY tanpa order. Admin hanya bisa masuk ke ruang
 * ber-order (sengketa) → DM 1:1 = tanpa `orderId` dan bukan ORDER.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
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

// ── Audit Pesan 2026-10-10 (#3): self-chat dari data ruang, bukan URL ───
import { isSelfChatRoom } from "@/lib/api/chat"

describe("isSelfChatRoom", () => {
  const me = { ids: ["USR-ME", "c_me_internal"], username: "aku" }
  const selfRoom: ChatRoom = {
    ...base,
    type: "INQUIRY",
    otherUser: { userId: "USR-ME", username: "aku" },
    counterpart: { id: "USR-ME", username: "aku" },
  }
  const peerRoom: ChatRoom = {
    ...base,
    type: "INQUIRY",
    otherUser: { userId: "USR-BUDI", username: "budi" },
    counterpart: { id: "USR-BUDI", username: "budi" },
  }

  it("lawan bicara = saya (userId publik) → self-chat", () => {
    expect(isSelfChatRoom(selfRoom, me)).toBe(true)
  })
  it("cocok lewat id internal atau username pun cukup", () => {
    expect(isSelfChatRoom({ ...selfRoom, otherUser: { userId: "c_me_internal" }, counterpart: undefined }, me)).toBe(true)
    expect(
      isSelfChatRoom({ ...selfRoom, otherUser: { userId: "", username: "@Aku" }, counterpart: undefined }, me),
    ).toBe(true)
  })
  it("ruang dengan orang lain → bukan self-chat walau URL mengklaim self=1 (param tidak dibaca)", () => {
    expect(isSelfChatRoom(peerRoom, me)).toBe(false)
  })
  it("fail-closed: ruang/profil belum termuat, ruang transaksi, atau lawan bicara kosong", () => {
    expect(isSelfChatRoom(null, me)).toBe(false)
    expect(isSelfChatRoom(selfRoom, null)).toBe(false)
    expect(isSelfChatRoom({ ...selfRoom, orderId: "ORD-1" }, me)).toBe(false)
    expect(isSelfChatRoom({ ...base, type: "INQUIRY" }, me)).toBe(false)
  })
  it("layar tidak lagi membaca param URL `self`", () => {
    const screen = readFileSync(resolve(__dirname, "..", "components/screens/chat-room-screen.tsx"), "utf8")
    expect(screen).not.toMatch(/self === "1"/)
    expect(screen).not.toMatch(/const \{ roomId, title, self \}/)
    expect(screen).toContain("isSelfChatRoom(room, selfIdentity)")
  })
})
