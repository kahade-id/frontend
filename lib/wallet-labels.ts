/**
 * Kahade — peta label/status mutasi wallet (SATU sumber untuk tab Dompet &
 * detail mutasi). Nilai asing dari backend ditampilkan apa adanya.
 */
import type { WalletTransaction } from "@/lib/api/wallet"
import type { WalletTxKind, WalletTxStatus } from "@/components/ui/wallet-transaction-list-item"

/** Label mutasi — satu tempat; nilai asing dari backend ditampilkan apa adanya. */
export const WALLET_TXN_LABELS: Record<string, string> = {
  TOPUP: "Topup",
  WITHDRAWAL: "Penarikan",
  TRANSFER_IN: "Transfer Masuk",
  TRANSFER_OUT: "Transfer Keluar",
  ORDER_ESCROW: "Escrow Order",
  ORDER_RELEASE: "Pencairan Order",
  REFUND: "Refund",
  FEE: "Biaya Platform",
  CASHBACK: "Cashback",
}

/** Peta type API → ikon komponen (kind). Nilai asing → "other". */
export const WALLET_TXN_KIND: Record<string, WalletTxKind> = {
  TOPUP: "topup",
  WITHDRAWAL: "withdraw",
  TRANSFER_IN: "transfer_in",
  TRANSFER_OUT: "transfer_out",
  ORDER_ESCROW: "escrow_hold",
  ORDER_RELEASE: "escrow_release",
  REFUND: "refund",
  FEE: "fee",
  CASHBACK: "cashback",
}

/** Peta status API → status komponen (SUCCESS = default, tidak dirender). */
export const WALLET_TXN_STATUS: Record<string, WalletTxStatus> = {
  COMPLETED: "SUCCESS",
  SUCCESS: "SUCCESS",
  PENDING: "PENDING",
  FAILED: "FAILED",
}

/** Arah dana: field `direction` bila ada, fallback kategori. */
export function isWalletCredit(txn: WalletTransaction): boolean {
  if (txn.direction) return txn.direction === "CREDIT"
  return ["TOPUP", "TRANSFER_IN", "ORDER_RELEASE", "REFUND", "CASHBACK"].includes(txn.type)
}
