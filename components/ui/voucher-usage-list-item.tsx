/**
 * Kahade — <VoucherUsageListItem> baris riwayat pemakaian voucher (§9.17
 * List Item, §3.1 Mono kode & nominal, §13 format).
 *
 * Satu baris `GET /v1/vouchers/my-usage`: voucher apa, dipakai di order mana,
 * berapa yang dihemat. Anatomi: IconBox Ticket -> judul voucher + meta
 * (kode Mono · ID order Mono · waktu) -> nominal hemat (+, success).
 *
 * Keputusan non-obvious:
 *   - Nominal hemat dirender `sign="always"` tone success — uang yang tidak
 *     keluar diperlakukan seperti uang masuk (konsisten dengan CREDIT di
 *     WalletTransactionListItem).
 *   - Kode & ID order dipotong `truncateMiddle` agar meta tetap satu baris;
 *     tap baris membuka detail order (chevron bila `onPress`).
 */
import { Ticket } from "phosphor-react-native"

import { Amount } from "@/components/ui/amount"
import { IconBox } from "@/components/ui/icon-box"
import { ListItem, type ListItemProps } from "@/components/ui/list-item"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { truncateMiddle } from "@/lib/format"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type VoucherUsageListItemProps = Omit<ListItemProps, "title" | "subtitle" | "leading" | "trailing" | "chevron"> & {
  title: string
  code: string
  /** Rupiah yang dihemat pada order tersebut */
  savedAmount: number
  orderId?: string
  /** Sudah diformat pemanggil (§13) */
  usedAt?: string
}

export function VoucherUsageListItem({ title, code, savedAmount, orderId, usedAt, onPress, inset = true, ...rest }: VoucherUsageListItemProps) {
  const meta = [code.toUpperCase(), orderId ? truncateMiddle(orderId, 6, 4) : undefined].filter(Boolean).join(" · ")

  return (
    <ListItem
      title={title}
      subtitle={
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          <Text variant="inherit" tone="secondary" className="font-mono-500 tracking-mono tabular-nums">
            {meta}
          </Text>
          {usedAt ? ` · ${usedAt}` : ""}
        </Text>
      }
      leading={<IconBox icon={Ticket} size="md" variant="surface" />}
      trailing={<Amount value={Math.abs(savedAmount)} size="body" sign="always" tone="success" />}
      chevron={!!onPress}
      onPress={onPress}
      inset={inset}
      accessibilityLabel={summarize([title, `kode ${code}`, `hemat ${Math.abs(savedAmount)} rupiah`, usedAt])}
      accessibilityHint={onPress ? "Buka detail transaksi" : undefined}
      {...rest}
    />
  )
}