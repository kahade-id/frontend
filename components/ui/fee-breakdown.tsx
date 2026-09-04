/**
 * Kahade — <FeeBreakdown> (§9.6 Card, §3.1 Mono nominal, §13 format Rupiah,
 * §12 Voice & Tone — "tidak ada biaya tersembunyi").
 *
 * Rincian biaya hasil `POST /v1/orders/calculate-fee` sebelum user membuat/
 * membayar order: nilai barang, biaya layanan, siapa yang menanggung
 * (`feeResponsibility` BUYER|SELLER|SPLIT), potongan voucher, dan dua angka
 * akhir — yang DIBAYAR pembeli dan yang DITERIMA penjual.
 *
 * Keputusan non-obvious:
 *   - Menampilkan KEDUA sisi (bayar & terima) sekaligus, bukan hanya sisi
 *     user: di escrow, kepercayaan tumbuh saat kedua pihak melihat angka yang
 *     sama. Sisi user diberi `emphasis` (KeyValue total), sisi lawan tetap
 *     baris biasa — hierarki dari ukuran, bukan disembunyikan.
 *   - Porsi biaya per pihak dihitung DI SINI hanya untuk tampilan dari
 *     `feeAmount` + `feeResponsibility` (SPLIT = dibagi dua, pembulatan ke
 *     atas di pembeli agar jumlah pas). Angka akhir `buyerPays`/`sellerGets`
 *     tetap dari server bila pemanggil mengirimnya — server adalah sumber
 *     kebenaran; hitungan lokal hanya fallback saat pratinjau.
 *   - Diskon voucher: <Amount> bernilai NEGATIF tone success ("-Rp10.000") —
 *     pola sama dengan VoucherRedeemBox & InvoiceReceiptView. Satu-satunya
 *     warna di kartu.
 *   - Penanggung biaya ditulis sebagai kalimat pendek di bawah baris biaya
 *     ("Ditanggung pembeli"), bukan Badge — ini penjelasan, bukan status.
 *   - `loading` = Skeleton dengan tinggi baris sama supaya kartu tidak
 *     melompat saat user mengubah nominal dan fee dihitung ulang.
 */
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Card } from "@/components/ui/card"
import { Divider } from "@/components/ui/divider"
import { KeyValue } from "@/components/ui/key-value"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type FeeResponsibility = "BUYER" | "SELLER" | "SPLIT"
export type FeeRole = "BUYER" | "SELLER"

export type FeeBreakdownLabels = {
  orderValue: string
  serviceFee: string
  responsibility: Record<FeeResponsibility, string>
  voucher: string
  buyerPays: string
  sellerGets: string
  feeHint?: string
}

const DEFAULT_LABELS: FeeBreakdownLabels = {
  orderValue: "Nilai transaksi",
  serviceFee: "Biaya layanan",
  responsibility: {
    BUYER: "Ditanggung pembeli",
    SELLER: "Ditanggung penjual",
    SPLIT: "Dibagi dua pihak",
  },
  voucher: "Potongan voucher",
  buyerPays: "Pembeli membayar",
  sellerGets: "Penjual menerima",
  feeHint: undefined,
}

export function splitFee(feeAmount: number, responsibility: FeeResponsibility): { buyer: number; seller: number } {
  const fee = Math.max(feeAmount, 0)
  if (responsibility === "BUYER") return { buyer: fee, seller: 0 }
  if (responsibility === "SELLER") return { buyer: 0, seller: fee }
  const half = Math.floor(fee / 2)
  return { buyer: fee - half, seller: half }
}

export type FeeBreakdownProps = Omit<ViewProps, "children"> & {
  orderValue: number
  feeAmount: number
  feeResponsibility: FeeResponsibility
  /** Peran user — baris totalnya diberi emphasis */
  role: FeeRole
  /** Potongan voucher (positif); dirender negatif */
  discountAmount?: number
  voucherCode?: string
  /** Angka akhir dari server; bila kosong dihitung lokal */
  buyerPays?: number
  sellerGets?: number
  loading?: boolean
  labels?: Partial<Omit<FeeBreakdownLabels, "responsibility">> & { responsibility?: Partial<FeeBreakdownLabels["responsibility"]> }
  className?: string
}

export function FeeBreakdown({
  orderValue,
  feeAmount,
  feeResponsibility,
  role,
  discountAmount = 0,
  voucherCode,
  buyerPays,
  sellerGets,
  loading = false,
  labels,
  className,
  ...rest
}: FeeBreakdownProps) {
  const t: FeeBreakdownLabels = {
    ...DEFAULT_LABELS,
    ...labels,
    responsibility: { ...DEFAULT_LABELS.responsibility, ...labels?.responsibility },
  }

  const share = splitFee(feeAmount, feeResponsibility)
  // Diskon mengurangi biaya, dialokasikan ke pihak yang menanggung biaya.
  const discount = Math.min(Math.max(discountAmount, 0), feeAmount)
  const discountShare = splitFee(discount, feeResponsibility)
  const pays = buyerPays ?? orderValue + share.buyer - discountShare.buyer
  const gets = sellerGets ?? orderValue - share.seller + discountShare.seller

  if (loading) {
    return (
      <Card padded className={cn("gap-3", className)} accessibilityLabel="Menghitung biaya" {...rest}>
        <Skeleton height={14} className="w-full" />
        <Skeleton height={14} className="w-full" />
        <Skeleton height={1} className="w-full" />
        <Skeleton height={20} className="w-full" />
        <Skeleton height={14} className="w-3/4" />
      </Card>
    )
  }

  return (
    <Card padded className={cn("gap-3", className)} {...rest}>
      <KeyValue label={t.orderValue} value={<Amount value={orderValue} size="body" />} />
      <KeyValue
        label={t.serviceFee}
        hint={[t.responsibility[feeResponsibility], t.feeHint].filter(Boolean).join(" · ")}
        value={<Amount value={feeAmount} size="body" />}
      />
      {discount > 0 ? (
        <KeyValue
          label={voucherCode ? `${t.voucher} · ${voucherCode}` : t.voucher}
          value={<Amount value={-discount} size="body" sign="auto" tone="success" />}
        />
      ) : null}

      <Divider />

      <KeyValue label={t.buyerPays} emphasis={role === "BUYER"} value={<Amount value={pays} size={role === "BUYER" ? "large" : "body"} />} />
      <KeyValue label={t.sellerGets} emphasis={role === "SELLER"} value={<Amount value={gets} size={role === "SELLER" ? "large" : "body"} />} />

      {feeResponsibility === "SPLIT" ? (
        <Text variant="caption" tone="tertiary">
          <Text variant="inherit" weight={500}>
            {t.responsibility.SPLIT}
          </Text>
          {" — "}
          <Amount value={share.buyer} size="body" tone="inherit" className="text-caption" />
          {" / "}
          <Amount value={share.seller} size="body" tone="inherit" className="text-caption" />
        </Text>
      ) : null}
    </Card>
  )
}
