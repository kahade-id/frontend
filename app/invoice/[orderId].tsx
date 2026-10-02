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
import { formatDateTimeWIB, formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { shareContent } from "@/lib/share"
import { shortId } from "@/lib/short-id"
import { useApiQuery } from "@/lib/use-api-query"
import { useFingerprintPoll } from "@/lib/use-fingerprint-poll"
import { translate } from "@/lib/i18n/translate"
import { FEE_RESPONSIBILITY_LABELS } from "@/components/ui/fee-breakdown"

/** R2 (#25): status invoice yang final — polling berhenti di sini. */
const INVOICE_TERMINAL_STATUSES = new Set([
  "PAID",
  "LUNAS",
  "COMPLETED",
  "SETTLED",
  "EXPIRED",
  "CANCELLED",
  "FAILED",
])

import { saveBlobFile, saveTextFile } from "@/lib/export-file"

import { Crossfade } from "@/components/ui/fade-in"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
  /**
   * D19 (batch 139): state ekspor EKSPLISIT — idle | working | done | error,
   * per format. Boolean `downloading` lama tidak bisa membedakan "gagal"
   * dari "tidak jalan"; kegagalan kini terlihat di layar (bukan cuma toast
   * yang hilang), dan lock `working` mencegah permintaan ganda.
   */
  type ExportFormat = "html" | "pdf"
  type ExportState =
    | { kind: "idle" }
    | { kind: "working"; format: ExportFormat }
    | { kind: "done"; format: ExportFormat; filename: string }
    | { kind: "error"; format: ExportFormat; message: string }
  const [exportState, setExportState] = useState<ExportState>({ kind: "idle" })
  const exporting = exportState.kind === "working"

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
            translate(
              "Invoice belum tersedia untuk order ini. Invoice diterbitkan setelah pembayaran dikonfirmasi.",
            ),
          )
        throw err
      }),
    Boolean(orderId),
    // R2 (audit ronde-2, butir #84): kembali dari layar pembayaran (invoice
    // tergenerasi async) menyegarkan otomatis — pelengkap polling #25.
    //
    // NS-008 (audit performa): refreshOnFocus DIMATIKAN — layar ini sudah
    // poll tiap 15 detik sampai status final, jadi refresh-on-focus hanya
    // menambah request ganda (focus + tick poll berurutan <1 detik).
    { refreshOnFocus: false },
  )
  const invoice = query.data

  // R2 (audit ronde-2, butir #25): invoice digenerasikan async setelah
  // pembayaran — poll 15 detik sampai status final (PAID/EXPIRED/CANCELLED)
  // tercapai; jangan paksa pengguna menutup-membuka layar untuk melihatnya.
  // D1-010 (perf 2026-09-29): invoice diturunkan dari baris order — poll
  // status order ringan (D1-005); bundle penuh hanya bila status berubah.
  useFingerprintPoll(
    (signal) => api.orders.getOrderStatus(orderId as string, signal),
    () => query.refresh(),
    15_000,
    Boolean(orderId) &&
      !INVOICE_TERMINAL_STATUSES.has((invoice?.status ?? "").toUpperCase()),
  )

  const handleDownload = useCallback(
    async (id: string, invoiceNumber: string | undefined) => {
      if (exporting) return
      setExportState({ kind: "working", format: "html" })
      try {
        const html = await api.orders.getReceiptHtml(id)
        // H-04 (audit escrow 2026-09-24): nama berkas memakai nomor ASLI dari
        // server; bila tidak ada, id order (klien tidak pernah mengarang
        // `INV-…` — B-14).
        const saved = await saveTextFile(html, `${invoiceNumber ?? `order-${id}`}.html`, "text/html")
        setExportState({ kind: "done", format: "html", filename: saved.filename })
        toast.show({
          title: saved.kind === "downloaded" ? "Struk diunduh" : "Struk siap dibagikan",
          description: saved.filename,
          tone: "success",
          duration: 3000,
        })
      } catch (err: unknown) {
        const message = userMessage(err)
        setExportState({ kind: "error", format: "html", message })
        toast.show({
          title: "Gagal mengunduh struk",
          description: message,
          tone: "danger",
        })
      }
    },
    [exporting, toast.show],
  )

  /**
   * O-04 (audit escrow 2026-09-24): unduh struk PDF resmi
   * (`GET /v1/orders/{id}/invoice/pdf`) — dokumen arsip yang sah, menggantikan
   * kebiasaan mengarsipkan HTML hasil unduh (D-14/L-02).
   */
  const handleDownloadPdf = useCallback(
    async (id: string, invoiceNumber: string | undefined) => {
      if (exporting) return
      setExportState({ kind: "working", format: "pdf" })
      try {
        const blob = await api.orders.getInvoicePdf(id)
        const saved = await saveBlobFile(blob, `${invoiceNumber ?? `order-${id}`}.pdf`, "application/pdf")
        setExportState({ kind: "done", format: "pdf", filename: saved.filename })
        toast.show({
          title: saved.kind === "downloaded" ? "Struk PDF diunduh" : "Struk PDF siap dibagikan",
          description: saved.filename,
          tone: "success",
          duration: 3000,
        })
      } catch (err: unknown) {
        const message = userMessage(err)
        setExportState({ kind: "error", format: "pdf", message })
        toast.show({
          title: "Gagal mengunduh struk PDF",
          description: message,
          tone: "danger",
        })
      }
    },
    [exporting, toast.show],
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
      // R2 (audit ronde-2, butir #83): UUID mentah tidak ikut kalimat yang
      // dibagikan ke pihak luar — shortcode 8 heksa sudah cukup merujuk.
      const message = `Invoice ${inv.invoiceNumber ?? `#${shortId(inv.order.id)}`} — ${formatRupiah(inv.total)} untuk pesanan #${shortId(inv.order.id)}`
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
            title="Pesanan tidak diketahui"
            description="Tautan yang Anda buka tidak memuat identitas pesanan."
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
            {/*
             * D19 (batch 139): kegagalan ekspor terlihat PERSISTEN di layar
             * (bukan hanya toast yang hilang) — dengan tombol coba lagi.
             */}
            {exportState.kind === "error" ? (
              <View className="gap-2">
                <Alert
                  tone="danger"
                  title={`Gagal mengunduh struk ${exportState.format === "pdf" ? "PDF" : "HTML"}`}
                >
                  {exportState.message}
                </Alert>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() =>
                    exportState.format === "pdf"
                      ? void handleDownloadPdf(invoice.order.id, invoice.invoiceNumber)
                      : void handleDownload(invoice.order.id, invoice.invoiceNumber)
                  }
                >
                  Coba lagi
                </Button>
              </View>
            ) : null}
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
                // TRX-017: tanggal terbit invoice berlabel zona eksplisit.
                { label: "Terbit", value: formatDateTimeWIB(invoice.issuedAt) },
                // UI-T010 (audit UI/UX 2026-09-27): tampilkan shortcode, bukan UUID
        // mentah 36 karakter (konsisten dengan jalur share yang sudah disensor).
        { label: "Pesanan", value: `#${shortId(invoice.order.id)}` },
                // M-56 (audit end-to-end, issue #101): baris biaya TIDAK hilang
                // diam-diam — `normalizeFeeBreakdown` bisa `undefined` dan dulu
                // tidak ada jejak di struk. Tidak terbaca = "—" (B-14).
                {
                  label: "Biaya layanan",
                  value: invoice.fee ? formatRupiah(invoice.fee.platformFee) : "—",
                },
                // R2 (audit ronde-2, butir #82): tanpa konteks tanggung-jawab
                // biaya, angka total di arsip abadi bisa disalah-tafsirkan.
                {
                  label: "Biaya ditanggung",
                  value:
                    FEE_RESPONSIBILITY_LABELS[invoice.order.feeResponsibility] ??
                    invoice.order.feeResponsibility ??
                    "—",
                },
              ]}
              onCopyNumber={(n) => void copy(n)}
              onDownload={() => void handleDownload(invoice.order.id, invoice.invoiceNumber)}
              onDownloadPdf={() => void handleDownloadPdf(invoice.order.id, invoice.invoiceNumber)}
              onShare={() => void handleShare(invoice)}
              downloading={exporting}
            />
            </View>
          ) : null}
        </Crossfade>
      </PullToRefresh>
    </Screen>
  )
}