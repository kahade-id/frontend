/**
 * Redesign tab Transaksi 2026-09-27 — pengelompokan order per hari (murni).
 *
 * Mengunci lib/transaction-grouping.ts:
 *  1. Label "Hari ini" / "Kemarin" / tanggal panjang + sub tanggal pendek.
 *  2. Batas hari memakai WIB (Asia/Jakarta), bukan tanggal perangkat/UTC.
 *  3. Order se-hari menjadi satu kelompok; urutan masuk dipertahankan.
 *  4. createdAt tidak valid → kelompok "Tanggal tidak tersedia".
 *  5. Nilai item TIDAK diubah (referensi yang sama, tanpa agregat).
 */
import { afterEach, describe, expect, it, vi } from "vitest"

import { groupOrdersByDay } from "@/lib/transaction-grouping"

type MiniOrder = { id: string; createdAt: string }

function order(id: string, createdAt: string): MiniOrder {
  return { id, createdAt }
}

afterEach(() => {
  vi.useRealTimers()
})

describe("groupOrdersByDay", () => {
  it("melabeli Hari ini / Kemarin / tanggal panjang", () => {
    vi.useFakeTimers()
    // 27 Sep 2026 10:00 WIB.
    vi.setSystemTime(new Date("2026-09-27T10:00:00+07:00"))
    const groups = groupOrdersByDay([
      order("a", "2026-09-27T05:00:00Z"), // 12:00 WIB 27 Sep
      order("b", "2026-09-26T10:00:00Z"), // 17:00 WIB 26 Sep
      order("c", "2026-09-20T10:00:00Z"), // 17:00 WIB 20 Sep
    ])
    expect(groups).toHaveLength(3)
    expect(groups[0].id).toBe("txday:2026-9-27")
    expect(groups[0].label).toBe("Hari ini")
    expect(groups[0].sub).toBeTruthy()
    expect(groups[0].orders.map((o) => o.id)).toEqual(["a"])
    expect(groups[0].count).toBe(1)
    expect(groups[1].label).toBe("Kemarin")
    expect(groups[1].sub).toBeTruthy()
    expect(groups[2].label).toContain("2026")
    expect(groups[2].label).not.toBe("Hari ini")
    expect(groups[2].label).not.toBe("Kemarin")
    expect(groups[2].sub).toBeNull()
  })

  it("batas WIB: 23:59 WIB masuk Kemarin, 00:00 WIB masuk Hari ini (bukan UTC)", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-27T10:00:00+07:00"))
    const groups = groupOrdersByDay([
      order("late", "2026-09-26T16:59:59Z"), // 23:59:59 WIB 26 Sep
      order("early", "2026-09-26T17:00:00Z"), // 00:00:00 WIB 27 Sep
    ])
    // Dalam UTC keduanya 26 Sep — WIB memisahnya ke dua hari berbeda.
    const late = groups.find((g) => g.orders.some((o) => o.id === "late"))
    const early = groups.find((g) => g.orders.some((o) => o.id === "early"))
    expect(late?.label).toBe("Kemarin")
    expect(early?.label).toBe("Hari ini")
    expect(late?.id).not.toBe(early?.id)
  })

  it("order se-hari menjadi satu kelompok dengan urutan masuk dipertahankan", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-27T10:00:00+07:00"))
    const groups = groupOrdersByDay([
      order("x1", "2026-09-27T01:00:00Z"),
      order("x2", "2026-09-27T02:00:00Z"),
      order("x3", "2026-09-27T03:00:00Z"),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].count).toBe(3)
    expect(groups[0].orders.map((o) => o.id)).toEqual(["x1", "x2", "x3"])
  })

  it("createdAt tidak valid → kelompok Tanggal tidak tersedia", () => {
    const groups = groupOrdersByDay([order("bad", "bukan-tanggal")])
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe("txday:invalid")
    expect(groups[0].label).toBe("Tanggal tidak tersedia")
    expect(groups[0].orders.map((o) => o.id)).toEqual(["bad"])
  })

  it("daftar kosong → tanpa kelompok", () => {
    expect(groupOrdersByDay([])).toEqual([])
  })

  it("tidak mengubah nilai item (referensi sama, tanpa agregat)", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-27T10:00:00+07:00"))
    const input = [order("a", "2026-09-27T05:00:00Z")]
    const groups = groupOrdersByDay(input)
    expect(groups[0].orders[0]).toBe(input[0])
  })
})
