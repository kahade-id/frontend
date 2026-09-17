/**
 * Screen — Jelajahi. Dua tab:
 *   - "Pengguna" (GET /v1/users/discover): rekomendasi pengguna + follow.
 *   - "Showcase" (GET /v1/showcase/feed): feed item showcase publik,
 *     cursor/keyset-based, dengan tab feed (Untuk Anda/Mengikuti/Terbaru/
 *     Populer) + pencarian.
 *
 * Keputusan non-obvious:
 *   - Feed showcase memakai PAGINASI CURSOR (keyset) — bukan page/offset
 *     seperti tab Pengguna. `nextCursor` dari respons diteruskan ke halaman
 *     berikutnya; `hasMore=false` = feed habis. offset di feed yang terus
 *     bertambah menghasilkan duplikat/lompatan (dijelaskan DTO backend).
 *   - Perubahan tab/search mereset feed ke halaman 1 (kursor lama dari
 *     sumber lain tidak valid). Pencarian di-debounce (useDebouncedValue)
 *     agar tidak menembak API tiap ketikan.
 *   - HEADER bergaya profil publik (bar judul + strip <Tabs>) dan MELIPAT
 *     saat scroll ke bawah / muncul lagi saat scroll ke atas (pola X) lewat
 *     useCollapsingHeader — keputusan animasi di UI thread (worklet), bukan
 *     onScroll JS per frame.
 *   - Tab "Untuk Anda" & "Mengikuti" TIDAK punya endpoint backend (spec feed
 *     hanya sort latest|popular) — keduanya turunan SISI KLIEN yang jujur:
 *       * Untuk Anda = selang-seling halaman Popular + Latest (campuran
 *         engagement & kesegaran), kursor keduanya disimpan terpisah.
 *       * Mengikuti = feed Latest difilter ke username yang diikuti
 *         (GET /v1/users/me + /v1/users/{u}/following, di-cache per refresh).
 *   - Aksi sosial tersedia LANGSUNG di feed: suka, komentar (BottomSheet
 *     dengan komposer), simpan, bagikan. `items` satu-satunya sumber
 *     kebenaran angka — suka mengubah item di array (optimistis, lalu
 *     disinkronkan dengan `{liked, likeCount}` final dari server).
 *     Simpan (bookmark) masih lokal: kontrak showcase belum punya endpoint
 *     koleksi tersaved — sama dengan layar detail.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated from "react-native-reanimated"
import { Compass, Images, ImagesSquare, Plus, UsersThree } from "phosphor-react-native"
import { router } from "expo-router"

import { api, isApiError, userMessage } from "@/lib/api"
import type { DiscoveredUser } from "@/lib/api/users"
import {
  getShowcaseFeed,
  getShowcaseSharePayload,
  likeShowcase,
  unlikeShowcase,
  type ShowcaseSocialItem,
} from "@/lib/api/showcase"
import { ROUTES } from "@/lib/routes"
import { shareContent } from "@/lib/share"
import { tokens } from "@/lib/tokens"
import { useCollapsingHeader } from "@/lib/use-collapsing-header"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { usePaginatedQuery } from "@/lib/use-paginated-query"

import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { ShowcaseCommentsSheet } from "@/components/ui/showcase-comments-sheet"
import { ShowcaseFeedItem } from "@/components/ui/showcase-feed-item"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { Tabs } from "@/components/ui/tabs"
import { Text } from "@/components/ui/text"
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
// Tab Showcase (cursor/keyset) — header lipat + tab feed gaya profil publik
// ------------------------------------------------------------------

export type ShowcaseFeedKind = "forYou" | "following" | "latest" | "popular"

/** Urutan tab meniru strip tab profil publik (bukan chip Terbaru/Populer). */
const FEED_TABS = [
  { value: "forYou", label: "Untuk Anda" },
  { value: "following", label: "Mengikuti" },
  { value: "latest", label: "Terbaru" },
  { value: "popular", label: "Populer" },
] as const satisfies readonly { value: ShowcaseFeedKind; label: string }[]

type KindCursors = { latest: string | null; popular: string | null }
const emptyCursors = (): KindCursors => ({ latest: null, popular: null })

/** Selang-seling dua halaman (popular dulu = bobot engagement), dedupe id. */
function interleave(a: ShowcaseSocialItem[], b: ShowcaseSocialItem[]): ShowcaseSocialItem[] {
  const out: ShowcaseSocialItem[] = []
  const seen = new Set<string>()
  const max = Math.max(a.length, b.length)
  for (let i = 0; i < max; i++) {
    for (const item of [b[i], a[i]]) {
      if (item && !seen.has(item.id)) {
        seen.add(item.id)
        out.push(item)
      }
    }
  }
  return out
}

/** Gabung halaman lanjutan tanpa duplikat (kursor feed bisa tumpang-tindih). */
function mergeById(prev: ShowcaseSocialItem[], incoming: ShowcaseSocialItem[]) {
  const merged = new Map(prev.map((item) => [item.id, item]))
  for (const item of incoming) merged.set(item.id, item)
  return [...merged.values()]
}

export function ShowcaseFeedTab({ bottomPadding }: { bottomPadding: number }) {
  const toast = useToast()
  const [kind, setKind] = useState<ShowcaseFeedKind>("forYou")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search.trim(), 400)
  const collapsing = useCollapsingHeader()

  const [items, setItems] = useState<ShowcaseSocialItem[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  /** "Mengikuti": tamu (belum login) — empty state khusus, bukan error. */
  const [followingGuest, setFollowingGuest] = useState(false)
  /** Bookmark bersifat lokal (backend belum punya endpoint koleksi tersaved). */
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(() => new Set())
  /** Item yang komentarnya sedang dibuka di BottomSheet (null = tertutup). */
  const [commentItem, setCommentItem] = useState<ShowcaseSocialItem | null>(null)
  /** Guard per item: mencegah dua request suka berbarengan pada kartu yang sama. */
  const likeBusy = useRef<Set<string>>(new Set())
  const activeRequest = useRef<AbortController | null>(null)
  const loadMoreBusy = useRef(false)
  const hasLoadedOnce = useRef(false)
  /** Kursor per tab — pindah tab tidak membuang posisi tab lain. */
  const cursors = useRef<Record<ShowcaseFeedKind, KindCursors>>({
    forYou: emptyCursors(),
    following: emptyCursors(),
    latest: emptyCursors(),
    popular: emptyCursors(),
  })
  const moreFlags = useRef<Record<ShowcaseFeedKind, { latest: boolean; popular: boolean }>>({
    forYou: { latest: false, popular: false },
    following: { latest: false, popular: false },
    latest: { latest: false, popular: false },
    popular: { latest: false, popular: false },
  })
  /** Cache daftar username yang diikuti — dimuat ulang tiap refresh manual. */
  const followingSet = useRef<ReadonlySet<string> | null>(null)

  /**
   * Muat daftar akun yang diikuti (maks 4×50 = 200 — cukup untuk feed;
   * follow > 200 tetap terfilter pada 200 teratas halaman). Gagal/tamu →
   * set kosong + flag guest; empty state yang menjelaskan, bukan error.
   */
  const ensureFollowingSet = useCallback(async (signal: AbortSignal) => {
    if (followingSet.current) return followingSet.current
    try {
      const me = await api.users.getMe()
      if (!me?.username) throw new Error("guest")
      const set = new Set<string>()
      for (let page = 1; page <= 4; page++) {
        const res = await api.users.getFollowing(me.username, { page, limit: 50 }, signal)
        for (const user of res.data) set.add(user.username)
        if (res.data.length < 50 || page >= res.meta.totalPages) break
      }
      followingSet.current = set
      return set
    } catch (err) {
      if (signal.aborted) throw err
      setFollowingGuest(true)
      followingSet.current = new Set()
      return followingSet.current
    }
  }, [])

  const fetchPage = useCallback(
    async (mode: "initial" | "refresh" | "more") => {
      if (mode === "more" && loadMoreBusy.current) return
      // Tab/search/refresh supersedes every older response. Without aborting,
      // a slow "latest" request could overwrite a newer "popular" result.
      if (mode !== "more") activeRequest.current?.abort()
      const controller = new AbortController()
      activeRequest.current = controller
      if (mode === "initial") setLoading(true)
      if (mode === "refresh") setRefreshing(true)
      if (mode === "more") {
        loadMoreBusy.current = true
        setLoadingMore(true)
        setLoadMoreError(null)
      } else {
        setError(null)
      }
      const slot = cursors.current[kind]
      const flags = moreFlags.current[kind]
      const query = { limit: FEED_LIMIT, search: debouncedSearch || undefined }
      try {
        let incoming: ShowcaseSocialItem[] = []
        let nextHasMore = false

        if (kind === "latest" || kind === "popular") {
          const page = await getShowcaseFeed(
            { ...query, sort: kind, cursor: slot[kind] ?? undefined },
            controller.signal,
          )
          slot[kind] = page.nextCursor
          flags[kind] = page.hasMore
          incoming = page.items
          nextHasMore = page.hasMore
        } else if (kind === "forYou") {
          // Dua sumber paralel; sisi yang habis (hasMore false) tidak
          // ditembak ulang pada load-more berikutnya.
          const [latestPage, popularPage] = await Promise.all([
            mode !== "more" || flags.latest
              ? getShowcaseFeed({ ...query, sort: "latest", cursor: slot.latest ?? undefined }, controller.signal)
              : Promise.resolve(null),
            mode !== "more" || flags.popular
              ? getShowcaseFeed({ ...query, sort: "popular", cursor: slot.popular ?? undefined }, controller.signal)
              : Promise.resolve(null),
          ])
          if (latestPage) {
            slot.latest = latestPage.nextCursor
            flags.latest = latestPage.hasMore
          }
          if (popularPage) {
            slot.popular = popularPage.nextCursor
            flags.popular = popularPage.hasMore
          }
          incoming = interleave(latestPage?.items ?? [], popularPage?.items ?? [])
          nextHasMore = (latestPage?.hasMore ?? flags.latest) || (popularPage?.hasMore ?? flags.popular)
        } else {
          // following: feed latest difilter ke akun yang diikuti.
          if (mode !== "more") {
            followingSet.current = null
            setFollowingGuest(false)
          }
          const set = await ensureFollowingSet(controller.signal)
          if (controller.signal.aborted) return
          const page = await getShowcaseFeed(
            { ...query, sort: "latest", cursor: slot.latest ?? undefined },
            controller.signal,
          )
          slot.latest = page.nextCursor
          flags.latest = page.hasMore
          incoming = page.items.filter((item) => set.has(item.author.username))
          nextHasMore = page.hasMore
        }

        if (controller.signal.aborted) return
        setItems((previous) => (mode === "more" ? mergeById(previous, incoming) : incoming))
        setHasMore(nextHasMore)
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
    [kind, debouncedSearch, ensureFollowingSet],
  )

  // Reset ke halaman 1 saat tab/search berubah (termasuk muat awal).
  useEffect(() => {
    void fetchPage(hasLoadedOnce.current ? "refresh" : "initial")
    return () => activeRequest.current?.abort()
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore) void fetchPage("more")
  }, [hasMore, loadingMore, fetchPage])

  // ── Aksi sosial di feed ────────────────────────────────────────────────
  /** Ganti sebagian field satu item — satu sumber angka untuk kartu di list. */
  const patchItem = useCallback((id: string, patch: Partial<ShowcaseSocialItem>) => {
    setItems((previous) =>
      previous.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    )
  }, [])

  /**
   * Suka/batal suka langsung dari kartu feed. Optimistis: angka berubah saat
   * jari menyentuh, lalu disinkronkan dengan nilai FINAL dari server
   * (`{liked, likeCount}`) supaya tidak berbeda dengan halaman detail.
   */
  const handleToggleLike = useCallback(
    async (item: ShowcaseSocialItem) => {
      if (likeBusy.current.has(item.id)) return
      const previous = { isLiked: item.isLiked === true, likeCount: item.likeCount }
      const next = !previous.isLiked
      likeBusy.current.add(item.id)
      patchItem(item.id, {
        isLiked: next,
        likeCount: Math.max(0, previous.likeCount + (next ? 1 : -1)),
      })
      try {
        const res = next ? await likeShowcase(item.id) : await unlikeShowcase(item.id)
        patchItem(item.id, { isLiked: res.liked, likeCount: res.likeCount })
      } catch (err) {
        patchItem(item.id, previous)
        // SHOWCASE_ALREADY_LIKED (race) bukan error pengguna — cukup sinkronkan.
        const isRace = isApiError(err) && err.backendCode === "SHOWCASE_ALREADY_LIKED"
        if (!isRace) {
          toast.show({
            title: "Gagal memperbarui suka",
            description: userMessage(err),
            tone: "danger",
          })
        }
      } finally {
        likeBusy.current.delete(item.id)
      }
    },
    [patchItem, toast],
  )

  const handleToggleSave = useCallback((item: ShowcaseSocialItem) => {
    setSavedIds((previous) => {
      const next = new Set(previous)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
  }, [])

  const handleShare = useCallback(
    async (item: ShowcaseSocialItem) => {
      try {
        const payload = await getShowcaseSharePayload(item.id)
        const outcome = await shareContent({
          message: `${payload.title} — ${payload.authorFullName ?? "@" + payload.authorUsername}`,
          url: payload.shareUrl,
          title: payload.title,
        })
        if (outcome === "unavailable") {
          toast.show({ title: "Share tidak tersedia di perangkat ini", tone: "info" })
        }
      } catch (err) {
        toast.show({
          title: "Gagal menyiapkan share",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      }
    },
    [toast],
  )

  /** Komentar baru dari komposer sheet — hitungan kartu ikut bertambah. */
  const handleCommentAdded = useCallback((id: string) => {
    setItems((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, commentCount: entry.commentCount + 1 } : entry,
      ),
    )
  }, [])

  const emptyState = (() => {
    if (kind === "following" && followingGuest) {
      return (
        <EmptyState
          icon={Images}
          title="Masuk untuk melihat feed mengikuti"
          description="Masuk terlebih dahulu agar kami bisa menampilkan showcase dari akun yang kamu ikuti."
        />
      )
    }
    if (kind === "following" && followingSet.current?.size === 0) {
      return (
        <EmptyState
          icon={Images}
          title="Kamu belum mengikuti siapa pun"
          description="Temukan penjual lewat tab Temukan, ikuti mereka, dan karyanya akan muncul di sini."
        />
      )
    }
    if (kind === "following") {
      return (
        <EmptyState
          icon={Images}
          title="Belum ada showcase dari akun yang diikuti"
          description="Saat akun yang kamu ikuti membagikan showcase, postingannya muncul di sini."
        />
      )
    }
    return (
      <EmptyState
        icon={Images}
        title="Belum ada showcase"
        description={
          debouncedSearch
            ? `Tidak ada hasil untuk "${debouncedSearch}".`
            : "Item showcase publik akan muncul di sini."
        }
      />
    )
  })()

  return (
    <View className="flex-1">
      {/* ── Header lipat (bar judul + cari + strip tab, gaya profil publik) ── */}
      <Animated.View
        style={[
          collapsing.containerStyle,
          { pointerEvents: collapsing.collapsed ? "none" : "auto" },
        ]}
      >
        <Animated.View style={collapsing.contentStyle} onLayout={collapsing.onHeaderLayout}>
          {/* Garis dasar cuma dari <Tabs> (border-b bawaannya) — jangan
              gandakan di wrapper. */}
          <View className="bg-background">
            <View className="min-h-14 w-full flex-row items-center px-3 py-1">
              <View className="w-12 items-start justify-center">
                <Icon icon={ImagesSquare} size="md" tone="active" />
              </View>
              <View className="flex-1 items-center justify-center px-2">
                <Text accessibilityRole="header" variant="h3" numberOfLines={1} className="text-center">
                  Showcase
                </Text>
              </View>
              <View className="w-12 items-end justify-center">
                <IconButton
                  icon={Plus}
                  accessibilityLabel="Kelola showcase saya"
                  accessibilityHint="Buka halaman untuk menambah dan mengatur showcase"
                  onPress={() => router.push(ROUTES.showcaseManagement)}
                />
              </View>
            </View>
            <View className="px-4 pb-3">
              <Input
                variant="search"
                value={search}
                onChangeText={setSearch}
                placeholder="Cari produk atau penjual"
                accessibilityLabel="Cari showcase"
              />
            </View>
            <Tabs scrollable items={FEED_TABS} value={kind} onChange={setKind} />
          </View>
        </Animated.View>
      </Animated.View>

      <PaginatedList
        data={items}
        loading={loading}
        refreshing={refreshing}
        loadingMore={loadingMore}
        hasMore={hasMore}
        error={error}
        loadMoreError={loadMoreError}
        onRefresh={() => {
          // Tarik-segarkan juga cache "mengikuti" supaya follow baru terbaca.
          followingSet.current = null
          void fetchPage("refresh")
        }}
        onRetry={() => void fetchPage("refresh")}
        onLoadMore={loadMore}
        onScroll={collapsing.onScroll}
        onScrollWorklet={collapsing.scrollWorklet}
        // Feed bergaya postingan sosial: media full-bleed memotong gutter —
        // teks di dalam <ShowcaseFeedItem> membawa px-5 sendiri.
        padded={false}
        // Jarak antar postingan 20px: divider di akhir tiap item jatuh
        // hampir tepat di tengah celah (lihat <ShowcaseFeedItem divider>).
        gap={tokens.space[5]}
        bottomPadding={bottomPadding}
        loadingPlaceholder={
          <SkeletonGroup className="gap-10 py-4">
            {Array.from({ length: 2 }, (_, index) => (
              <View key={index} className="gap-3">
                <View className="flex-row items-center gap-3 px-5">
                  <Skeleton shape="circle" className="h-10 w-10" />
                  <Skeleton className="h-4 w-2/5" />
                </View>
                <View className="mx-5">
                  <Skeleton shape="card" className="aspect-square w-full" />
                </View>
                <Skeleton className="mx-5 h-4 w-3/5" />
              </View>
            ))}
          </SkeletonGroup>
        }
        empty={emptyState}
        renderItem={({ item, index }) => (
          <ShowcaseFeedItem
            item={item}
            onPress={() => router.push(ROUTES.showcaseDetail(item.id))}
            onToggleLike={() => void handleToggleLike(item)}
            onOpenComments={() => setCommentItem(item)}
            onToggleSave={() => handleToggleSave(item)}
            saved={savedIds.has(item.id)}
            onShare={() => void handleShare(item)}
            onReport={() => router.push(ROUTES.reports({ targetId: item.id, targetName: item.title }))}
            // Garis pemisah antar postingan; item terakhir tidak perlu garis
            // menggantung di ujung feed.
            divider={index < items.length - 1}
          />
        )}
      />

      {/* Komentar dibaca & ditulis di sheet — pengguna tidak kehilangan posisi feed. */}
      <ShowcaseCommentsSheet
        item={commentItem}
        onRequestClose={() => setCommentItem(null)}
        onCommentAdded={handleCommentAdded}
      />
    </View>
  )
}
