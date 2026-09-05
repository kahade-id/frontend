/**
 * Screen — Detail Order (GET /v1/orders/{id}).
 *
 * Menampilkan status, ringkasan, tenggat, diikuti aksi sesuai status peran
 * user (bayar + PIN, konfirmasi, proses, kirim, lengkap, perpanjang,
 * sengketa, bukti pengiriman, invoice) — semua endpoint lib/api/orders.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, type Order, type OrderStatus } from "@/lib/api"
import { formatDateTime, formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { Package } from "phosphor-react-native"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { InvoiceReceiptView } from "@/components/ui/invoice-receipt-view"
import { OrderHistoryTimeline } from "@/components/ui/order-history-timeline"
import { OrderStatusBadge } from "@/components/ui/order-status-badge"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { ShippingInfoCard } from "@/components/ui/shipping-info-card"
import { Text } from "@/components/ui/text"
import { PinInput } from "@/components/ui/pin-input"
import { useCopy } from "@/lib/clipboard"
import { useToast } from "@/components/ui/toast"

const ACTIVE_STATUSES: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "COMPLETED",
  "DISPUTED",
]

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Menunggu Pembayaran",
  PAID: "Dibayar",
  PROCESSING: "Diproses",
  SHIPPED: "Dikirim",
  DELIVERED: "Terkirim",
  COMPLETED: "Selesai",
  DISPUTED: "Sengketa",
  CANCELLED: "Dibatalkan",
  REFUNDED: "Dikembalikan",
  EXPIRED: "Kedaluwarsa",
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copied, copy } = useCopy()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.orders.getOrderHistory>>["data"]>([])
  const [fee, setFee] = useState<Awaited<ReturnType<typeof api.orders.calculateFee>> | null>(null)
  const [invoice, setInvoice] = useState<Awaited<ReturnType<typeof api.orders.getInvoice>> | null>(null)
  const [pinStep, setPinStep] = useState(false)
  const [pendingAction, setPendingAction] = useState<"pay" | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const fetchOrder = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [o, h, inv] = await Promise.all([
        api.orders.getOrder(id),
        api.orders.getOrderHistory(id, { page: 1, limit: 50 }),
        api.orders.getInvoice(id).catch(() => null),
      ])
      setOrder(o)
      setHistory(h?.data ?? [])
      setInvoice(inv)
      setFee(o.fee ?? null)
      if (["PENDING_PAYMENT", "PAID"].includes(o.status)) {
        try {
          const f = await api.orders.calculateFee({
            orderValue: o.orderValue,
            feeResponsibility: o.feeResponsibility,
            role: o.myRole ?? "BUYER",
          })
          setFee(f)
        } catch {
          // fee opsional
        }
      }
    } catch {
      setError("Gagal memuat detail order.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchOrder()
  }, [fetchOrder])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchOrder()
    setRefreshing(false)
  }, [fetchOrder])

  const handleConfirm = useCallback(async () => {
    if (!order) return
    setSubmitting(true)
    try {
      await api.orders.confirmOrder(order.id, { action: "ACCEPT" })
      toast.show({ title: "Order dikonfirmasi", tone: "success", duration: 3000 })
      setConfirmOpen(false)
      await fetchOrder()
    } catch {
      toast.show({ title: "Gagal mengonfirmasi order", tone: "danger" })
    } finally {
      setSubmitting(false)
    }
  }, [order, toast.show, fetchOrder])

  const handlePayPin = useCallback(async (pin: string) => {
    if (!order) return
    setSubmitting(true)
    try {
      await api.orders.payOrder(order.id, { pin })
      toast.show({ title: "Pembayaran berhasil", tone: "success", duration: 3000 })
      setPinStep(false)
      await fetchOrder()
    } catch {
      toast.show({ title: "Pembayaran gagal", description: "Periksa PIN dan saldo Anda.", tone: "danger" })
      setPinStep(false)
    } finally {
      setSubmitting(false)
    }
  }, [order, toast.show, fetchOrder])

  const handleProcess = useCallback(async () => {
    if (!order) return
    setSubmitting(true)
    try {
      await api.orders.processOrder(order.id)
      toast.show({ title: "Order mulai diproses", tone: "success", duration: 3000 })
      await fetchOrder()
    } catch {
      toast.show({ title: "Gagal memproses order", tone: "danger" })
    } finally {
      setSubmitting(false)
    }
  }, [order, toast.show, fetchOrder])

  const handleComplete = useCallback(async () => {
    if (!order) return
    setSubmitting(true)
    try {
      await api.orders.completeOrder(order.id)
      toast.show({ title: "Order selesai", tone: "success", duration: 3000 })
      await fetchOrder()
    } catch {
      toast.show({ title: "Gagal menyelesaikan order", tone: "danger" })
    } finally {
      setSubmitting(false)
    }
  }, [order, toast.show, fetchOrder])

  const handleCancel = useCallback(async () => {
    if (!order) return
    setSubmitting(true)
    try {
      await api.orders.cancelOrder(order.id, { reason: "MUTUAL_AGREEMENT" })
      toast.show({ title: "Order dibatalkan", tone: "success", duration: 3000 })
      setConfirmOpen(false)
      await fetchOrder()
    } catch {
      toast.show({ title: "Gagal membatalkan order", tone: "danger" })
    } finally {
      setSubmitting(false)
    }
  }, [order, toast.show, fetchOrder])

  if (loading && !order) {
    return (
      <Screen edges={["top"]}>
        <Header title="Detail Order" />
        <EmptyState icon={Package} title="Memuat order…" />
      </Screen>
    )
  }

  if (error && !order) {
    return (
      <Screen edges={["top"]}>
        <Header title="Detail Order" />
        <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchOrder()} />
      </Screen>
    )
  }

  if (!order) return null

  const myRole = order.myRole ?? "BUYER"
  const counterpart = myRole === "BUYER" ? order.seller : order.buyer
  const canPay = order.status === "PENDING_PAYMENT" && myRole === "BUYER"
  const canConfirm = order.status === "PENDING_PAYMENT" && myRole === "SELLER"
  const canProcess = order.status === "PAID" && myRole === "SELLER"
  const canComplete = (order.status === "SHIPPED" || order.status === "DELIVERED") && myRole === "BUYER"
  const canCancel = ACTIVE_STATUSES.includes(order.status)

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Detail Order" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <View className="gap-3" style={{ paddingTop: tokens.space[3] }}>
          <View className="flex-row items-center justify-between">
            <Text variant="monoBody" tone="secondary">{order.id}</Text>
            <OrderStatusBadge status={order.status} role={myRole === "BUYER" ? "buyer" : "seller"} size="md" labels={STATUS_LABELS} />
          </View>

          <SectionHeader title={order.title} />
          <Text variant="body" tone="secondary">{order.description}</Text>

          <View className="flex-row justify-between">
            <Text variant="label">Nilai</Text>
            <Text variant="monoBody">{formatRupiah(order.orderValue)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text variant="label">Lawan transaksi</Text>
            <Text variant="body" tone="secondary">@{counterpart.username}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text variant="label">Tenggat</Text>
            <Text variant="body" tone="secondary">
              {order.deliveryDeadlineAt ? formatDateTime(order.deliveryDeadlineAt) : `${order.deliveryDeadlineDays} hari`}
            </Text>
          </View>

          <ShippingInfoCard
            shipping={
              order.trackingNumber || order.courierName
                ? {
                    courierName: order.courierName ?? undefined,
                    trackingNumber: order.trackingNumber ?? undefined,
                  }
                : null
            }
            canEdit={myRole === "SELLER" && order.status === "PROCESSING"}
            onCopy={(v) => void copy(v)}
            copied={copied}
          />

          {invoice ? (
            <InvoiceReceiptView
              mode="invoice"
              number={invoice.invoiceNumber}
              status={{ label: STATUS_LABELS[order.status] ?? order.status, tone: "success" }}
              from={{ name: order.seller.fullName ?? `@${order.seller.username}` }}
              to={{ name: order.buyer.fullName ?? `@${order.buyer.username}` }}
              items={invoice.items.map((i) => ({ id: i.label, title: i.label, amount: i.amount }))}
              total={invoice.total}
              meta={[{ label: "Terbit", value: formatDateTime(invoice.issuedAt) }]}
            />
          ) : null}

          {history.length > 0 ? (
            <>
              <SectionHeader title="Riwayat" />
              <OrderHistoryTimeline
                entries={history.map((h) => ({
                  id: h.id,
                  toStatus: h.toStatus,
                  fromStatus: h.fromStatus ?? undefined,
                  actor: h.actorId ?? undefined,
                  note: h.note ?? undefined,
                  timestamp: formatDateTime(h.createdAt),
                }))}
                currentStatus={order.status}
                expectedNext={
                  order.status === "PENDING_PAYMENT"
                    ? { title: "Menunggu pembayaran" }
                    : undefined
                }
              />
            </>
          ) : null}

          <View className="gap-2">
            {canPay ? (
              <Button onPress={() => setPinStep(true)}>Bayar Sekarang</Button>
            ) : null}
            {canConfirm ? (
              <Button onPress={() => setConfirmOpen(true)}>Terima Order</Button>
            ) : null}
            {canProcess ? (
              <Button onPress={() => void handleProcess()}>Mulai Proses</Button>
            ) : null}
            {canComplete ? (
              <Button onPress={() => void handleComplete()}>Tandai Selesai</Button>
            ) : null}
            {canCancel ? (
              <Button variant="secondary" onPress={() => setConfirmOpen(true)} disabled={submitting}>
                Batalkan Order
              </Button>
            ) : null}
          </View>
        </View>
      </PullToRefresh>

      {pinStep ? (
        <View className="px-6 py-4">
          <SectionHeader title="Verifikasi PIN" />
          <PinInput mode="enter" onComplete={(p) => void handlePayPin(p)} disabled={submitting} />
          <Button variant="ghost" fullWidth={false} onPress={() => setPinStep(false)} disabled={submitting}>
            Batal
          </Button>
        </View>
      ) : null}

      <Dialog
        title={canConfirm ? "Terima order ini?" : "Batalkan order?"}
        description={
          canConfirm
            ? "Anda akan melanjutkan proses penyelesaian pesanan ini."
            : "Order akan dibatalkan dan dana dikembalikan ke pembeli."
        }
        visible={confirmOpen}
        tone={canConfirm ? "neutral" : "danger"}
        destructive={!canConfirm}
        loading={submitting}
        confirmLabel={canConfirm ? "Terima" : "Batalkan Order"}
        cancelLabel="Tutup"
        onConfirm={() => void (canConfirm ? handleConfirm() : handleCancel())}
        onCancel={() => setConfirmOpen(false)}
        onRequestClose={() => setConfirmOpen(false)}
      />
    </Screen>
  )
}
