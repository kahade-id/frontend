/**
 * FE-052 (audit frontend 2026-09-29): adaptor string-digit untuk
 * formatRupiahTyping/parseRupiahTyping — dipakai input nominal yang
 * state-nya string digit mentah (receive, jastip lock, patungan, milestones).
 */
import { describe, expect, it } from "vitest"

import { formatRupiahTypingText, parseRupiahTypingText } from "@/lib/rupiah-input"

describe("formatRupiahTypingText (FE-052)", () => {
  it("digit → teks berformat ribuan", () => {
    expect(formatRupiahTypingText("1500000")).toBe("1.500.000")
    expect(formatRupiahTypingText("50000")).toBe("50.000")
    expect(formatRupiahTypingText("0")).toBe("0")
  })

  it("string kosong → tampilan kosong", () => {
    expect(formatRupiahTypingText("")).toBe("")
  })
})

describe("parseRupiahTypingText (FE-052)", () => {
  it("ketikan valid → string digit mentah", () => {
    expect(parseRupiahTypingText("1.500.000")).toBe("1500000")
    expect(parseRupiahTypingText("50000")).toBe("50000")
  })

  it("input kosong → string kosong (bukan null)", () => {
    expect(parseRupiahTypingText("")).toBe("")
  })

  it("ketikan tak valid → null (panggilan harus mengabaikan)", () => {
    expect(parseRupiahTypingText("12abc")).toBe(null)
    // >15 digit ditolak
    expect(parseRupiahTypingText("9".repeat(16))).toBe(null)
  })
})
