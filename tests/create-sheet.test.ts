/**
 * Store sheet global "Buat baru" — buka/tutup dari mana saja, idempoten.
 */
import { describe, expect, it } from "vitest"

import {
  closeCreateSheet,
  isCreateSheetOpen,
  openCreateSheet,
  resetCreateSheetForTest,
} from "@/lib/create-sheet"

describe("create-sheet store", () => {
  it("mulai tertutup", () => {
    resetCreateSheetForTest()
    expect(isCreateSheetOpen()).toBe(false)
  })

  it("open → true, close → false", () => {
    resetCreateSheetForTest()
    openCreateSheet()
    expect(isCreateSheetOpen()).toBe(true)
    closeCreateSheet()
    expect(isCreateSheetOpen()).toBe(false)
  })

  it("idempoten: open dua kali tetap terbuka, close dua kali tetap tertutup", () => {
    resetCreateSheetForTest()
    openCreateSheet()
    openCreateSheet()
    expect(isCreateSheetOpen()).toBe(true)
    closeCreateSheet()
    closeCreateSheet()
    expect(isCreateSheetOpen()).toBe(false)
  })
})
