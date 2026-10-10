/**
 * DT-03 (audit etalase 2026-10-10): kondisi "etalase tidak tersedia" bukan
 * hanya 404 — 410, 403, dan id rusak juga bukan kondisi "coba lagi".
 */
import { describe, expect, it } from "vitest"

import { resolveShowcaseUnavailability } from "@/lib/showcase-availability"

describe("resolveShowcaseUnavailability", () => {
  it("404 & 410 → tidak ditemukan", () => {
    expect(resolveShowcaseUnavailability({ status: 404 })).toBe("not-found")
    expect(resolveShowcaseUnavailability({ status: 410 })).toBe("not-found")
  })

  it("403 → privat (pemilik membatasi)", () => {
    expect(resolveShowcaseUnavailability({ status: 403 })).toBe("private")
  })

  it("id rusak dari seg() (BAD_REQUEST tanpa status) → tidak ditemukan, bukan retry", () => {
    expect(resolveShowcaseUnavailability({ status: null, code: "BAD_REQUEST" })).toBe("not-found")
    expect(resolveShowcaseUnavailability({ status: undefined, code: "BAD_REQUEST" })).toBe("not-found")
  })

  it("gangguan sesungguhnya tetap null → ErrorState + Coba lagi", () => {
    expect(resolveShowcaseUnavailability({ status: 500 })).toBeNull()
    expect(resolveShowcaseUnavailability({ status: null, code: "NETWORK" })).toBeNull()
    expect(resolveShowcaseUnavailability({ status: null })).toBeNull()
    // 400 dengan status HTTP (validasi server) bukan id rusak klien.
    expect(resolveShowcaseUnavailability({ status: 400, code: "BAD_REQUEST" })).toBeNull()
  })
})
