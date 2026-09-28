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
  Crown,
  Gift,
  LockKey,
  LockKeyOpen,
  Receipt,
  Scales,
  ShieldCheck,
  Sparkle,
  Users,
} from "phosphor-react-native"
import { View } from "react-native"

import { Amount } from "@/components/ui/amount"
import type { IconComponent } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { Highlight } from "@/components/ui/highlight"
import { ListItem, type ListItemProps } from "@/components/ui/list-item"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { cn } from "@/lib/cn"
import { truncateMiddle } from "@/lib/format"

export type WalletTxType = "CREDIT" | "DEBIT" | "UNKNOWN"
export type WalletTxStatus = "SUCCESS" | "PENDING" | "FAILED" | "UNKNOWN"
export type WalletTxKind =
  | "topup"
  | "bonus"
  | "withdraw"
  | "transfer_in"
  | "transfer_out"
  | "escrow_hold"
  | "escrow_release"
  | "refund"
  | "dispute"
  | "fee"
  | "referral"
  | "cashback"
  | "subscription"
  | "admin"
  | "other"

/**
 * Satu ikon per jenis mutasi. Enum backend punya 15 nilai (lihat
 * `WALLET_TXN_TYPES` di lib/wallet-labels.ts); sebelum pemetaan ini lengkap,
 * jenis baru seperti `REFERRAL_REWARD`, `SUBSCRIPTION_PAYMENT`,
 * `DISPUTE_RELEASE`, `TOPUP_BONUS`, dan `ADMIN_CREDIT`/`ADMIN_DEBIT` semua
 * jatuh ke ikon struk "other" — riwayat terlihat seragam padahal jenisnya
 * beda, dan pengguna kehilangan penanda visual paling cepat.
 *
 * Pilihan ikon mengikuti metafora yang sudah dipakai: panah untuk arah uang,
 * gembok untuk escrow, timbangan untuk sengketa, mahkota untuk langganan,
 * percikan untuk bonus, dua orang untuk referral, perisai untuk penyesuaian
 * admin (tindakan platform, bukan tindakan pengguna).
 */
const KIND_ICON: Record<WalletTxKind, IconComponent> = {
  topup: ArrowCircleDown,
  bonus: Sparkle,
  withdraw: ArrowCircleUp,
  transfer_in: ArrowsLeftRight,
  transfer_out: ArrowsLeftRight,
  escrow_hold: LockKey,
  escrow_release: LockKeyOpen,
  refund: ArrowUUpLeft,
  dispute: Scales,
  fee: Receipt,
  referral: Users,
  cashback: Gift,
  subscription: Crown,
  admin: ShieldCheck,
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
  /**
   * Gaya "vivid" (permintaan produk 2026-09-27, layar riwayat): ikon berwarna
   * mengikuti STATUS (hijau sukses, kuning proses, merah gagal) dan nominal
   * tegas (hijau masuk / merah keluar, semibold). Default false = gaya lama
   * (ikon monokrom, DEBIT netral) yang tetap dipakai overview & pencarian.
   */
  statusAccent?: boolean
  labels?: Partial<WalletTransactionListItemLabels>
  /**
   * Item 80 (mega-batch 2026-09-28): substring yang ditonjolkan di judul
   * (hasil pencarian). Kosong = render polos seperti sebelumnya.
   */
  highlight?: string
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
  statusAccent = false,
  labels,
  highlight,
  onPress,
  href,
  inset = true,
  ...rest
}: WalletTransactionListItemProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const isCredit = type === "CREDIT"
  // TRX-008: arah UNKNOWN tidak boleh dipaksa jadi positif maupun negatif —
  // nominal dirender netral (tanpa tanda) + label arah eksplisit.
  const isUnknownDirection = type === "UNKNOWN"
  const failed = status === "FAILED"
  const pending = status === "PENDING"
  const succeeded = status === "SUCCESS"
  const signed = isCredit
    ? Math.abs(amount)
    : type === "DEBIT"
      ? -Math.abs(amount)
      : Math.abs(amount)

  // Gaya vivid: ikon mengikuti status; default: monokrom (kategori ≠ status).
  const iconVariant = statusAccent
    ? failed
      ? "danger"
      : pending
        ? "warning"
        : succeeded
          ? "success"
          : "surface"
    : failed
      ? "danger"
      : "surface"

  // Gaya vivid: nominal tegas — hijau masuk, merah keluar. Default: DEBIT
  // netral (uang keluar yang disengaja bukan kabar buruk).
  // TRX-008: arah UNKNOWN tidak diwarnai seolah debit (danger) — netral.
  const amountTone = statusAccent
    ? isCredit
      ? "success"
      : isUnknownDirection
        ? "secondary"
        : "danger"
    : status !== "SUCCESS"
      ? "secondary"
      : isCredit
        ? "success"
        : isUnknownDirection
          ? "secondary"
          : "primary"

  const subtitle = [timestamp, reference ? truncateMiddle(reference, 6, 4) : undefined]
    .filter(Boolean)
    .join(" · ")

  const a11y = [
    title,
    `${isCredit ? "masuk" : type === "DEBIT" ? "keluar" : "arah tidak diketahui"} ${Math.abs(amount)} rupiah`,
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
      title={
        highlight ? (
          <Highlight text={title} query={highlight} variant="inherit" tone="primary" weight={500} matchWeight={600} />
        ) : (
          title
        )
      }
      subtitle={subtitle || undefined}
      leading={<IconBox icon={KIND_ICON[kind]} size="md" variant={iconVariant} />}
      trailing={
        <View className="items-end gap-1 tabular-nums">
          <Amount
            value={signed}
            size="body"
            sign={isUnknownDirection ? "never" : isCredit ? "always" : "auto"}
            tone={amountTone}
            className={cn(failed && "line-through", statusAccent && "font-sans-600")}
          />
          {/* TRX-008: arah tak dikenal diberi label eksplisit — nominal tanpa
              tanda saja masih bisa dibaca sebagai "positif". */}
          {isUnknownDirection ? (
            <StatusIndicator label="Arah tidak diketahui" tone="neutral" size="sm" />
          ) : null}
          {status === "PENDING" ? (
            <StatusIndicator label={t.pending} tone="warning" size="sm" />
          ) : null}
          {status === "UNKNOWN" ? (
            <StatusIndicator label={statusLabel} tone="neutral" size="sm" />
          ) : null}
          {failed ? <StatusIndicator label={t.failed} tone="danger" size="sm" /> : null}
        </View>
      }
      chevron={Boolean(onPress || href)}
      onPress={onPress}
      href={href}
      inset={inset}
      accessibilityLabel={a11y}
      accessibilityHint={onPress ? "Buka detail mutasi" : undefined}
      {...rest}
    />
  )
}