/**
 * Tests untuk lib/pending-actions.ts (K-01)
 * Memverifikasi penyimpanan, pembersihan, kedaluwarsa, dan batasan aksi menggantung.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  clearPendingActions,
  getPendingActionsSnapshot,
  prunePendingActions,
  recordPendingAction,
  resetPendingActionsForTest,
  resolvePendingAction,
  toEpochMs,
  type PendingAction,
} from "@/lib/pending-actions"
import { resetServerTime } from "@/lib/server-time"

describe("lib/pending-actions", () => {
  beforeEach(() => {
    resetServerTime()
    resetPendingActionsForTest()
  })

  afterEach(() => {
    resetServerTime()
    resetPendingActionsForTest()
  })

  it("toEpochMs menormalisasi number dan ISO string", () => {
    expect(toEpochMs(1700000000000)).toBe(1700000000000)
    expect(toEpochMs("2026-09-23T12:00:00Z")).toBe(Date.parse("2026-09-23T12:00:00Z"))
    expect(toEpochMs("not-a-date")).toBeUndefined()
    expect(toEpochMs(null)).toBeUndefined()
    expect(toEpochMs(undefined)).toBeUndefined()
  })

  it("mencatat dan membaca pending action", () => {
    const action: PendingAction = {
      kind: "withdraw-otp",
      txId: "tx-123",
      amount: 50000,
      createdAt: Date.now(),
    }
    recordPendingAction(action)

    const list = getPendingActionsSnapshot()
    expect(list).toHaveLength(1)
    expect(list[0]).toEqual(action)
  })

  it("mendeduplikasi aksi dengan kind dan id yang sama", () => {
    const action1: PendingAction = {
      kind: "withdraw-otp",
      txId: "tx-dup",
      amount: 10000,
      createdAt: Date.now(),
    }
    const action2: PendingAction = {
      kind: "withdraw-otp",
      txId: "tx-dup",
      amount: 20000,
      createdAt: Date.now() + 1000,
    }
    recordPendingAction(action1)
    recordPendingAction(action2)

    const list = getPendingActionsSnapshot()
    expect(list).toHaveLength(1)
    expect(list[0].amount).toBe(20000)
  })

  it("resolvePendingAction menghapus aksi yang sesuai", () => {
    recordPendingAction({
      kind: "withdraw-otp",
      txId: "tx-del",
      amount: 10000,
      createdAt: Date.now(),
    })
    recordPendingAction({
      kind: "qris-payment",
      orderId: "ord-keep",
      amount: 50000,
      createdAt: Date.now(),
    })

    resolvePendingAction("withdraw-otp", "tx-del")
    const list = getPendingActionsSnapshot()
    expect(list).toHaveLength(1)
    expect(list[0].kind).toBe("qris-payment")
  })

  it("prunePendingActions membuang aksi yang sudah kedaluwarsa (expiresAt)", () => {
    recordPendingAction({
      kind: "withdraw-otp",
      txId: "tx-expired",
      amount: 10000,
      createdAt: Date.now() - 10000,
      expiresAt: Date.now() - 1000, // sudah lewat
    })
    recordPendingAction({
      kind: "withdraw-otp",
      txId: "tx-valid",
      amount: 20000,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    })

    prunePendingActions()
    const list = getPendingActionsSnapshot()
    expect(list).toHaveLength(1)
    const validAction = list[0]
    expect(validAction?.kind).toBe("withdraw-otp")
    if (validAction?.kind === "withdraw-otp") {
      expect(validAction.txId).toBe("tx-valid")
    }
  })

  it("clearPendingActions menghapus semua entri", () => {
    recordPendingAction({
      kind: "topup-unpaid",
      paymentTxId: "top-1",
      amount: 15000,
      createdAt: Date.now(),
    })
    clearPendingActions()
    expect(getPendingActionsSnapshot()).toHaveLength(0)
  })
})
