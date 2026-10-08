/**
 * Audit chat B4 + B6 — bubble optimistis ⇄ pesan server, dan retry.
 *
 * B4 (double-bubble saat respons lambat): gema realtime tiba SEBELUM respons
 * POST dan lolos dari pencocokan → list memuat temp + gema; `map` lama
 * mengganti KEDUANYA dengan pesan yang sama → dua bubble ber-id sama.
 * `reconcileSentMessage` harus menyisakan tepat satu entri, dan kunci render
 * harus bertahan (tanpa remount = tanpa kedip).
 *
 * B6 (retry): key SAMA dan body SAMA — satu builder untuk kiriman pertama dan
 * semua retry (`buildSendDto`).
 */
import { describe, expect, it } from "vitest"

import type { ChatMessage } from "@/lib/api/chat"
import {
  clientKeyOf,
  findOptimisticMatch,
  mergeChatMessages,
  reconcileSentMessage,
} from "@/lib/chat-dedupe"
import { createTempMessageId, isTempMessageId } from "@/lib/chat-optimistic"
import { buildSendDto, resolveRetryKey } from "@/lib/chat-send-dto"

const BASE = new Date("2026-10-07T08:00:00.000Z").getTime()
const iso = (offsetMs: number) => new Date(BASE + offsetMs).toISOString()
const KEY = "0f9c1e2a-aaaa-4bbb-8ccc-1234567890ab"

function optimistic(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: createTempMessageId(KEY),
    text: "Siap, dikirim hari ini",
    messageType: "TEXT",
    fromUser: true,
    createdAt: iso(0),
    sendStatus: "sending",
    sendIdempotencyKey: KEY,
    ...overrides,
  }
}

function serverMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "srv-1",
    text: "Siap, dikirim hari ini",
    messageType: "TEXT",
    fromUser: true,
    createdAt: iso(900),
    ...overrides,
  }
}

describe("id sementara diturunkan dari idempotency key", () => {
  it("1 bubble ⇄ 1 key, dan dikenali sebagai id sementara", () => {
    const id = createTempMessageId(KEY)
    expect(id).toBe(`temp-${KEY}`)
    expect(isTempMessageId(id)).toBe(true)
    expect(createTempMessageId("lain")).not.toBe(id)
  })
})

describe("reconcileSentMessage (B4)", () => {
  it("respons POST mengganti bubble optimistis di tempatnya", () => {
    const other = serverMessage({ id: "srv-0", fromUser: false, text: "Kapan?", createdAt: iso(-5000) })
    const out = reconcileSentMessage([other, optimistic()], optimistic().id, serverMessage())
    expect(out.map((m) => m.id)).toEqual(["srv-0", "srv-1"])
    expect(out[1]?.sendStatus).toBeUndefined()
  })

  it("REGRESI double-bubble: gema lolos pencocokan → temp + gema → tepat SATU entri", () => {
    // Gema tiba dulu dengan teks yang dinormalisasi server (tidak cocok) sehingga
    // di-append; lalu respons POST tiba.
    const unmatchedEcho = serverMessage({ text: "Siap, dikirim hari ini ✓", createdAt: iso(600) })
    const list = mergeChatMessages([optimistic()], [unmatchedEcho]).next
    expect(list).toHaveLength(2) // sengaja: pencocokan gagal → duplikat sementara

    const out = reconcileSentMessage(list, optimistic().id, serverMessage())
    expect(out).toHaveLength(1)
    expect(out[0]?.id).toBe("srv-1")
    // Kode lama: list.map(m => m.id === temp || m.id === sent.id ? sent : m)
    const legacy = list.map((m) =>
      m.id === optimistic().id || m.id === "srv-1" ? serverMessage() : m,
    )
    expect(legacy.filter((m) => m.id === "srv-1")).toHaveLength(2)
  })

  it("hanya gema yang ada (bubble optimistis sudah diganti lebih dulu) → tidak digandakan", () => {
    const out = reconcileSentMessage([serverMessage()], optimistic().id, serverMessage())
    expect(out).toHaveLength(1)
  })

  it("temp maupun gema tidak ada → list dikembalikan apa adanya (pemanggil yang menambah)", () => {
    const list = [serverMessage({ id: "srv-9", createdAt: iso(-1000) })]
    expect(reconcileSentMessage(list, optimistic().id, serverMessage())).toBe(list)
  })

  it("urutan waktu dipulihkan: waktu server otoritatif", () => {
    // Pesan lawan bicara (waktu server) lebih akhir dari pesan saya menurut server,
    // walau bubble optimistis (jam perangkat) ada di ujung list.
    const theirs = serverMessage({ id: "srv-2", fromUser: false, text: "ok", createdAt: iso(2000) })
    const mine = optimistic({ createdAt: iso(3000) })
    const out = reconcileSentMessage([theirs, mine], mine.id, serverMessage({ createdAt: iso(1000) }))
    expect(out.map((m) => m.id)).toEqual(["srv-1", "srv-2"])
  })

  it("pesan server MEWARISI kunci render bubble optimistis (tanpa remount)", () => {
    const temp = optimistic()
    const out = reconcileSentMessage([temp], temp.id, serverMessage())
    expect(out[0]?.id).toBe("srv-1")
    expect(clientKeyOf(out[0] as ChatMessage)).toBe(temp.id)
    // Kunci baris sebelum & sesudah penggantian IDENTIK.
    expect(clientKeyOf(temp)).toBe(clientKeyOf(out[0] as ChatMessage))
  })

  it("retry berulang menjaga kunci pertama (bubble yang sudah pernah diganti)", () => {
    const first = reconcileSentMessage([optimistic()], optimistic().id, serverMessage())
    // Edit/refresh server berikutnya: pesan baru dengan id sama tetap memakai kunci lama.
    const again = reconcileSentMessage(first, "srv-1", serverMessage({ text: "diedit" }))
    expect(clientKeyOf(again[0] as ChatMessage)).toBe(createTempMessageId(KEY))
  })
})

describe("mergeChatMessages mewariskan kunci render (B4/I24)", () => {
  it("gema yang menggantikan bubble optimistis memakai kunci bubble itu", () => {
    const temp = optimistic()
    const { next } = mergeChatMessages([temp], [serverMessage()])
    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe("srv-1")
    expect(clientKeyOf(next[0] as ChatMessage)).toBe(temp.id)
  })

  it("pesan lawan bicara (tanpa bubble optimistis) tetap memakai id sebagai kunci", () => {
    const theirs = serverMessage({ id: "srv-7", fromUser: false })
    const { next } = mergeChatMessages([], [theirs])
    expect(clientKeyOf(next[0] as ChatMessage)).toBe("srv-7")
  })
})

describe("findOptimisticMatch lebih toleran terhadap normalisasi server (B4)", () => {
  it("CRLF vs LF dan spasi pinggir tidak menggagalkan pencocokan", () => {
    const temp = optimistic({ text: "baris 1\r\nbaris 2 " })
    expect(findOptimisticMatch([temp], serverMessage({ text: "baris 1\nbaris 2" }))?.id).toBe(temp.id)
  })

  it("server mengklasifikasi ulang media (FILE → VIDEO): masih satu keluarga", () => {
    const file = optimistic({
      messageType: "FILE",
      text: undefined,
      attachments: [{ fileName: "klip.mp4", fileUrl: "https://cdn/a", mimeType: "video/mp4", fileSize: 1000 }],
    })
    const echo = serverMessage({
      messageType: "VIDEO",
      text: undefined,
      attachments: [{ fileName: "klip.mp4", fileUrl: "https://cdn/b", mimeType: "video/mp4", fileSize: 1000 }],
    })
    expect(findOptimisticMatch([file], echo)?.id).toBe(file.id)
  })

  it("TEXT ≠ gambar walau teksnya sama (keluarga berbeda)", () => {
    const echo = serverMessage({
      messageType: "IMAGE",
      attachments: [{ fileName: "a.jpg", fileUrl: "u", mimeType: "image/jpeg", fileSize: 1 }],
    })
    expect(findOptimisticMatch([optimistic()], echo)).toBeNull()
  })

  it("ukuran lampiran 0/absen = tidak dilaporkan → kompatibel; nama beda tetap tidak cocok", () => {
    const file = optimistic({
      messageType: "FILE",
      text: undefined,
      attachments: [{ fileName: "nota.pdf", fileUrl: "f", mimeType: "application/pdf", fileSize: 0 }],
    })
    const sameName = serverMessage({
      messageType: "FILE",
      text: undefined,
      attachments: [{ fileName: "nota.pdf", fileUrl: "g", mimeType: "application/pdf", fileSize: 2048 }],
    })
    expect(findOptimisticMatch([file], sameName)?.id).toBe(file.id)
    const otherName = {
      ...sameName,
      attachments: [{ ...(sameName.attachments?.[0] as NonNullable<ChatMessage["attachments"]>[number]), fileName: "lain.pdf" }],
    }
    expect(findOptimisticMatch([file], otherName)).toBeNull()
  })

  it("gema yang memantulkan idempotency key mencocokkan tanpa tebak-tebakan teks/waktu", () => {
    const temp = optimistic({ text: "teks lokal" })
    const echo = { ...serverMessage({ text: "teks yang sudah diubah server", createdAt: iso(999_999) }), idempotencyKey: KEY } as ChatMessage
    expect(findOptimisticMatch([temp], echo)?.id).toBe(temp.id)
    // Key lain → tidak mencuri.
    const stranger = { ...echo, idempotencyKey: "kunci-lain" } as ChatMessage
    expect(findOptimisticMatch([temp], stranger)).toBeNull()
    // Bubble yang sudah failed tidak boleh dicuri walau key sama.
    expect(findOptimisticMatch([optimistic({ sendStatus: "failed" })], echo)).toBeNull()
  })
})

describe("buildSendDto + resolveRetryKey (B6)", () => {
  it("TEXT sederhana", () => {
    expect(buildSendDto(optimistic())).toEqual({
      messageType: "TEXT",
      content: "Siap, dikirim hari ini",
      attachments: undefined,
      durationSeconds: undefined,
      location: undefined,
      showcaseId: undefined,
      replyToId: undefined,
      ephemeralTtlSeconds: undefined,
      viewOnce: undefined,
    })
  })

  it("deterministik: dua panggilan menghasilkan body yang sama persis (key sama ⇒ body sama)", () => {
    const m = optimistic({
      messageType: "VOICE",
      text: undefined,
      durationSeconds: 12,
      replyToId: "srv-0",
      ephemeralTtlSeconds: 3600,
      viewOnce: true,
      attachments: [{ fileName: "vn.m4a", fileUrl: "u", mimeType: "audio/mp4", fileSize: 10, thumbnailUrl: undefined }],
    })
    expect(buildSendDto(m)).toEqual(buildSendDto(m))
    expect(buildSendDto({ ...m, sendStatus: "failed" })).toEqual(buildSendDto({ ...m, sendStatus: "sending" }))
  })

  it("pesan sekali-lihat/sementara yang di-retry TETAP sekali-lihat/sementara (bukan permanen)", () => {
    const dto = buildSendDto(optimistic({ viewOnce: true, ephemeralTtlSeconds: 86400 }))
    expect(dto.viewOnce).toBe(true)
    expect(dto.ephemeralTtlSeconds).toBe(86400)
  })

  it("VOICE membawa durationSeconds; LOCATION membawa koordinat; kartu produk membawa showcaseId", () => {
    expect(buildSendDto(optimistic({ messageType: "VOICE", durationSeconds: 7 })).durationSeconds).toBe(7)
    expect(buildSendDto(optimistic({ messageType: "TEXT", durationSeconds: 7 })).durationSeconds).toBeUndefined()
    const loc = buildSendDto(
      optimistic({ messageType: "LOCATION", text: undefined, location: { lat: -6.2, lng: 106.8, label: null } }),
    )
    expect(loc.location).toEqual({ lat: -6.2, lng: 106.8, label: undefined })
    const card = buildSendDto(
      optimistic({
        messageType: "PRODUCT_CARD",
        text: undefined,
        card: { kind: "PRODUCT_CARD", showcaseId: "sc-1", title: "Jam", priceMin: null, priceMax: null, imageUrl: null, sellerUsername: "u", snapshotAt: iso(0) },
      }),
    )
    expect(card.showcaseId).toBe("sc-1")
  })

  it("tipe tak dikenal jatuh ke TEXT (validasi defensif)", () => {
    expect(buildSendDto(optimistic({ messageType: "POLL" })).messageType).toBe("TEXT")
  })

  it("resolveRetryKey memakai key kiriman pertama", () => {
    expect(resolveRetryKey({ sendIdempotencyKey: KEY })).toEqual({ key: KEY, generated: false })
  })

  it("data lama tanpa key: key baru dibuat sekali dan ditandai generated agar disimpan", () => {
    const a = resolveRetryKey({})
    expect(a.generated).toBe(true)
    expect(a.key).toMatch(/^[0-9a-f-]{36}$/)
    // Setelah disimpan pada bubble, percobaan berikutnya memakai key itu.
    expect(resolveRetryKey({ sendIdempotencyKey: a.key })).toEqual({ key: a.key, generated: false })
  })
})
