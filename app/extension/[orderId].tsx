/**
 * Screen — Perpanjangan tenggat (GET /v1/orders/{orderId}/extensions).
 * Daftar kronologis permintaan; penanggap (pembeli) setujui/tolak via Dialog.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Clock } from "phosphor-react-native"

import { api, type Order } from "@/lib/api"
import type { OrderExtension } from "@/lib/api/orders"
import { addDays, OrderExtensionCard } from "@/components/ui/order-extension-card"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

type Action = { kind: "APPROVE" | "REJECT"; extension: OrderExtension } | null

export default function ExtensionScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderExtension[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [action, setAction] = useState<Action>(null)
  const [actionNote, setActionNote] = useState("")
  const [busy, setBusy] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    setError(null)
    try {
      const [o, res] = await Promise.all([
        api.orders.getOrder(orderId),
        api.orders.listExtensions(orderId, { page: 1, limit: 50 }),
      ])
      setOrder(o ?? null)
      setItems(res?.data ?? [])
    } catch {
      setError("Gagal memuat permintaan perpanjangan.")
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

  const openAction = useCallback((kind: "APPROVE" | "REJECT", ext: OrderExtension) => {
    setAction({ kind, extension: ext })
    setActionNote("")
  }, [])

  const submitAction = useCallback(async () => {
    if (!action || !orderId) return
    setBusy(true)
    try {
      await api.orders.respondExtension(orderId, action.extension.id, {
        action: action.kind,
        note: actionNote.trim() || undefined,
      })
      toast.show({
        title: action.kind === "APPROVE" ? "Perpanjangan disetujui" : "Perpanjangan ditolak",
        tone: action.kind === "APPROVE" ? "success" : "neutral",
        duration: 3000,
      })
      setAction(null)
      await fetchAll()
    } catch {
      toast.show({ title: "Gagal memproses permintaan", tone: "danger" })
    } finally {
      setBusy(false)
    }
  }, [action, orderId, actionNote, toast.show, fetchAll])

  // Permintaan perpanjangan diajukan penjual; atur tanggal tenggat dari order.
  const deadline = useMemo(() => {
    if (!order) return new Date()
    return order.deliveryDeadlineAt ?? addDays(order.createdAt, order.deliveryDeadlineDays)
  }, [order])

  const requestedByMe = order?.myRole === "SELLER"
  const requesterName = order ? (order.seller.fullName ?? order.seller.username) : undefined

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Perpanjangan Tenggat" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={Clock} title="Memuat permintaan…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Belum ada permintaan"
            description="Permintaan perpanjangan tenggat akan tercatat di sini."
          />
        ) : (
          <View className="gap-3" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title={`${items.length} permintaan`} />
            {items.map((ext) => {
              const pending = ext.status === "PENDING"
              const canRespond = pending && !requestedByMe && order?.myRole !== "SELLER"
              return (
                <OrderExtensionCard
                  key={ext.id}
                  extensionDays={ext.extensionDays}
                  currentDeadline={deadline}
                  reason={ext.reason}
                  status={ext.status}
                  requestedByMe={requestedByMe}
                  requesterName={requesterName}
                  requesterAvatar={order?.seller.avatarUrl ?? undefined}
                  responseNote={ext.note ?? undefined}
                  requestedAt={formatDateTime(ext.createdAt)}
                  onApprove={canRespond ? () => openAction("APPROVE", ext) : undefined}
                  onReject={canRespond ? () => openAction("REJECT", ext) : undefined}
                />
              )
            })}
          </View>
        )}
      </PullToRefresh>

      <Dialog
        title={action?.kind === "APPROVE" ? "Setujui perpanjangan?" : "Tolak perpanjangan?"}
        description={
          action?.kind === "APPROVE"
            ? "Tenggat pengiriman akan diperpanjang dan dana tetap di escrow."
            : "Tenggat pengiriman tidak berubah. Beri tahu penjual alasannya."
        }
        visible={!!action}
        loading={busy}
        destructive={action?.kind === "REJECT"}
        confirmLabel={action?.kind === "APPROVE" ? "Setujui" : "Tolak"}
        cancelLabel="Batal"
        onConfirm={() => void submitAction()}
        onCancel={() => setAction(null)}
        onRequestClose={() => setAction(null)}
      >
        <TextArea
          value={actionNote}
          onChangeText={setActionNote}
          placeholder="Catatan untuk penjual (opsional)…"
          maxLength={500}
        />
      </Dialog>
    </Screen>
  )
}
