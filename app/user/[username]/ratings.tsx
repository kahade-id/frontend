/**
 * Screen — Ulasan Publik (GET /v1/users/{username}/ratings).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Star } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { Rating } from "@/lib/api/ratings"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { RatingReviewCard, type RatingPerson } from "@/components/ui/rating-review-card"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"

export default function PublicRatingsScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const insets = useSafeAreaInsets()

  const [items, setItems] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!username) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.ratings.getPublicRatings(username)
      setItems(res ?? [])
    } catch {
      setError("Gagal memuat ulasan.")
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Ulasan" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={Star} title="Memuat ulasan…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : items.length === 0 ? (
          <EmptyState icon={Star} title="Belum ada ulasan" description="Ulasan pesanan akan muncul di sini." />
        ) : (
          <View className="gap-3" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title={`@${username}`} />
            {items.map((r) => {
              const reviewer: RatingPerson = {
                name: r.authorUsername ?? "Pengguna",
                avatar: r.authorAvatarUrl ?? undefined,
              }
              return (
                <RatingReviewCard
                  key={r.id}
                  stars={r.stars}
                  comment={r.comment ?? undefined}
                  reviewer={reviewer}
                  date={r.createdAt}
                  orderId={r.orderId}
                  reply={
                    r.reply
                      ? {
                          id: `reply-${r.id}`,
                          content: r.reply,
                          by: { name: `@${username}` },
                          role: "seller",
                          date: r.createdAt,
                        }
                      : undefined
                  }
                  commentLines={undefined}
                />
              )
            })}
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
