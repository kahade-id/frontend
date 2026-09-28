/**
 * Kontrak filter pencarian lokal Pengaturan (batch 139 A15).
 *
 * Menjamin: hanya memfilter item yang SUDAH ADA (tidak menambah destinasi),
 * case-insensitive, query kosong = semua grup utuh, grup tanpa hasil dibuang.
 */
import { describe, expect, it } from "vitest"

import { filterSettingsGroups } from "@/lib/settings-search"

const GROUPS = [
  {
    title: "Akun",
    items: [{ label: "Keamanan" }, { label: "Edit Profil" }],
  },
  {
    title: "Preferensi",
    items: [{ label: "Tampilan" }, { label: "Bahasa" }],
  },
  {
    title: "Legal",
    items: [{ label: "Syarat & Ketentuan" }],
  },
]

describe("filterSettingsGroups", () => {
  it("query kosong mengembalikan semua grup apa adanya", () => {
    expect(filterSettingsGroups(GROUPS, "")).toBe(GROUPS)
    expect(filterSettingsGroups(GROUPS, "   ")).toBe(GROUPS)
  })

  it("mencocokkan label case-insensitive", () => {
    const result = filterSettingsGroups(GROUPS, "bahasa")
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe("Preferensi")
    expect(result[0].items.map((i) => i.label)).toEqual(["Bahasa"])
  })

  it("membuang grup yang tidak punya item cocok", () => {
    const result = filterSettingsGroups(GROUPS, "keamanan")
    expect(result.map((g) => g.title)).toEqual(["Akun"])
  })

  it("mencocokkan substring di tengah label", () => {
    const result = filterSettingsGroups(GROUPS, "tamp")
    expect(result[0].items.map((i) => i.label)).toEqual(["Tampilan"])
  })

  it("tidak ada yang cocok → array kosong", () => {
    expect(filterSettingsGroups(GROUPS, "xyz-tidak-ada")).toEqual([])
  })

  it("trim whitespace di query", () => {
    const result = filterSettingsGroups(GROUPS, "  Bahasa  ")
    expect(result).toHaveLength(1)
  })
})
