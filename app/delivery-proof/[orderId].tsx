/**
 * Screen — Bukti pengiriman (GET /v1/orders/{orderId}/delivery-proof).
 * Tampilkan bukti terbaru; pembeli bisa konfirmasi / tolak (membuka sengketa).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Package } from "phosphor-react-native"

import { api, type Order } from "@/lib/api"
import type { DeliveryProof } from "@/lib/api/orders"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { DeliveryProofViewer, type DeliveryProofStatus, type DeliveryProofAttachment } from "@/components/ui/delivery-proof-viewer"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { useToast } from "@/components/ui/toast"

function toStatus(status: string): DeliveryProofStatus {
  if (status === "CONFIRMED") return "confirmed"
  if (status === "REJECTED") return "rejected"
  return "pending"
}

function toAttachments(p: DeliveryProof): DeliveryProofAttachment[] {
  const imgs: DeliveryProofAttachment[] = (p.fileUrls ?? []).map((uri) => ({ kind: "image", uri }))
  const pdfs: DeliveryProofAttachment[] = (p.linkUrls ?? []).map((uri) => ({
    kind: "pdf",
    uri,
    name: decodeURIComponent(uri.split("/").pop()?.split("?")[0] ?? "bukti.pdf"),
  }))
  return [...imgs, ...pdfs]
}

export default function DeliveryProofScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [order, setOrder] = useState<Order | null>(null)
  const [proofs, setProofs] = useState<DeliveryProof[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  const latest = useMemo(() => {
    if (proofs.length === 0) return null
    return [...proofs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  }, [proofs])

  const fetchAll = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    setError(null)
    try {
      const [o, ps] = await Promise.all([
        api.orders.getOrder(orderId),
        api.orders.listDeliveryProofs(orderId),
      ])
      setOrder(o ?? null)
      setProofs(ps ?? [])
    } catch {
      setError("Gagal memuat bukti pengiriman.")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const handleConfirm = useCallback(async () => {
    if (!latest) return
    setConfirming(true)
    try {
      await api.orders.confirmDelivery(orderId!, { proofId: latest.id })
      toast.show({ title: "Penerimaan dikonfirmasi", tone: "success", duration: 3000 })
      setConfirmOpen(false)
      await fetchAll()
    } catch {
      toast.show({ title: "Gagal mengonfirmasi penerimaan", tone: "danger" })
    } finally {
      setConfirming(false)
    }
  }, [latest, orderId, toast.show, fetchAll])

  const handleReject = useCallback(
    async (note: string) => {
      if (!latest) return
      setRejecting(true)
      try {
        await api.orders.rejectDelivery(orderId!, { note, proofId: latest.id })
        toast.show({ title: "Bukti ditolak, sengketa dibuka", tone: "danger", duration: 3000 })
        await fetchAll()
      } catch {
        toast.show({ title: "Gagal menolak bukti", tone: "danger" })
      } finally {
        setRejecting(false)
      }
    },
    [latest, orderId, toast.show, fetchAll],
  )

  const sellerName = order ? (order.seller.fullName ?? order.seller.username) : undefined

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Bukti Pengiriman" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={Package} title="Memuat bukti…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : !latest ? (
          <EmptyState icon={Package} title="Belum ada bukti pengiriman" />
        ) : (
          <View style={{ paddingTop: tokens.space[3] }}>
            <DeliveryProofViewer
              status={toStatus(latest.status)}
              attachments={toAttachments(latest)}
              sellerName={sellerName}
              note={latest.description}
              uploadedAtLabel={formatDateTime(latest.createdAt)}
              rejectionReason={latest.note ?? undefined}
              viewer={order?.myRole === "SELLER" ? "seller" : "buyer"}
              onConfirm={() => setConfirmOpen(true)}
              onReject={(note) => void handleReject(note)}
              confirming={confirming}
              rejecting={rejecting}
              onOpenAttachment={() => toast.show({ title: "Pratinjau lampiran" })}
            />
          </View>
        )}
      </PullToRefresh>

      <Dialog
        title="Konfirmasi penerimaan"
        description="Dana di escrow akan dilepas ke penjual. Pastikan barang sudah sesuai sebelum melanjutkan."
        visible={confirmOpen}
        loading={confirming}
        confirmLabel="Ya, terima"
        cancelLabel="Batal"
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirmOpen(false)}
        onRequestClose={() => setConfirmOpen(false)}
      />
    </Screen>
  )
}
