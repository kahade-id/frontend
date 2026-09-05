import { invalidResponse, readEntity, readPage } from "@/lib/api/response"
import type { Wallet, WalletTransaction, WalletTransactionsQuery } from "@/lib/api/wallet"

export function moneyNumber(value: unknown): number | undefined {
  const number = typeof value === "string" && /^-?\d+(?:\.0+)?$/.test(value) ? Number(value) : value
  return typeof number === "number" && Number.isSafeInteger(number) ? number : undefined
}
export function normalizeWallet(raw: unknown): Wallet {
  const wallet = readEntity<Record<string, unknown>>(raw, "wallet")
  const balance = moneyNumber(wallet.balance)
  if (balance === undefined) throw invalidResponse("wallet.balance")
  
  const holdRaw = wallet.holdBalance ?? wallet.hold_balance
  const availableRaw = wallet.availableBalance ?? wallet.available_balance
  
  const held = moneyNumber(holdRaw)
  const available = moneyNumber(availableRaw)
  
  if (
    (holdRaw != null && held === undefined) ||
    (availableRaw != null && available === undefined)
  )
    throw invalidResponse("wallet.balances")
  return {
    ...wallet,
    balance,
    availableBalance: available ?? (held === undefined ? undefined : balance - held),
    holdBalance: held,
  } as Wallet
}
export function normalizeWalletTransaction(raw: unknown): WalletTransaction {
  const tx = readEntity<Record<string, unknown>>(raw, "transaction")
  const amount = moneyNumber(tx.amount)
  if (amount === undefined || typeof tx.id !== "string" || typeof tx.type !== "string")
    throw invalidResponse("wallet.transaction")
  return { 
    ...tx, 
    amount,
    referenceId: (tx.referenceId ?? tx.reference_id) as string | null | undefined,
    createdAt: (tx.createdAt ?? tx.created_at) as string
  } as WalletTransaction
}
export function normalizeWalletPage(raw: unknown, query: Partial<WalletTransactionsQuery>) {
  const page = readPage<unknown>(raw, query, ["transactions"])
  return { ...page, data: page.data.map(normalizeWalletTransaction) }
}
