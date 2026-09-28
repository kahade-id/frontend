/**
 * Test Batch 139 E08/E09 — helper pencarian (lib/search-ui.ts).
 */
import { describe, expect, it } from "vitest"

import { getSearchEmptyStateCopy, pickDidYouMean } from "@/lib/search-ui"

describe("pickDidYouMean (E08 — koreksi tidak memaksa)", () => {
  it("menawarkan saran sebagai pilihan tanpa mengubah keyword", () => {
    const out = pickDidYouMean("sepatu lari", ["sepatu lari pria", "sepatu", "sepatu lari"])
    // "sepatu lari" (sama persis, beda kapitalisasi) dibuang; sisanya pilihan.
    expect(out).toEqual(["sepatu lari pria", "sepatu"])
  })
  it("tidak pernah mengembalikan keyword itu sendiri", () => {
    expect(pickDidYouMean("kopi", ["kopi"])).toEqual([])
  })
  it("dibatasi max dan dedupe case-insensitive", () => {
    const out = pickDidYouMean("a", ["B", "b", "C", "D", "E"], 3)
    expect(out).toEqual(["B", "C", "D"])
  })
  it("keyword kosong → tidak ada tawaran", () => {
    expect(pickDidYouMean("  ", ["kopi"])).toEqual([])
  })
})

describe("getSearchEmptyStateCopy (E09 — empty state per cakupan)", () => {
  it("setiap cakupan punya judul berbeda", () => {
    const titles = new Set(
      (["all", "users", "posts", "orders", "transactions", "chats"] as const).map(
        (s) => getSearchEmptyStateCopy(s).title,
      ),
    )
    expect(titles.size).toBe(6)
  })
  it("cakupan pengguna menyebut pengguna", () => {
    const copy = getSearchEmptyStateCopy("users")
    expect(copy.title.toLowerCase()).toContain("pengguna")
    expect(copy.description.length).toBeGreaterThan(0)
  })
  it("cakupan pesan menyebut pesan/percakapan", () => {
    const copy = getSearchEmptyStateCopy("chats")
    expect(copy.title.toLowerCase()).toMatch(/pesan/)
  })
})
