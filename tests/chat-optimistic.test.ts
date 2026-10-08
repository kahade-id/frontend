/**
 * Audit chat A1–A3 — pin, lepas pin, dan hapus pesan HARUS optimistis dan
 * HARUS dibatalkan bila backend menolak.
 *
 * Yang dikunci:
 *   - perubahan UI terjadi SINKRON, sebelum request selesai (bukan menunggu),
 *   - kegagalan mengembalikan state persis (ikon pin + baris pin + posisi
 *     bubble), dan hanya pesan yang GAGAL yang dikembalikan,
 *   - pesan optimistis (temp-…) tidak pernah dikirim ke server,
 *   - poll/gema yang membawa pesan "sedang dihapus" tidak menghidupkannya.
 */
import { describe, expect, it, vi } from "vitest"

import type { ChatMessage } from "@/lib/api/chat"
import { applyDeleteMessages, applyPinChange } from "@/lib/chat-message-actions"
import {
  isTempMessageId,
  removeMessagesByIds,
  restoreMessages,
  setPinnedOptimistic,
  settleWithConcurrency,
  sortMessagesByTime,
} from "@/lib/chat-optimistic"

function msg(id: string, minute: number, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    text: `pesan ${id}`,
    messageType: "TEXT",
    fromUser: true,
    createdAt: new Date(Date.UTC(2026, 9, 7, 8, minute)).toISOString(),
    ...extra,
  }
}

/** Harness state minimal: meniru `useState` + updater fungsional. */
function store<T>(initial: T) {
  let value = initial
  return {
    get: () => value,
    set: (updater: (prev: T) => T) => {
      value = updater(value)
    },
  }
}

/** Promise yang diselesaikan manual — untuk memeriksa state SEBELUM request selesai. */
function deferred<T = unknown>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("helper daftar pesan", () => {
  it("isTempMessageId hanya mengenali id optimistis", () => {
    expect(isTempMessageId("temp-1699-abc")).toBe(true)
    expect(isTempMessageId("msg_123")).toBe(false)
  })

  it("removeMessagesByIds mempertahankan identitas array bila tak ada yang cocok", () => {
    const list = [msg("a", 1), msg("b", 2)]
    expect(removeMessagesByIds(list, new Set(["zzz"]))).toBe(list)
    expect(removeMessagesByIds(list, new Set())).toBe(list)
    expect(removeMessagesByIds(list, new Set(["a"])).map((m) => m.id)).toEqual(["b"])
  })

  it("restoreMessages menyisipkan kembali sesuai urutan waktu dan tidak menggandakan", () => {
    const a = msg("a", 1)
    const b = msg("b", 2)
    const c = msg("c", 3)
    expect(restoreMessages([a, c], [b]).map((m) => m.id)).toEqual(["a", "b", "c"])
    // Pesan yang sudah ada lagi (mis. dibawa poll) tidak digandakan.
    const already = [a, b, c]
    expect(restoreMessages(already, [b])).toBe(already)
    expect(restoreMessages(already, [])).toBe(already)
  })

  it("sortMessagesByTime stabil untuk waktu yang sama", () => {
    const x = msg("x", 5)
    const y = msg("y", 5)
    const early = msg("early", 1)
    expect(sortMessagesByTime([x, y, early]).map((m) => m.id)).toEqual(["early", "x", "y"])
  })

  it("setPinnedOptimistic: tambah, segarkan, buang — dan kebalikannya = rollback", () => {
    const m = msg("a", 1)
    const added = setPinnedOptimistic([], m, true, "2026-10-07T00:00:00.000Z")
    expect(added).toHaveLength(1)
    expect(added[0]).toMatchObject({ id: "a", isPinned: true, pinnedAt: "2026-10-07T00:00:00.000Z" })
    // Menambah dua kali tidak menggandakan baris pin.
    expect(setPinnedOptimistic(added, m, true)).toHaveLength(1)
    // Lepas pin: entri hilang; lepas pin yang tak ada = identitas sama.
    expect(setPinnedOptimistic(added, m, false)).toEqual([])
    const empty: ChatMessage[] = []
    expect(setPinnedOptimistic(empty, m, false)).toBe(empty)
  })

  it("settleWithConcurrency: batas serentak, urutan hasil, tidak pernah reject", async () => {
    let running = 0
    let peak = 0
    const task = (i: number, fail = false) => async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      running -= 1
      if (fail) throw new Error(`gagal ${i}`)
      return i
    }
    const results = await settleWithConcurrency(
      [task(0), task(1, true), task(2), task(3), task(4, true), task(5)],
      2,
    )
    expect(peak).toBeLessThanOrEqual(2)
    expect(results.map((r) => r.status)).toEqual([
      "fulfilled",
      "rejected",
      "fulfilled",
      "fulfilled",
      "rejected",
      "fulfilled",
    ])
    expect(results[2]).toEqual({ status: "fulfilled", value: 2 })
    expect(await settleWithConcurrency([], 5)).toEqual([])
  })
})

describe("applyPinChange (A1 pin, A3 lepas pin)", () => {
  function setup(initialMessage: ChatMessage, initialPinned: ChatMessage[] = []) {
    const messages = store<ChatMessage[]>([initialMessage])
    const pinned = store<ChatMessage[]>(initialPinned)
    const patchMessage = (id: string, patch: (m: ChatMessage) => ChatMessage) =>
      messages.set((prev) => prev.map((m) => (m.id === id ? patch(m) : m)))
    return { messages, pinned, patchMessage }
  }

  it("pin: ikon + baris pin berubah SEBELUM request selesai", async () => {
    const m = msg("a", 1)
    const { messages, pinned, patchMessage } = setup(m)
    const gate = deferred()
    const pin = vi.fn(() => gate.promise)

    const done = applyPinChange({
      roomId: "r1",
      message: m,
      wantPin: true,
      pin,
      unpin: vi.fn(),
      patchMessage,
      setPinned: pinned.set,
    })

    // Request belum selesai, tetapi UI sudah berubah.
    expect(pin).toHaveBeenCalledWith("r1", "a")
    expect(messages.get()[0]?.isPinned).toBe(true)
    expect(pinned.get().map((p) => p.id)).toEqual(["a"])

    gate.resolve({})
    await expect(done).resolves.toEqual({ ok: true })
    expect(messages.get()[0]?.isPinned).toBe(true)
    expect(pinned.get()).toHaveLength(1)
  })

  it("pin gagal: ikon dan baris pin DIKEMBALIKAN, galat diteruskan untuk toast", async () => {
    const m = msg("a", 1)
    const { messages, pinned, patchMessage } = setup(m)
    const boom = new Error("Maksimal 3 pin")
    const result = await applyPinChange({
      roomId: "r1",
      message: m,
      wantPin: true,
      pin: vi.fn().mockRejectedValue(boom),
      unpin: vi.fn(),
      patchMessage,
      setPinned: pinned.set,
    })
    expect(result).toEqual({ ok: false, error: boom })
    expect(messages.get()[0]?.isPinned).toBe(false)
    expect(pinned.get()).toEqual([])
  })

  it("lepas pin: hilang seketika; gagal → pin dipulihkan di ikon DAN baris pin", async () => {
    const m = msg("a", 1, { isPinned: true })
    const { messages, pinned, patchMessage } = setup(m, [m])
    const gate = deferred()
    const unpin = vi.fn(() => gate.promise)

    const done = applyPinChange({
      roomId: "r1",
      message: m,
      wantPin: false,
      pin: vi.fn(),
      unpin,
      patchMessage,
      setPinned: pinned.set,
    })
    expect(messages.get()[0]?.isPinned).toBe(false)
    expect(pinned.get()).toEqual([])

    gate.reject(new Error("offline"))
    const result = await done
    expect(result.ok).toBe(false)
    expect(messages.get()[0]?.isPinned).toBe(true)
    expect(pinned.get().map((p) => p.id)).toEqual(["a"])
  })

  it("rollback tidak menimpa perubahan sah yang masuk selagi request berjalan", async () => {
    const m = msg("a", 1)
    const other = msg("b", 2, { isPinned: true })
    const { messages, pinned, patchMessage } = setup(m, [other])
    messages.set((prev) => [...prev, other])
    const gate = deferred()
    const done = applyPinChange({
      roomId: "r1",
      message: m,
      wantPin: true,
      pin: vi.fn(() => gate.promise),
      unpin: vi.fn(),
      patchMessage,
      setPinned: pinned.set,
    })
    // Lawan bicara melepas pin "b" lewat realtime selagi request kita berjalan.
    pinned.set((prev) => prev.filter((p) => p.id !== "b"))
    gate.reject(new Error("gagal"))
    await done
    // "a" dikembalikan, "b" tetap lepas (snapshot lama akan menghidupkannya lagi).
    expect(pinned.get()).toEqual([])
  })
})

describe("applyDeleteMessages (A2)", () => {
  function setup(initial: ChatMessage[], pinnedInitial: ChatMessage[] = []) {
    const messages = store<ChatMessage[]>(initial)
    const pinned = store<ChatMessage[]>(pinnedInitial)
    const forgotten: string[] = []
    return { messages, pinned, forgotten }
  }

  it("bubble hilang SEBELUM request selesai; sukses → tetap hilang", async () => {
    const a = msg("a", 1)
    const b = msg("b", 2)
    const { messages, pinned, forgotten } = setup([a, b])
    const gate = deferred()
    const remove = vi.fn(() => gate.promise)

    const done = applyDeleteMessages({
      roomId: "r1",
      targets: [a],
      remove,
      setMessages: messages.set,
      setPinned: pinned.set,
      forgetLocal: (id) => forgotten.push(id),
    })
    expect(remove).toHaveBeenCalledWith("r1", "a")
    expect(messages.get().map((m) => m.id)).toEqual(["b"])

    gate.resolve(undefined)
    const result = await done
    expect(result.failed).toEqual([])
    expect(result.deleted.map((m) => m.id)).toEqual(["a"])
    expect(messages.get().map((m) => m.id)).toEqual(["b"])
  })

  it("hanya pesan yang GAGAL dikembalikan, di posisi waktunya; baris pin ikut dipulihkan", async () => {
    const a = msg("a", 1)
    const b = msg("b", 2, { isPinned: true })
    const c = msg("c", 3)
    const { messages, pinned } = setup([a, b, c], [b])
    const boom = new Error("403")
    const result = await applyDeleteMessages({
      roomId: "r1",
      targets: [a, b],
      remove: vi.fn(async (_room: string, id: string) => {
        if (id === "b") throw boom
      }),
      setMessages: messages.set,
      setPinned: pinned.set,
      forgetLocal: () => undefined,
    })
    expect(result.deleted.map((m) => m.id)).toEqual(["a"])
    expect(result.failed).toEqual([{ message: b, error: boom }])
    expect(messages.get().map((m) => m.id)).toEqual(["b", "c"])
    expect(pinned.get().map((p) => p.id)).toEqual(["b"])
  })

  it("pesan optimistis (temp-…) tidak dikirim ke server dan dilupakan dari antrean lokal", async () => {
    const real = msg("a", 1)
    const temp = msg("temp-1-x", 2, { sendStatus: "failed" })
    const { messages, pinned, forgotten } = setup([real, temp])
    const remove = vi.fn().mockResolvedValue(undefined)
    const result = await applyDeleteMessages({
      roomId: "r1",
      targets: [temp],
      remove,
      setMessages: messages.set,
      setPinned: pinned.set,
      forgetLocal: (id) => forgotten.push(id),
    })
    expect(remove).not.toHaveBeenCalled()
    expect(forgotten).toEqual(["temp-1-x"])
    expect(result.deleted.map((m) => m.id)).toEqual(["temp-1-x"])
    expect(messages.get().map((m) => m.id)).toEqual(["a"])
  })

  it("id yang sedang dihapus tercatat di `pending` selama request, lalu dibersihkan", async () => {
    const a = msg("a", 1)
    const { messages, pinned } = setup([a])
    const pending = new Set<string>()
    const gate = deferred()
    const done = applyDeleteMessages({
      roomId: "r1",
      targets: [a],
      remove: vi.fn(() => gate.promise),
      setMessages: messages.set,
      setPinned: pinned.set,
      forgetLocal: () => undefined,
      pending,
    })
    expect([...pending]).toEqual(["a"])
    gate.resolve(undefined)
    await done
    expect(pending.size).toBe(0)
  })

  it("pending juga dibersihkan saat gagal, dan tanpa target tidak ada efek", async () => {
    const a = msg("a", 1)
    const { messages, pinned } = setup([a])
    const pending = new Set<string>()
    await applyDeleteMessages({
      roomId: "r1",
      targets: [a],
      remove: vi.fn().mockRejectedValue(new Error("x")),
      setMessages: messages.set,
      setPinned: pinned.set,
      forgetLocal: () => undefined,
      pending,
    })
    expect(pending.size).toBe(0)
    expect(messages.get().map((m) => m.id)).toEqual(["a"])

    const empty = await applyDeleteMessages({
      roomId: "r1",
      targets: [],
      remove: vi.fn(),
      setMessages: messages.set,
      setPinned: pinned.set,
      forgetLocal: () => undefined,
    })
    expect(empty).toEqual({ deleted: [], failed: [] })
  })

  it("menghormati batas konkurensi saat menghapus banyak pesan", async () => {
    const items = Array.from({ length: 12 }, (_, i) => msg(`m${i}`, i))
    const { messages, pinned } = setup(items)
    let running = 0
    let peak = 0
    await applyDeleteMessages({
      roomId: "r1",
      targets: items,
      remove: async () => {
        running += 1
        peak = Math.max(peak, running)
        await new Promise((r) => setTimeout(r, 3))
        running -= 1
      },
      setMessages: messages.set,
      setPinned: pinned.set,
      forgetLocal: () => undefined,
      concurrency: 3,
    })
    expect(peak).toBeLessThanOrEqual(3)
    expect(messages.get()).toEqual([])
  })
})
