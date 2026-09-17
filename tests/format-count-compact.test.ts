/**
 * Unit test `formatCountCompact` — penghitung sosial ringkas (1,4K / 2M).
 * Lapisan murni (tanpa react-native), ikut suite `npm test` (vitest node).
 */
import { describe, expect, it } from "vitest"

import { formatCountCompact, formatNumber } from "@/lib/format"

describe("formatCountCompact", () => {
  it("di bawah 1000 tampil apa adanya dengan pemisah ribuan", () => {
    expect(formatCountCompact(0)).toBe("0")
    expect(formatCountCompact(42)).toBe("42")
    expect(formatCountCompact(999)).toBe("999")
  })

  it("ribuan -> K dengan satu desimal berkoma", () => {
    expect(formatCountCompact(1000)).toBe("1K")
    expect(formatCountCompact(1400)).toBe("1,4K")
    expect(formatCountCompact(15500)).toBe("15,5K")
    expect(formatCountCompact(999_400)).toBe("999,4K")
  })

  it("jutaan -> M, miliaran -> B", () => {
    expect(formatCountCompact(2_000_000)).toBe("2M")
    expect(formatCountCompact(2_500_000)).toBe("2,5M")
    expect(formatCountCompact(1_500_000_000)).toBe("1,5B")
  })

  it("pembulatan yang menyentuh 1000 naik satu tingkat", () => {
    // 999.999 dibulatkan 1 desimal = 1000,0K -> harus jadi 1M
    expect(formatCountCompact(999_999)).toBe("1M")
    expect(formatCountCompact(999_999_999)).toBe("1B")
  })

  it("non-finite -> em dash, pecahan dipangkas", () => {
    expect(formatCountCompact(Number.NaN)).toBe("—")
    expect(formatCountCompact(Number.POSITIVE_INFINITY)).toBe("—")
    expect(formatCountCompact(1400.9)).toBe("1,4K")
  })
})

describe("formatNumber (regresi)", () => {
  it("tetap memisah ribuan tanpa compact", () => {
    expect(formatNumber(1400)).toBe("1.400")
    expect(formatNumber(2_000_000)).toBe("2.000.000")
  })
})
