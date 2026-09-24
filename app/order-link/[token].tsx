/**
 * Screen — Terima Order Link (GET /v1/orders/links/{token}).
 * Preview kartu + Terima (POST accept) / Tolak (POST cancel).
 */

import { Crossfade } from "@/components/ui/fade-in"
import { DetailLoading } from "@/components/ui/paginated-list"
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, isApiError, type OrderLink, userMessage } from "@/lib/api"
import { formatDateTimeWIB } from "@/lib/format"
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
    // M-38 (audit end-to-end, issue #27/#28): pratinjau `previewOrderLink`
    // (deeplink publik `auth:"none"`, F-01) adalah pintu UTAMA — dulu layar
    // memanggil `getOrderLink` (auth) terus sehingga fungsi publik MATI dan
    // penerima tanpa sesi tidak bisa memuat halaman sama sekali. `getOrderLink`
    // tetap cadangan bila deeplink nonaktif di server.
    (signal) =>
      api.orders.previewOrderLink(token, signal).catch((err: unknown) => {
        if (isApiError(err) && err.code === "ABORTED") throw err
        return api.orders.getOrderLink(token, signal)
      }),
    Boolean(token),
  )
  const link = query.data

  const handleAccept = useCallback(async () => {
    if (!link) return
    setAccepting(true)
    try {
      const order = await api.orders.acceptOrderLink(link.token)
      toast.show({
        title: "Order link diterima",
        description: "Pesanan berhasil dibuat.",
        tone: "success",
        duration: 4000,
      })
      query.setData((current) => (current ? { ...current, status: "ACCEPTED", orderId: order?.id ?? current.orderId } : current))
      const targetOrderId = order?.id ?? link.orderId
      if (targetOrderId) {
        router.replace(ROUTES.orderDetail(targetOrderId))
      } else {
        // F-04 (audit escrow 2026-09-24): respons tanpa `id` tidak membentuk
        // rute telanjang — arahkan ke daftar transaksi tempat pesanan baru muncul.
        router.replace(ROUTES.transactions)
      }
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
      // M-37 (audit end-to-end, issue #30): hasil `cancelOrderLink` (D-12)
      // dipakai — dulu dibuang dan status dipaksa "CANCELLED" + toast "Tautan
      // ditolak" apa pun jawaban server.
      const res = await api.orders.cancelOrderLink(link.token)
      const confirmed = (res.status ?? "CANCELLED") as OrderLink["status"]
      query.setData((current) => (current ? { ...current, status: confirmed } : current))
      toast.show({
        title: confirmed === "CANCELLED" ? "Tautan ditolak" : "Penolakan dikirim",
        description:
          confirmed === "CANCELLED" ? undefined : "Server melaporkan status lain — periksa tautan.",
        tone: confirmed === "CANCELLED" ? "success" : "info",
        duration: 3000,
      })
      setDeclineOpen(false)
    } catch (err: unknown) {
      toast.show({ title: "Gagal menolak tautan", description: userMessage(err), tone: "danger" })
      setDeclineOpen(false)
    } finally {
      setDeclining(false)
    }
  }, [link, toast.show])

  // M-39 (audit end-to-end, issue #32): status ASING/tak dikenal tidak diam-diam
  // menghilangkan tombol Terima/Tolak — hanya status final yang pasti yang
  // mematikannya; selain itu tawarkan aksi + tombol muat ulang sudah ada di
  // PullToRefresh.
  const KNOWN_FINAL: ReadonlySet<string> = new Set([
    "ACCEPTED",
    "CANCELLED",
    "EXPIRED",
    "COMPLETED",
    "USED",
    "REJECTED",
  ])
  const active =
    link != null && (link.status === "ACTIVE" || !KNOWN_FINAL.has(link.status))

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Order Link" />
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
                link.expiresAt ? `Berlaku hingga ${formatDateTimeWIB(link.expiresAt)}` : undefined
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