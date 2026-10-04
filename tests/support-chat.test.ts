/**
 * Poin 5 gelombang 2 (2026-10-04): livechat dukungan — lapisan murni
 * dengan mock socket, bukan akun live.
 *
 * Yang diuji:
 * - `normalizeSupportChatMessage`: boundary parsing pesan server →
 *   bentuk UI (senderType dinormalisasi, lampiran string/objek, tanpa id =
 *   ditolak).
 * - `parseSupportJoinAck` / `parseSupportMessageAck`: ack join & kirim,
 *   termasuk bentuk rusak (fail-closed).
 * - `createSupportChatHandlers`: routing event → callback — filter
 *   percakapan lain, filter gema typing milik sendiri, payload tak valid
 *   diabaikan.
 * - `emitSupportJoin` / `emitSupportMessage`: ack + timeout lewat socket
 *   mock (tanpa server).
 */
import { describe, expect, it, vi } from "vitest"
import type { Socket } from "socket.io-client"

import {
  SUPPORT_CHAT_SOCKET_EVENTS,
  emitSupportJoin,
  emitSupportMessage,
  normalizeSupportChatMessage,
  parseSupportJoinAck,
  parseSupportMessageAck,
} from "@/lib/realtime/support-chat-events"
import { createSupportChatHandlers } from "@/lib/realtime/use-support-chat"

/** Mock emitter → tipe emit socket asli (cast lokal khusus test). */
function asEmitter(mock: unknown): Pick<Socket, "emit"> {
  return mock as Pick<Socket, "emit">
}

// ------------------------------------------------------------------
// normalizeSupportChatMessage
// ------------------------------------------------------------------

describe("normalizeSupportChatMessage", () => {
  const base = {
    id: "msg-1",
    conversationId: "conv-1",
    senderType: "AGENT",
    senderId: "agent-9",
    senderName: "Agen Kahade",
    content: "Halo, ada yang bisa dibantu?",
    attachments: [],
    createdAt: "2026-10-04T10:00:00.000Z",
  }

  it("menormalkan payload lengkap", () => {
    const msg = normalizeSupportChatMessage(base)
    expect(msg).toMatchObject({
      id: "msg-1",
      conversationId: "conv-1",
      senderType: "AGENT",
      senderId: "agent-9",
      senderName: "Agen Kahade",
      content: "Halo, ada yang bisa dibantu?",
      createdAt: "2026-10-04T10:00:00.000Z",
    })
    expect(msg?.attachments).toEqual([])
  })

  it("senderType lowercase → uppercase; tak dikenal → SYSTEM", () => {
    expect(
      normalizeSupportChatMessage({ ...base, senderType: "user" })?.senderType,
    ).toBe("USER")
    expect(
      normalizeSupportChatMessage({ ...base, senderType: "BOT" })?.senderType,
    ).toBe("SYSTEM")
    expect(
      normalizeSupportChatMessage({ ...base, senderType: 42 })?.senderType,
    ).toBe("SYSTEM")
  })

  it("tanpa id → null (fail-closed)", () => {
    expect(normalizeSupportChatMessage({ ...base, id: undefined })).toBeNull()
    expect(normalizeSupportChatMessage(null)).toBeNull()
    expect(normalizeSupportChatMessage("bukan-objek")).toBeNull()
  })

  it("lampiran string dan objek dinormalisasi", () => {
    const msg = normalizeSupportChatMessage({
      ...base,
      attachments: [
        "https://api.kahade.id/uploads/a.png",
        { url: "https://api.kahade.id/uploads/b.pdf", name: "bukti.pdf" },
        123,
        null,
      ],
    })
    expect(msg?.attachments).toEqual([
      { url: "https://api.kahade.id/uploads/a.png" },
      {
        url: "https://api.kahade.id/uploads/b.pdf",
        name: "bukti.pdf",
        mimeType: null,
        size: null,
      },
    ])
  })

  it("content non-string → string kosong, createdAt hilang → sekarang", () => {
    const before = Date.now()
    const msg = normalizeSupportChatMessage({
      ...base,
      content: null,
      createdAt: undefined,
    })
    expect(msg?.content).toBe("")
    expect(+new Date(msg?.createdAt ?? 0)).toBeGreaterThanOrEqual(before)
  })
})

// ------------------------------------------------------------------
// parseSupportJoinAck / parseSupportMessageAck
// ------------------------------------------------------------------

describe("parseSupportJoinAck", () => {
  it("ack sukses penuh", () => {
    const ack = parseSupportJoinAck({
      success: true,
      conversation: { id: "conv-1" },
      messages: [
        {
          id: "m1",
          conversationId: "conv-1",
          senderType: "USER",
          content: "halo",
          createdAt: "2026-10-04T10:00:00.000Z",
        },
      ],
      agentOnline: true,
      queuePosition: 2,
    })
    expect(ack.success).toBe(true)
    expect(ack.messages).toHaveLength(1)
    expect(ack.messages[0].id).toBe("m1")
    expect(ack.agentOnline).toBe(true)
    expect(ack.queuePosition).toBe(2)
  })

  it("ack rusak → fail-closed tanpa throw", () => {
    const ack = parseSupportJoinAck({ success: "ya", messages: "bukan-array" })
    expect(ack.success).toBe(false)
    expect(ack.messages).toEqual([])
    expect(ack.queuePosition).toBeNull()
    expect(parseSupportJoinAck(null).success).toBe(false)
    expect(parseSupportJoinAck(undefined).success).toBe(false)
  })
})

describe("parseSupportMessageAck", () => {
  it("id dari data.id / data.messageId / root", () => {
    expect(
      parseSupportMessageAck({ success: true, data: { id: "srv-1" } }),
    ).toMatchObject({ success: true, messageId: "srv-1" })
    expect(
      parseSupportMessageAck({ success: true, data: { messageId: "srv-2" } }),
    ).toMatchObject({ success: true, messageId: "srv-2" })
    expect(
      parseSupportMessageAck({ success: true, id: "srv-3" }),
    ).toMatchObject({ success: true, messageId: "srv-3" })
    expect(parseSupportMessageAck({ success: true }).messageId).toBeNull()
  })

  it("gagal / bukan objek → success false", () => {
    expect(
      parseSupportMessageAck({ success: false, message: "ditolak" }),
    ).toMatchObject({ success: false, messageId: null, message: "ditolak" })
    expect(parseSupportMessageAck(null).success).toBe(false)
  })
})

// ------------------------------------------------------------------
// createSupportChatHandlers
// ------------------------------------------------------------------

function makeCallbacks() {
  return {
    onJoinAck: vi.fn(),
    onMessage: vi.fn(),
    onTyping: vi.fn(),
    onAgentJoined: vi.fn(),
    onAgentLeft: vi.fn(),
    onAssigned: vi.fn(),
    onEscalated: vi.fn(),
  }
}

describe("createSupportChatHandlers", () => {
  it("message.new: diteruskan bila percakapan sama, diabaikan bila lain", () => {
    const cb = makeCallbacks()
    const handlers = createSupportChatHandlers("conv-1", "viewer-1", cb)
    const payload = {
      id: "m1",
      conversationId: "conv-1",
      senderType: "AGENT",
      content: "halo",
      createdAt: "2026-10-04T10:00:00.000Z",
    }
    handlers[SUPPORT_CHAT_SOCKET_EVENTS.MESSAGE_NEW](payload)
    expect(cb.onMessage).toHaveBeenCalledTimes(1)
    expect(cb.onMessage.mock.calls[0][0]).toMatchObject({ id: "m1" })

    handlers[SUPPORT_CHAT_SOCKET_EVENTS.MESSAGE_NEW]({
      ...payload,
      id: "m2",
      conversationId: "conv-LAIN",
    })
    expect(cb.onMessage).toHaveBeenCalledTimes(1)
  })

  it("message.new tanpa id valid diabaikan (fail-closed)", () => {
    const cb = makeCallbacks()
    const handlers = createSupportChatHandlers("conv-1", "viewer-1", cb)
    handlers[SUPPORT_CHAT_SOCKET_EVENTS.MESSAGE_NEW]({
      conversationId: "conv-1",
      content: "tanpa id",
    })
    expect(cb.onMessage).not.toHaveBeenCalled()
  })

  it("typing: gema milik sendiri difilter, agen diteruskan", () => {
    const cb = makeCallbacks()
    const handlers = createSupportChatHandlers("conv-1", "viewer-1", cb)
    handlers[SUPPORT_CHAT_SOCKET_EVENTS.TYPING]({
      conversationId: "conv-1",
      senderType: "USER",
      senderId: "viewer-1",
      isTyping: true,
    })
    expect(cb.onTyping).not.toHaveBeenCalled()

    handlers[SUPPORT_CHAT_SOCKET_EVENTS.TYPING]({
      conversationId: "conv-1",
      senderType: "AGENT",
      senderId: "agent-9",
      senderName: "Agen Kahade",
      isTyping: true,
    })
    expect(cb.onTyping).toHaveBeenCalledWith(true, "Agen Kahade")

    handlers[SUPPORT_CHAT_SOCKET_EVENTS.TYPING]({
      conversationId: "conv-1",
      senderType: "AGENT",
      senderId: "agent-9",
      isTyping: false,
    })
    expect(cb.onTyping).toHaveBeenCalledWith(false, null)
  })

  it("agent_joined / agent_left", () => {
    const cb = makeCallbacks()
    const handlers = createSupportChatHandlers("conv-1", "viewer-1", cb)
    handlers[SUPPORT_CHAT_SOCKET_EVENTS.AGENT_JOINED]({ conversationId: "conv-1" })
    handlers[SUPPORT_CHAT_SOCKET_EVENTS.AGENT_LEFT]({ conversationId: "conv-1" })
    expect(cb.onAgentJoined).toHaveBeenCalledTimes(1)
    expect(cb.onAgentLeft).toHaveBeenCalledTimes(1)
    // Percakapan lain diabaikan.
    handlers[SUPPORT_CHAT_SOCKET_EVENTS.AGENT_JOINED]({ conversationId: "x" })
    expect(cb.onAgentJoined).toHaveBeenCalledTimes(1)
  })

  it("assigned: butuh agentName valid", () => {
    const cb = makeCallbacks()
    const handlers = createSupportChatHandlers("conv-1", "viewer-1", cb)
    handlers[SUPPORT_CHAT_SOCKET_EVENTS.ASSIGNED]({
      conversationId: "conv-1",
      agentName: "Agen Kahade",
    })
    expect(cb.onAssigned).toHaveBeenCalledTimes(1)
    handlers[SUPPORT_CHAT_SOCKET_EVENTS.ASSIGNED]({ conversationId: "conv-1" })
    expect(cb.onAssigned).toHaveBeenCalledTimes(1)
  })

  it("escalated: butuh ticketId valid", () => {
    const cb = makeCallbacks()
    const handlers = createSupportChatHandlers("conv-1", "viewer-1", cb)
    handlers[SUPPORT_CHAT_SOCKET_EVENTS.ESCALATED]({
      conversationId: "conv-1",
      ticketId: "t-1",
      ticketNumber: "TK-ABC123",
      subject: "Kendala pembayaran",
    })
    expect(cb.onEscalated).toHaveBeenCalledTimes(1)
    handlers[SUPPORT_CHAT_SOCKET_EVENTS.ESCALATED]({
      conversationId: "conv-1",
      subject: "tanpa ticketId",
    })
    expect(cb.onEscalated).toHaveBeenCalledTimes(1)
  })
})

// ------------------------------------------------------------------
// emitSupportJoin / emitSupportMessage (socket mock)
// ------------------------------------------------------------------

function makeMockSocket() {
  const emitted: Array<{ event: string; payload: unknown }> = []
  return {
    emitted,
    emit(event: string, payload: unknown) {
      emitted.push({ event, payload })
      return true
    },
  }
}

describe("emitSupportJoin / emitSupportMessage", () => {
  it("join: emit event + payload benar, ack sukses ter-parse", async () => {
    const socket = {
      emit(event: string, payload: unknown, ack?: (a: unknown) => void) {
        expect(event).toBe(SUPPORT_CHAT_SOCKET_EVENTS.JOIN)
        expect(payload).toEqual({ conversationId: "conv-1" })
        ack?.({
          success: true,
          conversation: { id: "conv-1" },
          messages: [],
          agentOnline: false,
          queuePosition: null,
        })
      },
    }
    const ack = await emitSupportJoin(asEmitter(socket), "conv-1", 1000)
    expect(ack.success).toBe(true)
  })

  it("message: timeout → success false tanpa gantung", async () => {
    const socket = {
      emit() {},
    }
    const ack = await emitSupportMessage(
      asEmitter(socket),
      { conversationId: "conv-1", content: "halo" },
      20,
    )
    expect(ack.success).toBe(false)
    expect(ack.message).toBe("timeout")
  })

  it("join: timeout → fail-closed", async () => {
    const socket = makeMockSocket()
    const ack = await emitSupportJoin(asEmitter(socket), "conv-1", 20)
    expect(ack.success).toBe(false)
    expect(socket.emitted[0]?.event).toBe(SUPPORT_CHAT_SOCKET_EVENTS.JOIN)
  })
})
