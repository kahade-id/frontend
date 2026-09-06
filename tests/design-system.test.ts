import { describe, expect, it } from "vitest"
import { dark, light, semantic, tokens, toCssVariables, toTailwindTheme } from "../lib/tokens"

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map((v) => parseInt(v, 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
}
function contrast(a: string, b: string) {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
describe("premium design contracts", () => {
  it("keeps the primary layout on an 8pt rhythm and text at least 14pt", () => {
    for (const value of [tokens.layout.screenPaddingX, tokens.layout.cardPadding, tokens.layout.cardGap, tokens.space[8], tokens.space[12]]) expect(value % 8).toBe(0)
    for (const type of Object.values(tokens.typography)) expect(type.fontSize).toBeGreaterThanOrEqual(14)
    expect(tokens.typography.display.fontFamily).toBe(tokens.fontFamily.sans)
  })
  it("exposes every theme variable in both modes without an orphan", () => {
    const referenced = new Set([...JSON.stringify(toTailwindTheme()).matchAll(/var\((--[^)]+)\)/g)].map((match) => match[1]))
    for (const mode of ["light", "dark"] as const) expect(Object.keys(toCssVariables(mode)).sort()).toEqual([...referenced].sort())
  })
  for (const mode of ["light", "dark"] as const) {
    it(`${mode}: keeps text, controls, actions and semantic labels accessible`, () => {
      const palette = mode === "light" ? light : dark
      for (const surface of ["background", "surface", "surfaceElevated"] as const) {
        for (const text of ["textPrimary", "textSecondary"] as const) expect(contrast(palette[text], palette[surface])).toBeGreaterThanOrEqual(4.5)
        for (const control of ["borderControl", "textTertiary"] as const) expect(contrast(palette[control], palette[surface])).toBeGreaterThanOrEqual(3)
      }
      expect(contrast(palette.primaryForeground, palette.primary)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(palette.accent, palette.accentSoft)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(palette.accentForeground, palette.accent)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(palette.borderFocus, palette.background)).toBeGreaterThanOrEqual(3)
      for (const status of Object.values(semantic)) {
        expect(contrast(status[mode].text, status[mode].bgSoft)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(status[mode].fill, palette.surface)).toBeGreaterThanOrEqual(3)
      }
    })
  }
})
