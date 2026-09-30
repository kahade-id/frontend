import { invalidResponse, readEntity, readPage } from "@/lib/api/response"
import type { Wallet, WalletTransaction, WalletTransactionsQuery } from "@/lib/api/wallet"

export function moneyNumber(value: unknown): number | undefined {
  const number = typeof value === "string" && /^-?\d+(?:\.0+)?$/.test(value) ? Number(value) : value
  return typeof number === "number" && Number.isSafeInteger(number) ? number : undefined
}
export function normalizeWallet(raw: unknown): Wallet {
  const wallet = readEntity<Record<string, unknown>>(raw, "wallet")
  const totalRaw = wallet.balance ?? wallet.totalBalance ?? wallet.total_balance
  const availableRaw = wallet.availableBalance ?? wallet.available_balance
  const escrowRaw = wallet.escrowBalance ?? wallet.escrow_balance
  const balance = moneyNumber(totalRaw)
  const available = moneyNumber(availableRaw)
  const escrow = moneyNumber(escrowRaw)
  const derivedBalance =
    balance ?? (available !== undefined && escrow !== undefined ? available + escrow : undefined)
  if (derivedBalance === undefined) throw invalidResponse("wallet.balance") 
  
  const holdRaw = wallet.holdBalance ?? wallet.hold_balance
  
  const held = moneyNumber(holdRaw)
  
  if (
    (holdRaw != null && held === undefined) ||
    (availableRaw != null && available === undefined)
  )
    throw invalidResponse("wallet.balances")
  // I-15 (audit end-to-end): WHITELIST field yang dikenal (prinsip D-08 seperti
  // `normalizeOrder`) — dulu `...wallet` menyebarkan field asing/salah tipe ke
  // state uang, inkonsisten dengan orders yang membuangnya.
  const idRaw = wallet.id ?? wallet.walletId
  // BFI-130: teruskan field aditif backend (whitelist — bukan spread liar).
  const escrowBreakdownRaw = wallet.escrowBreakdown
  const escrowBreakdown = Array.isArray(escrowBreakdownRaw)
    ? escrowBreakdownRaw
        .map((entry) => {
          const rec = (entry ?? {}) as Record<string, unknown>
          const amount = moneyNumber(rec.amount)
          const orderId = typeof rec.orderId === "string" ? rec.orderId : undefined
          return orderId && amount !== undefined ? { orderId, amount } : undefined
        })
        .filter((e): e is { orderId: string; amount: number } => e !== undefined)
    : undefined
  const lockReasonCode = wallet.lockReasonCode
  return {
    id: typeof idRaw === "string" ? idRaw : typeof idRaw === "number" ? String(idRaw) : "",
    balance: derivedBalance,
    // BFI-130: `totalBalance` = sumber `balance` — diekspos agar konsumen
    // bisa membaca nilai wire asli tanpa menebak derivasi.
    totalBalance: moneyNumber(wallet.totalBalance ?? wallet.total_balance),
    currency: typeof wallet.currency === "string" ? wallet.currency : undefined,
    status: (wallet.status ?? undefined) as Wallet["status"],
    availableBalance: available ?? (held === undefined ? undefined : derivedBalance - held),
    holdBalance: held,
    escrowBalance: escrow,
    hasPin: typeof wallet.hasPin === "boolean" ? wallet.hasPin : undefined,
    isLocked: typeof wallet.isLocked === "boolean" ? wallet.isLocked : undefined,
    lockReasonCode: typeof lockReasonCode === "string" ? lockReasonCode : undefined,
    kycFreeLimit: moneyNumber(wallet.kycFreeLimit ?? wallet.kyc_free_limit),
    escrowBreakdown,
    updatedAt: typeof wallet.updatedAt === "string" ? wallet.updatedAt : undefined,
    // FE-IMP-4 item 13: limit harian dari server (display-only "sisa limit").
    todayTopupAmount: moneyNumber(wallet.todayTopupAmount ?? wallet.today_topup_amount),
    todayWithdrawAmount: moneyNumber(wallet.todayWithdrawAmount ?? wallet.today_withdraw_amount),
    todayTransferAmount: moneyNumber(wallet.todayTransferAmount ?? wallet.today_transfer_amount),
    dailyTopupLimit: moneyNumber(wallet.dailyTopupLimit ?? wallet.daily_topup_limit),
    dailyWithdrawLimit: moneyNumber(wallet.dailyWithdrawLimit ?? wallet.daily_withdraw_limit),
    dailyTransferLimit: moneyNumber(wallet.dailyTransferLimit ?? wallet.daily_transfer_limit),
  } as Wallet
}
export function normalizeWalletTransaction(raw: unknown): WalletTransaction {
  const tx = readEntity<Record<string, unknown>>(raw, "transaction")
  const amount = moneyNumber(tx.amount)
  const rawTxId = tx.txId ?? tx.id
  // I-14 (audit end-toend 2026-09-24): id numerik diterima sebagai string —
  // pola A-07 di orders. Dulu SATU id numerik melempar PARSE dari
  // `normalizeWalletPage` dan menjatuhkan SELURUH halaman mutasi dompet.
  const transactionId =
    typeof rawTxId === "string" && rawTxId
      ? rawTxId
      : typeof rawTxId === "number" && Number.isFinite(rawTxId)
        ? String(rawTxId)
        : undefined
  if (amount === undefined || transactionId === undefined || typeof tx.type !== "string")
    throw invalidResponse("wallet.transaction")
  // I-14: tanggal dibaca toleran-tipe (D-03) — bukan cast `as string` yang
  // meloloskan objek/angka ke tampilan tanggal.
  const createdAtRaw = tx.createdAt ?? tx.created_at
  const createdAt =
    typeof createdAtRaw === "string"
      ? createdAtRaw
      : typeof createdAtRaw === "number" && Number.isFinite(createdAtRaw)
        ? String(createdAtRaw)
        : ""
  return { 
    ...tx, 
    id: transactionId,
    amount,
    referenceId: (tx.referenceId ?? tx.reference_id) as string | null | undefined,
    createdAt,
  } as WalletTransaction
}
export function normalizeWalletPage(raw: unknown, query: Partial<WalletTransactionsQuery>) {
  const page = readPage<unknown>(raw, query, ["transactions"])
  return { ...page, data: page.data.map(normalizeWalletTransaction) }
}
