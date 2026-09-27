/**
 * Unit test: lib/order-shipping-countdown.ts — logika tampil/sembunyi kartu
 * "Batas waktu kirim penjual" di detail order.
 *
 * Aturan yang dikunci:
 * - Tampil countdown hanya: sudah dibayar + belum dikirim (shippedBy null) +
 *   shippingDeadline ada & valid & di masa depan.
 * - Sudah dikirim → tidak tampil (walau deadline masih jauh).
 * - shippingDeadline null/invalid → tidak tampil, tidak crash (fail closed).
 * - Deadline lewat → status jujur "overdue", bukan countdown dan bukan hilang.
 * - Belum dibayar → tidak tampil.
 */
import { describe, expect, it } from "vitest"

import {
  resolveShippingCountdown,
  type ShippingCountdownInput,
} from "@/lib/order-shipping-countdown"

const NOW = new Date("2026-09-28T04:00:00+07:00").getTime()
const FUTURE = "2026-09-30T04:00:00+07:00"
const PAST = "2026-09-27T04:00:00+07:00"

const paidNotShipped: ShippingCountdownInput = {
  status: "PROCESSING",
  paidAt: "2026-09-27T10:00:00+07:00",
  shippingDeadline: FUTURE,
  shippedBy: null,
}

describe("resolveShippingCountdown", () => {
  it("menampilkan countdown bila dibayar + belum dikirim + deadline di masa depan", () => {
    const r = resolveShippingCountdown(paidNotShipped, NOW)
    expect(r).not.toBeNull()
    expect(r?.kind).toBe("countdown")
    if (r?.kind === "countdown") {
      expect(r.at).toBe(FUTURE)
      expect(r.secondsLeft).toBe(2 * 86400) // tepat 2 hari
    }
  })

  it("menganggap dibayar dari status pasca-bayar bila paidAt hilang (payload legacy)", () => {
    const r = resolveShippingCountdown(
      { ...paidNotShipped, paidAt: null, status: "IN_DELIVERY" },
      NOW,
    )
    expect(r?.kind).toBe("countdown")
  })

  it("tidak tampil bila sudah dikirim (shippedBy ada)", () => {
    const r = resolveShippingCountdown(
      { ...paidNotShipped, shippedBy: "2026-09-28T02:00:00+07:00" },
      NOW,
    )
    expect(r).toBeNull()
  })

  it("tidak tampil bila belum dibayar (WAITING_PAYMENT + paidAt null)", () => {
    const r = resolveShippingCountdown(
      { ...paidNotShipped, status: "WAITING_PAYMENT", paidAt: null },
      NOW,
    )
    expect(r).toBeNull()
  })

  it("fail closed: shippingDeadline null → tidak tampil, tidak crash", () => {
    expect(resolveShippingCountdown({ ...paidNotShipped, shippingDeadline: null }, NOW)).toBeNull()
  })

  it("fail closed: shippingDeadline invalid → tidak tampil, tidak crash", () => {
    expect(
      resolveShippingCountdown({ ...paidNotShipped, shippingDeadline: "bukan-tanggal" }, NOW),
    ).toBeNull()
    expect(
      resolveShippingCountdown({ ...paidNotShipped, shippingDeadline: "" }, NOW),
    ).toBeNull()
  })

  it("deadline lewat → status jujur 'overdue', bukan hilang", () => {
    const r = resolveShippingCountdown({ ...paidNotShipped, shippingDeadline: PAST }, NOW)
    expect(r?.kind).toBe("overdue")
    if (r?.kind === "overdue") expect(r.at).toBe(PAST)
  })

  it("fail closed: order null/undefined → null tanpa throw", () => {
    expect(resolveShippingCountdown(null, NOW)).toBeNull()
    expect(resolveShippingCountdown(undefined, NOW)).toBeNull()
  })

  it("tidak menganggap order CANCELLED sebagai dibayar", () => {
    const r = resolveShippingCountdown(
      { ...paidNotShipped, status: "CANCELLED", paidAt: null },
      NOW,
    )
    expect(r).toBeNull()
  })
})
