/**
 * Kahade — <VoucherCard> kartu voucher yang bisa dipakai (§9.6 Card, §9.7
 * Badge, §3.1 Mono untuk kode & nominal, §13 format).
 *
 * Satu item `GET /v1/vouchers/available` (query `applicableTo`), dipilih
 * user saat membuat order/menghitung fee (`voucherCode` di CreateOrderDto /
 * CalculateFeeDto). Anatomi:
 *   kiri : IconBox Ticket
 *   isi  : nilai potongan (Mono, tegas) + judul/deskripsi
 *          baris syarat: min. order · berlaku untuk (BUYER/SELLER) · kadaluarsa
 *   kanan: kode Mono kecil + CTA "Pakai" / tanda terpilih
 *
 * Keputusan non-obvious:
 *   - Voucher BUKAN kupon berwarna dengan gerigi — sistem flat monokrom (§1).
 *     Card standar; yang membedakan dari kartu lain hanya IconBox Ticket dan
 *     nilai potongan Mono besar-ish (monoBody 600).
 *   - `discountType`: PERCENTAGE ("10%", opsional "maks Rp50.000") atau FIXED
 *     (<Amount>). Nilai persen dirender Mono juga — angka presisi (§1).
 *   - `applicableTo` (BUYER | SELLER | ALL) tampil sebagai Badge neutral
 *     kecil hanya bila bukan ALL — default yang tidak perlu dikatakan.
 *   - `disabled` (mis. min. order belum tercapai) menonaktifkan CTA dan
 *     menampilkan `disabledReason` sebagai caption; kartu tetap terbaca
 *     (tidak opacity keseluruhan) agar user tahu syaratnya.
 *   - Kadaluarsa dekat (`expiresSoon`) memakai tone warning pada teks
 *     tanggal saja — bukan Badge — supaya kartu tidak "berteriak".
 *   - `selected` menebalkan border (Card selected) untuk mode pemilihan di
 *     alur buat order; di mode pemilihan CTA berubah jadi ikon Check.
 */
import { Check, Ticket } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, type CardProps } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { formatRupiah } from "@/lib/format"

export type VoucherDiscountType = "PERCENTAGE" | "FIXED"
export type VoucherApplicableTo = "BUYER" | "SELLER" | "ALL"

export type VoucherCardLabels = {
  use: string
  minOrder: string
  maxDiscount: string
  validUntil: string
  buyer: string
  seller: string
}

const DEFAULT_LABELS: VoucherCardLabels = {
  use: "Pakai",
  minOrder: "Min. transaksi",
  maxDiscount: "maks",
  validUntil: "Berlaku s.d.",
  buyer: "Pembeli",
  seller: "Penjual",
}

export type VoucherCardProps = Omit<CardProps, "children" | "variant" | "padded"> & {
  code: string
  title: string
  description?: string
  discountType: VoucherDiscountType
  /** Persen (0-100) untuk PERCENTAGE, Rupiah untuk FIXED */
  discountValue: number
  /** Batas potongan Rupiah (PERCENTAGE) */
  maxDiscount?: number
  minOrderValue?: number
  applicableTo?: VoucherApplicableTo
  /** Sudah diformat pemanggil (§13) */
  expiresAt?: string
  expiresSoon?: boolean
  /** Mode pemilihan: kartu terpilih */
  selected?: boolean
  onUse?: () => void
  disabled?: boolean
  disabledReason?: string
  labels?: Partial<VoucherCardLabels>
}

export function VoucherCard({
  code,
  title,
  description,
  discountType,
  discountValue,
  maxDiscount,
  minOrderValue,
  applicableTo = "ALL",
  expiresAt,
  expiresSoon = false,
  selected = false,
  onUse,
  disabled = false,
  disabledReason,
  labels,
  onPress,
  accessibilityLabel,
  className,
  ...rest
}: VoucherCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const isPercent = discountType === "PERCENTAGE"
  const discountText = isPercent ? `${discountValue}%` : formatRupiah(discountValue)

  const conditions = [
    minOrderValue != null ? `${t.minOrder} ${formatRupiah(minOrderValue)}` : undefined,
    isPercent && maxDiscount != null ? `${t.maxDiscount} ${formatRupiah(maxDiscount)}` : undefined,
  ].filter(Boolean) as string[]

  const a11y =
    accessibilityLabel ??
    summarize([
      `Voucher ${code}`,
      `potongan ${discountText}`,
      title,
      ...conditions,
      expiresAt ? `${t.validUntil} ${expiresAt}` : undefined,
      disabled ? disabledReason : undefined,
    ])

  return (
    <Card onPress={onPress} selected={selected} accessibilityLabel={a11y} className={cn("gap-4", className)} {...rest}>
      <View className="flex-row items-start gap-3">
        <IconBox icon={Ticket} size="md" variant="surface" active={selected} />

        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            {isPercent ? (
              <Text variant="monoBody" weight={600} tone="primary" className="tabular-nums">
                {discountText}
              </Text>
            ) : (
              <Amount value={discountValue} size="body" tone="primary" />
            )}
            {applicableTo !== "ALL" ? (
              <Badge tone="neutral" variant="outline">
                {applicableTo === "BUYER" ? t.buyer : t.seller}
              </Badge>
            ) : null}
          </View>
          <Text variant="body" weight={600} tone="primary" numberOfLines={2}>
            {title}
          </Text>
          {description ? (
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </View>

        {selected ? <Icon icon={Check} size="sm" tone="active" weight="bold" accessibilityLabel="Terpilih" /> : null}
      </View>

      <View className="flex-row items-end justify-between gap-3 border-t border-border pt-3">
        <View className="flex-1 gap-0.5">
          {conditions.length > 0 ? (
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              {conditions.join(" · ")}
            </Text>
          ) : null}
          {expiresAt ? (
            <Text variant="caption" tone={expiresSoon ? "warning" : "secondary"} className="tabular-nums">
              {t.validUntil} {expiresAt}
            </Text>
          ) : null}
          {disabled && disabledReason ? (
            <Text variant="caption" tone="secondary">
              {disabledReason}
            </Text>
          ) : null}
        </View>

        <View className="items-end gap-2">
          <Text variant="caption" tone="secondary" className="font-mono-500 tracking-mono">
            {code.toUpperCase()}
          </Text>
          {onUse && !selected ? (
            <Button variant="secondary" size="sm" fullWidth={false} onPress={onUse} disabled={disabled}>
              {t.use}
            </Button>
          ) : null}
        </View>
      </View>
    </Card>
  )
}

export function VoucherCardSkeleton({ className, ...rest }: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View accessible accessibilityRole="progressbar" className={cn("w-full gap-4 rounded-md border border-border bg-surface p-5", className)} accessibilityLabel="Memuat voucher" {...rest}>
      <View className="flex-row items-start gap-3">
        <Skeleton width={40} height={40} />
        <View className="flex-1 gap-2">
          <Skeleton height={16} className="w-20" />
          <Skeleton height={18} className="w-full" />
          <Skeleton height={12} className="w-3/4" />
        </View>
      </View>
      <View className="flex-row items-end justify-between">
        <Skeleton height={12} className="w-40" />
        <Skeleton height={32} className="w-16" />
      </View>
    </View>
  )
}
