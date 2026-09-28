/**
 * Kahade — <OrderStatusHero>.
 *
 * Kepala halaman detail order — FULL-BLEED band (tepi-ke-tepi, bukan card
 * mengambang): latar lembut sesuai status, status besar dan berwibawa,
 * judul order, lalu blok identitas transaksi — ID Transaksi (dengan salin),
 * Tanggal dan Waktu terpisah.
 *
 * Iterasi de-card 2026-09-27: keluhan user "monoton card card" — hero bukan
 * lagi <Card> melainkan pita full-bleed dengan `-mx-5 -mt-3` (meniadakan
 * padding container + paddingTop parent) sehingga menyentuh tepi layar dan
 * header. Latar = ramp `*-soft` sesuai tone status (mode-aware, aman di web
 * karena View biasa — bukan Reanimated).
 *
 * Hierarki baca: STATUS → JUDUL → ID TRANSAKSI → TANGGAL/WAKTU.
 */
import { View, type ViewProps } from "react-native"
import { Check, Copy } from "phosphor-react-native"

import { Divider } from "@/components/ui/divider"
import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { ORDER_STATUS_LABELS, OrderStatusBadge } from "@/components/ui/order-status-badge"
import { OrderRoleBadge } from "@/components/ui/order-role-badge"
import { cn } from "@/lib/cn"
import { formatDate, formatTime } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import type { OrderStatus } from "@/lib/api/orders"

/** Latar pita hero mengikuti tone status — selaras dengan OrderStatusBadge. */
const STATUS_HERO_BG: Record<string, string> = {
  WAITING_CONFIRMATION: "bg-warning-soft",
  WAITING_PAYMENT: "bg-warning-soft",
  PENDING_PAYMENT: "bg-warning-soft",
  DELIVERED: "bg-warning-soft",
  PROCESSING: "bg-info-soft",
  IN_DELIVERY: "bg-info-soft",
  PAID: "bg-info-soft",
  SHIPPED: "bg-info-soft",
  COMPLETED: "bg-success-soft",
  DISPUTED: "bg-danger-soft",
  CANCELLED: "bg-surface",
  REFUNDED: "bg-surface",
  EXPIRED: "bg-surface",
}

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
  const heroBg = STATUS_HERO_BG[status] ?? "bg-info-soft"
  return (
    <View className={cn("-mx-5 -mt-3 px-5 pb-7 pt-6", heroBg, className)} {...rest}>
      {/* Baris status — elemen paling menonjol di layar */}
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-1" accessible accessibilityRole="header">
          <Text variant="caption" tone="secondary">
            {translate("Status pesanan")}
          </Text>
          <Text variant="h1" accessibilityLabel={`${translate("Status pesanan")}: ${statusLabel}`}>
            {statusLabel}
          </Text>
        </View>
        {/* D14 (batch 139): badge peran yang SAMA dengan timeline & CTA. */}
        <View className="items-end gap-1.5">
          <OrderStatusBadge status={status} role={role} size="md" />
          <OrderRoleBadge role={role} />
        </View>
      </View>

      <View className="mt-4 gap-1">
        <Text variant="caption" tone="secondary">
          {translate("Pesanan")}
        </Text>
        <Text variant="h3" numberOfLines={3}>
          {title}
        </Text>
      </View>

      <View className="my-5">
        <Divider />
      </View>

      {/* Identitas transaksi */}
      <View className="gap-4">
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
    </View>
  )
}
