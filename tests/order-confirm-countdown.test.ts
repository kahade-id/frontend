/**
 * FE-110: countdown "Batas konfirmasi penjual" — logika tampil/sembunyi murni.
 */
import { describe, expect, it } from "vitest"

import { resolveConfirmCountdown } from "@/lib/order-confirm-countdown"

const NOW = new Date("2026-09-29T10:00:00+07:00").getTime()
const FUTURE = new Date(NOW + 36 * 3600 * 1000).toISOString()
const PAST = new Date(NOW - 3600 * 1000).toISOString()

describe("resolveConfirmCountdown", () => {
  it("WAITING_CONFIRMATION + deadline masa depan → countdown", () => {
    const r = resolveConfirmCountdown(
      { status: "WAITING_CONFIRMATION", confirmationDeadlineAt: FUTURE },
      NOW,
    )
    expect(r?.kind).toBe("countdown")
    if (r?.kind === "countdown") {
      expect(r.secondsLeft).toBeGreaterThan(0)
      expect(r.at).toBe(FUTURE)
    }
  })

  it("deadline lewat → overdue (status jujur, bukan disembunyikan)", () => {
    const r = resolveConfirmCountdown(
      { status: "WAITING_CONFIRMATION", confirmationDeadlineAt: PAST },
      NOW,
    )
    expect(r?.kind).toBe("overdue")
  })

  it("status lain → null (bukan tahap konfirmasi)", () => {
    for (const status of ["PROCESSING", "IN_DELIVERY", "COMPLETED"] as const) {
      expect(
        resolveConfirmCountdown({ status, confirmationDeadlineAt: FUTURE }, NOW),
      ).toBeNull()
    }
  })

  it("deadline null/invalid → null (fail closed)", () => {
    expect(
      resolveConfirmCountdown({ status: "WAITING_CONFIRMATION", confirmationDeadlineAt: null }, NOW),
    ).toBeNull()
    expect(
      resolveConfirmCountdown(
        { status: "WAITING_CONFIRMATION", confirmationDeadlineAt: "bukan-tanggal" },
        NOW,
      ),
    ).toBeNull()
  })

  it("order null → null", () => {
    expect(resolveConfirmCountdown(null, NOW)).toBeNull()
  })
})
