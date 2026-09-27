/**
 * Kahade — <OrderStatusHero>.
 *
 * Kepala halaman detail order: status yang MENONJOL (ikon besar + label),
 * judul order, lalu blok identitas transaksi — ID Transaksi (dengan salin),
 * Tanggal dan Waktu terpisah.
 *
 * Hierarki baca: STATUS → JUDUL → ID TRANSAKSI → TANGGAL/WAKTU.
 */
import { View, type ViewProps } from "react-native"
import { Check, Copy } from "phosphor-react-native"

import { Card } from "@/components/ui/card"
import { Divider } from "@/components/ui/divider"
import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { ORDER_STATUS_LABELS, OrderStatusBadge } from "@/components/ui/order-status-badge"
import { cn } from "@/lib/cn"
import { formatDate, formatTime } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import type { OrderStatus } from "@/lib/api/orders"

// `role` di-Omit: ViewProps RN punya `role?: Role` (a11y) yang disjoint dengan
// "buyer"/"seller" — tanpa Omit, `role` tereduksi menjadi `undefined` saja
// (lihat components/ui/order-status-badge.tsx).
export type OrderStatusHeroProps = Omit<ViewProps, "children" | "role"> & {
  status: OrderStatus | string
  title: string
  /** ID transaksi — backend mengirim format ORD-YYYYMMDD-SERIAL. */
  transactionId: string
  createdAt: string
  role?: "buyer" | "seller"
  copied: boolean
  onCopyId: () => void
  className?: string
}

export function OrderStatusHero({
  status,
  title,
  transactionId,
  createdAt,
  role,
  copied,
  onCopyId,
  className,
  ...rest
}: OrderStatusHeroProps) {
  const statusLabel = ORDER_STATUS_LABELS[status as OrderStatus] ?? String(status)
  const date = formatDate(createdAt, { long: true })
  const time = formatTime(createdAt)
  return (
    <Card padded className={cn("gap-4", className)} {...rest}>
      {/* Baris status — elemen paling menonjol di layar */}
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-1" accessible accessibilityRole="header">
          <Text variant="caption" tone="secondary">
            {translate("Status order")}
          </Text>
          <Text variant="h2" accessibilityLabel={`${translate("Status order")}: ${statusLabel}`}>
            {statusLabel}
          </Text>
        </View>
        <OrderStatusBadge status={status} role={role} size="md" />
      </View>

      <View className="gap-1">
        <Text variant="caption" tone="secondary">
          {translate("Order")}
        </Text>
        <Text variant="h3" numberOfLines={3}>
          {title}
        </Text>
      </View>

      <Divider />

      {/* Identitas transaksi */}
      <View className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text variant="caption" tone="secondary">
              {translate("ID Transaksi")}
            </Text>
            <Text variant="monoBody" numberOfLines={1} selectable accessibilityLabel={`${translate("ID Transaksi")} ${transactionId}`}>
              {transactionId}
            </Text>
          </View>
          <IconButton
            size="sm"
            shape="pill"
            icon={copied ? Check : Copy}
            active={copied}
            onPress={onCopyId}
            accessibilityLabel={copied ? translate("ID transaksi disalin") : translate("Salin ID transaksi")}
          />
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1 gap-1">
            <Text variant="caption" tone="secondary">
              {translate("Tanggal")}
            </Text>
            <Text variant="body" weight={600}>
              {date}
            </Text>
          </View>
          <View className="flex-1 gap-1">
            <Text variant="caption" tone="secondary">
              {translate("Waktu")}
            </Text>
            <Text variant="body" weight={600}>
              {time === "—" ? "—" : `${time} WIB`}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  )
}
