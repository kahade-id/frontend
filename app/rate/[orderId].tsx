/**
 * Screen — Beri Ulasan (POST /v1/ratings, orderId wajib).
 * Memakai <RatingForm> sistem: bintang + komentar, dipicu dari Detail Order
 * saat status COMPLETED.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Star } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import { readMyRatings } from "@/lib/api/ratings"
import { goBackOrNavigate } from "@/lib/navigation"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"

import { Crossfade } from "@/components/ui/fade-in"
import { DetailLoading } from "@/components/ui/paginated-list"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { RatingForm, type RatingFormValue } from "@/components/ui/rating-form"
import { Screen } from "@/components/ui/screen"
import { useToast } from "@/components/ui/toast"

export default function RateOrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  /**
   * Audit: state async dirakit manual. Cacat terbukti dari kode lama:
   * `handleRefresh` memanggil `fetchOrder()` yang sama dengan muat-awal, dan
   * fungsi itu membuka dengan `setLoading(true)` — jadi tarik-untuk-menyegarkan
   * mengganti form ulasan dengan kerangka. Request juga tidak dibatalkan saat
   * layar ditutup (AbortSignal sekarang diteruskan ke adapter).
   */
  const query = useApiQuery<Awaited<ReturnType<typeof api.orders.getOrder>>>(
    `rate-order:${orderId}`,
    (signal) => api.orders.getOrder(orderId as string, signal),
    Boolean(orderId),
  )
  const order = query.data
  const { loading, error, refreshing } = query
  const [value, setValue] = useState<RatingFormValue>({ stars: 0, comment: "" })
  const [submitting, setSubmitting] = useState(false)



  const handleSubmit = useCallback(
    async (v: RatingFormValue) => {
      if (!orderId) return
      setSubmitting(true)
      try {
        await api.ratings.createRating({
          orderId,
          stars: v.stars,
          comment: v.comment.trim() || undefined,
        })
        toast.show({ title: "Ulasan terkirim", tone: "success", duration: 3000 })
        goBackOrNavigate(ROUTES.orderDetail(orderId))
      } catch (err: unknown) {
        toast.show({
          title: "Gagal mengirim ulasan",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        // M-50 (audit end-to-end, issue #69): `setSubmitting(false)` di `finally`
        // — dulu hanya di `catch`; jalur sukses mengandalkan unmount yang tidak
        // terjadi bila navigasi tertahan.
        setSubmitting(false)
      }
    },
    [orderId, toast.show],
  )

  const counterpart = order?.myRole === "SELLER" ? order?.buyer : order?.seller

  /**
   * M-51 (audit end-to-end, issue #68): dedupe LEWAT daftar ulasan milik user
   * (`getMyRatings`) — flag `rated`/`isRated` di payload order tidak selalu
   * dikirim backend; tanpa jalur kedua ini pengguna tetap bisa mengirim ulasan
   * dua kali saat flag hilang. Gagal memuat daftar = biarkan flag order yang
   * memutuskan (jangan menghalangi user karena jaringan).
   */
  const [ratedByList, setRatedByList] = useState<boolean | null>(null)
  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    void api.ratings
      .getMyRatings({ page: 1, limit: 50 })
      .then((res) => {
        if (cancelled) return
        // Bentuk respons my-ratings beragam (array polos / {data} / {given,
        // received}) — `readMyRatings` yang menyatukan, bukan akses `.data`
        // langsung yang nihil untuk bentuk array.
        const rows = readMyRatings(res).items as Array<{ orderId?: unknown }>
        setRatedByList(rows.some((r) => r.orderId === orderId))
      })
      .catch(() => {
        if (!cancelled) setRatedByList(null)
      })
    return () => {
      cancelled = true
    }
  }, [orderId])
  const alreadyRated =
    Boolean((order as { rated?: boolean } | null)?.rated) ||
    Boolean((order as { isRated?: boolean } | null)?.isRated) ||
    ratedByList === true

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Beri Ulasan" />
      <PullToRefresh
        onRefresh={() => void query.refresh()}
        refreshing={refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <Crossfade loading={loading} skeleton={<DetailLoading />}>
          {error || !order ? (
          <ErrorState
            title="Gagal memuat"
            description={error ?? "Order tidak ditemukan."}
            onRetry={() => void query.reload()}
          />
        ) : order.status !== "COMPLETED" ? (
          // H-07 (audit escrow 2026-09-24): form ulasan hanya untuk pesanan
          // BERSTATUS COMPLETED — dulu bisa dibuka untuk status apa pun dan
          // ditolak server setelah diketik.
          <EmptyState
            icon={Star}
            title="Pesanan belum selesai"
            description="Ulasan hanya bisa diberikan setelah pesanan berstatus selesai."
          />
        ) : alreadyRated ? (
          // H-07 + M-51: satu order satu ulasan — flag order ATAU daftar
          // ulasan milik user (yang mana pun terbaca) mematikan form kedua.
          <EmptyState
            icon={Star}
            title="Sudah dinilai"
            description="Anda sudah memberi ulasan untuk pesanan ini."
          />
        ) : (
          <View style={{ paddingTop: tokens.space[3] }}>
            <RatingForm
              value={value}
              onChange={setValue}
              onSubmit={(v) => void handleSubmit(v)}
              submitting={submitting}
              counterpart={{
                name: counterpart?.fullName ?? counterpart?.username ?? "Lawan transaksi",
                avatar: counterpart?.avatarUrl ?? undefined,
                role: order.myRole === "SELLER" ? "buyer" : "seller",
              }}
              orderTitle={order.title}
            />
            </View>
          )}
        </Crossfade>
      </PullToRefresh>
    </Screen>
  )
}
