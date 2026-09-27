/**
 * FE-IMP-4 item 1 — test murni `computeEscrowHolds` / `totalEscrowHeld`.
 */
import { describe, expect, it } from "vitest"

import { computeEscrowHolds, totalEscrowHeld } from "@/lib/wallet-escrow-holds"
import type { WalletTransaction } from "@/lib/api/wallet"

function tx(partial: Partial<WalletTransaction> & { id: string }): WalletTransaction {
  return {
    type: "ORDER_LOCK",
    amount: 0,
    createdAt: "2026-09-28T00:00:00.000Z",
    ...partial,
  }
}

describe("computeEscrowHolds", () => {
  it("menahan lock tanpa pelepasan", () => {
    const holds = computeEscrowHolds([
      tx({ id: "1", type: "ORDER_LOCK", amount: -50000, referenceId: "ord-1" }),
    ])
    expect(holds).toHaveLength(1)
    expect(holds[0]).toMatchObject({ orderId: "ord-1", amount: 50000 })
  })

  it("mengeluarkan lock yang sudah ada ORDER_RELEASE", () => {
    const holds = computeEscrowHolds([
      tx({ id: "1", type: "ORDER_LOCK", amount: -50000, referenceId: "ord-1" }),
      tx({ id: "2", type: "ORDER_RELEASE", amount: -50000, referenceId: "ord-1" }),
    ])
    expect(holds).toHaveLength(0)
  })

  it("mengeluarkan lock yang sudah ada ORDER_REFUND / DISPUTE_RELEASE", () => {
    const holds = computeEscrowHolds([
      tx({ id: "1", type: "ORDER_LOCK", amount: -10000, referenceId: "ord-a" }),
      tx({ id: "2", type: "ORDER_LOCK", amount: -20000, referenceId: "ord-b" }),
      tx({ id: "3", type: "ORDER_REFUND", amount: 10000, referenceId: "ord-a" }),
      tx({ id: "4", type: "DISPUTE_RELEASE", amount: -20000, referenceId: "ord-b" }),
    ])
    expect(holds).toHaveLength(0)
  })

  it("melewati mutasi tanpa referenceId atau nominal nol", () => {
    const holds = computeEscrowHolds([
      tx({ id: "1", type: "ORDER_LOCK", amount: -50000 }),
      tx({ id: "2", type: "ORDER_LOCK", amount: 0, referenceId: "ord-x" }),
    ])
    expect(holds).toHaveLength(0)
  })

  it("totalEscrowHeld menjumlahkan nominal", () => {
    const holds = computeEscrowHolds([
      tx({ id: "1", type: "ORDER_LOCK", amount: -50000, referenceId: "ord-1" }),
      tx({ id: "2", type: "ORDER_LOCK", amount: -25000, referenceId: "ord-2" }),
    ])
    expect(totalEscrowHeld(holds)).toBe(75000)
  })
})
