/**
 * FE-019: unit test jendela thread chat terbatas dua arah (lib/chat-window).
 *
 * Yang dijaga:
 *   - trim sisi terbaru / terlama membuang tepat `length - max` pesan;
 *   - pesan optimistis/gagal (sendStatus) TIDAK PERNAH dibuang — trim
 *     melewatinya dan membuang pesan terkonfirmasi di sebelahnya;
 *   - tidak ada yang dibuang bila di bawah batas (identitas `===`);
 *   - urutan waktu menaik dipertahankan.
 */
import { describe, expect, it } from "vitest"

import type { ChatMessage } from "@/lib/api/chat"
import {
  CHAT_WINDOW_MAX_MESSAGES,
  trimNewestSide,
  trimOldestSide,
} from "@/lib/chat-window"

const BASE = new Date("2026-09-28T00:00:00.000Z").getTime()
const iso = (offsetMs: number) => new Date(BASE + offsetMs).toISOString()

function msg(id: string, offsetMs: number, extra?: Partial<ChatMessage>): ChatMessage {
  return {
    id,
    roomId: "room-1",
    senderId: "user-1",
    fromUser: true,
    messageType: "TEXT",
    text: `pesan ${id}`,
    createdAt: iso(offsetMs),
    ...extra,
  } as ChatMessage
}

/** N pesan terurut menaik: m-0 (terlama) … m-(N-1) (terbaru). */
const thread = (n: number, extra?: (i: number) => Partial<ChatMessage>) =>
  Array.from({ length: n }, (_, i) => msg(`m-${i}`, i * 1000, extra?.(i)))

describe("FE-019 trimNewestSide", () => {
  it("tidak mengubah apa pun di bawah batas (identitas ===)", () => {
    const input = thread(CHAT_WINDOW_MAX_MESSAGES)
    const out = trimNewestSide(input)
    expect(out.next).toBe(input)
    expect(out.dropped).toBe(0)
  })

  it("membuang kelebihan dari sisi terbaru", () => {
    const input = thread(CHAT_WINDOW_MAX_MESSAGES + 30)
    const out = trimNewestSide(input)
    expect(out.dropped).toBe(30)
    expect(out.next).toHaveLength(CHAT_WINDOW_MAX_MESSAGES)
    // Yang tersisa = 120 pesan TERTUA; 30 terbaru dibuang.
    expect(out.next[0].id).toBe("m-0")
    expect(out.next[out.next.length - 1].id).toBe(`m-${CHAT_WINDOW_MAX_MESSAGES - 1}`)
  })

  it("melewati pesan pending di ujung terbaru", () => {
    const input = thread(CHAT_WINDOW_MAX_MESSAGES + 2, (i) =>
      i >= CHAT_WINDOW_MAX_MESSAGES ? { sendStatus: "sending" as const } : {},
    )
    const out = trimNewestSide(input)
    expect(out.dropped).toBe(2)
    expect(out.next).toHaveLength(CHAT_WINDOW_MAX_MESSAGES)
    // Dua pesan pending tetap ada di ujung; yang dibuang = m-118, m-119.
    expect(out.next[out.next.length - 1].sendStatus).toBe("sending")
    expect(out.next[out.next.length - 2].sendStatus).toBe("sending")
    expect(out.next.map((m) => m.id)).not.toContain("m-118")
    expect(out.next.map((m) => m.id)).not.toContain("m-119")
  })

  it("tidak membuang apa pun bila semua kelebihan adalah pesan pending", () => {
    const input = thread(5, () => ({ sendStatus: "failed" as const }))
    const out = trimNewestSide(input, 3)
    expect(out.dropped).toBe(0)
    expect(out.next).toBe(input)
  })
})

describe("FE-019 trimOldestSide", () => {
  it("membuang kelebihan dari sisi terlama", () => {
    const input = thread(CHAT_WINDOW_MAX_MESSAGES + 25)
    const out = trimOldestSide(input)
    expect(out.dropped).toBe(25)
    expect(out.next).toHaveLength(CHAT_WINDOW_MAX_MESSAGES)
    expect(out.next[0].id).toBe("m-25")
    expect(out.next[out.next.length - 1].id).toBe(`m-${CHAT_WINDOW_MAX_MESSAGES + 24}`)
  })

  it("melewati pesan queued di ujung terlama", () => {
    const input = thread(CHAT_WINDOW_MAX_MESSAGES + 2, (i) =>
      i < 2 ? { sendStatus: "queued" as const } : {},
    )
    const out = trimOldestSide(input)
    expect(out.next).toHaveLength(CHAT_WINDOW_MAX_MESSAGES)
    expect(out.next[0].sendStatus).toBe("queued")
    expect(out.next[1].sendStatus).toBe("queued")
  })

  it("melewati pesan pending di ujung terlama", () => {
    const input = thread(CHAT_WINDOW_MAX_MESSAGES + 2, (i) =>
      i < 2 ? { sendStatus: "failed" as const } : {},
    )
    const out = trimOldestSide(input)
    expect(out.dropped).toBe(2)
    expect(out.next).toHaveLength(CHAT_WINDOW_MAX_MESSAGES)
    expect(out.next[0].sendStatus).toBe("failed")
    expect(out.next[1].sendStatus).toBe("failed")
    expect(out.next[2].id).toBe("m-4")
  })

  it("urutan waktu menaik dipertahankan", () => {
    const input = thread(CHAT_WINDOW_MAX_MESSAGES + 10)
    for (const trim of [trimNewestSide, trimOldestSide]) {
      const out = trim(input)
      const times = out.next.map((m) => Date.parse(m.createdAt))
      const sorted = [...times].sort((a, b) => a - b)
      expect(times).toEqual(sorted)
    }
  })
})
