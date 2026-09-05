import { describe, expect, it } from "vitest"
import {
  formatRupiah,
  parseRupiah,
  formatNumber,
  formatDecimal,
  formatDate,
  formatDateTime,
  formatTime,
  formatCountdown,
  formatPhoneId,
  formatFileSize,
} from "@/lib/format"

describe("financial formatting never fabricates valid data", () => {
  it.each([NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects unsafe money %s",
    (value) => expect(formatRupiah(value)).toBe("—"),
  )
  it("preserves direction and zero", () => {
    expect(formatRupiah(-50000)).toBe("-Rp50.000")
    expect(formatRupiah(0)).toBe("Rp0")
    expect(formatRupiah(50000, { sign: "always" })).toBe("+Rp50.000")
  })
  it("does not turn a negative pasted transfer into a positive one", () => {
    expect(Number.isNaN(parseRupiah("-Rp100.000"))).toBe(true)
    expect(parseRupiah("Rp100.000")).toBe(100000)
    expect(Number.isNaN(parseRupiah("999999999999999999"))).toBe(true)
  })
  it("handles invalid numeric data", () => {
    expect(formatNumber(NaN)).toBe("—")
    expect(formatDecimal(1.5, Infinity)).toBe("1,5")
    expect(formatFileSize(-10)).toBe("—")
  })
})
describe("dates and identity formatting", () => {
  it.each(["invalid", "", "2026-02-30"])("does not render invalid date %s", (value) => {
    expect(formatDate(value)).toBe("—")
    expect(formatDateTime(value)).toBe("—")
    expect(formatTime(value)).toBe("—")
  })
  it("preserves calendar-only dates without UTC conversion", () =>
    expect(formatDate("2026-09-05")).toBe("5 Sep 2026"))
  it("handles countdown boundaries", () => {
    expect(formatCountdown(NaN)).toBe("—")
    expect(formatCountdown(-3)).toBe("00:00")
    expect(formatCountdown(3661)).toBe("1:01:01")
  })
  it("never truncates trailing Indonesian phone digits", () => {
    expect(formatPhoneId("08123456789012")).toBe("+62 812-3456-789012")
    expect(formatPhoneId("+6281234567890")).toBe("+62 812-3456-7890")
  })
})

it("does not inflate pasted fractional or scientific money", () => {
  expect(parseRupiah("Rp 10.000,00")).toBe(10000)
  for (const value of ["Rp 10.000,50", "10000.50", "1e6", "+10000", "USD10000", "1..000"])
    expect(Number.isNaN(parseRupiah(value))).toBe(true)
})
