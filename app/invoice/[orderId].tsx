/**
 * Screen — Invoice (GET /v1/orders/{orderId}/invoice + receipt HTML).
 */
import { useCallback } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, userMessage } from "@/lib/api"
import { orderPartyName, type Invoice } from "@/lib/api/orders"
import { formatDateTime, formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { shareContent } from "@/lib/share"
import { useApiQuery } from "@/lib/use-api-query"

import { Button } from "@/components/ui/button"
import { DetailLoading } from "@/components/ui/paginated-list"
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
  const { copied, copy } = useCopy()

  /**
   * `useApiQuery`, bukan rakitan useState/useEffect: request dibatalkan saat
   * layar di-unmount, `refreshing` terpisah dari `loading` (tarik-untuk-
   * menyegarkan tidak lagi mengganti invoice dengan skeleton), dan error lewat
   * `userMessage(err)`. `enabled` menggantikan guard `if (!orderId) return`.
   */
  const query = useApiQuery<Invoice>(
    `invoice:${orderId}`,
    (signal) => api.orders.getInvoice(orderId, signal),
    Boolean(orderId),
  )
  const invoice = query.data

  const handleDownload = useCallback(
    async (orderId: string) => {
      try {
        await api.orders.getReceiptHtml(orderId)
        toast.show({
          title: "Struk siap diunduh",
          description: "File HTML diterima dari server.",
          tone: "success",
          duration: 3000,
        })
      } catch (err: unknown) {
        toast.show({
          title: "Gagal mengunduh struk",
          description: userMessage(err),
          tone: "danger",
        })
      }
    },
    [toast.show],
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
      const message = `Invoice ${inv.invoiceNumber} — ${formatRupiah(inv.total)} untuk order ${inv.order.id}`
      const outcome = await shareContent({ message, title: "Invoice Kahade" })
      if (outcome === "unavailable") {
        const ok = await copy(inv.invoiceNumber)
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

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Invoice" />
      <PullToRefresh
        onRefresh={query.refresh}
        refreshing={query.refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {query.loading ? (
          <DetailLoading />
        ) : query.error ? (
          <ErrorState
            title="Gagal memuat"
            description={query.error}
            onRetry={() => void query.reload()}
          />
        ) : invoice ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <InvoiceReceiptView
              mode="invoice"
              number={invoice.invoiceNumber}
              status={{ label: "Terverifikasi", tone: "success" }}
              from={{ name: orderPartyName(invoice.order.seller) ?? "—" }}
              to={{ name: orderPartyName(invoice.order.buyer) ?? "—" }}
              items={invoice.items.map((i, idx) => ({
                id: `${invoice.invoiceNumber}-${idx}`,
                title: i.label,
                amount: i.amount,
              }))}
              total={invoice.total}
              meta={[
                { label: "Terbit", value: formatDateTime(invoice.issuedAt) },
                { label: "Order", value: invoice.order.id },
              ]}
              onCopyNumber={(n) => void copy(n)}
              onDownload={() => void handleDownload(invoice.order.id)}
              onShare={() => void handleShare(invoice)}
            />
            <Button
              variant="ghost"
              fullWidth={false}
              onPress={() => void handleDownload(invoice.order.id)}
            >
              Unduh struk (HTML)
            </Button>
            {copied ? (
              <Button variant="ghost" fullWidth={false} disabled>
                Nomor invoice disalin
              </Button>
            ) : null}
          </View>
        ) : null}
      </PullToRefresh>
    </Screen>
  )
}