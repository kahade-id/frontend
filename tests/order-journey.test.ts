/**
 * Unit test: lib/order-journey.ts — derivasi lima tahap perjalanan order.
 *
 * Aturan yang dikunci:
 * - Murni dari data yang ada (createdAt/paidAt/completedAt + riwayat):
 *   tidak ada fetch, tidak ada perubahan logika status.
 * - Status tak dikenal tidak melempar — diperlakukan seperti tahap awal.
 * - Completion = konfirmasi terima + cair dana (boleh berbagi completedAt).
 */
import { describe, expect, it } from "vitest"

import { buildOrderJourney, type JourneyInput } from "@/lib/order-journey"

const base: JourneyInput = {
  status: "WAITING_CONFIRMATION",
  createdAt: "2026-09-20T10:00:00+07:00",
  paidAt: null,
  completedAt: null,
  history: [],
}

function states(input: JourneyInput) {
  return buildOrderJourney(input).map((s) => `${s.key}:${s.state}`)
}

describe("buildOrderJourney", () => {
  it("selalu memuat 5 tahap untuk order aktif", () => {
    for (const status of ["WAITING_CONFIRMATION", "WAITING_PAYMENT", "PROCESSING", "IN_DELIVERY"]) {
      const steps = buildOrderJourney({ ...base, status })
      expect(steps).toHaveLength(5)
      expect(steps.map((s) => s.key)).toEqual([
        "created",
        "paid",
        "shipped",
        "received",
        "released",
      ])
    }
  })

  it("WAITING_CONFIRMATION: dibuat selesai, bayar berjalan", () => {
    expect(states(base)).toEqual([
      "created:done",
      "paid:current",
      "shipped:upcoming",
      "received:upcoming",
      "released:upcoming",
    ])
  })

  it("WAITING_PAYMENT: tahap bayar berjalan dengan hint", () => {
    const steps = buildOrderJourney({ ...base, status: "WAITING_PAYMENT" })
    const paid = steps.find((s) => s.key === "paid")!
    expect(paid.state).toBe("current")
    expect(paid.hint).toBeTruthy()
  })

  it("PROCESSING: dikirim menjadi tahap berjalan", () => {
    expect(states({ ...base, status: "PROCESSING" })).toEqual([
      "created:done",
      "paid:done",
      "shipped:current",
      "received:upcoming",
      "released:upcoming",
    ])
  })

  it("COMPLETED: semua tahap selesai; diterima & cair boleh berbagi completedAt", () => {
    const completedAt = "2026-09-25T15:30:00+07:00"
    const steps = buildOrderJourney({ ...base, status: "COMPLETED", completedAt })
    expect(steps.every((s) => s.state === "done")).toBe(true)
    const received = steps.find((s) => s.key === "received")!
    const released = steps.find((s) => s.key === "released")!
    expect(received.timestamp).toBe(completedAt)
    expect(released.timestamp).toBe(completedAt)
  })

  it("mengambil timestamp dari riwayat bila field langsung kosong", () => {
    const steps = buildOrderJourney({
      ...base,
      status: "IN_DELIVERY",
      history: [
        { toStatus: "PROCESSING", createdAt: "2026-09-21T09:00:00+07:00" },
        { toStatus: "IN_DELIVERY", createdAt: "2026-09-22T14:00:00+07:00" },
      ],
    })
    const paid = steps.find((s) => s.key === "paid")!
    const shipped = steps.find((s) => s.key === "shipped")!
    expect(paid.timestamp).toBe("2026-09-21T09:00:00+07:00")
    expect(shipped.timestamp).toBe("2026-09-22T14:00:00+07:00")
  })

  it("DISPUTED: node penutup sengketa + dana dibekukan, tahap normal tetap terlihat", () => {
    const steps = buildOrderJourney({ ...base, status: "DISPUTED" })
    const disputed = steps.find((s) => s.key === "disputed")!
    expect(disputed.state).toBe("failed")
    expect(disputed.hint).toMatch(/dibekukan/i)
    expect(steps).toHaveLength(6)
  })

  it("CANCELLED sebelum bayar: hanya dibuat + node batal", () => {
    const steps = buildOrderJourney({ ...base, status: "CANCELLED" })
    expect(steps.map((s) => s.key)).toEqual(["created", "cancelled"])
    expect(steps[1].state).toBe("failed")
  })

  it("CANCELLED setelah bayar: tahap bayar ikut tercatat selesai", () => {
    const steps = buildOrderJourney({
      ...base,
      status: "CANCELLED",
      paidAt: "2026-09-21T09:00:00+07:00",
    })
    expect(steps.map((s) => s.key)).toEqual(["created", "paid", "cancelled"])
  })

  it("REFUNDED dan EXPIRED: node penutup yang sesuai", () => {
    expect(
      buildOrderJourney({ ...base, status: "REFUNDED" }).map((s) => s.key),
    ).toContain("refunded")
    expect(
      buildOrderJourney({ ...base, status: "EXPIRED" }).map((s) => s.key),
    ).toContain("expired")
  })

  it("status tak dikenal tidak melempar dan tampil seperti tahap awal", () => {
    const steps = buildOrderJourney({ ...base, status: "SOMETHING_NEW" })
    expect(steps).toHaveLength(5)
    expect(steps[0].state).toBe("done")
  })

  it("timestamp null bila tahap belum terjadi — tidak dikarang", () => {
    const steps = buildOrderJourney(base)
    for (const s of steps.filter((x) => x.state !== "done")) {
      expect(s.timestamp).toBeNull()
    }
  })
})

describe("TRX-013/TRX-014 (audit UI/UX 2026-09-28)", () => {
  it("TRX-013: CANCELLED tanpa pembayaran TIDAK mengklaim dana dikembalikan", () => {
    const steps = buildOrderJourney({ ...base, status: "CANCELLED" })
    const cancelled = steps.find((s) => s.key === "cancelled")!
    expect(cancelled.hint).toMatch(/sebelum pembayaran/)
    expect(cancelled.hint).not.toMatch(/dikembalikan/)
  })

  it("TRX-013: CANCELLED setelah bayar tetap menyebut refund", () => {
    const steps = buildOrderJourney({
      ...base,
      status: "CANCELLED",
      paidAt: "2026-09-21T09:00:00+07:00",
    })
    const cancelled = steps.find((s) => s.key === "cancelled")!
    expect(cancelled.hint).toMatch(/dikembalikan/)
  })

  it("TRX-014: order JASA tidak menunggu 'Dikirim penjual'", () => {
    const steps = buildOrderJourney({ ...base, status: "PROCESSING", orderType: "SERVICE" })
    const shipped = steps.find((s) => s.key === "shipped")!
    expect(shipped.label).toBe("Dikerjakan penjual")
    expect(shipped.hint).not.toMatch(/mengirim/i)
  })

  it("TRX-014: order DIGITAL tidak menunggu 'Dikirim penjual'", () => {
    const steps = buildOrderJourney({ ...base, status: "WAITING_PAYMENT", orderType: "DIGITAL_GOODS" })
    const shipped = steps.find((s) => s.key === "shipped")!
    expect(shipped.label).toBe("Disiapkan penjual")
  })

  it("TRX-014: tanpa orderType perilaku fisik lama dipertahankan", () => {
    const steps = buildOrderJourney({ ...base, status: "PROCESSING" })
    const shipped = steps.find((s) => s.key === "shipped")!
    expect(shipped.label).toBe("Dikirim penjual")
  })
})
