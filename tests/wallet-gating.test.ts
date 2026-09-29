/**
 * Test gating akses dompet — Mode Tanpa Wallet Internal (BI-safe).
 *
 * Mengunci kontrak:
 * - `getMainMenuMeta(false)`: item "Dompet Saya" DIGANTI "Rekening Bank";
 *   tidak ada href dompet yang tersisa di menu utama drawer.
 * - `getMainMenuMeta(true)`: menu tidak berubah (Dompet Saya tetap ada).
 * - `getCreateSheetItems(false)`: aksi "Isi saldo dompet" disembunyikan.
 * - `getCreateSheetItems(true)`: semua aksi tetap ada.
 *
 * Catatan: `getCreateSheetItems` diimpor dari komponen create-sheet — modul
 * itu hanya mengimpor expo-router (stub) + lib murni, jadi aman di node env
 * (preceden: tests/drawer-badges.test.ts).
 */
import { describe, expect, it } from "vitest"

import { MAIN_MENU_META, getMainMenuMeta } from "@/lib/drawer-menu"
import {
  CREATE_SHEET_ITEMS_META,
  getCreateSheetItemsMeta,
} from "@/lib/create-sheet-items"
import { ROUTES } from "@/lib/routes"

const WALLET_HREFS = new Set([
  ROUTES.wallet,
  ROUTES.topup,
  ROUTES.withdraw,
  ROUTES.transfer,
  ROUTES.receive,
  ROUTES.walletHistory,
  ROUTES.topupHistory,
  ROUTES.withdrawHistory,
])

describe("getMainMenuMeta", () => {
  it("flag true: menu tidak berubah (Dompet Saya tetap ada)", () => {
    expect(getMainMenuMeta(true)).toEqual(MAIN_MENU_META)
    expect(getMainMenuMeta(true).some((m) => m.id === "wallet")).toBe(true)
  })

  it("flag false: Dompet Saya diganti Rekening Bank", () => {
    const menu = getMainMenuMeta(false)
    expect(menu.some((m) => m.id === "wallet")).toBe(false)
    const bank = menu.find((m) => m.id === "bank-accounts")
    expect(bank).toBeDefined()
    expect(bank?.label).toBe("Rekening Bank")
    expect(bank?.href).toBe(ROUTES.bankAccounts)
  })

  it("flag false: tidak ada href dompet yang tersisa di menu utama", () => {
    const hrefs = getMainMenuMeta(false)
      .map((m) => m.href)
      .filter((h): h is NonNullable<typeof h> => h != null)
    expect(hrefs.some((h) => WALLET_HREFS.has(h))).toBe(false)
  })

  it("urutan & item lain tidak berubah saat flag false", () => {
    const menu = getMainMenuMeta(false)
    expect(menu.map((m) => m.id)).toEqual(
      MAIN_MENU_META.map((m) => (m.id === "wallet" ? "bank-accounts" : m.id)),
    )
  })
})

describe("getCreateSheetItemsMeta", () => {
  it("flag true: semua aksi tetap ada", () => {
    expect(getCreateSheetItemsMeta(true)).toEqual(CREATE_SHEET_ITEMS_META)
  })

  it("flag false: aksi top-up disembunyikan, sisanya utuh", () => {
    const items = getCreateSheetItemsMeta(false)
    expect(items.some((i) => i.key === "topup")).toBe(false)
    expect(items.map((i) => i.key)).toEqual(
      CREATE_SHEET_ITEMS_META.filter((i) => i.key !== "topup").map((i) => i.key),
    )
  })

  it("flag false: tidak ada href dompet yang tersisa", () => {
    const hrefs = getCreateSheetItemsMeta(false).map((i) => i.href)
    expect(hrefs).not.toContain(ROUTES.topup)
  })
})
