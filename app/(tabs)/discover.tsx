/**
 * Screen — Jelajahi. Dua tab:
 *   - "Pengguna" (GET /v1/users/discover): rekomendasi pengguna + follow.
 *   - "Showcase" (GET /v1/showcase/feed): feed item showcase publik,
 *     cursor/keyset-based, dengan filter urutan (Terbaru/Populer) + pencarian.
 *
 * Keputusan non-obvious:
 *   - Feed showcase memakai PAGINASI CURSOR (keyset) — bukan page/offset
 *     seperti tab Pengguna. `nextCursor` dari respons diteruskan ke halaman
 *     berikutnya; `hasMore=false` = feed habis. offset di feed yang terus
 *     bertambah menghasilkan duplikat/lompatan (dijelaskan DTO backend).
 *   - Perubahan `sort`/`search` mereset feed ke halaman 1 (kursor lama dari
 *     sort lain tidak valid). Pencarian di-debounce (useDebouncedValue) agar
 *     tidak menembak API tiap ketikan.
 *   - Tab Pengguna tetap memakai usePaginatedQuery (offset aman di daftar
 *     statis); hanya feed yang perlu cursor.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Compass, Images, UsersThree } from "phosphor-react-native"
import { router } from "expo-router"

import { api, userMessage } from "@/lib/api"
import type { DiscoveredUser } from "@/lib/api/users"
import {
  getShowcaseFeed,
  type ShowcaseFeedSort,
  type ShowcaseSocialItem,
} from "@/lib/api/showcase"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { usePaginatedQuery } from "@/lib/use-paginated-query"

import { Chip } from "@/components/ui/chip"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { Icon } from "@/components/ui/icon"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { ShowcaseFeedItem } from "@/components/ui/showcase-feed-item"
import { UserDiscoverResultItem } from "@/components/ui/user-discover-result-item"
import { useToast } from "@/components/ui/toast"

const PAGE_LIMIT = 20
const FEED_LIMIT = 20

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets()

  return (
    <Screen edges={["top"]} padded={false}>
      <Header showBack={false} title="Temukan pengguna" left={<Icon icon={UsersThree} size="md" tone="active" />} />
      <UsersTab bottomPadding={insets.bottom + tokens.space[8]} />
    </Screen>
  )
}

// ------------------------------------------------------------------
// Tab Pengguna (offset — daftar statis)
// ------------------------------------------------------------------

export function UsersTab({ bottomPadding }: { bottomPadding: number }) {
  const toast = useToast()
  const query = usePaginatedQuery<DiscoveredUser>("discover", (page, signal) =>
    api.users.discoverUsers({ page, limit: PAGE_LIMIT }, signal),
  )
  const { setData } = query
  const [pendingId, setPendingId] = useState<string | null>(null)

  const handleFollowToggle = useCallback(
    async (user: DiscoveredUser, following: boolean) => {
      setPendingId(user.id)
      const apply = (value: boolean) =>
        setData((prev) => prev.map((u) => (u.id === user.id ? { ...u, following: value } : u)))
      apply(following)
      try {
        if (following) await api.users.followUser(user.username)
        else await api.users.unfollowUser(user.username)
      } catch (err) {
        apply(!following)
        toast.show({
          title: "Gagal memperbarui status ikuti",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setPendingId(null)
      }
    },
    [setData, toast.show],
  )

  return (
    <PaginatedList
      {...query}
      onRefresh={query.refresh}
      onRetry={query.reload}
      onLoadMore={query.loadMore}
      gap={0}
      bottomPadding={bottomPadding}
      empty={
        <EmptyState
          icon={Compass}
          title="Belum ada rekomendasi"
          description="Pengguna yang disarankan untuk Anda akan muncul di sini."
        />
      }
      renderItem={({ item, index }) => (
        <UserDiscoverResultItem
          name={item.fullName ?? item.username}
          handle={`@${item.username}`}
          avatar={item.avatarUrl ?? undefined}
          verified={item.verified}
          transactionCount={item.transactionCount}
          rating={item.rating}
          onPress={() => router.push(ROUTES.userProfile(item.username))}
          follow={{
            following: !!item.following,
            loading: pendingId === item.id,
            onToggle: (next) => void handleFollowToggle(item, next),
          }}
          divider={index < query.data.length - 1}
        />
      )}
    />
  )
}

// ------------------------------------------------------------------
// Tab Showcase (cursor/keyset)
// ------------------------------------------------------------------

export function ShowcaseFeedTab({ bottomPadding }: { bottomPadding: number }) {
  const [sort, setSort] = useState<ShowcaseFeedSort>("latest")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search.trim(), 400)

  const [items, setItems] = useState<ShowcaseSocialItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const activeRequest = useRef<AbortController | null>(null)
  const loadMoreBusy = useRef(false)
  const hasLoadedOnce = useRef(false)

  const fetchPage = useCallback(
    async (cursor: string | null, mode: "initial" | "refresh" | "more") => {
      if (mode === "more" && loadMoreBusy.current) return
      // Sort/search/refresh supersedes every older response. Without aborting,
      // a slow "latest" request could overwrite a newer "popular" result.
      if (mode !== "more") activeRequest.current?.abort()
      const controller = new AbortController()
      activeRequest.current = controller
      if (mode === "initial") setLoading(true)
      if (mode === "refresh") setRefreshing(true)
      if (mode === "more") {
        loadMoreBusy.current = true
        setLoadingMore(true)
      }
      if (mode === "more") setLoadMoreError(null)
      else setError(null)
      try {
        const page = await getShowcaseFeed(
          {
            cursor: cursor ?? undefined,
            limit: FEED_LIMIT,
            sort,
            search: debouncedSearch || undefined,
          },
          controller.signal,
        )
        if (controller.signal.aborted) return
        setItems((previous) => {
          if (mode !== "more") return page.items
          // Cursor feeds can overlap when new records are inserted between
          // requests. Merge by id prevents duplicate cards and unstable keys.
          const merged = new Map(previous.map((item) => [item.id, item]))
          for (const item of page.items) merged.set(item.id, item)
          return [...merged.values()]
        })
        setNextCursor(page.nextCursor)
        setHasMore(page.hasMore)
        hasLoadedOnce.current = true
      } catch (err) {
        if (controller.signal.aborted) return
        if (mode === "more") setLoadMoreError(userMessage(err))
        else setError(userMessage(err))
      } finally {
        if (activeRequest.current === controller) {
          setLoading(false)
          setRefreshing(false)
          setLoadingMore(false)
          loadMoreBusy.current = false
        }
      }
    },
    [sort, debouncedSearch],
  )

  // Reset ke halaman 1 saat sort/search berubah (termasuk muat awal).
  useEffect(() => {
    void fetchPage(null, hasLoadedOnce.current ? "refresh" : "initial")
    return () => activeRequest.current?.abort()
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (nextCursor && hasMore && !loadingMore) void fetchPage(nextCursor, "more")
  }, [nextCursor, hasMore, loadingMore, fetchPage])

  return (
    <View className="flex-1">
      <View className="gap-2 px-4 py-3">
        <Input
          variant="search"
          value={search}
          onChangeText={setSearch}
          placeholder="Cari produk atau penjual"
          accessibilityLabel="Cari showcase"
        />
        <View className="flex-row gap-2">
          <Chip selected={sort === "latest"} onPress={() => setSort("latest")}>
            Terbaru
          </Chip>
          <Chip selected={sort === "popular"} onPress={() => setSort("popular")}>
            Populer
          </Chip>
        </View>
      </View>
      <PaginatedList
        data={items}
        loading={loading}
        refreshing={refreshing}
        loadingMore={loadingMore}
        hasMore={hasMore}
        error={error}
        loadMoreError={loadMoreError}
        onRefresh={() => void fetchPage(null, "refresh")}
        onRetry={() => void fetchPage(null, "refresh")}
        onLoadMore={loadMore}
        gap={12}
        padded
        bottomPadding={bottomPadding}
        empty={
          <EmptyState
            icon={Images}
            title="Belum ada showcase"
            description={
              debouncedSearch
                ? `Tidak ada hasil untuk "${debouncedSearch}".`
                : "Item showcase publik akan muncul di sini."
            }
          />
        }
        renderItem={({ item }) => (
          <ShowcaseFeedItem
            item={item}
            onPress={() => router.push(ROUTES.showcaseDetail(item.id))}
          />
        )}
      />
    </View>
  )
}
