/**
 * Kahade — <FeeBreakdown> rincian biaya escrow (§3.1 Mono nominal, §13
 * format, §9.6 Card, §9.24 Tooltip untuk penjelasan biaya).
 *
 * Merender hasil `POST /v1/orders/calculate-fee` (orderValue,
 * feeResponsibility BUYER|SELLER|SPLIT, voucherCode) sebagai daftar baris
 * KeyValue: nilai barang -> biaya layanan -> diskon voucher -> garis ->
 * total yang DIBAYAR pembeli & total yang DITERIMA penjual.
 *
 * Kenapa dua total, bukan satu (non-obvious): di escrow, biaya bisa
 * ditanggung pembeli, penjual, atau dibagi. Satu angka "Total" tidak cukup
 * — pembeli ingin tahu berapa yang keluar dari saldonya, penjual ingin tahu
 * berapa yang masuk. Keduanya selalu ditampilkan; baris yang relevan untuk
 * `viewer` diberi `emphasis` (Mono Large), yang lain Mono Body.
 *
 * Keputusan non-obvious:
 *   - Diskon voucher ditampilkan negatif ("-Rp10.000") tone success —
 *     satu-satunya warna semantik di komponen ini, karena diskon adalah
 *     "kabar baik" yang layak ditandai; biaya layanan tetap netral.
 *   - Porsi biaya per pihak ("Anda menanggung 50%") tampil sebagai `hint`
 *     di bawah baris biaya, bukan baris terpisah, supaya daftar tetap 5-6
 *     baris maksimum.
 *   - `loading` merender Skeleton dengan jumlah baris sama; angka tidak
 *     pernah "0" sesaat sebelum data datang (menghindari salah baca).
 *   - Ikon info (Tooltip §9.24) di label biaya layanan menjelaskan dasar
 *     perhitungan — teks dari `feeExplanation` (server/fee-schedule), bukan
 *     hardcode persen di komponen.
 */
import { Info } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Divider } from "@/components/ui/divider"
import { Icon } from "@/components/ui/icon"
import { KeyValue } from "@/components/ui/key-value"
import type { OrderRole } from "@/components/ui/order-status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/cn"

export type FeeResponsibility = "BUYER" | "SELLER" | "SPLIT"

export const FEE_RESPONSIBILITY_LABELS: Record<FeeResponsibility, string> = {
  BUYER: "Ditanggung pembeli",
  SELLER: "Ditanggung penjual",
  SPLIT: "Dibagi dua",
}

export type FeeBreakdownLabels = {
  orderValue: string
  serviceFee: string
  voucher: string
  buyerPays: string
  sellerReceives: string
  yourShare: (pct: number) => string
  feeInfo: string
}

const DEFAULT_LABELS: FeeBreakdownLabels = {
  orderValue: "Nilai transaksi",
  serviceFee: "Biaya layanan",
  voucher: "Diskon voucher",
  buyerPays: "Dibayar pembeli",
  sellerReceives: "Diterima penjual",
  yourShare: (pct) => `Anda menanggung ${pct}%`,
  feeInfo: "Tentang biaya layanan",
}

// `role` di-Omit: ViewProps RN punya `role?: Role` (a11y) yang disjoint dengan OrderRole
export type FeeBreakdownProps = Omit<ViewProps, "children" | "role"> & {
  orderValue: number
  /** Total biaya layanan sebelum diskon */
  serviceFee: number
  /** Nilai diskon voucher (positif) — 0/undefined = tidak ada */
  voucherDiscount?: number
  voucherCode?: string
  feeResponsibility: FeeResponsibility
  /** Peran USER — baris yang relevan diberi emphasis */
  viewer: OrderRole
  /** Penjelasan dasar biaya untuk Tooltip (dari fee-schedule) */
  feeExplanation?: string
  loading?: boolean
  /** Tanpa border/padding — untuk ditanam di Card lain */
  bare?: boolean
  labels?: Partial<FeeBreakdownLabels>
  className?: string
}

/** Porsi biaya (0–1) yang ditanggung tiap pihak */
export function feeShare(responsibility: FeeResponsibility): { buyer: number; seller: number } {
  if (responsibility === "BUYER") return { buyer: 1, seller: 0 }
  if (responsibility === "SELLER") return { buyer: 0, seller: 1 }
  return { buyer: 0.5, seller: 0.5 }
}

/** Hitung total per pihak — dipakai juga oleh layar ringkasan tanpa komponen */
export function computeFeeTotals(input: {
  orderValue: number
  serviceFee: number
  voucherDiscount?: number
  feeResponsibility: FeeResponsibility
}) {
  const share = feeShare(input.feeResponsibility)
  const netFee = Math.max(0, input.serviceFee - (input.voucherDiscount ?? 0))
  const buyerFee = Math.round(netFee * share.buyer)
  const sellerFee = netFee - buyerFee
  return {
    netFee,
    buyerFee,
    sellerFee,
    buyerPays: input.orderValue + buyerFee,
    sellerReceives: input.orderValue - sellerFee,
  }
}

export function FeeBreakdown({
  orderValue,
  serviceFee,
  voucherDiscount = 0,
  voucherCode,
  feeResponsibility,
  viewer,
  feeExplanation,
  loading = false,
  bare = false,
  labels,
  className,
  ...rest
}: FeeBreakdownProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const share = feeShare(feeResponsibility)
  const myPct = Math.round((viewer === "buyer" ? share.buyer : share.seller) * 100)
  const totals = computeFeeTotals({ orderValue, serviceFee, voucherDiscount, feeResponsibility })

  const box = cn("w-full", !bare && "rounded-md border border-border bg-surface px-5", className)

  if (loading) {
    return (
      <View className={box} accessibilityLabel="Memuat rincian biaya" {...rest}>
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-row items-center justify-between py-3">
            <Skeleton height={14} className="w-32" />
            <Skeleton height={14} className="w-24" />
          </View>
        ))}
        <Divider />
        <View className="flex-row items-center justify-between py-3">
          <Skeleton height={14} className="w-28" />
          <Skeleton height={24} className="w-36" />
        </View>
      </View>
    )
  }

  const feeLabel = (
    <View className="flex-row items-center gap-1">
      <Text variant="body" tone="secondary">
        {t.serviceFee}
      </Text>
      {feeExplanation ? (
        <Tooltip content={feeExplanation} accessibilityLabel={t.feeInfo}>
          <Icon icon={Info} size="xs" />
        </Tooltip>
      ) : null}
    </View>
  )

  return (
    <View className={box} {...rest}>
      <KeyValue label={t.orderValue} value={<Amount value={orderValue} />} />
      <Divider />

      {/* Baris biaya — label custom dengan Tooltip, jadi tidak lewat prop `label` */}
      <View className="w-full flex-row items-start justify-between gap-4 py-3" accessible accessibilityLabel={`${t.serviceFee}: ${totals.netFee}`}>
        {feeLabel}
        <View className="flex-1 items-end gap-1">
          <Amount value={serviceFee} />
          <Text variant="caption" tone="tertiary" className="text-right">
            {`${FEE_RESPONSIBILITY_LABELS[feeResponsibility]} · ${t.yourShare(myPct)}`}
          </Text>
        </View>
      </View>

      {voucherDiscount > 0 ? (
        <>
          <Divider />
          <KeyValue
            label={voucherCode ? `${t.voucher} (${voucherCode})` : t.voucher}
            value={<Amount value={-voucherDiscount} tone="success" />}
          />
        </>
      ) : null}

      <Divider />
      <KeyValue
        label={t.buyerPays}
        value={<Amount value={totals.buyerPays} size={viewer === "buyer" ? "large" : "body"} />}
        emphasis={viewer === "buyer"}
      />
      <Divider tone="subtle" />
      <KeyValue
        label={t.sellerReceives}
        value={<Amount value={totals.sellerReceives} size={viewer === "seller" ? "large" : "body"} />}
        emphasis={viewer === "seller"}
      />
    </View>
  )
}
