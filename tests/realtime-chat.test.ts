/**
 * GAP-B2 (G125): realtime chat — pesan, reaksi, typing, read receipt,
 * reconnect — dengan MOCK socket, bukan dua akun live.
 *
 * Yang diuji adalah lapisan murni:
 * - `mergeMessageLists`: dedup realtime vs optimistic vs poll REST (G108),
 * - `createChatRoomHandlers`: routing event dua klien mock (satu room,
 *   dua viewer) — filter room, filter gema sendiri,
 * - `createTypingTracker`: expiry otomatis indikator mengetik (G110),
 * - `getViewerIdFromToken` & `buildSocketOptions`: auth handshake tanpa
 *   token di URL + backoff dengan jitter (G103/G104/G121).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

import type { ChatMessage, ChatReaction } from "@/lib/api/chat"
import {
  buildSocketOptions,
  CHAT_SOCKET_EVENTS,
  createTypingTracker,
  getViewerIdFromToken,
  mergeMessageLists,
  applyDeletedTombstone,
  applyReactionSummary,
  TYPING_EXPIRY_MS,
} from "@/lib/realtime/chat-events"
import { createChatRoomHandlers } from "@/lib/realtime/use-chat-room"

// ------------------------------------------------------------------
// Helper
// ------------------------------------------------------------------

function msg(partial: Partial<ChatMessage> & { id: string }): ChatMessage {
  return {
    messageType: "TEXT",
    fromUser: false,
    createdAt: "2026-09-26T10:00:00.000Z",
    ...partial,
  }
}

/** Mock socket ala EventEmitter untuk mensimulasikan dua klien. */
function createMockSocket() {
  const handlers = new Map<string, Set<(payload: unknown) => void>>()
  return {
    on(event: string, handler: (payload: unknown) => void) {
      let set = handlers.get(event)
      if (!set) {
        set = new Set()
        handlers.set(event, set)
      }
      set.add(handler)
    },
    off(event: string, handler: (payload: unknown) => void) {
      handlers.get(event)?.delete(handler)
    },
    /** Server mendorong event ke klien ini. */
    receive(event: string, payload: unknown) {
      for (const handler of [...(handlers.get(event) ?? [])]) handler(payload)
    },
    listenerCount(event: string) {
      return handlers.get(event)?.size ?? 0
    },
  }
}

function base64UrlEncode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

const ROOM = "room-1"
const ME = "internal-user-1"
const PEER = "internal-user-2"

function tokenFor(sub: string): string {
  return `header.${base64UrlEncode({ sub, aud: "kahade-user", iss: "kahade" })}.sig`
}

// ------------------------------------------------------------------
// getViewerIdFromToken
// ------------------------------------------------------------------

describe("getViewerIdFromToken", () => {
  it("membaca sub dari payload JWT", () => {
    expect(getViewerIdFromToken(tokenFor(ME))).toBe(ME)
  })

  it("null untuk token kosong / malformed / tanpa sub", () => {
    expect(getViewerIdFromToken(null)).toBeNull()
    expect(getViewerIdFromToken(undefined)).toBeNull()
    expect(getViewerIdFromToken("bukan-jwt")).toBeNull()
    expect(getViewerIdFromToken("a.b")).toBeNull()
    expect(getViewerIdFromToken(`h.${base64UrlEncode({})}.s`)).toBeNull()
    expect(getViewerIdFromToken("h.!!!.s")).toBeNull()
  })
})

// ------------------------------------------------------------------
// buildSocketOptions — auth & backoff (G103/G104/G121)
// ------------------------------------------------------------------

describe("buildSocketOptions", () => {
  it("token hanya di auth handshake, tidak di query URL; websocket saja", () => {
    const opts = buildSocketOptions("secret-token") as Record<string, unknown>
    expect(opts.auth).toEqual({ token: "secret-token" })
    expect(opts.query).toBeUndefined()
    expect(opts.transports).toEqual(["websocket"])
  })

  it("backoff reconnect dengan jitter", () => {
    const opts = buildSocketOptions("t") as Record<string, unknown>
    expect(opts.reconnection).toBe(true)
    expect(opts.reconnectionDelay).toBe(1000)
    expect(opts.reconnectionDelayMax).toBe(30_000)
    // randomizationFactor 0.5 = ±50% jitter (G121).
    expect(opts.randomizationFactor).toBe(0.5)
  })
})

// ------------------------------------------------------------------
// mergeMessageLists — dedup realtime vs optimistic vs poll (G108)
// ------------------------------------------------------------------

describe("mergeMessageLists", () => {
  it("pesan realtime baru ditambahkan sekali; duplikat (poll/realtime ganda) dibuang", () => {
    const incoming = msg({ id: "m1", text: "halo" })
    const first = mergeMessageLists([], [incoming])
    expect(first.added).toBe(1)
    expect(first.messages).toHaveLength(1)

    // Event yang sama datang lagi (broadcast room + user:<id>) → 0.
    const second = mergeMessageLists(first.messages, [incoming])
    expect(second.added).toBe(0)
    expect(second.messages).toBe(first.messages) // referensi sama = tidak berubah
    expect(second.messages).toHaveLength(1)

    // Poll REST membawa pesan yang sama → tetap 0.
    const third = mergeMessageLists(second.messages, [msg({ id: "m1", text: "halo" })])
    expect(third.added).toBe(0)
    expect(third.messages).toHaveLength(1)
  })

  it("pesan optimistis (temp id) dan salinan realtime (real id) tidak bentrok", () => {
    const optimistic = msg({ id: "temp-1", text: "kirim", fromUser: true, sendStatus: "sending" })
    const afterOptimistic = mergeMessageLists([], [optimistic])
    // Salinan realtime dari pesan sendiri tiba sebelum respons REST.
    const realtimeCopy = msg({ id: "real-9", text: "kirim", fromUser: false })
    const merged = mergeMessageLists(afterOptimistic.messages, [realtimeCopy])
    expect(merged.added).toBe(1)
    // Layar mengganti temp → real dengan membuang duplikat id real dulu;
    // di sini disimulasikan: tidak ada dua baris dengan id sama.
    const ids = merged.messages.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("payload per-viewer meng-upgrade fromUser sticky (netral=false → viewer=true)", () => {
    // Salinan netral broadcast room tiba dulu (fromUser selalu false).
    const neutral = msg({ id: "m2", text: "dari perangkat lain", senderId: "u-x", fromUser: false })
    const first = mergeMessageLists([], [neutral])
    expect(first.messages[0]?.fromUser).toBe(false)
    // Salinan per-viewer (user:<id>) tiba sesudahnya.
    const viewer = msg({ id: "m2", text: "dari perangkat lain", senderId: "u-x", fromUser: true })
    const second = mergeMessageLists(first.messages, [viewer])
    expect(second.added).toBe(0)
    expect(second.messages[0]?.fromUser).toBe(true)
    // Payload netral berikutnya tidak bisa menurunkan lagi.
    const third = mergeMessageLists(second.messages, [neutral])
    expect(third.messages[0]?.fromUser).toBe(true)
  })

  it("patch edit/pin/reaksi dari event update tanpa duplikat", () => {
    const base = mergeMessageLists([], [msg({ id: "m3", text: "lama" })]).messages
    const updated = mergeMessageLists(base, [
      msg({ id: "m3", text: "baru", isEdited: true, isPinned: true }),
    ])
    expect(updated.added).toBe(0)
    expect(updated.messages[0]).toMatchObject({ text: "baru", isEdited: true, isPinned: true })
  })

  it("urutan kronologis dipertahankan", () => {
    const a = msg({ id: "a", createdAt: "2026-09-26T10:02:00.000Z" })
    const b = msg({ id: "b", createdAt: "2026-09-26T10:01:00.000Z" })
    const merged = mergeMessageLists([], [a, b])
    expect(merged.messages.map((m) => m.id)).toEqual(["b", "a"])
  })
})

// ------------------------------------------------------------------
// Tombstone & reaksi
// ------------------------------------------------------------------

describe("applyDeletedTombstone & applyReactionSummary", () => {
  it("hapus → tombstone (konsisten dengan poll REST)", () => {
    const prev = [msg({ id: "m1", text: "rahasia" })]
    const next = applyDeletedTombstone(prev, "m1")
    expect(next[0]).toMatchObject({ isDeleted: true, text: undefined, attachments: [] })
    // Idempotent.
    expect(applyDeletedTombstone(next, "m1")).toBe(next)
    // Id tak dikenal → tidak berubah.
    expect(applyDeletedTombstone(prev, "nope")).toBe(prev)
  })

  it("#9c: kutipan di pesan lain yang membalas pesan terhapus ikut jadi tombstone", () => {
    const prev = [
      msg({ id: "m1", text: "rahasia" }),
      msg({
        id: "m2",
        text: "balasan",
        replyTo: { id: "m1", content: "rahasia", senderName: "Budi", fileName: "foto.jpg" },
      }),
      msg({ id: "m3", text: "lain", replyTo: { id: "m0", content: "x" } }),
    ]
    const next = applyDeletedTombstone(prev, "m1")
    // Isi asli tidak bocor lewat strip balasan.
    expect(next[1].replyTo).toEqual({ id: "m1", content: null, senderName: "Budi", fileName: null, isDeleted: true })
    // Pesan balasan itu sendiri tidak dihapus.
    expect(next[1].isDeleted).toBeUndefined()
    expect(next[1].text).toBe("balasan")
    // Kutipan ke pesan lain tidak tersentuh (identitas objek sama).
    expect(next[2]).toBe(prev[2])
    // Idempotent setelah kutipan ditandai.
    expect(applyDeletedTombstone(next, "m1")).toBe(next)
  })

  it("#9c: hanya kutipan yang berubah (pesan asli tidak ada di jendela) tetap dihitung perubahan", () => {
    const prev = [msg({ id: "m2", replyTo: { id: "m1", content: "rahasia" } })]
    const next = applyDeletedTombstone(prev, "m1")
    expect(next).not.toBe(prev)
    expect(next[0].replyTo?.isDeleted).toBe(true)
    expect(next[0].replyTo?.content).toBeNull()
  })

  it("reaksi diganti wholesale dari server", () => {
    const reactions: ChatReaction[] = [{ emoji: "👍", count: 2, reactedByMe: true }]
    const prev = [msg({ id: "m1", reactions: [] })]
    const next = applyReactionSummary(prev, "m1", reactions)
    expect(next[0]?.reactions).toEqual(reactions)
    expect(applyReactionSummary(next, "m1", reactions)).toBe(next)
  })
})

// ------------------------------------------------------------------
// createTypingTracker — expiry otomatis (G110)
// ------------------------------------------------------------------

describe("createTypingTracker", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("indikator padam otomatis bila paket stop hilang", () => {
    const onChange = vi.fn()
    const tracker = createTypingTracker(onChange, 3000)
    tracker.signal(true)
    expect(onChange).toHaveBeenLastCalledWith(true)
    vi.advanceTimersByTime(2999)
    expect(onChange).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenLastCalledWith(false)
    tracker.dispose()
  })

  it("sinyal baru me-reset timer expiry", () => {
    const onChange = vi.fn()
    const tracker = createTypingTracker(onChange, 3000)
    tracker.signal(true)
    vi.advanceTimersByTime(2000)
    tracker.signal(true) // heartbeat
    vi.advanceTimersByTime(2000)
    expect(onChange).not.toHaveBeenCalledWith(false)
    vi.advanceTimersByTime(1000)
    expect(onChange).toHaveBeenLastCalledWith(false)
    tracker.dispose()
  })

  it("stop eksplisit membatalkan timer", () => {
    const onChange = vi.fn()
    const tracker = createTypingTracker(onChange, 3000)
    tracker.signal(true)
    tracker.signal(false)
    expect(onChange).toHaveBeenLastCalledWith(false)
    vi.advanceTimersByTime(10_000)
    expect(onChange).toHaveBeenCalledTimes(2)
    tracker.dispose()
  })

  it("default expiry = TYPING_EXPIRY_MS", () => {
    expect(TYPING_EXPIRY_MS).toBe(10_000)
  })
})

// ------------------------------------------------------------------
// createChatRoomHandlers — dua klien mock (G125)
// ------------------------------------------------------------------

describe("createChatRoomHandlers (dua klien mock)", () => {
  it("pesan hanya diteruskan bila roomId cocok; room lain diabaikan", () => {
    const mine: unknown[] = []
    const handlers = createChatRoomHandlers(ROOM, ME, { onMessage: (raw) => mine.push(raw) })
    const socket = createMockSocket()
    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler)

    socket.receive(CHAT_SOCKET_EVENTS.NEW_MESSAGE, { roomId: ROOM, id: "m1" })
    socket.receive(CHAT_SOCKET_EVENTS.NEW_MESSAGE, { roomId: "room-lain", id: "mX" })
    socket.receive(CHAT_SOCKET_EVENTS.MESSAGE_UPDATED, { roomId: "room-lain", id: "mY" })
    expect(mine).toHaveLength(1)
    expect((mine[0] as { id: string }).id).toBe("m1")
  })

  it("dua klien menerima event yang sama secara independen", () => {
    const clientA: unknown[] = []
    const clientB: unknown[] = []
    const socketA = createMockSocket()
    const socketB = createMockSocket()
    for (const [event, handler] of Object.entries(
      createChatRoomHandlers(ROOM, ME, { onMessage: (raw) => clientA.push(raw) }),
    )) {
      socketA.on(event, handler)
    }
    for (const [event, handler] of Object.entries(
      createChatRoomHandlers(ROOM, PEER, { onMessage: (raw) => clientB.push(raw) }),
    )) {
      socketB.on(event, handler)
    }
    // Server broadcast ke room chat:<id> → kedua socket menerima.
    const payload = { roomId: ROOM, id: "m1", text: "halo" }
    socketA.receive(CHAT_SOCKET_EVENTS.NEW_MESSAGE, payload)
    socketB.receive(CHAT_SOCKET_EVENTS.NEW_MESSAGE, payload)
    expect(clientA).toHaveLength(1)
    expect(clientB).toHaveLength(1)
  })

  it("gema typing/read milik sendiri difilter; milik lawan diteruskan", () => {
    const typing: boolean[] = []
    const reads: (string | null)[] = []
    const handlers = createChatRoomHandlers(ROOM, ME, {
      onTyping: (v) => typing.push(v),
      onRead: (id) => reads.push(id),
    })
    const socket = createMockSocket()
    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler)

    // Gema sendiri (REST sendTypingIndicator broadcast termasuk pengirim).
    socket.receive(CHAT_SOCKET_EVENTS.TYPING, { roomId: ROOM, userId: ME, isTyping: true })
    socket.receive(CHAT_SOCKET_EVENTS.READ, { roomId: ROOM, userId: ME, readAt: "x" })
    expect(typing).toHaveLength(0)
    expect(reads).toHaveLength(0)

    // Lawan bicara.
    socket.receive(CHAT_SOCKET_EVENTS.TYPING, { roomId: ROOM, userId: PEER, isTyping: true })
    socket.receive(CHAT_SOCKET_EVENTS.READ, { roomId: ROOM, userId: PEER, messageId: "m1", readAt: "x" })
    socket.receive(CHAT_SOCKET_EVENTS.READ, { roomId: ROOM, userId: PEER, readAt: "x" })
    expect(typing).toEqual([true])
    expect(reads).toEqual(["m1", null])
  })

  it("reaksi, hapus, pin, presence diteruskan dengan validasi bentuk", () => {
    const calls: Record<string, unknown[]> = {
      reaction: [],
      deleted: [],
      pin: [],
      presence: [],
    }
    const handlers = createChatRoomHandlers(ROOM, ME, {
      onReaction: (id, reactions) => calls.reaction.push([id, reactions]),
      onMessageDeleted: (id) => calls.deleted.push(id),
      onPin: (id, isPinned) => calls.pin.push([id, isPinned]),
      onPresence: (isOnline) => calls.presence.push(isOnline),
    })
    const socket = createMockSocket()
    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler)

    socket.receive(CHAT_SOCKET_EVENTS.REACTION_UPDATED, {
      roomId: ROOM,
      messageId: "m1",
      reactions: [{ emoji: "❤️", count: 1, reactedByMe: false }],
    })
    // Payload rusak diabaikan diam-diam.
    socket.receive(CHAT_SOCKET_EVENTS.REACTION_UPDATED, { roomId: ROOM })
    socket.receive(CHAT_SOCKET_EVENTS.REACTION_UPDATED, { roomId: ROOM, messageId: "m1" })

    socket.receive(CHAT_SOCKET_EVENTS.MESSAGE_DELETED, { roomId: ROOM, messageId: "m2" })
    socket.receive(CHAT_SOCKET_EVENTS.MESSAGE_DELETED, { roomId: ROOM })
    socket.receive(CHAT_SOCKET_EVENTS.MESSAGE_PINNED, { roomId: ROOM, messageId: "m3" })
    socket.receive(CHAT_SOCKET_EVENTS.MESSAGE_UNPINNED, { roomId: ROOM, messageId: "m3" })
    socket.receive(CHAT_SOCKET_EVENTS.USER_ONLINE, { userId: PEER })
    socket.receive(CHAT_SOCKET_EVENTS.USER_OFFLINE, { userId: PEER })

    expect(calls.reaction).toHaveLength(1)
    expect(calls.deleted).toEqual(["m2"])
    expect(calls.pin).toEqual([["m3", true], ["m3", false]])
    expect(calls.presence).toEqual([true, false])
  })

  it("unsubscribe membersihkan semua listener (ganti room/unmount)", () => {
    const seen: unknown[] = []
    const handlers = createChatRoomHandlers(ROOM, ME, { onMessage: (raw) => seen.push(raw) })
    const socket = createMockSocket()
    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler)
    expect(socket.listenerCount(CHAT_SOCKET_EVENTS.NEW_MESSAGE)).toBe(1)

    for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler)
    expect(socket.listenerCount(CHAT_SOCKET_EVENTS.NEW_MESSAGE)).toBe(0)
    socket.receive(CHAT_SOCKET_EVENTS.NEW_MESSAGE, { roomId: ROOM, id: "m1" })
    expect(seen).toHaveLength(0)
  })
})
