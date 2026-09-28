/**
 * Test murni — status ketersediaan Bantuan Langsung (F05).
 */
import { describe, expect, it } from "vitest"

import {
  getLiveSupportAvailability,
  liveSupportScheduleSummary,
} from "@/lib/live-support-availability"

// Helper: buat Date pada jam tertentu di Asia/Jakarta. 2026-09-28 = Senin.
function jakartaAt(dayOffset: number, hour: number): Date {
  // 2026-09-28T00:00:00+07:00 = Senin 28 Sep 2026 00:00 WIB.
  const base = Date.UTC(2026, 8, 28, 0, 0, 0) - 7 * 60 * 60 * 1000
  return new Date(base + dayOffset * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000)
}

describe("getLiveSupportAvailability", () => {
  it("buka di jam kerja Senin–Jumat", () => {
    const a = getLiveSupportAvailability(jakartaAt(0, 10)) // Senin 10:00 WIB
    expect(a.open).toBe(true)
    if (a.open) expect(a.closesAt).toContain("20:00")
  })

  it("tutup di luar jam kerja hari kerja + memberi tahu buka berikutnya", () => {
    const a = getLiveSupportAvailability(jakartaAt(0, 22)) // Senin 22:00
    expect(a.open).toBe(false)
    if (!a.open) expect(a.opensAt).toContain("08:00")
  })

  it("Sabtu ikut jadwal Sabtu", () => {
    const open = getLiveSupportAvailability(jakartaAt(5, 10)) // Sabtu 10:00
    expect(open.open).toBe(true)
    const closed = getLiveSupportAvailability(jakartaAt(5, 18)) // Sabtu 18:00
    expect(closed.open).toBe(false)
  })

  it("Minggu tutup", () => {
    const a = getLiveSupportAvailability(jakartaAt(6, 12)) // Minggu 12:00
    expect(a.open).toBe(false)
    if (!a.open) {
      expect(a.reason).toBe("sunday")
      expect(a.opensAt).toContain("Senin")
    }
  })

  it("selalu menyertakan petunjuk antrean (jujur: real-time belum ada)", () => {
    const a = getLiveSupportAvailability(jakartaAt(0, 10))
    expect(a.queueHint.length).toBeGreaterThan(0)
  })
})

describe("liveSupportScheduleSummary", () => {
  it("menyebut hari dan jam layanan", () => {
    const s = liveSupportScheduleSummary()
    expect(s).toContain("Senin")
    expect(s).toContain("Sabtu")
    expect(s).toContain("Minggu")
  })
})
