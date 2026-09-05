import { describe, expect, it } from "vitest"
import {
  moneyNumber,
  normalizeWallet,
  normalizeWalletPage,
  normalizeWalletTransaction,
} from "@/lib/api/wallet-contract"
import { walletTransactionStatus, walletTransactionType } from "@/lib/wallet-labels"
import type { WalletTransaction } from "@/lib/api/wallet"

describe("wallet boundary", () => {
  it("normalizes exact integer decimal strings, not fractional or unsafe money", () => {
    expect(moneyNumber("12345.00")).toBe(12345)
    expect(moneyNumber("9007199254740993")).toBeUndefined()
    expect(moneyNumber("1200.50")).toBeUndefined()
    expect(moneyNumber(null)).toBeUndefined()
  })
  it("derives available only from explicit held funds", () => {
    expect(normalizeWallet({ balance: "100000", holdBalance: "20000" }).availableBalance).toBe(
      80000,
    )
    expect(normalizeWallet({ balance: 100000 }).availableBalance).toBeUndefined()
    expect(normalizeWallet({ balance: 100000 }).holdBalance).toBeUndefined()
  })
  it("rejects missing or malformed balances instead of showing zero", () => {
    expect(() => normalizeWallet({ message: "ok" })).toThrow()
    expect(() => normalizeWallet({ balance: 100000, holdBalance: "unknown" })).toThrow()
  })
  it("normalizes each transaction and preserves page metadata", () => {
    const result = normalizeWalletPage(
      {
        transactions: [{ id: "a", type: "TOPUP", amount: "10000" }],
        pagination: { page: 1, limit: 20, total: 21, totalPages: 2 },
      },
      { page: 1, limit: 20 },
    )
    expect(result.data[0].amount).toBe(10000)
    expect(result.meta.totalPages).toBe(2)
  })
  it("rejects bad transaction amounts and missing IDs", () => {
    expect(() => normalizeWalletTransaction({ id: "a", type: "TOPUP", amount: "xyz" })).toThrow()
    expect(() => normalizeWalletTransaction({ type: "TOPUP", amount: 10 })).toThrow()
  })
  it.each([undefined, null, "FUTURE_STATUS"])("never guesses success for %s", (status) =>
    expect(walletTransactionStatus(status)).toBe("UNKNOWN"),
  )
  it("unknown movements do not become debits", () => {
    const tx = { type: "FUTURE_TYPE" } as WalletTransaction
    expect(walletTransactionType(tx)).toBe("UNKNOWN")
    expect(walletTransactionType({ ...tx, direction: "CREDIT" })).toBe("CREDIT")
  })
})
