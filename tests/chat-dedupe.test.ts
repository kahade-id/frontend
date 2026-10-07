/**
 * Workstream A — dedupe pesan optimistis vs gema server (fix duplikat reply).
 *
 * Skenario bug: kirim reply → pesan optimistis (`temp-…`, sending) tampil →
 * gema realtime `chat.new_message` tiba DENGAN ID SERVER (broadcast termasuk
 * ke pengirim) → di-append sebagai pesan baru → POST resolve mengganti entri
 * optimistis → dua bubble ber-id sama.
 *
 * 2026-10-08 (keluhan "double-send" pada koneksi lambat): gema bisa tiba
 * dengan `fromUser: false` bila payload tidak menandai sisi-pengirim. Gema
 * seperti itu dulu TIDAK PERNAH dicocokkan → di-append → bubble ganda yang
 * menetap. Sekarang merge sadar-identitas lewat `selfIds` (lihat describe
 * "gema netral milik sendiri" di bawah).
 */
import { describe, expect, it } from "vitest"

import type { ChatMessage } from "@/lib/api/chat"
import {
  OPTIMISTIC_MATCH_WINDOW_MS,
  findOptimisticMatch,
  mergeChatMessages,
} from "@/lib/chat-dedupe"

const BASE = new Date("2026-09-28T00:00:00.000Z").getTime()
const iso = (offsetMs: number) => new Date(BASE + offsetMs).toISOString()

function optimistic(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "temp-1",
    text: "Siap, saya kirim hari ini",
    messageType: "TEXT",
    fromUser: true,
    replyToId: "m-quoted",
    createdAt: iso(0),
    sendStatus: "sending",
    ...overrides,
  }
}

/** Gema server untuk pesan optimistis di atas (id asli, tanpa sendStatus). */
function serverEcho(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "srv-1",
    text: "Siap, saya kirim hari ini",
    messageType: "TEXT",
    fromUser: true,
    replyToId: "m-quoted",
    replyTo: {
      id: "m-quoted",
      content: "Kapan dikirim?",
      messageType: "TEXT",
      isDeleted: false,
      senderName: "Budi",
    },
    createdAt: iso(1500),
    ...overrides,
  }
}

describe("findOptimisticMatch", () => {
  it("mencocokkan gema server dengan pesan optimistis (kasus reply)", () => {
    const match = findOptimisticMatch([optimistic()], serverEcho())
    expect(match?.id).toBe("temp-1")
  })

  it("tidak cocok bila teks berbeda", () => {
    expect(findOptimisticMatch([optimistic()], serverEcho({ text: "lain" }))).toBeNull()
  })

  it("tidak cocok bila replyToId berbeda (reply ≠ pesan biasa)", () => {
    expect(
      findOptimisticMatch([optimistic({ replyToId: null })], serverEcho()),
    ).toBeNull()
    expect(
      findOptimisticMatch([optimistic()], serverEcho({ replyToId: "m-lain" })),
    ).toBeNull()
  })

  it("tidak menyentuh kandidat failed (menunggu retry eksplisit)", () => {
    const failed = optimistic({ sendStatus: "failed" })
    expect(findOptimisticMatch([failed], serverEcho())).toBeNull()
  })

  it("tidak cocok untuk pesan lawan bicara", () => {
    expect(
      findOptimisticMatch([optimistic()], serverEcho({ fromUser: false })),
    ).toBeNull()
  })

  it("tidak cocok bila selisih waktu melewati jendela", () => {
    const old = optimistic({ createdAt: iso(-OPTIMISTIC_MATCH_WINDOW_MS - 1000) })
    expect(findOptimisticMatch([old], serverEcho())).toBeNull()
  })

  it("FIFO: dua teks identik → kandidat tertua yang menang", () => {
    const first = optimistic({ id: "temp-a", createdAt: iso(0) })
    const second = optimistic({ id: "temp-b", createdAt: iso(500) })
    // Urutan list dibalik — tetap yang tertua yang cocok.
    expect(findOptimisticMatch([second, first], serverEcho())?.id).toBe("temp-a")
  })

  it("sidik lampiran ikut dibandingkan", () => {
    const withFile = optimistic({
      messageType: "FILE",
      text: undefined,
      attachments: [
        { fileName: "nota.pdf", fileUrl: "file:///x", mimeType: "application/pdf", fileSize: 10 },
      ],
    })
    const echoSame = serverEcho({
      messageType: "FILE",
      text: undefined,
      attachments: [
        { fileName: "nota.pdf", fileUrl: "https://cdn/y", mimeType: "application/pdf", fileSize: 10 },
      ],
    })
    expect(findOptimisticMatch([withFile], echoSame)?.id).toBe("temp-1")
    expect(
      findOptimisticMatch(
        [withFile],
        { ...echoSame, attachments: [{ ...echoSame.attachments![0], fileName: "lain.pdf" }] },
      ),
    ).toBeNull()
  })
})

describe("mergeChatMessages", () => {
  it("gema sebelum POST resolve: GANTI optimistis, bukan append (tanpa duplikat)", () => {
    const prev = [optimistic()]
    const result = mergeChatMessages(prev, [serverEcho()])
    expect(result.changed).toBe(true)
    expect(result.added).toBe(0)
    expect(result.next).toHaveLength(1)
    expect(result.next[0].id).toBe("srv-1")
    // replyToId + kutipan server ikut terbawa.
    expect(result.next[0].replyToId).toBe("m-quoted")
    expect(result.next[0].replyTo?.content).toBe("Kapan dikirim?")
  })

  it("skenario penuh: gema dulu lalu POST resolve → tetap 1 pesan", () => {
    // t1: gema realtime tiba sebelum POST resolve.
    let list = mergeChatMessages([optimistic()], [serverEcho()]).next
    expect(list).toHaveLength(1)
    // t2: POST resolve — replace memakai id temp ATAU id server.
    const msg = serverEcho()
    list = list.map((m) => (m.id === "temp-1" || m.id === msg.id ? msg : m))
    const result = mergeChatMessages(list, [msg])
    expect(result.next).toHaveLength(1)
    expect(result.next.filter((m) => m.id === "srv-1")).toHaveLength(1)
  })

  it("POST resolve dulu lalu gema tiba belakangan → tetap 1 pesan", () => {
    const afterPost = [serverEcho()]
    const result = mergeChatMessages(afterPost, [serverEcho()])
    expect(result.changed).toBe(false)
    expect(result.next).toBe(afterPost) // identik → skip setState
  })

  it("pesan baru lawan bicara tetap di-append + hasFreshFromOther", () => {
    const prev = [serverEcho()]
    const fromOther: ChatMessage = {
      id: "srv-2",
      text: "Oke ditunggu",
      messageType: "TEXT",
      fromUser: false,
      createdAt: iso(60_000),
    }
    const result = mergeChatMessages(prev, [fromOther])
    expect(result.changed).toBe(true)
    expect(result.added).toBe(1)
    expect(result.hasFreshFromOther).toBe(true)
    expect(result.next.map((m) => m.id)).toEqual(["srv-1", "srv-2"])
  })

  it("C-07: pesan yang sudah ada ikut disegarkan (reaksi/edit) tanpa duplikat", () => {
    const prev: ChatMessage[] = [
      { id: "srv-9", text: "halo", messageType: "TEXT", fromUser: false, createdAt: iso(-60_000) },
    ]
    const updated: ChatMessage = {
      ...prev[0],
      isEdited: true,
      text: "halo!",
      reactions: [{ emoji: "👍", count: 1, reactedByMe: false }],
    }
    const result = mergeChatMessages(prev, [updated])
    expect(result.changed).toBe(true)
    expect(result.added).toBe(0)
    expect(result.next).toHaveLength(1)
    expect(result.next[0].text).toBe("halo!")
    expect(result.next[0].isEdited).toBe(true)
  })

  it("pesan terhapus (tombstone by id) tidak terganggu dedupe", () => {
    const prev: ChatMessage[] = [
      { id: "srv-9", text: "halo", messageType: "TEXT", fromUser: true, createdAt: iso(-60_000) },
    ]
    const tombstone: ChatMessage = { ...prev[0], text: undefined, isDeleted: true }
    const result = mergeChatMessages(prev, [tombstone])
    expect(result.next).toHaveLength(1)
    expect(result.next[0].isDeleted).toBe(true)
  })

  it("dua gema identik dalam satu batch tidak mencuri slot yang sama", () => {
    const prev = [optimistic({ id: "temp-a", createdAt: iso(0) })]
    const echo2 = serverEcho({ id: "srv-2", createdAt: iso(1600) })
    const result = mergeChatMessages(prev, [serverEcho(), echo2])
    // srv-1 mengganti temp-a; srv-2 tidak punya kandidat → append.
    expect(result.next.map((m) => m.id)).toEqual(["srv-1", "srv-2"])
  })

  it("urutan waktu tetap menaik setelah replace", () => {
    const prev = [
      { id: "srv-0", text: "pagi", messageType: "TEXT" as const, fromUser: false, createdAt: iso(-120_000) },
      optimistic(),
    ]
    const result = mergeChatMessages(prev, [serverEcho()])
    expect(result.next.map((m) => m.id).sort()).toEqual(["srv-0", "srv-1"])
    const times = result.next.map((m) => new Date(m.createdAt).getTime())
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })
})


/**
 * 2026-10-08: gema netral milik sendiri.
 *
 * Pada koneksi lambat, POST bisa resolve jauh setelah socket mengirim gema —
 * dan sebagian payload gema tidak membawa `fromUser`/`isMine` sehingga
 * `normalizeChatMessage` memberi `fromUser: false`. Tanpa `selfIds`, gema itu
 * di-append sebagai "pesan baru" dan bubble ganda menetap sampai ruang
 * ditutup. Dengan `selfIds`, pengirim yang cocok dengan identitas saya tetap
 * MENGGANTIKAN bubble optimistis.
 */
describe("gema netral milik sendiri (selfIds)", () => {
  const SELF = ["USR-ME-1", "cuid-me"]

  it("gema fromUser=false dengan senderId saya MENGGANTI bubble optimistis", () => {
    const prev = [optimistic()]
    const neutral = serverEcho({ fromUser: false, senderId: "USR-ME-1" })
    const result = mergeChatMessages(prev, [neutral], { selfIds: SELF })
    expect(result.next.map((m) => m.id)).toEqual(["srv-1"])
    expect(result.added).toBe(0)
    expect(result.hasFreshFromOther).toBe(false)
  })

  it("`sender.userId` juga dikenali (payload tanpa senderId datar)", () => {
    const neutral = serverEcho({
      fromUser: false,
      senderId: null,
      sender: { id: "cuid-me", userId: "USR-ME-1", fullName: "Saya" },
    })
    const result = mergeChatMessages([optimistic()], [neutral], { selfIds: SELF })
    expect(result.next.map((m) => m.id)).toEqual(["srv-1"])
    expect(result.added).toBe(0)
  })

  it("pesan lawan bicara dengan teks IDENTIK tidak mencuri bubble optimistis", () => {
    const theirs = serverEcho({ fromUser: false, senderId: "USR-OTHER", sender: null })
    const result = mergeChatMessages([optimistic()], [theirs], { selfIds: SELF })
    // Dua bubble: milik saya (masih sending) + pesan lawan yang memang baru.
    expect(result.next.map((m) => m.id).sort()).toEqual(["srv-1", "temp-1"])
    expect(result.added).toBe(1)
    expect(result.hasFreshFromOther).toBe(true)
  })

  it("tanpa selfIds perilaku LAMA dipertahankan (konservatif)", () => {
    const neutral = serverEcho({ fromUser: false, senderId: "USR-ME-1" })
    const result = mergeChatMessages([optimistic()], [neutral])
    expect(result.next.map((m) => m.id).sort()).toEqual(["srv-1", "temp-1"])
    expect(result.added).toBe(1)
  })

  it("gema netral tanpa id pengirim + selfIds dikenal tetap di-append", () => {
    const neutral = serverEcho({ fromUser: false, senderId: null, sender: null })
    const result = mergeChatMessages([optimistic()], [neutral], { selfIds: SELF })
    expect(result.next.map((m) => m.id).sort()).toEqual(["srv-1", "temp-1"])
  })

  it("findOptimisticMatch menerima gema netral milik sendiri", () => {
    const neutral = serverEcho({ fromUser: false, senderId: "USR-ME-1" })
    expect(findOptimisticMatch([optimistic()], neutral, { selfIds: SELF })?.id).toBe("temp-1")
    expect(findOptimisticMatch([optimistic()], neutral)).toBeNull()
  })
})
