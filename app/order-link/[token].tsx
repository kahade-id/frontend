/**
 * Screen — Terima Order Link (GET /v1/orders/links/{token}).
 * Preview kartu + Terima (POST accept) / Tolak (POST cancel).
 */

import { Crossfade } from "@/components/ui/fade-in"
import { DetailLoading } from "@/components/ui/paginated-list"
import { useCallback, useMemo, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, isApiError, type OrderLink } from "@/lib/api"
import { showMutationError } from "@/lib/mutation-toast"
import { formatDateTimeWIB } from "@/lib/format"
import { useHasSession } from "@/lib/guest-gate"
import { orderLinkStatus } from "@/lib/order-link-labels"
import { goBackOrNavigate } from "@/lib/navigation"
import { toEpochMs } from "@/lib/pending-actions"
import { ROUTES } from "@/lib/routes"
import { serverNow } from "@/lib/server-time"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"

import { Alert } from "@/components/ui/alert"
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
        // R2 (audit ronde-2, butir #71): cadangan `getOrderLink` HANYA untuk
        // "preview publik tidak tersedia" (404 rute deeplink nonaktif).
        // Gagal SEMENTARA (jaringan/timeout/5xx) dipermukaan sebagai error
        // fetcher — layar menampilkan status galat + Coba lagi, bukan
        // menjemput dua kali dan mengganti narasi layar.
        if (isApiError(err) && (err.isTransient || (err.status != null && err.status >= 500))) {
          throw err
        }
        return api.orders.getOrderLink(token, signal)
      }),
    Boolean(token),
  )
  const link = query.data

  // R2 (audit ronde-2, butir #73): pembuat tautan tidak boleh menerima
  // tautannya sendiri — hindari 422 server dengan tombol mati + penjelasan.
  // R2 (audit ronde-2, butir #69): layar ini sengaja PUBLIK (preview
  // auth:"none" + rute diizinkan tamu). Cek "tautan milikku" (#73) butuh sesi
  // — tanpa sesi query tidak ditembak (hindari 401 di jalur tamu).
  const hasSession = useHasSession()
  const meQuery = useApiQuery(
    "me:self-check",
    (signal) => api.users.getMeCached(signal),
    hasSession,
  )
  const isOwnLink =
    link != null &&
    meQuery.data != null &&
    ((link.creator?.id != null && link.creator.id === meQuery.data.id) ||
      (link.creator?.username != null &&
        meQuery.data.username != null &&
        link.creator.username.toLowerCase() === meQuery.data.username.toLowerCase()))

  // R2 (audit ronde-2, butir #72): kedaluwarsa dicek SEBELUM panggil API —
  // tombol Terima pada tautan kedaluwarsa menghasilkan 409 teknis; kini
  // dihentikan klien dengan pesan manusiawi (status server tetap otoritatif).
  const isExpiredLocally = useMemo(() => {
    if (!link?.expiresAt) return false
    const ms = toEpochMs(link.expiresAt)
    return ms != null && ms <= serverNow()
  }, [link?.expiresAt, link])

  const handleAccept = useCallback(async () => {
    if (!link) return
    // R2 (audit ronde-2, butir #69): tamu publik yang menekan Terima dialihkan
    // ke login — setelah masuk, kembali ke tautan ini (next-path).
    if (!hasSession) {
      router.push(ROUTES.loginRequired(`/order-link/${encodeURIComponent(link.token)}`))
      return
    }
    // R2 (butir #72): tautan yang kedaluwarsa tidak boleh ditembak ke server.
    if (isExpiredLocally) {
      toast.show({
        title: "Tautan sudah kedaluwarsa",
        description: "Minta tautan baru kepada pembuat order.",
        tone: "warning",
      })
      return
    }
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
      // R2 (audit ronde-2, butir #13): accept dapat MEMBUAT ORDER — toast tunai
      // kontradiktif pada respons hilang; muat ulang preview untuk situasi
      // kenyataan (status ACTED/ sudah orderId) sebelum dicoba lagi.
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal menerima tautan",
          uncertainHint: "Tautan mungkin sudah diterima — memuat ulang…",
          uncertainDetail: "Pesanan bisa sudah dibuat — periksa status tautan / daftar transaksi.",
          err,
        })
      ) {
        void query.refresh().catch(() => {})
      }
    } finally {
      setAccepting(false)
    }
  }, [link, isExpiredLocally, toast.show, router, query])

  const handleDecline = useCallback(async () => {
    if (!link) return
    if (isExpiredLocally) {
      toast.show({ title: "Tautan sudah kedaluwarsa", tone: "warning" })
      return
    }
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
      // R2 (audit ronde-2, butir #14): respons hilang ≠ penolakan batal.
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal menolak tautan",
          uncertainHint: "Penolakan mungkin sudah diproses — memuat ulang…",
          err,
        })
      ) {
        void query.refresh().catch(() => {})
      }
      setDeclineOpen(false)
    } finally {
      setDeclining(false)
    }
  }, [link, isExpiredLocally, toast.show, query])

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
              onAccept={active && !isOwnLink && !isExpiredLocally ? () => void handleAccept() : undefined}
              onDecline={
                active && !isOwnLink && !isExpiredLocally
                  ? () => {
                      if (!hasSession) {
                        router.push(ROUTES.loginRequired(`/order-link/${encodeURIComponent(link.token)}`))
                        return
                      }
                      setDeclineOpen(true)
                    }
                  : undefined
              }
              accepting={accepting}
            />
            {active && isOwnLink ? (
              // R2 (butir #73): kreator membuka tautannya sendiri (mis. dari
              // riwayat berbagi) — jangan biarkan menghadapi 422 server.
              <Alert
                tone="warning"
                title="Ini tautan buatan Anda"
              >
                Bagikan tautan ke lawan transaksi — tautan hanya bisa diterima oleh akun lain.
              </Alert>
            ) : null}
            {active && !isOwnLink && isExpiredLocally ? (
              // R2 (butir #72): #72 — kedaluwarsa diputuskan klien lebih dulu
              // agar tidak ada 409 teknis yang membingungkan.
              <Alert
                tone="warning"
                title="Tautan sudah kedaluwarsa"
              >
                Minta tautan baru kepada pembuat order untuk melanjutkan.
              </Alert>
            ) : null}
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