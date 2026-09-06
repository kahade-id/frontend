/**
 * Kahade — <TransactionTemplateCard> templat transaksi tersimpan
 * (§9.6 Card, §3.1 Mono nominal, §9.7 Badge, §9.1 Button).
 *
 * Satu entri `GET /v1/transaction-templates`; aksi ke `PUT/DELETE .../{id}`
 * dan "Gunakan" yang mengisi form buat order (CreateOrderDto) dari templat.
 * CreateTemplateDto di spec kosong (di-infer dari CreateOrderDto): name,
 * role, title, description, orderType, orderValue, deliveryDeadlineDays,
 * feeResponsibility, counterpartUsername opsional, usageCount/lastUsedAt.
 *
 * Anatomi:
 *   ikon jenis order (IconBox) · nama templat (H3) · Badge peran ("Saya penjual")
 *   judul order default (body) + deskripsi 2 baris (caption)
 *   nominal <Amount body> · "n hari" · fee responsibility · lawan tetap (@user)
 *   footer: "Dipakai 12x · terakhir 3 Sep" (caption secondary)
 *   aksi: Gunakan (primary sm, flex-1) · Ubah · Hapus (icon buttons ghost)
 *
 * Keputusan non-obvious:
 *   - Ikon jenis order diambil dari ORDER_TYPE_ICONS (satu sumber dengan
 *     <OrderTypeSelector>) supaya user mengenali templat dari ikon yang sama
 *     yang ia pilih saat membuat.
 *   - Nama templat adalah judul utama; judul ORDER default jadi baris kedua.
 *     User menamai templat dengan kata kunci ("Jasa desain logo — DP 50%")
 *     yang lebih cepat dikenali daripada judul order yang panjang.
 *   - Meta angka (nominal, tenggat, fee) dirender sebagai baris chip-teks
 *     dipisah " · " — bukan KeyValueList: templat dipindai cepat di daftar,
 *     tabel label-nilai memperlambat.
 *   - "Gunakan" adalah primary karena itu alasan templat ada; Ubah/Hapus jadi
 *     <IconButton ghost> di kanan agar tidak bersaing.
 *   - `onPress` kartu (bila diberi) membuka detail/pratinjau, BUKAN langsung
 *     memakai templat — mencegah pembuatan order tidak sengaja.
 */
import { PencilSimple, Trash } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, type CardProps } from "@/components/ui/card"
import type { FeeResponsibility } from "@/components/ui/fee-breakdown"
import { IconBox } from "@/components/ui/icon-box"
import { IconButton } from "@/components/ui/icon-button"
import {
  ORDER_ROLE_LABELS,
  ORDER_TYPE_ICONS,
  ORDER_TYPE_LABELS,
  type OrderRoleValue,
  type OrderType,
} from "@/components/ui/order-form-selectors"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { mapValue } from "@/lib/has-own"

export type TransactionTemplate = {
  id: string
  name: string
  role: OrderRoleValue
  title: string
  description?: string
  orderType: OrderType
  orderValue: number
  deliveryDeadlineDays: number
  feeResponsibility: FeeResponsibility
  counterpartUsername?: string
  usageCount?: number
  /** Sudah diformat pemanggil (§13) */
  lastUsedLabel?: string
}

export type TransactionTemplateCardLabels = {
  use: string
  edit: string
  remove: string
  days: (n: number) => string
  fee: Record<FeeResponsibility, string>
  usage: (n: number) => string
  lastUsed: (when: string) => string
  neverUsed: string
}

const DEFAULT_LABELS: TransactionTemplateCardLabels = {
  use: "Gunakan templat",
  edit: "Ubah templat",
  remove: "Hapus templat",
  days: (n) => `${n} hari`,
  fee: { BUYER: "Biaya pembeli", SELLER: "Biaya penjual", SPLIT: "Biaya dibagi" },
  usage: (n) => `Dipakai ${n}×`,
  lastUsed: (when) => `terakhir ${when}`,
  neverUsed: "Belum pernah dipakai",
}

export type TransactionTemplateCardProps = Omit<CardProps, "children" | "padded" | "role"> & {
  template: TransactionTemplate
  onUse?: (template: TransactionTemplate) => void
  onEdit?: (template: TransactionTemplate) => void
  onDelete?: (template: TransactionTemplate) => void
  labels?: Partial<TransactionTemplateCardLabels>
}

export function TransactionTemplateCard({
  template,
  onUse,
  onEdit,
  onDelete,
  labels,
  onPress,
  accessibilityLabel,
  className,
  ...rest
}: TransactionTemplateCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  // `role`/`orderType` datang dari respons template dan tidak divalidasi.
  // `MAP[key] ?? fallback` tidak cukup: kunci warisan Object.prototype
  // ("toString") mengembalikan sebuah FUNGSI, bukan undefined, sehingga `??`
  // diam saja dan fungsinya berakhir sebagai anak <Badge>/<Text> — React
  // menolaknya dan seluruh kartu jatuh ke error boundary. Lihat lib/has-own.
  const typeIcon = mapValue(ORDER_TYPE_ICONS, template.orderType, ORDER_TYPE_ICONS.OTHER)
  const typeLabel = mapValue(ORDER_TYPE_LABELS, template.orderType, template.orderType)
  const roleLabel = mapValue(ORDER_ROLE_LABELS, template.role, template.role)

  const usage =
    template.usageCount && template.usageCount > 0
      ? [t.usage(template.usageCount), template.lastUsedLabel ? t.lastUsed(template.lastUsedLabel) : undefined]
          .filter(Boolean)
          .join(" · ")
      : t.neverUsed

  const a11y =
    accessibilityLabel ??
    [template.name, roleLabel, typeLabel, `${template.orderValue} rupiah`, usage].join(", ")

  return (
    <Card onPress={onPress} className={cn("gap-4", className)} accessibilityLabel={a11y} {...rest}>
      {/* Header */}
      <View className="flex-row items-start gap-3">
        <IconBox icon={typeIcon} size="md" variant="surface" accessibilityLabel={typeLabel} />
        <View className="flex-1 gap-1">
          <Text variant="h3" tone="primary" numberOfLines={1}>
            {template.name}
          </Text>
          <Badge tone="neutral" variant="outline" className="self-start">
            {roleLabel}
          </Badge>
        </View>
      </View>

      {/* Isi order default */}
      <View className="gap-1">
        <Text variant="body" weight={500} tone="primary" numberOfLines={1}>
          {template.title}
        </Text>
        {template.description ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {template.description}
          </Text>
        ) : null}
      </View>

      {/* Meta angka */}
      <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <Amount value={template.orderValue} size="body" tone="primary" />
        <Text variant="caption" tone="secondary">
          ·
        </Text>
        <Text variant="caption" tone="secondary" className="tabular-nums">
          {t.days(template.deliveryDeadlineDays)}
        </Text>
        <Text variant="caption" tone="secondary">
          ·
        </Text>
        <Text variant="caption" tone="secondary">
          {t.fee[template.feeResponsibility]}
        </Text>
        {template.counterpartUsername ? (
          <>
            <Text variant="caption" tone="secondary">
              ·
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              @{template.counterpartUsername}
            </Text>
          </>
        ) : null}
      </View>

      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {usage}
      </Text>

      {onUse || onEdit || onDelete ? (
        <View className="flex-row items-center gap-2 border-t border-border pt-4">
          {onUse ? (
            <Button variant="primary" size="sm" onPress={() => onUse(template)} className="flex-1">
              {t.use}
            </Button>
          ) : null}
          {onEdit ? (
            <IconButton icon={PencilSimple} variant="ghost" size="sm" accessibilityLabel={t.edit} onPress={() => onEdit(template)} />
          ) : null}
          {onDelete ? (
            <IconButton icon={Trash} variant="ghost" size="sm" accessibilityLabel={t.remove} onPress={() => onDelete(template)} />
          ) : null}
        </View>
      ) : null}
    </Card>
  )
}

export function TransactionTemplateCardSkeleton({ className, ...rest }: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View accessible accessibilityRole="progressbar"
      className={cn("w-full gap-4 rounded-md border border-border bg-surface p-5", className)}
      accessibilityLabel="Memuat templat"
      {...rest}
    >
      <View className="flex-row items-start gap-3">
        <Skeleton width={40} height={40} />
        <View className="flex-1 gap-2">
          <Skeleton height={18} className="w-40" />
          <Skeleton height={20} className="w-24" />
        </View>
      </View>
      <Skeleton height={16} className="w-3/4" />
      <Skeleton height={12} className="w-full" />
      <Skeleton height={14} className="w-56" />
      <Skeleton height={40} className="w-full" />
    </View>
  )
}
