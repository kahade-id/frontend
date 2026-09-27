/**
 * Test murni — draft form tiket dukungan (item 131).
 */
import { describe, expect, it } from "vitest"

import {
  clearSupportDraft,
  isEmptyDraft,
  loadSupportDraft,
  saveSupportDraft,
  type SupportDraft,
} from "@/lib/support-draft"

const draft = (over: Partial<SupportDraft> = {}): SupportDraft => ({
  category: "GENERAL",
  subject: "",
  message: "",
  attachments: [],
  savedAt: 0,
  ...over,
})

describe("isEmptyDraft", () => {
  it("kosong bila semua field kosong", () => {
    expect(isEmptyDraft(draft())).toBe(true)
  })

  it("tidak kosong bila ada isi apa pun", () => {
    expect(isEmptyDraft(draft({ subject: "x" }))).toBe(false)
    expect(isEmptyDraft(draft({ message: "x" }))).toBe(false)
    expect(isEmptyDraft(draft({ attachments: ["k"] }))).toBe(false)
    expect(isEmptyDraft(draft({ orderId: "o1" }))).toBe(false)
    expect(isEmptyDraft(draft({ relatedArticleId: "a1" }))).toBe(false)
  })

  it("spasi saja dihitung kosong", () => {
    expect(isEmptyDraft(draft({ subject: "   ", message: "\n" }))).toBe(true)
  })
})

describe("loadSupportDraft / saveSupportDraft", () => {
  it("roundtrip menyimpan semua field", async () => {
    const d = draft({
      category: "ORDER",
      subject: "Barang belum datang",
      message: "Sudah 5 hari",
      attachments: ["k1", "k2"],
      orderId: "order-9",
      relatedArticleId: "art-3",
      savedAt: 123,
    })
    await saveSupportDraft(d)
    const loaded = await loadSupportDraft()
    expect(loaded).toMatchObject({
      category: "ORDER",
      subject: "Barang belum datang",
      message: "Sudah 5 hari",
      attachments: ["k1", "k2"],
      orderId: "order-9",
      relatedArticleId: "art-3",
    })
  })

  it("sanitasi memotong panjang dan membuang tipe aneh", async () => {
    await saveSupportDraft(draft({ subject: "x".repeat(500), message: "y".repeat(9000) }))
    const loaded = await loadSupportDraft()
    expect(loaded?.subject.length).toBeLessThanOrEqual(120)
    expect(loaded?.message.length).toBeLessThanOrEqual(5000)
  })

  it("clearSupportDraft menghapus draft", async () => {
    await saveSupportDraft(draft({ subject: "sementara" }))
    await clearSupportDraft()
    expect(await loadSupportDraft()).toBeNull()
  })
})
