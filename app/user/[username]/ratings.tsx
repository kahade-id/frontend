import { LoadingScreen } from "@/components/ui/loading-screen"
/**
 * Screen — Ulasan Publik.
 *   GET /v1/users/{username}/ratings?page&limit&filter (semua REQUIRED).
 *   `filter` tanpa enum di spec → chip Semua/Positif/Negatif/Berkomentar
 *   (nilai asumsi, lihat lib/api/ratings.ts). Paginasi PAGE_SIZE 20 + LoadMore;
 *   respons array|{data,meta} via readMyRatings.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Star } from "phosphor-react-native"

import { api } from "@/lib/api"
import { readMyRatings, type PublicRatingFilter, type Rating } from "@/lib/api/ratings"
import { tokens } from "@/lib/tokens"

import { Chip } from "@/components/ui/chip"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadMore } from "@/components/ui/load-more"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { RatingReviewCard, type RatingPerson } from "@/components/ui/rating-review-card"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"

const PAGE_SIZE = 20
const FILTERS: { value: PublicRatingFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "positive", label: "Positif" },
  { value: "negative", label: "Negatif" },
  { value: "with_comment", label: "Berkomentar" },
]

export default function PublicRatingsScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const insets = useSafeAreaInsets()

  const [filter, setFilter] = useState<PublicRatingFilter>("all")
  const [items, setItems] = useState<Rating[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPage = useCallback(
    async (p: number) => {
      if (!username) return
      const body = await api.ratings.getPublicRatings(username, {
        page: p,
        limit: PAGE_SIZE,
        filter,
      })
      const { items: data, totalPages } = readMyRatings(body)
      setItems((prev) => (p === 1 ? data : [...prev, ...data]))
      setPage(p)
      setHasMore(typeof totalPages === "number" ? p < totalPages : data.length >= PAGE_SIZE)
    },
    [username, filter],
  )

  const fetchAll = useCallback(async () => {
    if (!username) return
    setLoading(true)
    setError(null)
    try {
      await fetchPage(1)
    } catch {
      setError("Gagal memuat ulasan.")
    } finally {
      setLoading(false)
    }
  }, [username, fetchPage])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      await fetchPage(page + 1)
    } catch {
      // gagal memuat halaman berikutnya: biarkan tombol untuk coba lagi
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, fetchPage, page])

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
      <View className="flex-row flex-wrap gap-2 px-6" style={{ paddingTop: tokens.space[3] }}>
        {FILTERS.map((f) => (
          <Chip key={f.value} selected={filter === f.value} onPress={() => setFilter(f.value)}>
            {f.label}
          </Chip>
        ))}
      </View>
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <LoadingScreen message="Memuat ulasan…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Star}
            title="Belum ada ulasan"
            description="Ulasan pesanan akan muncul di sini."
          />
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
            <LoadMore
              status={loadingMore ? "loading" : hasMore ? "idle" : "end"}
              onLoadMore={() => void handleLoadMore()}
              hideEnd
            />
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
