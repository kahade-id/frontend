/**
 * Test murni — draft tiket per kategori + kedaluwarsa (batch 139, F11).
 *
 * Revisi dari item 131: satu draft global → map per kategori.
 */
import { describe, expect, it } from "vitest"

import {
  clearSupportDraft,
  draftTtlLabel,
  isEmptyDraft,
  listDraftCategories,
  loadSupportDraft,
  saveSupportDraft,
  SUPPORT_DRAFT_TTL_MS,
  type SupportDraft,
} from "@/lib/support-draft"

const draft = (over: Partial<SupportDraft> = {}): Omit<SupportDraft, "expiresAt"> => ({
  category: "GENERAL",
  subject: "",
  message: "",
  attachments: [],
  savedAt: Date.now(),
  ...over,
})

describe("isEmptyDraft", () => {
  it("kosong bila semua field kosong", () => {
    expect(isEmptyDraft({ ...draft(), expiresAt: Date.now() + 1 })).toBe(true)
  })

  it("tidak kosong bila ada isi apa pun", () => {
    const d = (o: Partial<SupportDraft>) => ({ ...draft(o), expiresAt: Date.now() + 1 })
    expect(isEmptyDraft(d({ subject: "x" }))).toBe(false)
    expect(isEmptyDraft(d({ message: "x" }))).toBe(false)
    expect(isEmptyDraft(d({ attachments: ["k"] }))).toBe(false)
    expect(isEmptyDraft(d({ orderId: "o1" }))).toBe(false)
    expect(isEmptyDraft(d({ relatedArticleId: "a1" }))).toBe(false)
  })
})

describe("draft per kategori", () => {
  it("kategori berbeda tidak saling menimpa", async () => {
    await saveSupportDraft(draft({ category: "GENERAL", subject: "umum" }))
    await saveSupportDraft(draft({ category: "ORDER", subject: "pesanan" }))
    const general = await loadSupportDraft("GENERAL")
    const order = await loadSupportDraft("ORDER")
    expect(general?.subject).toBe("umum")
    expect(order?.subject).toBe("pesanan")
  })

  it("roundtrip menyimpan semua field + expiresAt 7 hari", async () => {
    const before = Date.now()
    await saveSupportDraft(
      draft({
        category: "PAYMENT",
        subject: "Gagal bayar",
        message: "Sudah coba 2x",
        attachments: ["k1"],
        attachmentCaptions: { k1: "bukti transfer" },
        orderId: "order-9",
      }),
    )
    const loaded = await loadSupportDraft("PAYMENT")
    expect(loaded).toMatchObject({
      category: "PAYMENT",
      subject: "Gagal bayar",
      attachments: ["k1"],
      attachmentCaptions: { k1: "bukti transfer" },
      orderId: "order-9",
    })
    expect(loaded!.expiresAt).toBeGreaterThanOrEqual(before + SUPPORT_DRAFT_TTL_MS - 1000)
  })

  it("draft kedaluwarsa tidak dikembalikan + dibersihkan", async () => {
    const expiredAt = Date.now() - SUPPORT_DRAFT_TTL_MS - 1000
    await saveSupportDraft(draft({ category: "KYC", subject: "lama", savedAt: expiredAt }))
    expect(await loadSupportDraft("KYC")).toBeNull()
    expect(await listDraftCategories()).not.toContain("KYC")
  })

  it("clearSupportDraft per kategori tidak menghapus kategori lain", async () => {
    await saveSupportDraft(draft({ category: "GENERAL", subject: "g" }))
    await saveSupportDraft(draft({ category: "TECHNICAL", subject: "t" }))
    await clearSupportDraft("GENERAL")
    expect(await loadSupportDraft("GENERAL")).toBeNull()
    expect((await loadSupportDraft("TECHNICAL"))?.subject).toBe("t")
  })

  it("sanitasi memotong panjang field", async () => {
    await saveSupportDraft(draft({ category: "OTHER", subject: "x".repeat(500) }))
    const loaded = await loadSupportDraft("OTHER")
    expect(loaded?.subject.length).toBeLessThanOrEqual(120)
  })
})

describe("draftTtlLabel", () => {
  it("label sisa waktu yang bisa dimengerti", () => {
    const now = Date.now()
    expect(draftTtlLabel({ ...draft(), expiresAt: now + 3 * 24 * 60 * 60 * 1000 }, now)).toContain("3 hari")
    expect(draftTtlLabel({ ...draft(), expiresAt: now + 2 * 60 * 60 * 1000 }, now)).toContain("2 jam")
    expect(draftTtlLabel({ ...draft(), expiresAt: now - 1 }, now)).toBe("kedaluwarsa")
  })
})
