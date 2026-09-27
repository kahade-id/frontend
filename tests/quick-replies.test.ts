/**
 * Item 23 (2026-09-28) — template balasan cepat: CRUD template custom,
 * penyimpanan lokal, dan penyaring query.
 */
import { beforeEach, describe, expect, it } from "vitest"

import {
  QUICK_REPLY_CUSTOM_MAX,
  __resetQuickRepliesForTest,
  addQuickReply,
  filterQuickReplies,
  loadQuickReplies,
  removeQuickReply,
  updateQuickReply,
} from "@/lib/quick-replies"
import { deleteRawItem, getRawItem, setRawItem } from "@/lib/secure-storage"

const STORAGE_KEY = "chat.quickReplies.v1"

beforeEach(async () => {
  __resetQuickRepliesForTest()
  // Payload tidak ikut di-reset oleh reset module — bersihkan eksplisit.
  await deleteRawItem(STORAGE_KEY)
})

describe("template balasan cepat (item 23)", () => {
  it("memuat template bawaan saat storage kosong", async () => {
    const replies = await loadQuickReplies()
    expect(replies.length).toBeGreaterThan(0)
    expect(replies.every((r) => r.builtin)).toBe(true)
    expect(replies.every((r) => typeof r.id === "string" && typeof r.text === "string")).toBe(true)
  })

  it("template custom bertahan dan terbaca ulang dari storage", async () => {
    const added = await addQuickReply("Paket dikirim hari ini, resi menyusul.")
    expect(added.builtin).toBe(false)
    expect(await getRawItem(STORAGE_KEY)).not.toBeNull()
    // Modul stateless (baca langsung dari storage) — reload cukup panggil lagi.
    const reloaded = await loadQuickReplies()
    expect(reloaded.some((r) => r.text === "Paket dikirim hari ini, resi menyusul.")).toBe(true)
    // Custom muncul sebelum bawaan (paling baru dulu).
    expect(reloaded[0].builtin).toBe(false)
  })

  it("teks kosong ditolak", async () => {
    await expect(addQuickReply("   ")).rejects.toThrow()
  })

  it("duplikat teks custom ditolak", async () => {
    await addQuickReply("teks sama")
    await expect(addQuickReply("teks sama")).rejects.toThrow()
  })

  it("update template custom", async () => {
    const added = await addQuickReply("teks awal")
    await updateQuickReply(added.id, "teks baru")
    const reloaded = await loadQuickReplies()
    expect(reloaded.find((r) => r.id === added.id)?.text).toBe("teks baru")
  })

  it("template bawaan tidak berubah saat diupdate/dihapus (no-op aman)", async () => {
    const builtin = (await loadQuickReplies()).find((r) => r.builtin)
    expect(builtin).toBeDefined()
    await updateQuickReply(builtin!.id, "coba ubah")
    await removeQuickReply(builtin!.id)
    const reloaded = await loadQuickReplies()
    const stillThere = reloaded.find((r) => r.id === builtin!.id)
    expect(stillThere).toBeDefined()
    expect(stillThere!.text).toBe(builtin!.text)
    expect(reloaded.filter((r) => r.builtin)).toHaveLength(reloaded.length)
  })

  it("hapus template custom", async () => {
    const added = await addQuickReply("hapus saya")
    await removeQuickReply(added.id)
    const reloaded = await loadQuickReplies()
    expect(reloaded.some((r) => r.id === added.id)).toBe(false)
  })

  it("filter: query kosong mengembalikan semua; cocok sebagian, case-insensitive", async () => {
    await addQuickReply("Paket sudah dikirim")
    const replies = await loadQuickReplies()
    expect(filterQuickReplies(replies, "")).toHaveLength(replies.length)
    const filtered = filterQuickReplies(replies, "PAKET")
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((r) => r.text.toLowerCase().includes("paket"))).toBe(true)
  })

  it("batas jumlah template custom ditegakkan", async () => {
    expect(QUICK_REPLY_CUSTOM_MAX).toBe(50)
    for (let i = 0; i < QUICK_REPLY_CUSTOM_MAX; i++) {
      await addQuickReply(`custom ${i}`)
    }
    await expect(addQuickReply("kelebihan")).rejects.toThrow()
  })

  it("payload rusak di storage kembali ke template bawaan", async () => {
    await setRawItem(STORAGE_KEY, "{rusak")
    const replies = await loadQuickReplies()
    expect(replies.length).toBeGreaterThan(0)
    expect(replies.every((r) => r.builtin)).toBe(true)
  })
})
