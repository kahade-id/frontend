/**
 * Kahade — <OrderProductCard>.
 *
 * Kartu produk bergaya invoice e-commerce: thumbnail ikon kategori, nama,
 * deskripsi, chip tipe order, dan nilai transaksi.
 *
 * Jujur data: Order adalah pesanan kustom (judul + deskripsi), bukan katalog
 * — tidak ada foto/varian/jumlah di respons backend, jadi tidak dikarang.
 */
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Badge } from "@/components/ui/badge"
import { Divider } from "@/components/ui/divider"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { ORDER_TYPE_ICONS, ORDER_TYPE_LABELS } from "@/components/ui/order-form-selectors"
import { cn } from "@/lib/cn"
import { translate } from "@/lib/i18n/translate"
import type { OrderType } from "@/lib/api/orders"
export type OrderProductCardProps = Omit<ViewProps, "children"> & {
  title: string
  description?: string
  orderType: OrderType | string
  orderValue: number
  className?: string
}

export function OrderProductCard({
  title,
  description,
  orderType,
  orderValue,
  className,
  ...rest
}: OrderProductCardProps) {
  const TypeIcon = (ORDER_TYPE_ICONS as Record<string, IconComponent | undefined>)[orderType]
  const typeLabel = (ORDER_TYPE_LABELS as Record<string, string>)[orderType] ?? String(orderType)
  // Iterasi de-card 2026-09-27: section polos — judul + isi + hairline divider,
  // tanpa bungkus <Card>.
  return (
    <View className={cn("gap-4", className)} {...rest}>
      <SectionHeader title={translate("Produk")} />
      <View className="flex-row gap-3">
        <View
          className="h-16 w-16 items-center justify-center rounded-md bg-surface"
          accessible
          accessibilityLabel={translate("Ikon kategori {x}", { x: typeLabel })}
        >
          {TypeIcon ? <Icon icon={TypeIcon} size={28} weight="regular" /> : null}
        </View>
        <View className="flex-1 gap-1">
          <Text variant="body" weight={700} numberOfLines={2}>
            {title}
          </Text>
          {description ? (
            <Text variant="caption" tone="secondary" numberOfLines={3}>
              {description}
            </Text>
          ) : null}
          <Badge tone="neutral" icon={TypeIcon ?? undefined}>
            {typeLabel}
          </Badge>
        </View>
      </View>
      <Divider />
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="body" tone="secondary">
          {translate("Nilai transaksi")}
        </Text>
        <Amount value={orderValue} size="body" />
      </View>
    </View>
  )
}
