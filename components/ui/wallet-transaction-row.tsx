import type { WalletTransaction } from "@/lib/api/wallet"
import { summarize } from "@/lib/a11y"
import { formatRupiah, formatDateTime } from "@/lib/format"
import {
  WALLET_TXN_KIND,
  WALLET_TXN_LABELS,
  walletTransactionStatus,
  walletTransactionType,
} from "@/lib/wallet-labels"
import { WalletTransactionListItem } from "@/components/ui/wallet-transaction-list-item"
import { mapValue } from "@/lib/has-own"

/** One mapping for overview, top-up/withdraw histories and search results. */
export function WalletTransactionRow({
  transaction: tx,
  onPress,
  divider = true,
}: {
  transaction: WalletTransaction
  onPress?: () => void
  divider?: boolean
}) {
  return (
    <WalletTransactionListItem
      padded={false}
      accessibilityLabel={summarize([
        mapValue(WALLET_TXN_LABELS, tx.type, tx.type),
        walletTransactionType(tx) === "CREDIT"
          ? "Dana masuk"
          : walletTransactionType(tx) === "DEBIT"
            ? "Dana keluar"
            : "Arah belum tersedia",
        formatRupiah(tx.amount),
        tx.status ?? "Status belum tersedia",
        formatDateTime(tx.createdAt),
        tx.referenceId ?? undefined,
      ])}
      title={mapValue(WALLET_TXN_LABELS, tx.type, tx.type)}
      type={walletTransactionType(tx)}
      amount={tx.amount}
      kind={mapValue(WALLET_TXN_KIND, tx.type, "other")}
      status={walletTransactionStatus(tx.status)}
      statusLabel={tx.status ?? "Status belum tersedia"}
      timestamp={formatDateTime(tx.createdAt)}
      reference={tx.referenceId ?? undefined}
      onPress={onPress}
      divider={divider}
      inset={false}
    />
  )
}
