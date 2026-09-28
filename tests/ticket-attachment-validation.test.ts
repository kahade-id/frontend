/**
 * Test murni — validasi lampiran tiket (F08).
 */
import { describe, expect, it } from "vitest"

import {
  attachmentLimitSummary,
  TICKET_ATTACHMENT_MAX_COUNT,
  TICKET_ATTACHMENT_MAX_SIZE_BYTES,
  validateTicketAttachments,
} from "@/lib/ticket-attachment-validation"

const img = (over: Partial<{ name: string; mimeType: string; size: number }> = {}) => ({
  name: "foto.jpg",
  mimeType: "image/jpeg",
  size: 500_000,
  ...over,
})

describe("validateTicketAttachments", () => {
  it("lolos untuk gambar valid", () => {
    expect(validateTicketAttachments([img(), img({ name: "b.png", mimeType: "image/png" })])).toEqual([])
  })

  it("menolak tipe non-gambar dengan pesan yang jelas", () => {
    const issues = validateTicketAttachments([img({ name: "dok.pdf", mimeType: "application/pdf" })])
    expect(issues).toHaveLength(1)
    expect(issues[0].reason).toBe("type")
    expect(issues[0].message).toContain("dok.pdf")
  })

  it("menolak file melebihi batas ukuran", () => {
    const issues = validateTicketAttachments([
      img({ name: "besar.jpg", size: TICKET_ATTACHMENT_MAX_SIZE_BYTES + 1 }),
    ])
    expect(issues).toHaveLength(1)
    expect(issues[0].reason).toBe("size")
    expect(issues[0].message).toContain("besar.jpg")
  })

  it("melewatkan validasi ukuran bila platform tidak melaporkan size (0)", () => {
    expect(validateTicketAttachments([img({ size: 0 })])).toEqual([])
  })

  it("menolak kelebihan jumlah terhadap existingCount", () => {
    const candidates = Array.from({ length: 3 }, (_, i) => img({ name: `f${i}.jpg` }))
    const issues = validateTicketAttachments(candidates, TICKET_ATTACHMENT_MAX_COUNT - 1)
    expect(issues).toHaveLength(2)
    expect(issues.every((i) => i.reason === "count")).toBe(true)
    // Kandidat pertama masih muat.
    expect(issues[0].index).toBe(1)
  })

  it("ringkasan batas menyebut angka yang sama dengan konstanta", () => {
    const s = attachmentLimitSummary()
    expect(s).toContain(String(TICKET_ATTACHMENT_MAX_COUNT))
    expect(s).toContain("10")
  })
})
