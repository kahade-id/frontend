/**
 * Kahade — <HelpCategoryCard> kartu kategori Pusat Bantuan (§9.6 Card,
 * §7 ikon monokrom, §4 grid gap 12px).
 *
 * Satu item `GET /v1/help-center/categories` (query `lang`). Dipakai dalam
 * grid 2 kolom di landing Pusat Bantuan; tap -> Push daftar artikel
 * (`GET /v1/help-center/categories/{slug}`). Anatomi: IconBox -> nama ->
 * jumlah artikel (caption tabular).
 *
 * Keputusan non-obvious:
 *   - Ikon diterima sebagai `IconComponent` Phosphor; pemetaan nama ikon dari
 *     backend -> komponen adalah urusan layer data. Fallback `Question`.
 *   - Tidak ada ilustrasi/warna per kategori — grid 6-8 kartu berwarna akan
 *     jadi elemen paling ramai di layar bantuan yang justru harus menenangkan.
 *   - `articleCount` opsional; bila 0 kartu tetap tampil (kategori kosong
 *     tetap valid, mis. sedang disiapkan) tapi tone caption disabled.
 */
import { Question } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Card, type CardProps } from "@/components/ui/card"
import type { IconComponent } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type HelpCategoryCardProps = Omit<CardProps, "children" | "variant" | "padded"> & {
  name: string
  description?: string
  icon?: IconComponent
  articleCount?: number
  /** Format jumlah artikel (default "{n} artikel") */
  formatCount?: (n: number) => string
}

const defaultFormatCount = (n: number) => `${n} artikel`

export function HelpCategoryCard({
  name,
  description,
  icon,
  articleCount,
  formatCount = defaultFormatCount,
  onPress,
  accessibilityLabel,
  className,
  ...rest
}: HelpCategoryCardProps) {
  const countText = articleCount != null ? formatCount(articleCount) : undefined
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? [name, countText].filter(Boolean).join(", ")}
      accessibilityHint={onPress ? "Buka daftar artikel" : undefined}
      className={cn("gap-3", className)}
      {...rest}
    >
      <IconBox icon={icon ?? Question} size="md" variant="surface" />
      <View className="gap-0.5">
        <Text variant="body" weight={600} tone="primary" numberOfLines={2}>
          {name}
        </Text>
        {description ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        {countText ? (
          <Text variant="caption" tone={articleCount === 0 ? "disabled" : "secondary"} className="tabular-nums">
            {countText}
          </Text>
        ) : null}
      </View>
    </Card>
  )
}

export function HelpCategoryCardSkeleton({ className, ...rest }: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View className={cn("w-full gap-3 rounded-md border border-border bg-surface p-5", className)} accessibilityLabel="Memuat kategori" {...rest}>
      <Skeleton width={40} height={40} />
      <Skeleton height={16} className="w-3/4" />
      <Skeleton height={12} className="w-1/2" />
    </View>
  )
}
