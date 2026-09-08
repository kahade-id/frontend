import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Ulasan Publik.
 *   GET /v1/users/{username}/ratings?page&limit&filter.
 *   Production menerima Semua (filter dihilangkan), Positif, Netral, atau
 *   Negatif. Paginasi PAGE_SIZE 20 + LoadMore;
 *   respons array|{data,meta} via readMyRatings.
 */
import { useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Star } from "phosphor-react-native"

import { api } from "@/lib/api"
import { readMyRatings, type PublicRatingFilter, type Rating } from "@/lib/api/ratings"
import { tokens } from "@/lib/tokens"
import { usePaginatedQuery } from "@/lib/use-paginated-query"

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
  { value: "neutral", label: "Netral" },
  { value: "negative", label: "Negatif" },
]

export default function PublicRatingsScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const insets = useSafeAreaInsets()

  const [filter, setFilter] = useState<PublicRatingFilter>("all")

  /**
   * `usePaginatedQuery`, bukan rakitan manual page/hasMore/loadingMore.
   * Yang sebelumnya hilang dan sekarang ditangani hook:
   *   - ganti filter membatalkan request halaman lama (respons lambat tidak
   *     bisa menimpa hasil filter baru);
   *   - "muat lagi" single-flight, dan baris yang sudah ada TETAP tampil saat
   *     halaman berikutnya gagal;
   *   - `refreshing` terpisah dari `loading` sehingga tarik-untuk-menyegarkan
   *     tidak lagi mengosongkan daftar.
   * Fallback `totalPages` meniru logika lama: bila backend tidak mengirimnya,
   * halaman penuh dianggap masih punya lanjutan.
   */
  const query = usePaginatedQuery<Rating>(
    `public-ratings:${username}:${filter}`,
    async (page, signal) => {
      // `usePaginatedQuery` tidak punya `enabled`, jadi guard `!username`
      // (pengganti `if (!username) return` versi lama) pindah ke sini —
      // tanpa ini fetcher akan menembak /v1/users/undefined/ratings.
      if (!username) return { data: [], meta: { page, limit: PAGE_SIZE, totalPages: page } }
      const body = await api.ratings.getPublicRatings(
        username,
        { page, limit: PAGE_SIZE, ...(filter === "all" ? {} : { filter }) },
        signal,
      )
      const { items, totalPages } = readMyRatings(body)
      return {
        data: items,
        meta: {
          page,
          limit: PAGE_SIZE,
          totalPages: totalPages ?? (items.length >= PAGE_SIZE ? page + 1 : page),
        },
      }
    },
  )
  const items = query.data

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
        onRefresh={query.refresh}
        refreshing={query.refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {query.loading ? (
          <ListLoading />
        ) : query.error ? (
          <ErrorState
            title="Gagal memuat"
            description={query.error}
            onRetry={() => void query.reload()}
          />
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
              status={
                query.loadMoreError
                  ? "error"
                  : query.loadingMore
                    ? "loading"
                    : query.hasMore
                      ? "idle"
                      : "end"
              }
              onLoadMore={() => void query.loadMore()}
              hideEnd
            />
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}