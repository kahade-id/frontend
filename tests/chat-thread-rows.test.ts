/**
 * Audit chat I24 — menambah satu pesan TIDAK boleh membuat seluruh list
 * di-render ulang. Baris yang isinya tidak berubah harus identik (`===`)
 * dan kunci baris harus stabil saat bubble optimistis diganti pesan server.
 */
import { describe, expect, it } from "vitest"

import type { ChatMessage } from "@/lib/api/chat"
import { dayKey, dayLabel } from "@/lib/chat-day-label"
import { reconcileSentMessage } from "@/lib/chat-dedupe"
import { createTempMessageId } from "@/lib/chat-optimistic"
import { buildThreadRows, stickyDayChildIndices, type ThreadRow } from "@/lib/chat-thread-rows"

const at = (day: number, minute: number) => new Date(2026, 9, day, 9, minute).toISOString()
const msg = (id: string, day: number, minute: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  messageType: "TEXT",
  fromUser: false,
  text: id,
  createdAt: at(day, minute),
  ...extra,
})

const opts = (over: Partial<Parameters<typeof buildThreadRows>[1]> = {}) => ({
  unreadAnchorId: null,
  unreadCount: 0,
  dayKey,
  dayLabel: (iso: string) => dayLabel(iso, new Date(2026, 9, 7, 12, 0)),
  ...over,
})

describe("buildThreadRows", () => {
  it("menyisipkan pemisah hari, pemisah belum-dibaca, dan menanam `previous` di tiap bubble", () => {
    const a = msg("a", 6, 1)
    const b = msg("b", 7, 1)
    const c = msg("c", 7, 2)
    const rows = buildThreadRows([a, b, c], opts({ unreadAnchorId: "c", unreadCount: 2 }))
    expect(rows.map((r) => r.kind)).toEqual(["day", "msg", "day", "msg", "unread", "msg"])
    const msgRows = rows.filter((r): r is Extract<ThreadRow, { kind: "msg" }> => r.kind === "msg")
    expect(msgRows.map((r) => r.previous?.id)).toEqual([undefined, "a", "b"])
    expect(rows.find((r) => r.kind === "unread")).toMatchObject({ anchorId: "c", count: 2 })
    expect(rows[0]).toMatchObject({ kind: "day", label: "Kemarin" })
  })

  it("menambah satu pesan: SEMUA baris lama identik; hanya baris baru yang objek baru", () => {
    const base = [msg("a", 7, 1), msg("b", 7, 2), msg("c", 7, 3)]
    const first = buildThreadRows(base, opts())
    const sent = msg("d", 7, 4)
    const second = buildThreadRows([...base, sent], opts({ previousRows: first }))
    expect(second).toHaveLength(first.length + 1)
    first.forEach((row, i) => expect(second[i]).toBe(row))
    expect(second[second.length - 1]).toMatchObject({ kind: "msg", previous: base[2] })
  })

  it("pesan pertama hari baru: hanya pemisah hari + bubble baru yang objek baru", () => {
    const base = [msg("a", 6, 1), msg("b", 6, 2)]
    const first = buildThreadRows(base, opts())
    const second = buildThreadRows([...base, msg("c", 7, 1)], opts({ previousRows: first }))
    first.forEach((row, i) => expect(second[i]).toBe(row))
    expect(second.slice(first.length).map((r) => r.kind)).toEqual(["day", "msg"])
  })

  it("tidak ada perubahan: ARRAY lama dikembalikan (data FlatList identik → bail-out)", () => {
    const list = [msg("a", 7, 1), msg("b", 7, 2)]
    const first = buildThreadRows(list, opts())
    const again = buildThreadRows([...list], opts({ previousRows: first }))
    expect(again).toBe(first)
  })

  it("memuat riwayat lama (prepend): hanya baris yang `previous`-nya berubah yang diganti", () => {
    const newer = [msg("c", 7, 1), msg("d", 7, 2)]
    const first = buildThreadRows(newer, opts())
    const older = msg("b", 7, 0)
    const second = buildThreadRows([older, ...newer], opts({ previousRows: first }))
    const byKey = new Map(second.map((r) => [r.key, r]))
    // "d" tidak berubah (previous tetap "c") → identik; "c" kini punya previous → objek baru.
    expect(byKey.get("d")).toBe(first.find((r) => r.key === "d"))
    expect(byKey.get("c")).not.toBe(first.find((r) => r.key === "c"))
  })

  it("pesan yang diedit/bereaksi (objek pesan baru) hanya mengganti barisnya", () => {
    const a = msg("a", 7, 1)
    const b = msg("b", 7, 2)
    const first = buildThreadRows([a, b], opts())
    const bEdited = { ...b, text: "diedit" }
    const second = buildThreadRows([a, bEdited], opts({ previousRows: first }))
    expect(second[0]).toBe(first[0]) // day
    expect(second[1]).toBe(first[1]) // a
    expect(second[2]).not.toBe(first[2]) // b
  })

  it("label hari berubah (lewat tengah malam) → baris hari diganti, bubble tidak", () => {
    const list = [msg("a", 6, 1)]
    const today = (iso: string) => dayLabel(iso, new Date(2026, 9, 6, 12))
    const tomorrow = (iso: string) => dayLabel(iso, new Date(2026, 9, 7, 12))
    const first = buildThreadRows(list, opts({ dayLabel: today }))
    const second = buildThreadRows(list, opts({ dayLabel: tomorrow, previousRows: first }))
    expect(first[0]).toMatchObject({ label: "Hari ini" })
    expect(second[0]).toMatchObject({ label: "Kemarin" })
    expect(second[0]).not.toBe(first[0])
    expect(second[1]).toBe(first[1])
  })
})

describe("kunci baris stabil saat bubble optimistis diganti pesan server (anti-kedip)", () => {
  it("kunci sebelum dan sesudah penggantian IDENTIK — baris tidak di-remount", () => {
    const key = "9b2c0a52-1111-4222-8333-444455556666"
    const temp = msg(createTempMessageId(key), 7, 5, {
      fromUser: true,
      sendStatus: "sending",
      sendIdempotencyKey: key,
    })
    const before = buildThreadRows([msg("a", 7, 1), temp], opts())
    const sent = msg("srv-100", 7, 5, { fromUser: true })
    const after = buildThreadRows(
      reconcileSentMessage([msg("a", 7, 1), temp], temp.id, sent),
      opts({ previousRows: before }),
    )
    const keyOfLast = (rows: ThreadRow[]) => rows[rows.length - 1]?.key
    expect(keyOfLast(after)).toBe(keyOfLast(before))
    expect(keyOfLast(after)).toBe(temp.id)
    // Baris berisi pesan server yang sama, tetapi objek barisnya diperbarui.
    const lastAfter = after[after.length - 1] as Extract<ThreadRow, { kind: "msg" }>
    expect(lastAfter.message.id).toBe("srv-100")
  })
})

describe("stickyDayChildIndices — ruang indeks ANAK (header = anak ke-0)", () => {
  const rows = () =>
    buildThreadRows([msg("a", 5, 1), msg("b", 5, 2), msg("c", 6, 1), msg("d", 6, 2)], opts())

  it("tanpa header list: indeks = indeks data (pemisah di 0 dan 3)", () => {
    expect(rows().map((r) => r.kind)).toEqual(["day", "msg", "msg", "day", "msg", "msg"])
    expect(stickyDayChildIndices(rows(), 0)).toEqual([0, 3])
  })

  it("dengan header list: setiap indeks digeser +1 (VirtualizedList mencocokkan item i dengan i+1)", () => {
    expect(stickyDayChildIndices(rows(), 1)).toEqual([1, 4])
  })

  it("header list sendiri TIDAK pernah menempel (indeks 0 tidak ikut)", () => {
    expect(stickyDayChildIndices(rows(), 1)).not.toContain(0)
  })

  it("tanpa pemisah hari → tidak ada yang menempel", () => {
    expect(stickyDayChildIndices([], 1)).toEqual([])
  })
})
