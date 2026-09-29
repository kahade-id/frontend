import { memo } from "react"
import type { Href } from "expo-router"
import type { WalletTransaction } from "@/lib/api/wallet"
import { summarize } from "@/lib/a11y"
import { formatRupiah, formatDateTimeWIB } from "@/lib/format"
import {
  WALLET_TXN_KIND,
  WALLET_TXN_LABELS,
  walletTransactionStatus,
  walletTransactionType,
} from "@/lib/wallet-labels"
import { walletStatusLabel } from "@/lib/wallet-ui"
import { WalletTransactionListItem } from "@/components/ui/wallet-transaction-list-item"
import { mapValue } from "@/lib/has-own"

/** One mapping for overview, top-up/withdraw histories and search results. */

/**
 * LR-010 (perf-fix): dibungkus `memo` — nominal & perilaku tidak berubah;
 * hanya mencegah re-render baris saat daftar re-render.
 */
export const WalletTransactionRow = memo(function WalletTransactionRow({
  transaction: tx,
  onPress,
  href,
  divider = true,
  vivid = false,
  highlight,
}: {
  transaction: WalletTransaction
  onPress?: () => void
  /** Rute detail transaksi — membuat baris jadi tautan nyata di web. */
  href?: Href
  divider?: boolean
  /**
   * Gaya "vivid" (permintaan produk 2026-09-27): ikon berwarna mengikuti
   * status, nominal tegas hijau masuk / merah keluar. Dipakai layar riwayat.
   */
  vivid?: boolean
  /**
   * Item 80 (mega-batch 2026-09-28): substring yang ditonjolkan di judul
   * (hasil pencarian).
   */
  highlight?: string
}) {
  // TIM 8 (perf, P0): `formatDateTimeWIB` dihitung SEKALI per baris —
  // versi lama memanggilnya 2× (accessibilityLabel + prop timestamp).
  const timestamp = formatDateTimeWIB(tx.createdAt)
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
        // WF-028 (Batch 1-money): screen reader mendengar label yang sama
        // dengan visual ("Diproses"), bukan enum mentah ("PENDING_OTP").
        // Status asing tetap memakai enum-nya (jujur, bukan label tebakan).
        walletStatusLabel(tx.status),
        // UI-W001: tanggal selalu WIB — konsisten dengan pengelompokan
        // riwayat dan layar detail, bukan zona perangkat.
        timestamp,
        tx.referenceId ?? undefined,
      ])}
      title={mapValue(WALLET_TXN_LABELS, tx.type, tx.type)}
      type={walletTransactionType(tx)}
      amount={tx.amount}
      kind={mapValue(WALLET_TXN_KIND, tx.type, "other")}
      status={walletTransactionStatus(tx.status)}
      statusLabel={walletStatusLabel(tx.status)}
      timestamp={timestamp}
      reference={tx.referenceId ?? undefined}
      statusAccent={vivid}
      highlight={highlight}
      onPress={onPress}
      href={href}
      divider={divider}
      inset={false}
    />
  )
})
