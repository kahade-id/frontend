import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Beri Ulasan (POST /v1/ratings, orderId wajib).
 * Memakai <RatingForm> sistem: bintang + komentar, dipicu dari Detail Order
 * saat status COMPLETED.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import { tokens } from "@/lib/tokens"

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

  const [order, setOrder] = useState<Awaited<ReturnType<typeof api.orders.getOrder>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [value, setValue] = useState<RatingFormValue>({ stars: 0, comment: "" })
  const [submitting, setSubmitting] = useState(false)

  const fetchOrder = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.orders.getOrder(orderId)
      setOrder(res)
    } catch {
      setError("Order tidak ditemukan.")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void fetchOrder()
  }, [fetchOrder])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchOrder()
    setRefreshing(false)
  }, [fetchOrder])

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
        router.back()
      } catch {
        toast.show({ title: "Gagal mengirim ulasan", tone: "danger" })
        setSubmitting(false)
      }
    },
    [orderId, toast.show],
  )

  const counterpart = order?.myRole === "SELLER" ? order?.buyer : order?.seller

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Beri Ulasan" />
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
        ) : error || !order ? (
          <ErrorState
            title="Gagal memuat"
            description={error ?? "Order tidak ditemukan."}
            onRetry={() => void fetchOrder()}
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
      </PullToRefresh>
    </Screen>
  )
}
