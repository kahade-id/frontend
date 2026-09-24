/**
 * Screen — Invoice (GET /v1/orders/{orderId}/invoice + receipt HTML).
 *
 * Perbaikan keandalan (laporan "Invoice gagal memuat"):
 *   - `getInvoice` kini menormalisasi body (lib/api/orders.ts): kunci
 *     bersarang/berbeda nama dan angka-string tidak lagi melempar di render.
 *   - 404 dipetakan ke penjelasan ("belum diterbitkan ...") — invoice wajar
 *     belum ada untuk order yang belum dibayar, dan itu bukan "gagal".
 *   - Unduh struk BENAR-BENAR menyimpan berkas (sebelumnya HTML hanya diambil
 *     lalu dibuang; toast "siap diunduh" padahal tidak ada berkas).
 *   - `orderId` kosong (deep link rusak) mendapat EmptyState eksplisit.
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Receipt } from "phosphor-react-native"

import { api, isApiError, userMessage } from "@/lib/api"
import { orderPartyName, type Invoice } from "@/lib/api/orders"
import { formatDateTime, formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { shareContent } from "@/lib/share"
import { useApiQuery } from "@/lib/use-api-query"

import { saveBlobFile, saveTextFile } from "@/lib/export-file"

import { Crossfade } from "@/components/ui/fade-in"
import { DetailLoading } from "@/components/ui/paginated-list"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { InvoiceReceiptView } from "@/components/ui/invoice-receipt-view"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { useCopy } from "@/lib/clipboard"
import { useToast } from "@/components/ui/toast"

export default function InvoiceScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copy } = useCopy()
  const [downloading, setDownloading] = useState(false)

  /**
   * `useApiQuery`, bukan rakitan useState/useEffect: request dibatalkan saat
   * layar di-unmount, `refreshing` terpisah dari `loading` (tarik-untuk-
   * menyegarkan tidak lagi mengganti invoice dengan skeleton), dan error lewat
   * `userMessage(err)`. `enabled` menggantikan guard `if (!orderId) return`.
   */
  const query = useApiQuery<Invoice>(
    `invoice:${orderId}`,
    (signal) =>
      api.orders.getInvoice(orderId ?? "", signal).catch((err: unknown) => {
        // 404 = invoice belum diterbitkan (wajar untuk order yang belum
        // dibayar) — jelaskan, jangan "Gagal memuat" generik.
        if (isApiError(err) && err.code === "NOT_FOUND")
          throw new Error(
            "Invoice belum tersedia untuk order ini. Invoice diterbitkan setelah pembayaran dikonfirmasi.",
          )
        throw err
      }),
    Boolean(orderId),
  )
  const invoice = query.data

  const handleDownload = useCallback(
    async (id: string, invoiceNumber: string | undefined) => {
      if (downloading) return
      setDownloading(true)
      try {
        const html = await api.orders.getReceiptHtml(id)
        // H-04 (audit escrow 2026-09-24): nama berkas memakai nomor ASLI dari
        // server; bila tidak ada, id order (klien tidak pernah mengarang
        // `INV-…` — B-14).
        const saved = await saveTextFile(html, `${invoiceNumber ?? `order-${id}`}.html`, "text/html")
        toast.show({
          title: saved.kind === "downloaded" ? "Struk diunduh" : "Struk siap dibagikan",
          description: saved.filename,
          tone: "success",
          duration: 3000,
        })
      } catch (err: unknown) {
        toast.show({
          title: "Gagal mengunduh struk",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setDownloading(false)
      }
    },
    [downloading, toast.show],
  )

  /**
   * O-04 (audit escrow 2026-09-24): unduh struk PDF resmi
   * (`GET /v1/orders/{id}/invoice/pdf`) — dokumen arsip yang sah, menggantikan
   * kebiasaan mengarsipkan HTML hasil unduh (D-14/L-02).
   */
  const handleDownloadPdf = useCallback(
    async (id: string, invoiceNumber: string | undefined) => {
      if (downloading) return
      setDownloading(true)
      try {
        const blob = await api.orders.getInvoicePdf(id)
        const saved = await saveBlobFile(blob, `${invoiceNumber ?? `order-${id}`}.pdf`, "application/pdf")
        toast.show({
          title: saved.kind === "downloaded" ? "Struk PDF diunduh" : "Struk PDF siap dibagikan",
          description: saved.filename,
          tone: "success",
          duration: 3000,
        })
      } catch (err: unknown) {
        toast.show({
          title: "Gagal mengunduh struk PDF",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setDownloading(false)
      }
    },
    [downloading, toast.show],
  )

  /**
   * Bagikan invoice.
   *
   * Kenapa ini cacat sebelumnya: <InvoiceReceiptView> menyembunyikan tombol
   * "Bagikan" lewat guard `{onShare ? … : null}` (baris 289-290 komponennya).
   * Layar ini mengirim `onCopyNumber` dan `onDownload` tetapi TIDAK `onShare`,
   * jadi struk hanya punya Salin + Unduh — padahal <OrderLinkShareCard>
   * (app/order-links.tsx) dan kartu referral sudah bisa berbagi.
   *
   * Payload-nya TEKS, bukan berkas: `handleDownload` hanya mengambil HTML
   * dari server lalu men-toast, tidak pernah menyimpan file lokal, sehingga
   * tidak ada `fileUri` untuk <ShareFilePayload>.
   *
   * Pola fallback identik dengan app/order-links.tsx: bila share sheet tidak
   * tersedia (desktop web tanpa navigator.share) jatuh ke menyalin, bukan
   * diam — pengguna selalu dapat sesuatu.
   */
  const handleShare = useCallback(
    async (inv: Invoice) => {
      const message = `Invoice ${inv.invoiceNumber ?? inv.order.id} — ${formatRupiah(inv.total)} untuk order ${inv.order.id}`
      const outcome = await shareContent({ message, title: "Invoice Kahade" })
      if (outcome === "unavailable") {
        const ok = inv.invoiceNumber ? await copy(inv.invoiceNumber) : await copy(inv.order.id)
        toast.show({
          title: ok ? "Nomor invoice disalin" : "Tidak bisa membagikan",
          description: ok
            ? "Berbagi tidak tersedia di perangkat ini; tempel nomor invoice secara manual."
            : undefined,
          tone: ok ? "success" : "danger",
        })
      }
    },
    [copy, toast.show],
  )

  if (!orderId) {
    return (
      <Screen edges={["top"]} padded={false}>
        <Header title="Invoice" />
        <View className="flex-1 px-5">
          <EmptyState
            icon={Receipt}
            title="Order tidak diketahui"
            description="Tautan yang Anda buka tidak memuat identitas order."
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Invoice" />
      <PullToRefresh
        onRefresh={query.refresh}
        refreshing={query.refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <Crossfade loading={query.loading} skeleton={<DetailLoading />}>
          {query.error ? (
          <ErrorState
            title="Gagal memuat invoice"
            description={query.error}
            onRetry={() => void query.reload()}
          />
        ) : invoice ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <InvoiceReceiptView
              mode="invoice"
              number={invoice.invoiceNumber ?? "—"}
              // M-19 (audit end-to-end, issue #63/#66): badge MEMANTULKAN status
              // asli — dulu hardcode "Terverifikasi" (success) APA PUN kondisi
              // order, dan status kosong merender badge tanpa teks. Tidak ada
              // status terbaca = "—" (B-14), bukan klaim "terverifikasi".
              status={(() => {
                const s = (invoice.status ?? "").toUpperCase()
                if (!s) return { label: "—", tone: "neutral" as const }
                if (s === "PAID" || s === "LUNAS" || s === "COMPLETED" || s === "SETTLED")
                  return { label: "Lunas", tone: "success" as const }
                if (s === "PENDING" || s === "UNPAID" || s === "WAITING")
                  return { label: "Belum bayar", tone: "warning" as const }
                if (s === "EXPIRED" || s === "CANCELLED" || s === "FAILED")
                  return { label: "Batal", tone: "danger" as const }
                return { label: s, tone: "neutral" as const }
              })()}
              from={{ name: orderPartyName(invoice.order.seller) ?? "—" }}
              to={{ name: orderPartyName(invoice.order.buyer) ?? "—" }}
              items={invoice.items.map((i, idx) => ({
                id: `${invoice.invoiceNumber ?? invoice.order.id}-${idx}`,
                title: i.label,
                amount: i.amount,
              }))}
              total={invoice.total}
              meta={[
                { label: "Terbit", value: formatDateTime(invoice.issuedAt) },
                { label: "Order", value: invoice.order.id },
                // M-56 (audit end-to-end, issue #101): baris biaya TIDAK hilang
                // diam-diam — `normalizeFeeBreakdown` bisa `undefined` dan dulu
                // tidak ada jejak di struk. Tidak terbaca = "—" (B-14).
                {
                  label: "Biaya platform",
                  value: invoice.fee ? formatRupiah(invoice.fee.platformFee) : "—",
                },
              ]}
              onCopyNumber={(n) => void copy(n)}
              onDownload={() => void handleDownload(invoice.order.id, invoice.invoiceNumber)}
              onDownloadPdf={() => void handleDownloadPdf(invoice.order.id, invoice.invoiceNumber)}
              onShare={() => void handleShare(invoice)}
              downloading={downloading}
            />
            </View>
          ) : null}
        </Crossfade>
      </PullToRefresh>
    </Screen>
  )
}