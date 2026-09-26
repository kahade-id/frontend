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
 *     WAJIB dari server — server adalah sumber kebenaran; bila pemanggil
 *     tidak mengirimnya, baris total menampilkan "—" (WF-024), bukan
 *     hitungan lokal yang berpotensi beda dari backend.
 *   - Diskon voucher: <Amount> bernilai NEGATIF tone success ("-Rp10.000") —
 *     pola sama dengan VoucherRedeemBox & InvoiceReceiptView. Satu-satunya
 *     warna di kartu.
 *   - Penanggung biaya ditulis sebagai kalimat pendek di bawah baris biaya
 *     ("Ditanggung pembeli"), bukan Badge — ini penjelasan, bukan status.
 *   - `loading` = Skeleton dengan tinggi baris sama supaya kartu tidak
 *     melompat saat user mengubah nominal dan fee dihitung ulang.
 */
import { type ViewProps } from "react-native"
import { translate } from "@/lib/i18n/translate"

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

// J-03 (audit escrow 2026-09-24): label default dibungkus `translate()` di
// titik definisi (usulan audit) supaya masuk katalog i18n.
const DEFAULT_LABELS: FeeBreakdownLabels = {
  orderValue: translate("Nilai transaksi"),
  serviceFee: translate("Biaya layanan"),
  responsibility: {
    BUYER: translate("Ditanggung pembeli"),
    SELLER: translate("Ditanggung penjual"),
    SPLIT: translate("Dibagi dua pihak"),
  },
  voucher: translate("Potongan voucher"),
  buyerPays: translate("Pembeli membayar"),
  sellerGets: translate("Penjual menerima"),
  feeHint: undefined,
}

/** Label penanggung biaya — dipakai FeeResponsibilitySelector & detail order */
export const FEE_RESPONSIBILITY_LABELS: Record<FeeResponsibility, string> = DEFAULT_LABELS.responsibility

/**
 * B-03/B-07 (audit escrow 2026-09-24): `feeShare`/`splitFee` pindah ke
 * `lib/financial.ts` (matematika uang murni, teruji di
 * tests/orders-domain.test.ts) — di sini hanya di-re-export untuk pemakai lama.
 */
import { splitFee } from "@/lib/financial"

export { feeShare, splitFee } from "@/lib/financial"

// `role` di-Omit dari ViewProps: RN 0.81 punya `role?: Role` (aksesibilitas)
// yang literal-nya disjoint dengan FeeRole — tanpa Omit seluruh props = never.
export type FeeBreakdownProps = Omit<ViewProps, "children" | "role"> & {
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
  /**
   * B-02 (audit escrow 2026-09-24): potongan voucher TIDAK lagi di-clamp ke
   * feeAmount — voucher yang lebih besar dari biaya platform (mis. gratis
   * ongkir + potongan) tampil penuh sesuai nominal server. Clamp membuat
   * baris "Potongan voucher" pernah menampilkan angka yang lebih kecil dari
   * yang dipakai backend.
   *
   * B-06 (diperbarui WF-024 Batch 1-money): fallback lokal DIHAPUS — total
   * akhir hanya dari server (`buyerPays`/`sellerGets`); tanpanya tampil "—".
   */
  const discount = Math.max(Math.trunc(discountAmount) || 0, 0)
  // M-11 (audit end-to-end 2026-09-24, issue #16-17): voucher = potongan
  // TAGIHAN PEMBELI penuh (P-D: order 150rb + voucher 50rb → pembeli bayar
  // 100rb, BUKAN 150rb); penjual tetap menerima `orderValue − fee.seller`
  // (BUKAN orderValue − fee.seller + share voucher — itu membuat penjual
  // "menerima" 195rb dari order 150rb). Invariant B-06 tetap terjaga:
  // pays − gets = (s.b − D) − (−s.s) = fee − discount.
  //
  // WF-024 (Batch 1-money): FAIL-EXPLICIT — bila angka server tidak dikirim,
  // JANGAN hitung lokal diam-diam (pernah menampilkan total yang beda dari
  // backend). Baris total menampilkan "—" sampai server mengirim angkanya.
  const pays = buyerPays
  const gets = sellerGets

  if (loading) {
    return (
      <Card padded className={cn("gap-3", className)} accessibilityLabel="Menghitung biaya" {...rest}>
        <Skeleton height={14} className="w-full tabular-nums" />
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

      {/* WF-024: angka server tidak ada → placeholder, bukan hitungan lokal. */}
      <KeyValue
        label={t.buyerPays}
        emphasis={role === "BUYER"}
        value={
          pays != null ? (
            <Amount value={pays} size={role === "BUYER" ? "large" : "body"} />
          ) : (
            <Text variant="body" tone="tertiary">—</Text>
          )
        }
      />
      <KeyValue
        label={t.sellerGets}
        emphasis={role === "SELLER"}
        value={
          gets != null ? (
            <Amount value={gets} size={role === "SELLER" ? "large" : "body"} />
          ) : (
            <Text variant="body" tone="tertiary">—</Text>
          )
        }
      />

      {feeResponsibility === "SPLIT" ? (
        <Text variant="caption" tone="secondary">
          <Text variant="inherit" weight={500}>
            {t.responsibility.SPLIT}
          </Text>
          {" — "}
          <Amount value={share.buyer} size="body" tone="inherit" className="text-caption" />
          {" / "}
          <Amount value={share.seller} size="body" tone="inherit" className="text-caption" />
          {/* B-11: sisa pembulatan 1 Rupiah dibebankan ke pembeli —
              dieksplisitkan, bukan diam-diam tersembunyi di angka baris atas. */}
          {share.buyer !== share.seller ? " (sisa pembulatan ke pembeli)" : ""}
        </Text>
      ) : null}
    </Card>
  )
}
