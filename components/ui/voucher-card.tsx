/**
 * Kahade — <VoucherCard> tiket voucher yang bisa dipakai (§9.6 Card, §9.7
 * Badge, §3.1 Mono untuk kode & nominal, §13 format).
 *
 * Satu item `GET /v1/vouchers/available` (query `applicableTo`), dipilih
 * user saat membuat order/menghitung fee (`voucherCode` di CreateOrderDto /
 * CalculateFeeDto). Satu bahasa dengan struk <ReceiptTicket> (rev.
 * 2026-09-27): cangkang <TicketShell> + <TicketDivider> (notch perforasi
 * kiri-kanan, watermark, garis putus-putus). Anatomi:
 *   badan    : Badge status (AKTIF/TERPAKAI/KEDALUWARSA) + nilai potongan
 *              besar (Mono) + judul/deskripsi + Badge pembeli/penjual
 *   perforasi: garis putus-putus + notch
 *   potongan : kode Mono besar + tombol salin, baris syarat (min. order ·
 *              maks. diskon · kadaluarsa), CTA "Pakai" / tanda terpilih
 *
 * Keputusan non-obvious:
 *   - `status` ("active" | "used" | "expired" | "inactive") dihitung PEMANGGIL
 *     dari data voucher (usedAt / active / expiresAt) — komponen hanya
 *     memetakan ke Badge; tidak menebak sendiri supaya satu definisi status
 *     dipakai semua layar.
 *   - Kode disalin lewat `onCopyCode` milik pemanggil (clipboard + toast di
 *     sana), bukan di dalam komponen — komponen tidak menyentuh perangkat.
 *   - `discountType`: PERCENTAGE ("25%", Mono besar) atau FIXED (<Amount>
 *     large). Nilai persen dirender Mono — angka presisi (§1).
 *   - `disabled` (mis. min. order belum tercapai) menonaktifkan CTA dan
 *     menampilkan `disabledReason` sebagai caption; kartu tetap terbaca
 *     (tidak opacity keseluruhan) agar user tahu syaratnya.
 *   - Kadaluarsa dekat (`expiresSoon`) memakai tone warning pada teks
 *     tanggal saja — bukan Badge — supaya kartu tidak "berteriak".
 *   - `selected` menebalkan border ke border-focus (pola Card selected)
 *     untuk mode pemilihan di alur buat order; di mode pemilihan CTA
 *     berubah jadi ikon Check.
 */
import { Check, Copy, Ticket } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { TicketDivider, TicketShell } from "@/components/ui/voucher-ticket"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { formatRupiah } from "@/lib/format"

export type VoucherDiscountType = "PERCENTAGE" | "FIXED" | "UNKNOWN"
export type VoucherApplicableTo = "BUYER" | "SELLER" | "ALL"

/** Status tiket voucher — dihitung pemanggil, bukan komponen. */
export type VoucherStatus = "active" | "used" | "expired" | "inactive"

export type VoucherCardLabels = {
  use: string
  minOrder: string
  maxDiscount: string
  validUntil: string
  buyer: string
  seller: string
  active: string
  used: string
  expired: string
  inactive: string
  code: string
  copyCode: string
  unavailable: string
}

const DEFAULT_LABELS: VoucherCardLabels = {
  use: "Pakai",
  minOrder: "Min. transaksi",
  maxDiscount: "maks",
  validUntil: "Berlaku s.d.",
  buyer: "Pembeli",
  seller: "Penjual",
  active: "Aktif",
  used: "Terpakai",
  expired: "Kedaluwarsa",
  inactive: "Nonaktif",
  code: "Kode voucher",
  copyCode: "Salin kode voucher",
  unavailable: "Belum tersedia",
}

const STATUS_BADGE_TONE: Record<VoucherStatus, BadgeTone> = {
  active: "success",
  used: "neutral",
  expired: "danger",
  // TRX-022: nonaktif ≠ kedaluwarsa — netral, bukan merah.
  inactive: "neutral",
}

const STATUS_BADGE_LABEL: Record<VoucherStatus, keyof Pick<VoucherCardLabels, "active" | "used" | "expired" | "inactive">> = {
  active: "active",
  used: "used",
  expired: "expired",
  inactive: "inactive",
}

export type VoucherCardProps = Omit<ViewProps, "children"> & {
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
  /** Badge status tiket — dihitung pemanggil dari usedAt/active/expiresAt */
  status?: VoucherStatus
  /** Mode pemilihan: kartu terpilih */
  selected?: boolean
  onUse?: () => void
  /** Tombol salin di samping kode; tidak dirender bila tidak diberikan */
  onCopyCode?: () => void
  onPress?: () => void
  disabled?: boolean
  disabledReason?: string
  labels?: Partial<VoucherCardLabels>
  accessibilityLabel?: string
  className?: string
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
  status = "active",
  selected = false,
  onUse,
  onCopyCode,
  onPress,
  disabled = false,
  disabledReason,
  labels,
  accessibilityLabel,
  className,
  ...rest
}: VoucherCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const isPercent = discountType === "PERCENTAGE"
  // TRX-022: tipe diskon ASING tidak boleh ditebak — tampilkan "Belum
  // tersedia" alih-alih default persen yang menyesatkan.
  const discountText =
    discountType === "UNKNOWN" || !Number.isFinite(discountValue)
      ? t.unavailable
      : isPercent
        ? `${discountValue}%`
        : formatRupiah(discountValue)

  const conditions = [
    minOrderValue != null ? `${t.minOrder} ${formatRupiah(minOrderValue)}` : undefined,
    isPercent && maxDiscount != null ? `${t.maxDiscount} ${formatRupiah(maxDiscount)}` : undefined,
  ].filter(Boolean) as string[]

  const a11y =
    accessibilityLabel ??
    summarize([
      `Voucher ${code}`,
      t[STATUS_BADGE_LABEL[status]],
      `potongan ${discountText}`,
      title,
      ...conditions,
      expiresAt ? `${t.validUntil} ${expiresAt}` : undefined,
      disabled ? disabledReason : undefined,
    ])

  return (
    <TicketShell
      onPress={onPress}
      accessibilityLabel={a11y}
      className={cn(selected && "border-focus border-border-focus", className)}
      {...rest}
    >
      {/* ── Badan tiket ─────────────────────────────────── */}
      <View className="gap-3 px-5 pb-4 pt-5">
        <View className="flex-row items-center gap-2">
          <Badge tone={STATUS_BADGE_TONE[status]} dot>
            {t[STATUS_BADGE_LABEL[status]]}
          </Badge>
          {applicableTo !== "ALL" ? (
            <Badge tone="neutral" variant="outline">
              {applicableTo === "BUYER" ? t.buyer : t.seller}
            </Badge>
          ) : null}
          <View className="flex-1" />
          {selected ? (
            <Icon icon={Check} size="sm" tone="active" weight="bold" accessibilityLabel="Terpilih" />
          ) : (
            <Icon icon={Ticket} size="md" tone="default" accessibilityLabel="Voucher" />
          )}
        </View>

        {/* V1/P2-09 (audit non-escrow 2026-10-03): tipe UNKNOWN / nilai tak
            valid tampilkan "Belum tersedia" secara visual juga — sebelumnya
            <Amount> me-render "Rp—" sementara a11y bilang "Belum tersedia". */}
        {discountType === "UNKNOWN" || !Number.isFinite(discountValue) ? (
          <Text variant="monoLarge" tone="secondary">
            {discountText}
          </Text>
        ) : isPercent ? (
          <Text variant="monoLarge" tone="primary" className="tabular-nums">
            {discountText}
          </Text>
        ) : (
          <Amount value={discountValue} size="large" tone="primary" sign="never" animated={false} />
        )}

        <View className="gap-0.5">
          <Text ellipsizeMode="tail" variant="body" weight={600} tone="primary" numberOfLines={2}>
            {title}
          </Text>
          {description ? (
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </View>
      </View>

      <TicketDivider />

      {/* ── Potongan tiket: kode + syarat + CTA ───────────── */}
      <View className="gap-3 px-5 py-4">
        <View className="gap-1">
          <Text variant="caption" tone="tertiary">
            {t.code}
          </Text>
          <View className="flex-row items-center gap-1">
            <Text
              variant="monoBody"
              weight={600}
              tone="primary"
              selectable
              className="shrink tracking-mono"
              accessibilityLabel={`Kode voucher ${code.split("").join(" ")}`}
            >
              {code.toUpperCase()}
            </Text>
            {onCopyCode ? (
              <IconButton
                icon={Copy}
                size="sm"
                variant="ghost"
                accessibilityLabel={t.copyCode}
                onPress={onCopyCode}
                className="-my-1"
              />
            ) : null}
          </View>
        </View>

        <View className="gap-0.5">
          {conditions.length > 0 ? (
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              {conditions.join(" · ")}
            </Text>
          ) : null}
          {expiresAt ? (
            <Text
              variant="caption"
              tone={expiresSoon ? "warning" : "secondary"}
              className="tabular-nums"
            >
              {t.validUntil} {expiresAt}
            </Text>
          ) : null}
          {disabled && disabledReason ? (
            <Text variant="caption" tone="secondary">
              {disabledReason}
            </Text>
          ) : null}
        </View>

        {onUse && !selected ? (
          <View className="flex-row justify-end">
            <Button
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={onUse}
              disabled={disabled}
            >
              {t.use}
            </Button>
          </View>
        ) : null}
      </View>
    </TicketShell>
  )
}

export function VoucherCardSkeleton({
  className,
  ...rest
}: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      className={cn("w-full gap-4 rounded-lg border border-border bg-surface p-5", className)}
      accessibilityLabel="Memuat voucher"
      {...rest}
    >
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
