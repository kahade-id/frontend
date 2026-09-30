/**
 * Tests untuk skala typography global (lib/tokens.ts) + font italic.
 *
 * Menjaga keputusan 30 Sep 2026:
 * - Skala global naik sekaligus: h2 22→24, h3 18→20, body 14→15,
 *   label 13→14, monoBody 14→15 (lineHeight proporsional).
 * - Italic asli: fontFamilyItalicByWeight 400/700 terdaftar.
 */
import { describe, expect, it } from "vitest"
import { fontFamilyItalicByWeight, typography } from "@/lib/tokens"

describe("typography scale (keputusan 30 Sep 2026)", () => {
  it("h2 = 24/33", () => {
    expect(typography.h2.fontSize).toBe(24)
    expect(typography.h2.lineHeight).toBe(33)
  })

  it("h3 = 20/29", () => {
    expect(typography.h3.fontSize).toBe(20)
    expect(typography.h3.lineHeight).toBe(29)
  })

  it("body = 15/24", () => {
    expect(typography.body.fontSize).toBe(15)
    expect(typography.body.lineHeight).toBe(24)
  })

  it("label = 14/19", () => {
    expect(typography.label.fontSize).toBe(14)
    expect(typography.label.lineHeight).toBe(19)
  })

  it("monoBody = 15/21", () => {
    expect(typography.monoBody.fontSize).toBe(15)
    expect(typography.monoBody.lineHeight).toBe(21)
  })

  it("tidak ada body text < 14px di skala utama", () => {
    for (const key of ["body", "bodyLarge", "label", "monoBody"] as const) {
      expect(typography[key].fontSize).toBeGreaterThanOrEqual(14)
    }
  })
})

describe("fontFamilyItalicByWeight", () => {
  it("400 dan 700 terdaftar dengan nama asset yang benar", () => {
    expect(fontFamilyItalicByWeight[400]).toBe("PlusJakartaSans-Italic")
    expect(fontFamilyItalicByWeight[700]).toBe("PlusJakartaSans-BoldItalic")
  })
})
