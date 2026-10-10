/**
 * Audit Pesan 2026-10-10 (bug #8): logika murni polling — voting optimistis
 * harus menghasilkan bentuk yang sama dengan jawaban server.
 */
import { describe, expect, it } from "vitest"

import type { ChatPoll } from "@/lib/api/chat"
import { applyOptimisticVote, pollLockState, pollOptionPercent } from "@/lib/chat-poll"

function poll(over: Partial<ChatPoll> = {}): ChatPoll {
  return {
    id: "p1",
    roomId: "r1",
    question: "Kapan COD?",
    options: [
      { index: 0, text: "Sabtu", votes: 2 },
      { index: 1, text: "Minggu", votes: 1 },
      { index: 2, text: "Senin", votes: 0 },
    ],
    totalVotes: 3,
    allowMultiple: false,
    deadline: null,
    isClosed: false,
    myVotes: [],
    createdBy: { userId: "USR-1", fullName: "Budi" },
    createdAt: "2026-10-10T00:00:00.000Z",
    ...over,
  }
}

describe("applyOptimisticVote", () => {
  it("pilihan tunggal: suara pertama menambah opsi & total", () => {
    const next = applyOptimisticVote(poll(), [1])
    expect(next.myVotes).toEqual([1])
    expect(next.options[1].votes).toBe(2)
    expect(next.totalVotes).toBe(4)
  })
  it("pilihan tunggal: mengganti suara lama (opsi lama turun, baru naik, total tetap)", () => {
    const next = applyOptimisticVote(poll({ myVotes: [0] }), [2])
    expect(next.myVotes).toEqual([2])
    expect(next.options[0].votes).toBe(1)
    expect(next.options[2].votes).toBe(1)
    expect(next.totalVotes).toBe(3)
  })
  it("pilihan ganda: menambah tanpa menghapus yang lama (idempoten)", () => {
    const base = poll({ allowMultiple: true, myVotes: [0] })
    const next = applyOptimisticVote(base, [0, 2])
    expect(next.myVotes).toEqual([0, 2])
    expect(next.options[0].votes).toBe(2) // tidak dihitung dua kali
    expect(next.options[2].votes).toBe(1)
    expect(next.totalVotes).toBe(4)
  })
  it("indeks di luar jangkauan diabaikan", () => {
    const next = applyOptimisticVote(poll(), [7])
    expect(next.myVotes).toEqual([])
    expect(next.totalVotes).toBe(3)
  })
})

describe("pollLockState / pollOptionPercent", () => {
  it("ditutup pembuat menang atas tenggat", () => {
    expect(pollLockState({ isClosed: true, deadline: null }, 0)).toBe("closed")
  })
  it("tenggat lewat → expired; belum → open", () => {
    const deadline = "2026-10-10T10:00:00.000Z"
    expect(pollLockState({ isClosed: false, deadline }, Date.parse(deadline) + 1)).toBe("expired")
    expect(pollLockState({ isClosed: false, deadline }, Date.parse(deadline) - 1)).toBe("open")
  })
  it("persen relatif total suara, aman untuk total 0", () => {
    expect(pollOptionPercent(1, 10)).toBe(10)
    expect(pollOptionPercent(1, 0)).toBe(0)
  })
})
