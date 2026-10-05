import { describe, expect, it } from "vitest"

import { SECONDARY_MENU_META } from "@/lib/drawer-menu"

describe("sidebar 2026-10-05 — menu sekunder di bawah garis pemisah", () => {
  it("Keamanan, Pusat Bantuan, Bisnis — dalam urutan itu", () => {
    expect(SECONDARY_MENU_META.map((m) => m.label)).toEqual([
      "Keamanan",
      "Pusat Bantuan",
      "Bisnis",
    ])
    expect(SECONDARY_MENU_META.map((m) => m.id)).toEqual([
      "security",
      "help-center",
      "business",
    ])
  })

  it("tidak ada lagi menu warisan (umpan balik / live-support / tiket) di drawer", () => {
    const ids = SECONDARY_MENU_META.map((m) => m.id)
    for (const lama of ["feedback", "live-support", "support-tickets"]) {
      expect(ids).not.toContain(lama)
    }
  })
})
