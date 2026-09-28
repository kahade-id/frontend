/**
 * Item mega-batch 34: hint "langkah berikutnya" untuk area aksi kosong di
 * detail order — murni copy per status × peran.
 */
import { describe, expect, it } from "vitest"
import { orderNextStepHint } from "@/lib/order-next-step"

describe("orderNextStepHint (item 34)", () => {
  it("penjual WAITING_CONFIRMATION → konfirmasi order", () => {
    expect(orderNextStepHint("WAITING_CONFIRMATION", "SELLER")).toMatch(
      /konfirmasi order/i,
    )
  })

  it("pembeli WAITING_CONFIRMATION → menunggu penjual", () => {
    expect(orderNextStepHint("WAITING_CONFIRMATION", "BUYER")).toMatch(
      /menunggu penjual/i,
    )
  })

  it("penjual WAITING_PAYMENT/PENDING_PAYMENT → menunggu pembayaran", () => {
    expect(orderNextStepHint("WAITING_PAYMENT", "SELLER")).toMatch(
      /menunggu pembeli membayar/i,
    )
    expect(orderNextStepHint("PENDING_PAYMENT", "SELLER")).toMatch(
      /menunggu pembeli membayar/i,
    )
  })

  it("pembeli WAITING_PAYMENT → null (tombol Bayar yang tampil)", () => {
    expect(orderNextStepHint("WAITING_PAYMENT", "BUYER")).toBeNull()
  })

  it("pembeli PROCESSING → penjual menyiapkan", () => {
    expect(orderNextStepHint("PROCESSING", "BUYER")).toMatch(
      /menyiapkan dan mengirim/i,
    )
  })

  it("penjual IN_DELIVERY → menunggu konfirmasi pembeli", () => {
    expect(orderNextStepHint("IN_DELIVERY", "SELLER")).toMatch(
      /menunggu pembeli mengonfirmasi/i,
    )
    expect(orderNextStepHint("SHIPPED", "SELLER")).toMatch(
      /menunggu pembeli mengonfirmasi/i,
    )
  })

  it("DISPUTED → pantau sengketa (tanpa peran pun)", () => {
    expect(orderNextStepHint("DISPUTED", "BUYER")).toMatch(/sengketa/i)
    expect(orderNextStepHint("DISPUTED", undefined)).toMatch(/sengketa/i)
  })

  it("status terminal / tak dikenal → null", () => {
    expect(orderNextStepHint("COMPLETED", "BUYER")).toBeNull()
    expect(orderNextStepHint("CANCELLED", "SELLER")).toBeNull()
    expect(orderNextStepHint("WHATEVER", "BUYER")).toBeNull()
  })

  it("peran tak dikenal untuk status non-sengketa → null", () => {
    expect(orderNextStepHint("PROCESSING", undefined)).toBeNull()
  })
})
