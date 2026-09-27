/**
 * Tests untuk lib/font-scale.ts (item #28 — ukuran font A-/A+).
 * Batas 0.85–1.3 di-clamp di baca maupun tulis; nilai korup → default 1.0.
 */
import { beforeEach, describe, expect, it } from "vitest"
import {
  FONT_SCALE_DEFAULT,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  clampFontScale,
  decreaseFontScale,
  getFontScale,
  increaseFontScale,
  resetFontScale,
  setFontScale,
} from "@/lib/font-scale"

describe("lib/font-scale", () => {
  beforeEach(() => {
    resetFontScale()
  })

  it("clampFontScale menjaga rentang 0.85–1.3", () => {
    expect(clampFontScale(1)).toBe(1)
    expect(clampFontScale(0.85)).toBe(FONT_SCALE_MIN)
    expect(clampFontScale(1.3)).toBe(FONT_SCALE_MAX)
    expect(clampFontScale(0.5)).toBe(FONT_SCALE_MIN)
    expect(clampFontScale(2)).toBe(FONT_SCALE_MAX)
  })

  it("clampFontScale fail-safe untuk nilai korup", () => {
    expect(clampFontScale(NaN)).toBe(FONT_SCALE_DEFAULT)
    expect(clampFontScale(Infinity)).toBe(FONT_SCALE_DEFAULT)
    expect(clampFontScale("besar")).toBe(FONT_SCALE_DEFAULT)
    expect(clampFontScale(null)).toBe(FONT_SCALE_DEFAULT)
    expect(clampFontScale(undefined)).toBe(FONT_SCALE_DEFAULT)
  })

  it("increase/decrease bergerak 0.05 dan berhenti di batas", () => {
    expect(increaseFontScale()).toBeCloseTo(1.05, 10)
    expect(decreaseFontScale()).toBeCloseTo(1, 10)
    expect(decreaseFontScale()).toBeCloseTo(0.95, 10)

    setFontScale(FONT_SCALE_MAX)
    expect(increaseFontScale()).toBe(FONT_SCALE_MAX)
    setFontScale(FONT_SCALE_MIN)
    expect(decreaseFontScale()).toBe(FONT_SCALE_MIN)
  })

  it("setFontScale men-clamp sebelum menyimpan", () => {
    setFontScale(99)
    expect(getFontScale()).toBe(FONT_SCALE_MAX)
    setFontScale(-1)
    expect(getFontScale()).toBe(FONT_SCALE_MIN)
    resetFontScale()
    expect(getFontScale()).toBe(FONT_SCALE_DEFAULT)
  })
})
