/**
 * Test murni — antrean pesan live support yang gagal terkirim (F07).
 */
import { describe, expect, it } from "vitest"

import {
  bumpUnsentAttempts,
  dequeueUnsentLiveMessage,
  enqueueUnsentLiveMessage,
  getUnsentLiveMessages,
} from "@/lib/live-support-outbox"

describe("live-support-outbox", () => {
  it("enqueue lalu get per ticketId", async () => {
    await enqueueUnsentLiveMessage({ id: "m-1", ticketId: "tick-A", text: "Halo?", createdAt: 100 })
    await enqueueUnsentLiveMessage({ id: "m-2", ticketId: "tick-B", text: "Lain", createdAt: 200 })
    const a = await getUnsentLiveMessages("tick-A")
    expect(a).toHaveLength(1)
    expect(a[0].id).toBe("m-1")
    expect(a[0].attempts).toBe(0)
  })

  it("dedupe: enqueue id sama tidak menggandakan", async () => {
    await enqueueUnsentLiveMessage({ id: "m-dup", ticketId: "tick-C", text: "x", createdAt: 1 })
    await enqueueUnsentLiveMessage({ id: "m-dup", ticketId: "tick-C", text: "x", createdAt: 2 })
    const list = await getUnsentLiveMessages("tick-C")
    expect(list).toHaveLength(1)
  })

  it("bumpUnsentAttempts menaikkan counter", async () => {
    await enqueueUnsentLiveMessage({ id: "m-bump", ticketId: "tick-D", text: "y", createdAt: 1 })
    await bumpUnsentAttempts("m-bump")
    await bumpUnsentAttempts("m-bump")
    const list = await getUnsentLiveMessages("tick-D")
    expect(list[0].attempts).toBe(2)
  })

  it("dequeue menghapus entri yang berhasil terkirim", async () => {
    await enqueueUnsentLiveMessage({ id: "m-del", ticketId: "tick-E", text: "z", createdAt: 1 })
    await dequeueUnsentLiveMessage("m-del")
    expect(await getUnsentLiveMessages("tick-E")).toEqual([])
  })

  it("entri tidak valid disanitasi (tanpa id/teks dibuang)", async () => {
    await enqueueUnsentLiveMessage({ id: "", ticketId: "tick-F", text: "", createdAt: 1 })
    expect(await getUnsentLiveMessages("tick-F")).toEqual([])
  })
})
