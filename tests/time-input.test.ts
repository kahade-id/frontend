/**
 * Tests untuk lib/time-input.ts (item #26 — jadwal jangan-ganggu).
 * Parsing "HH:mm" toleran dengan fallback fail-safe; rentang mendukung
 * lewat tengah malam (22:00–06:00).
 */
import { describe, expect, it } from "vitest"
import { formatTimeValue, isTimeInRange, parseTimeValue } from "@/lib/time-input"

function at(hour: number, minute: number): Date {
  const d = new Date(2026, 8, 28, hour, minute, 0)
  return d
}

describe("lib/time-input", () => {
  it("parseTimeValue menerima format valid", () => {
    expect(parseTimeValue("22:00")).toEqual({ hour: 22, minute: 0 })
    expect(parseTimeValue("06:30")).toEqual({ hour: 6, minute: 30 })
    expect(parseTimeValue(" 9:05 ")).toEqual({ hour: 9, minute: 5 })
  })

  it("parseTimeValue fail-safe untuk input tak valid", () => {
    expect(parseTimeValue("")).toEqual({ hour: 22, minute: 0 })
    expect(parseTimeValue("abc")).toEqual({ hour: 22, minute: 0 })
    expect(parseTimeValue("25:00")).toEqual({ hour: 22, minute: 0 })
    expect(parseTimeValue("10:99")).toEqual({ hour: 10, minute: 0 })
  })

  it("formatTimeValue selalu HH:mm dua digit", () => {
    expect(formatTimeValue(6, 5)).toBe("06:05")
    expect(formatTimeValue(22, 0)).toBe("22:00")
  })

  it("isTimeInRange untuk rentang normal", () => {
    expect(isTimeInRange("09:00", "17:00", at(12, 0))).toBe(true)
    expect(isTimeInRange("09:00", "17:00", at(8, 59))).toBe(false)
    expect(isTimeInRange("09:00", "17:00", at(17, 0))).toBe(false) // end eksklusif
    expect(isTimeInRange("09:00", "17:00", at(9, 0))).toBe(true) // start inklusif
  })

  it("isTimeInRange untuk rentang lewat tengah malam", () => {
    expect(isTimeInRange("22:00", "06:00", at(23, 30))).toBe(true)
    expect(isTimeInRange("22:00", "06:00", at(2, 0))).toBe(true)
    expect(isTimeInRange("22:00", "06:00", at(12, 0))).toBe(false)
    expect(isTimeInRange("22:00", "06:00", at(6, 0))).toBe(false)
  })

  it("isTimeInRange false untuk rentang degenerat", () => {
    expect(isTimeInRange("22:00", "22:00", at(22, 30))).toBe(false)
  })
})
