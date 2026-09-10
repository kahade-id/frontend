import { Crossfade } from "@/components/ui/fade-in"
import { DetailLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Terima Order Link (GET /v1/orders/links/{token}).
 * Preview kartu + Terima (POST accept) / Tolak (POST cancel).
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, type OrderLink, userMessage } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { orderLinkStatus } from "@/lib/order-link-labels"
import { goBackOrNavigate } from "@/lib/navigation"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { OrderLinkPreviewCard } from "@/components/ui/order-link-preview-card"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { useToast } from "@/components/ui/toast"

export default function OrderLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [accepting, setAccepting] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declining, setDeclining] = useState(false)

  /**
   * `useApiQuery`, bukan rakitan useState/useEffect: request dibatalkan saat
   * layar di-unmount, `refreshing` terpisah dari `loading` (tarik-untuk-
   * menyegarkan tidak lagi mengganti preview dengan skeleton), dan error lewat
   * `userMessage(err)`. Mutasi status lokal setelah Terima/Tolak tetap ada,
   * lewat `setData` milik hook.
   */
  const query = useApiQuery<OrderLink>(
    `order-link:${token}`,
    (signal) => api.orders.getOrderLink(token, signal),
    Boolean(token),
  )
  const link = query.data

  const handleAccept = useCallback(async () => {
    if (!link) return
    setAccepting(true)
    try {
      await api.orders.acceptOrderLink(link.token)
      toast.show({
        title: "Order link diterima",
        description: "Pesanan berhasil dibuat.",
        tone: "success",
        duration: 4000,
      })
      query.setData((current) => (current ? { ...current, status: "ACCEPTED" } : current))
      if (link.orderId) router.replace(ROUTES.orderDetail(link.orderId))
    } catch (err: unknown) {
      toast.show({ title: "Gagal menerima tautan", description: userMessage(err), tone: "danger" })
    } finally {
      setAccepting(false)
    }
  }, [link, toast.show, router])

  const handleDecline = useCallback(async () => {
    if (!link) return
    setDeclining(true)
    try {
      await api.orders.cancelOrderLink(link.token)
      toast.show({ title: "Tautan ditolak", tone: "success", duration: 3000 })
      setDeclineOpen(false)
      query.setData((current) => (current ? { ...current, status: "CANCELLED" } : current))
    } catch (err: unknown) {
      toast.show({ title: "Gagal menolak tautan", description: userMessage(err), tone: "danger" })
      setDeclineOpen(false)
    } finally {
      setDeclining(false)
    }
  }, [link, toast.show])

  const active = link?.status === "ACTIVE"

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Order Link" />
      <PullToRefresh
        onRefresh={query.refresh}
        refreshing={query.refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <Crossfade loading={query.loading} skeleton={<DetailLoading />}>
          {query.error ? (
          <ErrorState
            title="Gagal memuat"
            description={query.error}
            onRetry={() => void query.reload()}
          />
        ) : link ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <OrderLinkPreviewCard
              creator={{
                name: link.creator?.fullName ?? `@${link.creator?.username ?? "—"}`,
                username: link.creator?.username,
                avatar: link.creator?.avatarUrl ?? undefined,
              }}
              creatorRole={link.role}
              title={link.title}
              description={link.description}
              orderType={link.orderType}
              orderValue={link.orderValue}
              deliveryDeadlineDays={link.deliveryDeadlineDays}
              feeResponsibility={link.feeResponsibility}
              status={orderLinkStatus(link.status)}
              expiresLabel={
                link.expiresAt ? `Berlaku hingga ${formatDateTime(link.expiresAt)}` : undefined
              }
              lockedToUsername={link.counterpartUsername ?? undefined}
              onAccept={active ? () => void handleAccept() : undefined}
              onDecline={active ? () => setDeclineOpen(true) : undefined}
              accepting={accepting}
            />
            {!active ? (
              <Button variant="secondary" onPress={() => goBackOrNavigate(ROUTES.home)}>
                Kembali
              </Button>
            ) : null}
            </View>
          ) : null}
        </Crossfade>
      </PullToRefresh>

      <Dialog
        title="Tolak tautan ini?"
        description="Pengirim akan melihat tautan sebagai dibatalkan."
        visible={declineOpen}
        destructive
        loading={declining}
        confirmLabel="Tolak"
        cancelLabel="Batal"
        onConfirm={() => void handleDecline()}
        onCancel={() => setDeclineOpen(false)}
        onRequestClose={() => setDeclineOpen(false)}
      />
    </Screen>
  )
}