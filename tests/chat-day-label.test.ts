/**
 * Audit chat G18 — pemisah hari: "Hari ini" / "Kemarin" / tanggal.
 * Dulu tanpa satu pun test; `now` kini disuntikkan.
 */
import { describe, expect, it } from "vitest"

import { dayKey, dayLabel, msUntilNextLocalMidnight } from "@/lib/chat-day-label"

/** Waktu LOKAL (bukan UTC) — pemisah hari memakai hari kalender perangkat. */
const local = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).toISOString()

describe("dayKey", () => {
  it("sama untuk pesan di hari kalender lokal yang sama, beda untuk hari lain", () => {
    expect(dayKey(local(2026, 10, 7, 0, 5))).toBe(dayKey(local(2026, 10, 7, 23, 55)))
    expect(dayKey(local(2026, 10, 7))).not.toBe(dayKey(local(2026, 10, 8)))
  })

  it("tanggal tak valid → string kosong", () => {
    expect(dayKey("bukan-tanggal")).toBe("")
  })
})

describe("dayLabel", () => {
  const now = new Date(2026, 9, 7, 10, 0)

  it("hari ini / kemarin", () => {
    expect(dayLabel(local(2026, 10, 7, 0, 1), now)).toBe("Hari ini")
    expect(dayLabel(local(2026, 10, 6, 23, 59), now)).toBe("Kemarin")
  })

  it("hari kalender, bukan selisih 24 jam: 23.30 kemarin vs 00.30 hari ini tetap 'Kemarin'", () => {
    const justAfterMidnight = new Date(2026, 9, 7, 0, 30)
    expect(dayLabel(local(2026, 10, 6, 23, 30), justAfterMidnight)).toBe("Kemarin")
  })

  it("lebih lama → tanggal eksplisit (bukan 'Hari ini'/'Kemarin')", () => {
    const label = dayLabel(local(2026, 10, 5), now)
    expect(label).not.toBe("Hari ini")
    expect(label).not.toBe("Kemarin")
    expect(label).toMatch(/2026/)
    expect(label).toMatch(/5/)
  })

  it("berganti hari: label pesan yang sama berubah dari 'Hari ini' menjadi 'Kemarin'", () => {
    const iso = local(2026, 10, 7, 20, 0)
    expect(dayLabel(iso, new Date(2026, 9, 7, 23, 59))).toBe("Hari ini")
    expect(dayLabel(iso, new Date(2026, 9, 8, 0, 1))).toBe("Kemarin")
  })

  it("tanggal tak valid tidak melempar", () => {
    expect(() => dayLabel("bukan-tanggal", now)).not.toThrow()
  })
})

describe("msUntilNextLocalMidnight", () => {
  it("jam 23.59 → ±1 menit + toleransi 1 dtk", () => {
    const ms = msUntilNextLocalMidnight(new Date(2026, 9, 7, 23, 59, 0))
    expect(ms).toBe(60_000 + 1_000)
  })

  it("tengah hari → separuh hari lagi", () => {
    const ms = msUntilNextLocalMidnight(new Date(2026, 9, 7, 12, 0, 0))
    expect(ms).toBe(12 * 3_600_000 + 1_000)
  })

  it("selalu positif walau tepat tengah malam", () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 9, 8, 0, 0, 0))).toBeGreaterThan(0)
  })
})
