/**
 * Screen — Invoice (GET /v1/orders/{orderId}/invoice + receipt HTML).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import type { Invoice } from "@/lib/api/orders"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FileText } from "phosphor-react-native"
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

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchInvoice = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.orders.getInvoice(orderId)
      setInvoice(res)
    } catch {
      setError("Invoice tidak ditemukan.")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void fetchInvoice()
  }, [fetchInvoice])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchInvoice()
    setRefreshing(false)
  }, [fetchInvoice])

  const handleDownload = useCallback(
    async (orderId: string) => {
      try {
        await api.orders.getReceiptHtml(orderId)
        toast.show({ title: "Struk siap diunduh", description: "File HTML diterima dari server.", tone: "success", duration: 3000 })
      } catch {
        toast.show({ title: "Gagal mengunduh struk", tone: "danger" })
      }
    },
    [toast.show],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Invoice" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={FileText} title="Memuat invoice…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchInvoice()} />
        ) : invoice ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <InvoiceReceiptView
              mode="invoice"
              number={invoice.invoiceNumber}
              status={{ label: "Terverifikasi", tone: "success" }}
              from={{ name: invoice.order.seller.fullName ?? `@${invoice.order.seller.username}` }}
              to={{ name: invoice.order.buyer.fullName ?? `@${invoice.order.buyer.username}` }}
              items={invoice.items.map((i, idx) => ({ id: `${invoice.invoiceNumber}-${idx}`, title: i.label, amount: i.amount }))}
              total={invoice.total}
              meta={[
                { label: "Terbit", value: formatDateTime(invoice.issuedAt) },
                { label: "Order", value: invoice.order.id },
              ]}
              onCopyNumber={(n) => void copy(n)}
              onDownload={() => void handleDownload(invoice.order.id)}
            />
            <Button variant="ghost" fullWidth={false} onPress={() => void handleDownload(invoice.order.id)}>
              Unduh Struk (HTML)
            </Button>
            {copied ? (
              <Button variant="ghost" fullWidth={false} disabled>Nomor invoice disalin</Button>
            ) : null}
          </View>
        ) : null}
      </PullToRefresh>
    </Screen>
  )
}
