/**
 * Batch 43 FE-CHAT: template balasan "/" tersinkron backend (helper murni).
 */
import { describe, expect, it } from "vitest"
import {
  filterReplyTemplates,
  normalizeTemplateShortcut,
  validateTemplateInput,
} from "@/lib/reply-templates"

const TPL = [
  { id: "1", shortcut: "salam", text: "Halo kak!", createdAt: "", updatedAt: "" },
  { id: "2", shortcut: "nego", text: "Bisa nego tipis kak", createdAt: "", updatedAt: "" },
  { id: "3", shortcut: "kirim_hari_ini", text: "Dikirim hari ini", createdAt: "", updatedAt: "" },
]

describe("filterReplyTemplates", () => {
  it("query kosong → semua", () => {
    expect(filterReplyTemplates(TPL, "")).toHaveLength(3)
  })
  it("cocok shortcut", () => {
    expect(filterReplyTemplates(TPL, "neg").map((t) => t.id)).toEqual(["2"])
  })
  it("cocok isi teks", () => {
    expect(filterReplyTemplates(TPL, "dikirim").map((t) => t.id)).toEqual(["3"])
  })
  it("case-insensitive", () => {
    expect(filterReplyTemplates(TPL, "SALAM").map((t) => t.id)).toEqual(["1"])
  })
})

describe("normalizeTemplateShortcut", () => {
  it("huruf kecil + spasi jadi underscore", () => {
    expect(normalizeTemplateShortcut(" Salam Pagi ")).toBe("salam_pagi")
  })
})

describe("validateTemplateInput", () => {
  it("ok untuk input valid", () => {
    expect(validateTemplateInput("salam", "Halo kak").ok).toBe(true)
  })
  it("tolak shortcut kosong / karakter ilegal / terlalu panjang", () => {
    expect(validateTemplateInput("", "x").ok).toBe(false)
    expect(validateTemplateInput("salam!", "x").ok).toBe(false)
    expect(validateTemplateInput("a".repeat(33), "x").ok).toBe(false)
  })
  it("tolak teks kosong / terlalu panjang", () => {
    expect(validateTemplateInput("salam", "  ").ok).toBe(false)
    expect(validateTemplateInput("salam", "x".repeat(501)).ok).toBe(false)
  })
})
