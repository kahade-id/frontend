/**
 * Kahade — <VoucherUsageListItem> tiket riwayat pemakaian voucher (§9.17
 * List Item, §3.1 Mono kode & nominal, §13 format).
 *
 * Satu baris `GET /v1/vouchers/my-usage`: voucher apa, dipakai di order mana,
 * berapa yang dihemat. Rev. tiket 2026-09-27: satu bahasa dengan struk
 * <ReceiptTicket> — <TicketShell> + <TicketDivider> (notch perforasi,
 * watermark, garis putus-putus). Anatomi:
 *   badan    : IconBox Ticket + kode Mono + Badge "Terpakai" + judul,
 *              nominal hemat (+, success) di kanan
 *   perforasi: garis putus-putus + notch
 *   potongan : meta (ID order Mono · waktu) + chevron bila bisa dibuka
 *
 * Keputusan non-obvious:
 *   - Nominal hemat dirender `sign="always"` tone success — uang yang tidak
 *     keluar diperlakukan seperti uang masuk (konsisten dengan CREDIT di
 *     WalletTransactionListItem).
 *   - ID order dipotong `truncateMiddle` agar meta tetap satu baris; tap
 *     baris membuka detail order (chevron bila `onPress`).
 *   - `inset` dipertahankan di tipe demi kompatibilitas API, tetapi tidak
 *     lagi berpengaruh visual: tiket selalu kartu penuh (tidak ada divider
 *     antar-baris seperti ListItem lama).
 */
import { CaretRight, Ticket } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { Text } from "@/components/ui/text"
import { TicketDivider, TicketShell } from "@/components/ui/voucher-ticket"
import { summarize } from "@/lib/a11y"
import { truncateMiddle } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"

export type VoucherUsageListItemProps = Omit<ViewProps, "children"> & {
  title: string
  code: string
  /** Rupiah yang dihemat pada order tersebut */
  savedAmount: number
  orderId?: string
  /** Sudah diformat pemanggil (§13) */
  usedAt?: string
  onPress?: () => void
  /** Ditinggalkan demi kompatibilitas API — tidak berpengaruh visual. */
  inset?: boolean
  accessibilityLabel?: string
  accessibilityHint?: string
  className?: string
}

export function VoucherUsageListItem({
  title,
  code,
  savedAmount,
  orderId,
  usedAt,
  onPress,
  inset = true,
  accessibilityLabel,
  accessibilityHint,
  className,
  ...rest
}: VoucherUsageListItemProps) {
  void inset
  const orderMeta = orderId ? truncateMiddle(orderId, 6, 4) : undefined

  const a11y =
    accessibilityLabel ??
    summarize([
      title,
      translate("kode {x}", { x: code }),
      translate("Terpakai"),
      translate("hemat {x} rupiah", { x: Math.abs(savedAmount) }),
      usedAt,
    ])

  return (
    <TicketShell
      onPress={onPress}
      accessibilityLabel={a11y}
      accessibilityHint={accessibilityHint ?? (onPress ? "Buka detail transaksi" : undefined)}
      className={className}
      {...rest}
    >
      {/* ── Badan tiket ─────────────────────────────────── */}
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-4">
        <IconBox icon={Ticket} size="md" variant="surface" />
        <View className="min-w-0 flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text
              ellipsizeMode="tail"
              variant="monoBody"
              weight={600}
              tone="primary"
              numberOfLines={1}
              className="shrink tracking-mono tabular-nums"
            >
              {code.toUpperCase()}
            </Text>
            <Badge tone="neutral" dot>
              {translate("Terpakai")}
            </Badge>
          </View>
          <Text ellipsizeMode="tail" variant="body" weight={600} tone="primary" numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Amount value={Math.abs(savedAmount)} size="body" sign="always" tone="success" />
        {onPress ? <Icon icon={CaretRight} size="md" tone="default" /> : null}
      </View>

      <TicketDivider />

      {/* ── Potongan tiket: meta pemakaian ──────────────── */}
      {orderMeta || usedAt ? (
        <View className="px-4 py-3">
          <Text ellipsizeMode="tail" variant="caption" tone="secondary" numberOfLines={1}>
            {orderMeta ? (
              <Text variant="inherit" tone="secondary" className="font-mono-500 tracking-mono tabular-nums">
                {orderMeta}
              </Text>
            ) : null}
            {orderMeta && usedAt ? " · " : null}
            {usedAt ?? ""}
          </Text>
        </View>
      ) : null}
    </TicketShell>
  )
}
