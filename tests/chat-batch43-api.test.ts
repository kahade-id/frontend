/**
 * Batch 43 FE-CHAT: test kontrak normalizer endpoint chat baru.
 *
 * Mengunci bentuk respons backend (mega/be-chat @ 9bd7dd9):
 *  - GET/PATCH /v1/chat/privacy → { hideReadReceipts, dmPolicy }
 *  - POST /v1/chat/self → { room } (isSelf ditandai client)
 *  - GET /v1/chat/pinned → { pinnedRooms }
 *  - POST /v1/chat/rooms/{id}/polls → poll penuh (myVotes dsb.)
 *  - GET /v1/chat/rooms/{id}/starred → { roomId, messages: [{starredAt, message}] }
 *  - POST /v1/chat/rooms/{id}/order → { order: { orderId, status, … }, roomId }
 *  - POST …/translate → { messageId, targetLang, translatedText, sourceLang }
 *  - type guard kartu PRODUCT_CARD / ORDER_CARD.
 */
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/session", () => ({
  getAccessToken: () => Promise.resolve("token"),
  getRefreshToken: () => Promise.resolve(null),
  setAccessToken: () => Promise.resolve(),
  setRefreshToken: () => Promise.resolve(),
  getSessionRevision: () => 1,
  clearSession: () => Promise.resolve(),
  emitSessionExpired: () => undefined,
  getDeviceId: () => Promise.resolve("device-1"),
  getDeviceInfo: () => "Kahade/test",
  getAppVersion: () => "0.0.0",
}))

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

function jsonOk(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

import {
  asOrderCard,
  asProductCard,
  createOrderFromChat,
  createPoll,
  getChatPrivacy,
  getOrCreateSelfRoom,
  listPinnedChatRooms,
  listStarredMessages,
  translateChatMessage,
  votePoll,
} from "@/lib/api/chat"

describe("chat privacy", () => {
  it("normalisasi GET /v1/chat/privacy", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk({ hideReadReceipts: true, dmPolicy: "FOLLOWING" }),
    )
    const res = await getChatPrivacy()
    expect(res).toEqual({ hideReadReceipts: true, dmPolicy: "FOLLOWING" })
  })
  it("dmPolicy tak dikenal → EVERYONE", async () => {
    fetchMock.mockResolvedValueOnce(jsonOk({ hideReadReceipts: false, dmPolicy: "X" }))
    const res = await getChatPrivacy()
    expect(res.dmPolicy).toBe("EVERYONE")
  })
})

describe("self chat", () => {
  it("POST /v1/chat/self menandai isSelf", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk({ room: { id: "r1", type: "INQUIRY", status: "OPEN", isSelf: true } }),
    )
    const room = await getOrCreateSelfRoom()
    expect(room.id).toBe("r1")
    expect(room.isSelf).toBe(true)
  })
})

describe("pinned rooms", () => {
  it("GET /v1/chat/pinned → pinnedRooms", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk({ pinnedRooms: [{ roomId: "a", position: 0, pinnedAt: "2026-09-28T00:00:00Z" }] }),
    )
    const pins = await listPinnedChatRooms()
    expect(pins).toEqual([{ roomId: "a", position: 0, pinnedAt: "2026-09-28T00:00:00Z" }])
  })
})

describe("polls", () => {
  const pollPayload = {
    id: "p1",
    roomId: "r1",
    question: "Kapan COD?",
    options: [
      { index: 0, text: "Pagi", votes: 2 },
      { index: 1, text: "Sore", votes: 1 },
    ],
    totalVotes: 3,
    allowMultiple: false,
    deadline: null,
    isClosed: false,
    myVotes: [0],
    createdBy: { userId: "u1", fullName: "Budi" },
    createdAt: "2026-09-28T00:00:00Z",
  }
  it("createPoll menormalisasi poll", async () => {
    fetchMock.mockResolvedValueOnce(jsonOk(pollPayload))
    const poll = await createPoll("r1", { question: "Kapan COD?", options: ["Pagi", "Sore"] })
    expect(poll.id).toBe("p1")
    expect(poll.options).toHaveLength(2)
    expect(poll.myVotes).toEqual([0])
    expect(poll.createdBy.fullName).toBe("Budi")
  })
  it("votePoll mengembalikan poll terbaru", async () => {
    fetchMock.mockResolvedValueOnce(jsonOk({ ...pollPayload, myVotes: [1], totalVotes: 4 }))
    const poll = await votePoll("r1", "p1", [1])
    expect(poll.myVotes).toEqual([1])
    expect(poll.totalVotes).toBe(4)
  })
})

describe("starred messages", () => {
  it("listStarredMessages membuka bungkus { starredAt, message }", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk({
        roomId: "r1",
        messages: [
          {
            starredAt: "2026-09-28T01:00:00Z",
            message: { id: "m1", content: "penting", sender: "u2" },
          },
        ],
      }),
    )
    const list = await listStarredMessages("r1")
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe("m1")
    expect(list[0].isStarred).toBe(true)
    expect(list[0].starredAt).toBe("2026-09-28T01:00:00Z")
  })
})

describe("createOrderFromChat", () => {
  it("POST /v1/chat/rooms/{id}/order → order ringkas", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk({
        order: {
          orderId: "KHD-123",
          status: "PENDING_PAYMENT",
          feeCalculation: { fee: 1000 },
          confirmationDeadlineAt: "2026-09-29T00:00:00Z",
        },
        roomId: "r1",
      }),
    )
    const res = await createOrderFromChat("r1", { title: "PS5 bekas", hargaSepakat: 5000000 })
    expect(res.order.orderId).toBe("KHD-123")
    expect(res.order.status).toBe("PENDING_PAYMENT")
    expect(res.roomId).toBe("r1")
  })
})

describe("translateChatMessage", () => {
  it("menormalisasi respons terjemahan", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk({
        messageId: "m1",
        targetLang: "en",
        translatedText: "Hello",
        sourceLang: "id",
      }),
    )
    const t = await translateChatMessage("r1", "m1", "en")
    expect(t.translatedText).toBe("Hello")
    expect(t.sourceLang).toBe("id")
  })
})

describe("card type guards", () => {
  it("asProductCard menerima snapshot valid", () => {
    const card = asProductCard({
      kind: "PRODUCT_CARD",
      showcaseId: "s1",
      title: "PS5",
      priceMin: "1000",
      priceMax: null,
      imageUrl: null,
      sellerUsername: "toko",
      snapshotAt: "2026-09-28T00:00:00Z",
    })
    expect(card?.showcaseId).toBe("s1")
    expect(asProductCard({ kind: "ORDER_CARD" })).toBeNull()
    expect(asProductCard(null)).toBeNull()
  })
  it("asOrderCard menerima snapshot valid", () => {
    const card = asOrderCard({
      kind: "ORDER_CARD",
      orderId: "cuid123",
      orderCode: "KHD-1",
      title: "PS5",
      status: "PAID",
      orderValue: "5000000",
      buyerUsername: "b",
      sellerUsername: "s",
      snapshotAt: "2026-09-28T00:00:00Z",
    })
    expect(card?.orderCode).toBe("KHD-1")
    expect(asOrderCard({ kind: "PRODUCT_CARD" })).toBeNull()
  })
})
