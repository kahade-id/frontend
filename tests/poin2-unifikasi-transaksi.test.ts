/**
 * Poin 2 (2026-10-04) — Unifikasi transaksi escrow (sisi frontend).
 *
 * Mengunci kontrak yang murni (jalan di vitest node env):
 *  1. ROUTES.createTransactionJastip/Patungan meneruskan id partisipasi ke
 *     create-transaction (tanpa id = perilaku lama, prefill saja).
 *  2. normalizeSlotBooking membaca `orderId` — pintu sengketa/retur di layar
 *     booking jasa hanya tampil bila terisi.
 *  3. Guard teks sumber:
 *     - create-transaction: setelah order terbentuk, otomatis memanggil
 *       endpoint create-order participant dengan order.id (tanpa tempel ID
 *       manual); CreateOrderDto membawa `slotId` dari booking.
 *     - jastip/[id].tsx & patungan/[id].tsx: pola "Tautkan pesanan yang sudah
 *       dibayar" (tombol + BottomSheet + handleLink + link-order) DIHAPUS.
 *     - Tab Transaksi: baris "Kelola" (Template Transaksi, Tautan Pesanan,
 *       Sengketa Saya) menggantikan 3 item drawer yang dipindah.
 *     - components/order-help-actions.tsx: memakai ROUTES.disputeDetail &
 *       ROUTES.newReturn (entry sengketa/retur dari jastip/patungan/booking).
 */
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { normalizeSlotBooking } from "@/lib/api/commerce"
import { ROUTES } from "@/lib/routes"

const testsDir = dirname(fileURLToPath(import.meta.url))
const src = (p: string) => readFileSync(resolve(testsDir, "..", p), "utf8")

/** Ekstrak params dari Href object `{ pathname, params }`. */
function hrefParams(href: unknown): Record<string, string> {
  const o = href as { params?: Record<string, string> }
  return o.params ?? {}
}

describe("POIN 2 — route create-transaction meneruskan id partisipasi", () => {
  it("createTransactionJastip meneruskan jastipParticipantId", () => {
    const params = hrefParams(ROUTES.createTransactionJastip("Jastip: Trip X", 150000, "jp_123"))
    expect(params.jastipParticipantId).toBe("jp_123")
    expect(params.amount).toBe("150000")
    expect(params.orderType).toBe("PHYSICAL_GOODS")
  })

  it("createTransactionJastip tanpa id partisipasi = prefill biasa (kompatibel)", () => {
    const params = hrefParams(ROUTES.createTransactionJastip("Jastip: Trip X", 150000))
    expect(params.jastipParticipantId).toBeUndefined()
    expect(params.title).toBe("Jastip: Trip X")
  })

  it("createTransactionPatungan meneruskan patunganParticipantId", () => {
    const params = hrefParams(ROUTES.createTransactionPatungan("Patungan: Kopi", 50000, "pp_456"))
    expect(params.patunganParticipantId).toBe("pp_456")
    expect(params.amount).toBe("50000")
    expect(params.orderType).toBe("OTHER")
  })

  it("createTransactionPatungan tanpa id partisipasi = prefill biasa (kompatibel)", () => {
    const params = hrefParams(ROUTES.createTransactionPatungan("Patungan: Kopi", 50000))
    expect(params.patunganParticipantId).toBeUndefined()
  })

  it("rute sengketa/retur yang dipakai entry point Poin 2 ada", () => {
    // disputeDetail butuh disputeId; newReturn menerima orderId opsional.
    expect(hrefParams(ROUTES.newReturn("ord_1")).orderId).toBe("ord_1")
    expect(hrefParams(ROUTES.newReturn()).orderId).toBeUndefined()
    const detail = ROUTES.disputeDetail("dsp_1") as { pathname?: string }
    expect(detail.pathname).toBe("/dispute/[id]")
  })
})

describe("POIN 2 — normalizeSlotBooking membawa orderId", () => {
  it("orderId terbaca dari payload backend", () => {
    const b = normalizeSlotBooking({ id: "b1", slotId: "s1", userId: "u1", orderId: "ord_9" })
    expect(b?.orderId).toBe("ord_9")
  })

  it("orderId null bila backend belum mengirim (booking tanpa order)", () => {
    const b = normalizeSlotBooking({ id: "b1", slotId: "s1", userId: "u1" })
    expect(b?.orderId).toBeNull()
  })
})

describe("POIN 2 — guard teks sumber (pola manual dihapus, alur otomatis)", () => {
  it("create-transaction: order otomatis didaftarkan ke partisipasi", () => {
    const s = src("app/create-transaction.tsx")
    expect(s).toContain("createOrderFromJastipParticipant")
    expect(s).toContain("createOrderFromPatunganParticipant")
    expect(s).toContain("jastipParticipantId")
    expect(s).toContain("patunganParticipantId")
    // Dipanggil SETELAH order terbentuk, dengan order.id.
    expect(s).toMatch(/registerOrderForParticipant\(participantPrefill\.id, order\.id\)/)
  })

  it("create-transaction: slotId ikut dalam CreateOrderDto", () => {
    const s = src("app/create-transaction.tsx")
    expect(s).toMatch(/\.\.\.\(slotPrefill \? \{ slotId: slotPrefill\.slotId \} : \{\}\)/)
  })

  it("jastip/[id]: pola tempel-ID manual dihapus", () => {
    const s = src("app/jastip/[id].tsx")
    expect(s).not.toContain("Tautkan pesanan yang sudah dibayar")
    expect(s).not.toContain("handleLink")
    expect(s).not.toContain("linkJastipOrder")
    expect(s).not.toContain("link-order")
    // Id partisipasi diteruskan ke wizard; entry sengketa/retur ada.
    expect(s).toContain("OrderHelpActions")
    expect(s).toMatch(/createTransactionJastip\([\s\S]*?myParticipation\.id/)
  })

  it("patungan/[id]: pola tempel-ID manual dihapus", () => {
    const s = src("app/patungan/[id].tsx")
    expect(s).not.toContain("Tautkan pesanan yang sudah dibayar")
    expect(s).not.toContain("handleLink")
    expect(s).not.toContain("linkPatunganOrder")
    expect(s).not.toContain("link-order")
    // Id partisipasi diteruskan ke wizard; entry sengketa/retur ada.
    expect(s).toContain("OrderHelpActions")
    expect(s).toMatch(/createTransactionPatungan\([\s\S]*?myParticipation\.id/)
  })

  it("service-bookings: entry sengketa/retur hanya bila ada orderId", () => {
    const s = src("app/service-bookings.tsx")
    expect(s).toContain("OrderHelpActions")
    expect(s).toMatch(/booking\.orderId \? <OrderHelpActions/)
  })

  it("tab Transaksi: baris Kelola menggantikan 3 item drawer", () => {
    const s = src("components/screens/transactions-tab-screen.tsx")
    expect(s).toContain("TrxManageRow")
    expect(s).toContain("Template Transaksi")
    expect(s).toContain("Tautan Pesanan")
    expect(s).toContain("Sengketa Saya")
    expect(s).toContain("ROUTES.transactionTemplates")
    expect(s).toContain("ROUTES.orderLinks")
    expect(s).toContain("ROUTES.disputes")
  })

  it("order-help-actions: memakai ROUTES.disputeDetail & ROUTES.newReturn", () => {
    const s = src("components/order-help-actions.tsx")
    expect(s).toContain("ROUTES.disputeDetail(disputeId)")
    expect(s).toContain("ROUTES.newReturn(orderId)")
  })
})
