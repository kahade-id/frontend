/**
 * Audit chat F14 — logika yang dulu di dalam useEffect layar ruang chat.
 */
import { describe, expect, it } from "vitest"

import type { ChatMessage } from "@/lib/api/chat"
import {
  applyStarredIds,
  dmSafetyCounterpartId,
  nextInlineActiveId,
} from "@/lib/chat-room-effects"

const msg = (id: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  messageType: "TEXT",
  fromUser: false,
  createdAt: "2026-10-07T08:00:00.000Z",
  ...extra,
})

describe("applyStarredIds", () => {
  it("tidak membuat objek baru untuk pesan yang statusnya sudah benar", () => {
    const a = msg("a")
    const b = msg("b", { isStarred: true })
    const c = msg("c")
    const next = applyStarredIds([a, b, c], new Set(["b", "c"]))
    // a dan b sudah benar → objek YANG SAMA (memo baris utuh); hanya c diganti.
    expect(next[0]).toBe(a)
    expect(next[1]).toBe(b)
    expect(next[2]).not.toBe(c)
  })

  it("mengembalikan array asal bila tak ada perubahan (identitas)", () => {
    const list = [msg("a"), msg("b", { isStarred: true })]
    expect(applyStarredIds(list, new Set(["b"]))).toBe(list)
    expect(applyStarredIds([], new Set())).toEqual([])
  })

  it("hanya pesan yang berubah yang diganti objeknya", () => {
    const a = msg("a")
    const b = msg("b")
    const c = msg("c", { isStarred: true })
    const next = applyStarredIds([a, b, c], new Set(["b"]))
    expect(next[0]).toBe(a)
    expect(next[1]).not.toBe(b)
    expect(next[1]?.isStarred).toBe(true)
    // c dulu berbintang, kini tidak lagi.
    expect(next[2]?.isStarred).toBe(false)
  })

  it("undefined dan false setara (tidak memicu perubahan palsu)", () => {
    const a = msg("a", { isStarred: false })
    const b = msg("b")
    const list = [a, b]
    expect(applyStarredIds(list, new Set())).toBe(list)
  })
})

describe("dmSafetyCounterpartId", () => {
  const base = { isOneToOne: true, isSelfChat: false, orderId: null, sealTier: null, counterpartId: "USR-1" }

  it("DM 1:1 tanpa transaksi dan lawan bicara tanpa badge → id lawan bicara", () => {
    expect(dmSafetyCounterpartId(base)).toBe("USR-1")
  })

  it("tidak berlaku: grup/transaksi, self-chat, ada orderId, lawan berbadge, id kosong", () => {
    expect(dmSafetyCounterpartId({ ...base, isOneToOne: false })).toBeNull()
    expect(dmSafetyCounterpartId({ ...base, isSelfChat: true })).toBeNull()
    expect(dmSafetyCounterpartId({ ...base, orderId: "ORD-1" })).toBeNull()
    expect(dmSafetyCounterpartId({ ...base, sealTier: "gold" })).toBeNull()
    expect(dmSafetyCounterpartId({ ...base, counterpartId: "" })).toBeNull()
    expect(dmSafetyCounterpartId({ ...base, counterpartId: undefined })).toBeNull()
  })

  it("keputusan berupa satu string primitif — objek room yang berganti identitas tidak memicu ulang efek", () => {
    // Dua objek room berbeda dengan isi sama → id yang sama (deps efek tidak berubah).
    expect(dmSafetyCounterpartId({ ...base })).toBe(dmSafetyCounterpartId({ ...base }))
  })
})

describe("nextInlineActiveId", () => {
  it("mempertahankan hasil aktif yang masih ada (tanpa menggulir ulang)", () => {
    expect(nextInlineActiveId(["a", "b", "c"], "b")).toEqual({ id: "b", shouldJump: false })
  })

  it("hasil aktif hilang → hasil pertama + menggulir", () => {
    expect(nextInlineActiveId(["a", "b"], "zzz")).toEqual({ id: "a", shouldJump: true })
    expect(nextInlineActiveId(["a", "b"], undefined)).toEqual({ id: "a", shouldJump: true })
  })

  it("tanpa hasil → undefined, tidak menggulir", () => {
    expect(nextInlineActiveId([], "a")).toEqual({ id: undefined, shouldJump: false })
  })
})
