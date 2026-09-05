/**
 * Kahade — <WalletTransactionListItem> baris mutasi dompet (§9.17 List Item,
 * §3.1 Mono nominal, §2.3 semantic untuk arah dana, §13 format).
 *
 * Satu baris `GET /v1/wallet/transactions` (juga topup-history &
 * withdraw-history). Anatomi: IconBox (jenis mutasi) -> judul + meta
 * (waktu · referensi Mono) -> nominal bertanda + status kecil.
 *
 * Keputusan non-obvious:
 *   - Arah dana = `type: "CREDIT" | "DEBIT" | "UNKNOWN"` (enum backend). CREDIT dirender
 *     <Amount sign="always" tone="success"> ("+Rp50.000"), DEBIT tone
 *     "primary" ("-Rp50.000") — BUKAN danger. Uang keluar yang disengaja
 *     (bayar order, tarik saldo) bukan kabar buruk; merah disimpan untuk
 *     mutasi yang GAGAL (`status="FAILED"`) supaya tetap bermakna (§2.3).
 *   - `kind` (topup/withdraw/transfer_in/transfer_out/escrow_hold/
 *     escrow_release/refund/fee/cashback) hanya memilih IKON Phosphor;
 *     warna tetap monokrom (IconBox surface). Kategori bukan status (§2.3).
 *   - Status PENDING/FAILED muncul sebagai <StatusIndicator size="sm"> di
 *     bawah nominal, bukan Badge: dua badge (jenis + status) di baris 56px
 *     terlalu ramai. SUCCESS tidak ditampilkan — default yang tidak perlu
 *     dikatakan.
 *   - Referensi (Mono caption) dipotong `truncateMiddle` supaya awal & akhir
 *     tetap terlihat — user mencocokkan digit terakhir dengan mutasi bank.
 *   - Dibangun di atas <ListItem> (bukan custom row): kontrak leading/
 *     trailing ListItem cukup, dan mewarisi min-h-14, divider inset, dan
 *     pressed tanpa scale (§8 hanya Button yang scale).
 */
import {
  ArrowCircleDown,
  ArrowCircleUp,
  ArrowsLeftRight,
  ArrowUUpLeft,
  Gift,
  LockKey,
  LockKeyOpen,
  Receipt,
} from "phosphor-react-native"
import { View } from "react-native"

import { Amount } from "@/components/ui/amount"
import type { IconComponent } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { ListItem, type ListItemProps } from "@/components/ui/list-item"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { truncateMiddle } from "@/lib/format"

export type WalletTxType = "CREDIT" | "DEBIT" | "UNKNOWN"
export type WalletTxStatus = "SUCCESS" | "PENDING" | "FAILED" | "UNKNOWN"
export type WalletTxKind =
  | "topup"
  | "withdraw"
  | "transfer_in"
  | "transfer_out"
  | "escrow_hold"
  | "escrow_release"
  | "refund"
  | "fee"
  | "cashback"
  | "other"

const KIND_ICON: Record<WalletTxKind, IconComponent> = {
  topup: ArrowCircleDown,
  withdraw: ArrowCircleUp,
  transfer_in: ArrowsLeftRight,
  transfer_out: ArrowsLeftRight,
  escrow_hold: LockKey,
  escrow_release: LockKeyOpen,
  refund: ArrowUUpLeft,
  fee: Receipt,
  cashback: Gift,
  other: Receipt,
}

export type WalletTransactionListItemLabels = {
  pending: string
  failed: string
}

const DEFAULT_LABELS: WalletTransactionListItemLabels = {
  pending: "Diproses",
  failed: "Gagal",
}

export type WalletTransactionListItemProps = Omit<
  ListItemProps,
  "title" | "subtitle" | "leading" | "trailing" | "chevron"
> & {
  title: string
  type: WalletTxType
  amount: number
  kind?: WalletTxKind
  status?: WalletTxStatus
  statusLabel?: string
  /** Sudah diformat pemanggil (§13): "3 Sep 2026, 14:30" */
  timestamp?: string
  /** Nomor referensi / ID transaksi — dirender Mono, dipotong di tengah */
  reference?: string
  labels?: Partial<WalletTransactionListItemLabels>
}

export function WalletTransactionListItem({
  title,
  type,
  amount,
  kind = "other",
  status = "UNKNOWN",
  statusLabel = "Status belum tersedia",
  timestamp,
  reference,
  labels,
  onPress,
  inset = true,
  ...rest
}: WalletTransactionListItemProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const isCredit = type === "CREDIT"
  const failed = status === "FAILED"
  const signed = isCredit
    ? Math.abs(amount)
    : type === "DEBIT"
      ? -Math.abs(amount)
      : Math.abs(amount)

  const subtitle = [timestamp, reference ? truncateMiddle(reference, 6, 4) : undefined]
    .filter(Boolean)
    .join(" · ")

  const a11y = [
    title,
    `${isCredit ? "masuk" : type === "DEBIT" ? "keluar" : ""} ${Math.abs(amount)} rupiah`,
    status === "PENDING"
      ? t.pending
      : failed
        ? t.failed
        : status === "UNKNOWN"
          ? statusLabel
          : undefined,
    timestamp,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <ListItem
      title={title}
      subtitle={subtitle || undefined}
      leading={<IconBox icon={KIND_ICON[kind]} size="md" variant={failed ? "danger" : "surface"} />}
      trailing={
        <View className="items-end gap-1">
          <Amount
            value={signed}
            size="body"
            sign={type === "UNKNOWN" ? "never" : isCredit ? "always" : "auto"}
            tone={status !== "SUCCESS" ? "secondary" : isCredit ? "success" : "primary"}
            className={failed ? "line-through" : undefined}
          />
          {status === "PENDING" ? (
            <StatusIndicator label={t.pending} tone="warning" size="sm" />
          ) : null}
          {status === "UNKNOWN" ? (
            <StatusIndicator label={statusLabel} tone="neutral" size="sm" />
          ) : null}
          {failed ? <StatusIndicator label={t.failed} tone="danger" size="sm" /> : null}
        </View>
      }
      chevron={!!onPress}
      onPress={onPress}
      inset={inset}
      accessibilityLabel={a11y}
      accessibilityHint={onPress ? "Buka detail mutasi" : undefined}
      {...rest}
    />
  )
}
