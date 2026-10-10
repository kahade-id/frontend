import { describe, expect, it } from "vitest"

import {
  courierCostToNumber,
  formatEtaDays,
  shipmentStatusText,
  shipmentStatusTone,
  sortTrackingEventsLatestFirst,
  type TrackingEvent,
} from "@/lib/api/courier"

const ev = (id: string, occurredAt: string | null, createdAt: string): TrackingEvent => ({
  id,
  status: "IN_TRANSIT",
  rawStatus: "IN_TRANSIT",
  occurredAt,
  createdAt,
})

describe("courier helpers (audit alamat & kurir 2026-10-10)", () => {
  it("E01/E10: biaya rupiah dipakai apa adanya — tidak dibagi 100", () => {
    expect(courierCostToNumber("15000")).toBe(15000)
    expect(courierCostToNumber(15500)).toBe(15500)
    expect(courierCostToNumber(null)).toBeNull()
    expect(courierCostToNumber("abc")).toBeNull()
  })

  it("E04: timeline terbaru di atas berdasar occurredAt, fallback createdAt, stabil", () => {
    const sorted = sortTrackingEventsLatestFirst([
      ev("a", "2026-10-01T08:00:00Z", "2026-10-01T09:00:00Z"),
      ev("b", "2026-10-01T10:00:00Z", "2026-10-01T09:30:00Z"), // out-of-order dari provider
      ev("c", null, "2026-10-01T09:15:00Z"),
      ev("d", "2026-10-01T10:00:00Z", "2026-10-01T09:40:00Z"), // waktu sama dengan b → urutan masuk
    ])
    expect(sorted.map((e) => e.id)).toEqual(["b", "d", "c", "a"])
  })

  it("E05: ETA dirangkai dari hari min–maks; hari ini bila maks 0", () => {
    expect(formatEtaDays(1, 3)).toBe("1–3 hari")
    expect(formatEtaDays(2, 2)).toBe("2 hari")
    expect(formatEtaDays(0, 0)).toBe("Hari ini")
    expect(formatEtaDays(null, undefined)).toBeNull()
    expect(formatEtaDays(null, 4)).toBe("4 hari")
  })

  it("E07/E11: label & tone status — status asing tetap tampil mentah", () => {
    expect(shipmentStatusText("DELIVERED")).toBe("Tiba")
    expect(shipmentStatusText("WARP")).toBe("WARP")
    expect(shipmentStatusTone("DELIVERED")).toBe("success")
    expect(shipmentStatusTone("EXCEPTION")).toBe("danger")
    expect(shipmentStatusTone("UNKNOWN")).toBe("warning")
    expect(shipmentStatusTone("CREATED")).toBe("neutral")
  })
})
