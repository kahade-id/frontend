import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Order Link Saya (GET /v1/orders/links/my, paginated).
 *
 * Tiap tautan: <OrderLinkShareCard> (salin, bagikan via share sheet native,
 * batalkan bila masih ACTIVE, buka pesanan bila sudah ACCEPTED).
 *
 * Keputusan non-obvious:
 *   - Bagikan memakai `shareContent()` (lib/share) → share sheet OS; bila
 *     "unavailable" (web desktop) jatuh ke salin tautan + toast. Sebelumnya
 *     tombol Bagikan hanya menampilkan toast berisi URL.
 *   - URL fallback dibentuk `orderLinkUrl(token)` (lib/deeplinks) — tidak ada
 *     literal skema `kahade://` di layar.
 *   - Tone badge status: ACTIVE=success, ACCEPTED=info, EXPIRED=warning,
 *     CANCELLED=neutral — mengikuti §2.3 (semantic hanya untuk status).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { LinkSimple } from "phosphor-react-native"
import { router } from "expo-router"

import { api, type OrderLink, userMessage } from "@/lib/api"
import { useCopy } from "@/lib/clipboard"
import { orderLinkUrl } from "@/lib/deeplinks"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { shareContent } from "@/lib/share"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadMore, type LoadMoreStatus } from "@/components/ui/load-more"
import { OrderLinkShareCard } from "@/components/ui/order-link-share-card"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { orderLinkStatusMeta } from "@/lib/order-link-labels"
import { useToast } from "@/components/ui/toast"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

const PAGE_SIZE = 20

export default function OrderLinksScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copy } = useCopy()

  const [items, setItems] = useState<OrderLink[]>([])
  const [page, setPage] = useState(1)
  const [more, setMore] = useState<LoadMoreStatus>("idle")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<OrderLink | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const fetchLinks = useCallback(async (nextPage: number) => {
    if (nextPage === 1) {
      setLoading(true)
      setError(null)
    } else {
      setMore("loading")
    }
    try {
      const res = await api.orders.listMyOrderLinks({ page: nextPage, limit: PAGE_SIZE })
      const data = res.data ?? []
      setItems((prev) => (nextPage === 1 ? data : [...prev, ...data]))
      setPage(nextPage)
      const totalPages = res.meta?.totalPages
      setMore(
        totalPages != null
          ? nextPage >= totalPages
            ? "end"
            : "idle"
          : data.length < PAGE_SIZE
            ? "end"
            : "idle",
      )
    } catch (err) {
      if (nextPage === 1) setError(userMessage(err))
      else setMore("error")
    } finally {
      if (nextPage === 1) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchLinks(1)
  }, [fetchLinks])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchLinks(1)
    setRefreshing(false)
  }, [fetchLinks])

  const handleShare = useCallback(
    async (payload: { url: string; message: string }, title: string) => {
      const outcome = await shareContent({ message: payload.message, url: payload.url, title })
      if (outcome === "unavailable") {
        const ok = await copy(payload.url)
        toast.show({
          title: ok ? "Tautan disalin" : "Tidak bisa membagikan",
          description: ok
            ? "Berbagi tidak tersedia di perangkat ini; tempel tautan secara manual."
            : undefined,
          tone: ok ? "success" : "danger",
        })
      }
    },
    [copy, toast.show],
  )

  const handleCancel = useCallback(async () => {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await api.orders.cancelOrderLink(cancelTarget.token)
      setItems((prev) =>
        prev.map((l) => (l.token === cancelTarget.token ? { ...l, status: "CANCELLED" } : l)),
      )
      toast.show({ title: "Tautan dibatalkan", tone: "success" })
      setCancelTarget(null)
    } catch (err: unknown) {
      toast.show({
        title: "Gagal membatalkan tautan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setCancelling(false)
    }
  }, [cancelTarget, toast.show])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Order Link" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <ListLoading />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchLinks(1)} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={LinkSimple}
            title="Belum ada tautan"
            description="Buat order link dari layar buat transaksi, lalu bagikan ke lawan transaksi."
            action={
              <Button
                variant="secondary"
                fullWidth={false}
                onPress={() => router.push(ROUTES.createTransaction)}
              >
                Buat Tautan Baru
              </Button>
            }
          />
        ) : (
          <View accessible={false} className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Tautan saya" />
            {items.map((link) => {
              const url = link.url ?? orderLinkUrl(link.token)
              const status = orderLinkStatusMeta(link.status)
              return (
                <OrderLinkShareCard
                  key={link.token}
                  url={url}
                  title={link.title}
                  amount={link.orderValue}
                  orderCode={link.token}
                  status={status}
                  expiresLabel={
                    link.expiresAt ? `Berlaku hingga ${formatDateTime(link.expiresAt)}` : undefined
                  }
                  onCopy={(u) => {
                    void copy(u).then(
                      (ok) => ok && toast.show({ title: "Tautan disalin", tone: "success" }),
                    )
                  }}
                  onShare={
                    link.status === "ACTIVE"
                      ? (payload) => void handleShare(payload, link.title)
                      : undefined
                  }
                  onCancel={link.status === "ACTIVE" ? () => setCancelTarget(link) : undefined}
                  cancelling={cancelling && cancelTarget?.token === link.token}
                  onOpen={
                    link.status === "ACCEPTED" && link.orderId
                      ? () => router.push(ROUTES.orderDetail(link.orderId as string))
                      : () => router.push(ROUTES.orderLink(link.token))
                  }
                />
              )
            })}
            <LoadMore status={more} onLoadMore={() => void fetchLinks(page + 1)} hideEnd />
            <Button variant="secondary" onPress={() => router.push(ROUTES.createTransaction)}>
              Buat Tautan Baru
            </Button>
          </View>
        )}
      </PullToRefresh>

      <Dialog
        title="Batalkan tautan ini?"
        description="Tautan tidak bisa lagi diterima oleh siapa pun. Tindakan ini tidak dapat dibatalkan."
        visible={!!cancelTarget}
        destructive
        loading={cancelling}
        confirmLabel="Batalkan Tautan"
        cancelLabel="Kembali"
        onConfirm={() => void handleCancel()}
        onCancel={() => setCancelTarget(null)}
        onRequestClose={() => setCancelTarget(null)}
      />
    </Screen>
  )
}