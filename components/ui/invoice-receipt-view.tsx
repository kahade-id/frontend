/**
 * Kahade — <InvoiceReceiptView> (§9.6 Card, §9.17 KeyValue, §3.1 Mono untuk
 * nominal & ID, §13 format Rupiah/tanggal, §2.3 Badge status).
 *
 * Tampilan struk/invoice untuk detail order (`GET /v1/orders/{id}/invoice`)
 * dan transaksi wallet. Satu komponen untuk dua mode:
 *   - `mode="invoice"` : tagihan yang belum/akan dibayar — total menonjol,
 *                        ada jatuh tempo.
 *   - `mode="receipt"` : bukti pembayaran selesai — ada waktu bayar & metode.
 *
 * Anatomi: kop (Logo mark + judul + nomor Mono + Badge status) -> pihak
 * (dari/kepada) -> rincian item -> ringkasan biaya (subtotal, biaya layanan,
 * diskon, total) -> meta (tanggal, metode, referensi) -> aksi (unduh PDF,
 * bagikan).
 *
 * Keputusan non-obvious:
 *   - Seluruh angka lewat <Amount> dan `formatRupiah` — TIDAK ada format
 *     lokal di sini (§13 satu sumber). Diskon/voucher dirender <Amount
 *     sign="always"> dengan nilai negatif supaya tampil "-Rp10.000" tone
 *     success: potongan adalah kabar baik, satu-satunya warna di rincian.
 *   - Total memakai <KeyValue emphasis> + <Amount size="large"> (Mono 24)
 *     — pemisahnya cukup <Divider> dari <KeyValueList> (§6.1 tidak ada
 *     "border tebal"); penekanan dari tipografi.
 *   - Nomor invoice `monoBody` dengan tombol salin (pola kotak read-only
 *     OrderLinkShareCard) karena nomor ini yang diketik pengguna saat
 *     komplain ke CS; `onCopyNumber` — clipboard tugas pemanggil (§9.11).
 *   - Garis pemisah antar blok memakai <Divider tone="subtle"> (gray.300
 *     dekoratif), sementara garis SEBELUM total memakai divider default:
 *     satu-satunya tempat pembedaan struktur perlu lebih tegas.
 *   - Struk versi cetak/PDF disediakan server (`/receipt` HTML). Komponen
 *     ini hanya memanggil `onDownload`/`onShare`; tidak merender HTML.
 *   - Kop memakai <Logo variant="mark" size="sm"> di kiri — sesuai kebiasaan
 *     struk institusi; `variant="lockup"` terlalu lebar untuk 360px bersama
 *     Badge status.
 *   - Semua label tanggal adalah string yang SUDAH diformat pemanggil
 *     ("3 Sep 2026, 14:30"), konsisten dengan komponen domain lain.
 */
import { Copy, DownloadSimple, ShareNetwork } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Divider } from "@/components/ui/divider"
import { IconButton } from "@/components/ui/icon-button"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { Logo } from "@/components/ui/logo"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatRupiah } from "@/lib/format"

export type InvoiceMode = "invoice" | "receipt"

export type InvoiceParty = {
  name: string
  /** @username atau email/telepon yang sudah diformat */
  detail?: string
}

export type InvoiceLineItem = {
  id: string
  title: string
  /** Baris kecil di bawah judul, mis. "1 × Rp150.000" */
  detail?: string
  amount: number
}

export type InvoiceAdjustment = {
  id: string
  label: string
  /** Positif = biaya; negatif = potongan (dirender tone success) */
  amount: number
}

export type InvoiceMeta = {
  label: string
  value: string
  mono?: boolean
}

export type InvoiceReceiptLabels = {
  invoiceTitle: string
  receiptTitle: string
  from: string
  to: string
  items: string
  subtotal: string
  total: string
  copyNumber: string
  download: string
  share: string
}

export type InvoiceReceiptViewProps = Omit<ViewProps, "children"> & {
  mode?: InvoiceMode
  /** Nomor invoice/struk, mis. "INV-2026-0903-0001" */
  number: string
  status?: { label: string; tone: BadgeTone }
  from?: InvoiceParty
  to?: InvoiceParty
  items: InvoiceLineItem[]
  adjustments?: InvoiceAdjustment[]
  /** Bila tidak dikirim, dihitung dari items + adjustments */
  total?: number
  /** Baris meta: tanggal terbit, jatuh tempo, metode, referensi (sudah diformat) */
  meta?: InvoiceMeta[]
  /** Catatan kaki kecil (kebijakan, terima kasih) */
  footnote?: string
  onCopyNumber?: (number: string) => void
  onDownload?: () => void
  onShare?: () => void
  downloading?: boolean
  labels?: Partial<InvoiceReceiptLabels>
  className?: string
}

const DEFAULT_LABELS: InvoiceReceiptLabels = {
  invoiceTitle: "Tagihan",
  receiptTitle: "Struk pembayaran",
  from: "Dari",
  to: "Kepada",
  items: "Rincian",
  subtotal: "Subtotal",
  total: "Total",
  copyNumber: "Salin nomor",
  download: "Unduh PDF",
  share: "Bagikan",
}

function Party({ label, party }: { label: string; party: InvoiceParty }) {
  return (
    <View className="flex-1 gap-1">
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <Text variant="body" weight={500} numberOfLines={1}>
        {party.name}
      </Text>
      {party.detail ? (
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {party.detail}
        </Text>
      ) : null}
    </View>
  )
}

export function InvoiceReceiptView({
  mode = "receipt",
  number,
  status,
  from,
  to,
  items,
  adjustments = [],
  total,
  meta = [],
  footnote,
  onCopyNumber,
  onDownload,
  onShare,
  downloading = false,
  labels,
  className,
  ...rest
}: InvoiceReceiptViewProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const subtotal = items.reduce((s, it) => s + it.amount, 0)
  const computedTotal = total ?? subtotal + adjustments.reduce((s, a) => s + a.amount, 0)
  const title = mode === "invoice" ? t.invoiceTitle : t.receiptTitle

  return (
    <Card variant="elevated" padded className={cn("gap-5", className)} {...rest}>
      {/* Kop */}
      <View className="flex-row items-start gap-3">
        <Logo variant="mark" size="sm" />
        <View className="flex-1 gap-1">
          <Text variant="h3">{title}</Text>
          <View
            accessible
            accessibilityLabel={`${title} nomor ${number.split("").join(" ")}`}
            className="flex-row items-center gap-1"
          >
            <Text variant="monoBody" tone="secondary" numberOfLines={1} className="shrink">
              {number}
            </Text>
            {onCopyNumber ? (
              <IconButton
                icon={Copy}
                size="sm"
                variant="ghost"
                accessibilityLabel={t.copyNumber}
                onPress={() => onCopyNumber(number)}
                className="-my-2"
              />
            ) : null}
          </View>
        </View>
        {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
      </View>

      {from || to ? (
        <>
          <Divider tone="subtle" />
          <View className="flex-row gap-4">
            {from ? <Party label={t.from} party={from} /> : null}
            {to ? <Party label={t.to} party={to} /> : null}
          </View>
        </>
      ) : null}

      <Divider tone="subtle" />

      {/* Rincian item */}
      <View className="gap-3">
        <Text variant="label" tone="secondary">
          {t.items}
        </Text>
        {items.map((it) => (
          <View key={it.id} className="flex-row items-start gap-3">
            <View className="flex-1 gap-0">
              <Text variant="body" numberOfLines={2}>
                {it.title}
              </Text>
              {it.detail ? (
                <Text variant="caption" tone="secondary">
                  {it.detail}
                </Text>
              ) : null}
            </View>
            <Amount value={it.amount} />
          </View>
        ))}
      </View>

      {/* Ringkasan biaya */}
      <KeyValueList>
        {adjustments.length > 0 ? <KeyValue label={t.subtotal} value={<Amount value={subtotal} />} /> : null}
        {adjustments.map((a) => (
          <KeyValue
            key={a.id}
            label={a.label}
            value={<Amount value={a.amount} sign={a.amount < 0 ? "auto" : "never"} tone={a.amount < 0 ? "success" : "primary"} />}
          />
        ))}
        <KeyValue
          label={t.total}
          emphasis
          value={<Amount value={computedTotal} size="large" />}
          accessibilityLabel={`${t.total} ${formatRupiah(computedTotal)}`}
        />
      </KeyValueList>

      {meta.length > 0 ? (
        <>
          <Divider tone="subtle" />
          <KeyValueList divided={false} className="gap-2">
            {meta.map((m) => (
              <KeyValue key={m.label} label={m.label} value={m.value} mono={m.mono} />
            ))}
          </KeyValueList>
        </>
      ) : null}

      {footnote ? (
        <Text variant="caption" tone="secondary">
          {footnote}
        </Text>
      ) : null}

      {onDownload || onShare ? (
        <View className="flex-row gap-3 border-t border-border pt-4">
          {onDownload ? (
            <Button
              variant="secondary"
              leftIcon={DownloadSimple}
              loading={downloading}
              onPress={onDownload}
              containerClassName="flex-1"
            >
              {t.download}
            </Button>
          ) : null}
          {onShare ? (
            <Button variant="ghost" leftIcon={ShareNetwork} onPress={onShare} containerClassName="flex-1">
              {t.share}
            </Button>
          ) : null}
        </View>
      ) : null}
    </Card>
  )
}
