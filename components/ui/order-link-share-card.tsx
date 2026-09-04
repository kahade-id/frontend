/**
 * Kahade — <OrderLinkShareCard> (§9.6 Card, §3.1 Mono untuk ID/URL,
 * §9.11 Banner untuk feedback "Disalin", §12 Voice & Tone).
 *
 * Kartu yang muncul setelah penjual membuat transaksi escrow: berisi tautan
 * yang dikirim ke pembeli (WhatsApp, chat, dsb.). Ini titik krusial alur —
 * kalau tautan salah tersalin, pembeli membayar ke order lain. Karena itu
 * kartu memperlakukan tautan seperti nomor rekening: Mono, tidak terpotong
 * di tengah tanpa tanda, mudah disalin & dibagikan dalam satu ketukan.
 *
 * Anatomi: judul + Badge status -> ringkasan (nama barang, nominal) ->
 * kotak tautan Mono + tombol salin -> tombol "Bagikan" primary -> catatan
 * masa berlaku (opsional).
 *
 * Keputusan non-obvious:
 *   - Tautan dipotong dengan `truncateMiddle` (host tetap terlihat, kode
 *     order di ujung tetap terlihat) — bukan `numberOfLines={1}` ellipsis
 *     di kanan yang justru menyembunyikan bagian unik (kode order). Teks
 *     penuh tetap dikirim ke `onCopy`/`onShare`, dan `accessibilityLabel`
 *     membaca URL penuh.
 *   - Clipboard & share sheet BUKAN urusan komponen: `onCopy(url)` dan
 *     `onShare(payload)` menerima data siap pakai. Pemanggil menampilkan
 *     Banner "Tautan disalin" (§9.11 — tidak ada Toast) dan memanggil
 *     `Share.share` / expo-sharing. Komponen tetap bebas dependensi native,
 *     konsisten dengan BackupCodesDisplay.
 *   - `onShare` menerima `{ url, message }` — `message` sudah dirakit dari
 *     judul + nominal + URL supaya setiap layar pemanggil tidak menyusun
 *     kalimat sendiri dan copy tetap konsisten (§12 formal, "Anda").
 *   - Nominal dirender <Amount size="large"> (Mono 24): ini angka yang akan
 *     dibayar pembeli; penjual harus bisa memastikan sekali lihat.
 *   - Kotak tautan `bg-surface border-border rounded-sm` (radius input §5)
 *     — secara visual "field read-only", bukan tombol, supaya jelas yang
 *     bisa ditekan adalah ikon salin di kanan.
 *   - Status memakai <Badge tone> dari pemanggil (menunggu pembayaran =
 *     warning, dibayar = success) — satu-satunya warna di kartu; sisanya
 *     monokrom (§2.3 semantic eksklusif untuk status transaksi).
 *   - `expiresLabel` adalah string yang SUDAH diformat pemanggil ("Berlaku
 *     hingga 4 Sep 2026, 14:30" — §13, tidak ada relative time).
 */
import { Copy, ShareNetwork } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatRupiah, truncateMiddle } from "@/lib/format"

export type OrderLinkSharePayload = {
  url: string
  /** Kalimat siap kirim: "{title} — {nominal}\n{url}" */
  message: string
}

export type OrderLinkShareCardLabels = {
  heading: string
  copy: string
  share: string
  messageTemplate: (title: string, amount: string, url: string) => string
}

export type OrderLinkShareCardProps = Omit<ViewProps, "children"> & {
  url: string
  /** Nama barang/jasa */
  title: string
  amount: number
  /** Kode order untuk a11y & subtitle, mis. "KHD-2026-0903-AB12" */
  orderCode?: string
  status?: { label: string; tone: BadgeTone }
  /** Sudah diformat pemanggil, mis. "Berlaku hingga 4 Sep 2026, 14:30" */
  expiresLabel?: string
  onCopy?: (url: string) => void
  onShare?: (payload: OrderLinkSharePayload) => void
  labels?: Partial<OrderLinkShareCardLabels>
  className?: string
}

const DEFAULT_LABELS: OrderLinkShareCardLabels = {
  heading: "Tautan pembayaran",
  copy: "Salin tautan",
  share: "Bagikan",
  messageTemplate: (title, amount, url) => `${title} — ${amount}\nBayar aman lewat Kahade: ${url}`,
}

/** Potong URL: buang skema agar host+path unik tetap terbaca dalam 1 baris */
export function displayOrderUrl(url: string): string {
  const noScheme = url.replace(/^https?:\/\//, "")
  return truncateMiddle(noScheme, 18, 8)
}

export function OrderLinkShareCard({
  url,
  title,
  amount,
  orderCode,
  status,
  expiresLabel,
  onCopy,
  onShare,
  labels,
  className,
  ...rest
}: OrderLinkShareCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const message = t.messageTemplate(title, formatRupiah(amount), url)

  return (
    <Card padded className={cn("gap-5", className)} {...rest}>
      <View className="flex-row items-start gap-2">
        <View className="flex-1 gap-1">
          <Text variant="label" tone="secondary">
            {t.heading}
          </Text>
          <Text variant="h3" numberOfLines={2}>
            {title}
          </Text>
          {orderCode ? (
            <Text variant="monoBody" tone="secondary">
              {orderCode}
            </Text>
          ) : null}
        </View>
        {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
      </View>

      <Amount value={amount} size="large" />

      {/* Label di <Text>: `accessible` pada wrapper menelan IconButton "Salin".
          Teks tampil dipersingkat, tapi SR tetap membaca URL penuh (audit #4). */}
      <View className="flex-row items-center gap-2 rounded-sm border border-border bg-surface pl-3 pr-1 py-1">
        <Text
          accessibilityLabel={`${t.heading}: ${url}`}
          variant="monoBody"
          tone="primary"
          className="flex-1"
          numberOfLines={1}
        >
          {displayOrderUrl(url)}
        </Text>
        {onCopy ? (
          <IconButton icon={Copy} size="sm" variant="ghost" accessibilityLabel={t.copy} onPress={() => onCopy(url)} />
        ) : null}
      </View>

      {onShare ? (
        <Button variant="primary" leftIcon={ShareNetwork} onPress={() => onShare({ url, message })}>
          {t.share}
        </Button>
      ) : null}

      {expiresLabel ? (
        <Text variant="caption" tone="secondary">
          {expiresLabel}
        </Text>
      ) : null}
    </Card>
  )
}
