/**
 * Tests untuk lib/order-confirm.ts (item #24 — aksi "Konfirmasi terima").
 * Ekstraksi order ID dari payload push/notifikasi fail-closed (null bila
 * tidak ketemu); kelayakan hanya untuk pembeli pada status terkirim.
 */
import { describe, expect, it, vi } from "vitest"

// Facade `@/lib/api` menarik rantai native (expo-notifications dkk.) yang
// tidak ada di Node — mock di-hoist sebelum import statis di bawah.
const mocks = vi.hoisted(() => ({ getOrder: vi.fn() }))
vi.mock("@/lib/api", () => ({ api: { orders: { getOrder: mocks.getOrder } } }))

import {
  CONFIRM_RECEIPT_STATUSES,
  checkConfirmReceiptEligible,
  orderIdFromNotification,
  orderIdFromPushData,
} from "@/lib/order-confirm"

describe("lib/order-confirm — ekstraksi order ID", () => {
  it("membaca orderId / order_id langsung", () => {
    expect(orderIdFromPushData({ orderId: "ord-1" })).toBe("ord-1")
    expect(orderIdFromPushData({ order_id: "ord-2" })).toBe("ord-2")
  })

  it("membaca referenceId bertipe order/transaction/escrow", () => {
    expect(orderIdFromPushData({ referenceType: "order", referenceId: "ord-3" })).toBe("ord-3")
    expect(
      orderIdFromPushData({ referenceType: "ORDER_SHIPPED", referenceId: "ord-4" }),
    ).toBe("ord-4")
    expect(
      orderIdFromPushData({ type: "transaction", referenceId: "trx-1" }),
    ).toBe("trx-1")
  })

  it("menolak referenceId bertipe non-order", () => {
    expect(orderIdFromPushData({ referenceType: "chat", referenceId: "c-1" })).toBeNull()
    expect(orderIdFromPushData({ referenceType: "wallet", referenceId: "w-1" })).toBeNull()
  })

  it("membaca order ID dari actionUrl", () => {
    expect(orderIdFromPushData({ actionUrl: "kahade://order/ord-9" })).toBe("ord-9")
    expect(orderIdFromPushData({ actionUrl: "https://kahade.id/order/ord-10/detail" })).toBe(
      "ord-10",
    )
  })

  it("fail-closed: null untuk payload tak dikenal", () => {
    expect(orderIdFromPushData(null)).toBeNull()
    expect(orderIdFromPushData({})).toBeNull()
    expect(orderIdFromPushData({ foo: "bar" })).toBeNull()
    expect(orderIdFromPushData("ord-1")).toBeNull()
  })

  it("orderIdFromNotification memakai referenceType terverifikasi", () => {
    expect(
      orderIdFromNotification({ referenceType: "order", referenceId: "ord-5" }),
    ).toBe("ord-5")
    expect(
      orderIdFromNotification({ referenceType: "chat", referenceId: "c-2" }),
    ).toBeNull()
  })
})

describe("lib/order-confirm — status kelayakan", () => {
  it("hanya status terkirim yang eligible", () => {
    expect([...CONFIRM_RECEIPT_STATUSES].sort()).toEqual(
      ["DELIVERED", "IN_DELIVERY", "SHIPPED"].sort(),
    )
  })

  it("checkConfirmReceiptEligible: hanya BUYER + status terkirim", async () => {
    const { getOrder } = mocks
    getOrder.mockReset()

    // Eligible: pembeli + SHIPPED.
    getOrder.mockResolvedValue({ id: "o1", myRole: "BUYER", status: "SHIPPED" })
    expect(await checkConfirmReceiptEligible("o1")).toEqual({
      eligible: true,
      order: { id: "o1", myRole: "BUYER", status: "SHIPPED" },
    })

    // Penjual tidak eligible.
    getOrder.mockResolvedValue({ id: "o1", myRole: "SELLER", status: "SHIPPED" })
    expect((await checkConfirmReceiptEligible("o1")).eligible).toBe(false)

    // Status belum kirim tidak eligible.
    getOrder.mockResolvedValue({ id: "o1", myRole: "BUYER", status: "PAID" })
    expect((await checkConfirmReceiptEligible("o1")).eligible).toBe(false)

    // API error → fail-closed.
    getOrder.mockRejectedValue(new Error("offline"))
    expect((await checkConfirmReceiptEligible("o1")).eligible).toBe(false)
  })
})
