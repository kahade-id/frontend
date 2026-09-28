/**
 * batch 139 — TIM FE139-WALLET, Wave 2 (D03/D04/D05).
 * Helper murni di lib/wallet-batch139.ts.
 */
import { describe, expect, it } from "vitest"
import {
  breakdownAddsUp,
  disabledPresetReason,
  resolveRevalidatedRecipient,
} from "../lib/wallet-batch139"

// ---------------------------------------------------------------- D04
describe("D04 resolveRevalidatedRecipient", () => {
  const selected = { id: "u-1", name: "Budi Lama" }

  it("valid + nama diperbarui dari fullName server", () => {
    const out = resolveRevalidatedRecipient(
      [{ id: "u-1", username: "budi", fullName: "Budi Baru" }],
      selected,
    )
    expect(out).toEqual({ valid: true, name: "Budi Baru" })
  })

  it("valid + fallback ke username bila fullName kosong", () => {
    const out = resolveRevalidatedRecipient(
      [{ id: "u-1", username: "budi", fullName: null }],
      selected,
    )
    expect(out).toEqual({ valid: true, name: "budi" })
  })

  it("valid bila id cocok walau username berubah (kunci = id)", () => {
    const out = resolveRevalidatedRecipient(
      [{ id: "u-1", username: "budi_baru", fullName: "Budi Baru" }],
      selected,
    )
    expect(out.valid).toBe(true)
  })

  it("INVALID bila id tidak ada di hasil lookup (fail-closed)", () => {
    const out = resolveRevalidatedRecipient(
      [{ id: "u-9", username: "orang_lain", fullName: "Orang Lain" }],
      selected,
    )
    expect(out).toEqual({ valid: false })
  })

  it("INVALID bila hasil lookup kosong", () => {
    expect(resolveRevalidatedRecipient([], selected)).toEqual({ valid: false })
  })
})

// ---------------------------------------------------------------- D05
describe("D05 disabledPresetReason", () => {
  const fmt = (v: number) => `Rp${v}`

  it("alasan dikembalikan bila ada chip di atas max", () => {
    const reason = disabledPresetReason([50_000, 100_000, 250_000], 100_000, false, fmt)
    expect(reason).toContain("Rp100000")
    expect(reason).toContain("melebihi batas")
  })

  it("null bila semua chip dalam batas", () => {
    expect(disabledPresetReason([50_000, 100_000], 100_000, false, fmt)).toBeNull()
  })

  it("null bila keypad disabled total (alasan berbeda)", () => {
    expect(disabledPresetReason([50_000, 500_000], 100_000, true, fmt)).toBeNull()
  })

  it("null bila max tidak diketahui", () => {
    expect(disabledPresetReason([50_000], undefined, false, fmt)).toBeNull()
  })

  it("null bila tidak ada preset", () => {
    expect(disabledPresetReason([], 100_000, false, fmt)).toBeNull()
    expect(disabledPresetReason(undefined, 100_000, false, fmt)).toBeNull()
  })
})

// ---------------------------------------------------------------- D03
describe("D03 breakdownAddsUp", () => {
  it("true bila tersedia + ditahan = total", () => {
    expect(breakdownAddsUp(80_000, 20_000, 100_000)).toBe(true)
  })

  it("false bila tidak pas (jangan klaim konsistensi)", () => {
    expect(breakdownAddsUp(80_000, 10_000, 100_000)).toBe(false)
  })

  it("false bila tersedia tidak diketahui", () => {
    expect(breakdownAddsUp(undefined, 20_000, 100_000)).toBe(false)
  })

  it("false bila total tidak diketahui", () => {
    expect(breakdownAddsUp(80_000, 20_000, undefined)).toBe(false)
  })

  it("true bila ditahan nol dan tersedia = total", () => {
    expect(breakdownAddsUp(100_000, 0, 100_000)).toBe(true)
  })
})
