/** Public cursor feed. Page data and cursors commit atomically; account/filter changes fence old responses.
 * Following remains a client-side filter until a server-side following-feed contract exists. */
import { useCallback, useEffect, useRef, useState, memo } from "react"
import { View } from "react-native"
import Animated from "react-native-reanimated"
import { Images, X } from "phosphor-react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useIsFocused } from "@react-navigation/native"

import { api, isApiError, userMessage } from "@/lib/api"
import { getShowcaseFeed, type ShowcaseSocialItem } from "@/lib/api/showcase"
import { useHasSession, useSessionRevision } from "@/lib/guest-gate"
import { fetchViaQueryCache } from "@/lib/query-cache"
import { queryKeys } from "@/lib/query-keys"
import { ROUTES } from "@/lib/routes"
import {
  emptyFeedPageState,
  interleave,
  mergeById,
  resetFeedPageState,
  sameFeedFilter,
  type FeedPageState,
  type ShowcaseFeedFilter,
} from "@/lib/showcase-feed-logic"
import { showcaseFeedDirtyVersion, useShowcaseDirtyVersion } from "@/lib/showcase-social-prefs"
import { tokens } from "@/lib/tokens"
import { useCollapsingHeader } from "@/lib/use-collapsing-header"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { useShowcaseSocialActions } from "@/lib/use-showcase-social-actions"

import { translate } from "@/lib/i18n/translate"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { IconButton } from "@/components/ui/icon-button"
import { PaginatedList } from "@/components/ui/paginated-list"
import { ShowcaseCommentsSheet } from "@/components/ui/showcase-comments-sheet"
import { ShowcaseFeedItem } from "@/components/ui/showcase-feed-item"
import { ShowcaseReportSheet } from "@/components/ui/showcase-report-sheet"
import { ModeShiftFade } from "@/components/ui/mode-switcher"
import { ShowcaseHeader, type ShowcaseFeedKind } from "@/components/ui/showcase-header"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"

const FEED_LIMIT = 20
/**
 * A-02: tab "Mengikuti" — setelah filter klien, satu fetch boleh mengambil
 * maks 3 halaman berurutan sampai ≥5 item terkumpul (atau hasMore habis).
 * Batas atas menjaga feed tidak berputar tanpa henti pada akun yang follow
 * banyak penjual tidak aktif.
 */
const FOLLOWING_MIN_ITEMS = 5
const FOLLOWING_MAX_PAGES = 3

// ------------------------------------------------------------------
// Tab Showcase (cursor/keyset) — header lipat + tab feed gaya profil publik
// ------------------------------------------------------------------

/** Urutan tab meniru strip tab profil publik (bukan chip Terbaru/Populer). */
const FEED_TABS = [
  { value: "forYou", label: "Untuk Anda" },
  { value: "following", label: "Mengikuti" },
  { value: "latest", label: "Terbaru" },
  { value: "popular", label: "Populer" },
] as const satisfies readonly { value: ShowcaseFeedKind; label: string }[]

/**
 * Kartu memo (A-09): membaca state sosialnya sendiri lewat hook, sehingga
 * `renderItem` induk bisa useCallback dan FlatList tidak menggambar ulang
 * sel lain di setiap render induk. Override suka/simpan berasal dari store
 * bersama — sinkron dengan layar detail & profil dalam satu sesi.
 */
type FeedCardProps = {
  item: ShowcaseSocialItem
  divider: boolean
  onOpenComments: (item: ShowcaseSocialItem) => void
  onReport: (item: ShowcaseSocialItem) => void
}

const FeedCard = memo(function FeedCard({
  item,
  divider,
  onOpenComments,
  onReport,
}: FeedCardProps) {
  const { liked, likeCount, saved, toggleLike, toggleSave, share } =
    useShowcaseSocialActions(item)
  const display =
    liked === (item.isLiked === true) && likeCount === item.likeCount
      ? item
      : { ...item, isLiked: liked, likeCount }
  return (
    <ShowcaseFeedItem
      item={display}
      onPress={() => router.push(ROUTES.showcaseDetail(item.id))}
      onToggleLike={toggleLike}
      onOpenComments={() => onOpenComments(item)}
      onToggleSave={toggleSave}
      saved={saved}
      onShare={share}
      onReport={() => onReport(item)}
      divider={divider}
    />
  )
})

export type ShowcaseFeedTabProps = {
  bottomPadding: number
  /** A-12: filter kategori aktif (dari param rute /showcase?category=…). */
  category?: string
  onClearCategory?: () => void
}

export function ShowcaseFeedTab({ bottomPadding, category, onClearCategory }: ShowcaseFeedTabProps) {
  const params = useLocalSearchParams<{ kind?: string; search?: string }>()
  const kind: ShowcaseFeedKind = params.kind === "following" || params.kind === "latest" || params.kind === "popular" ? params.kind : "forYou"
  const search = typeof params.search === "string" ? params.search.slice(0, 100) : ""
  const setKind = (next: ShowcaseFeedKind) => router.setParams({ kind: next })
  const setSearch = (next: string) => router.setParams({ search: next || undefined })
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
  /**
   * A-13: daftar akun yang diikuti kini STATE (bukan ref) supaya empty-state
   * ikut re-render saat nilai berubah. `null` = belum dimuat sesi ini.
   * A-04: milik `followingOwner` — ganti akun membuang cache.
   */
  const [followingSet, setFollowingSet] = useState<ReadonlySet<string> | null>(null)
  const followingOwner = useRef<string | null>(null)
  const followingCache = useRef<ReadonlySet<string> | null>(null)
  /** Item yang komentarnya sedang dibuka di BottomSheet (null = tertutup). */
  const [commentItem, setCommentItem] = useState<ShowcaseSocialItem | null>(null)
  /** Item yang sedang dilaporkan (null = tertutup). */
  const [reportItem, setReportItem] = useState<ShowcaseSocialItem | null>(null)
  const activeRequest = useRef<AbortController | null>(null)
  const loadMoreBusy = useRef(false)
  /**
   * State paginasi per (tab × filter) — KUNCI A-01: kursor keyset hanya valid
   * untuk himpunan hasil yang persis sama. Mengganti tab/kata kunci/kategori
   * TIDAK boleh memakai kursor milik himpunan lain.
   */
  const pageStates = useRef<
    Record<ShowcaseFeedKind, { filter: ShowcaseFeedFilter; state: FeedPageState }>
  >({
    forYou: { filter: {}, state: emptyFeedPageState() },
    following: { filter: {}, state: emptyFeedPageState() },
    latest: { filter: {}, state: emptyFeedPageState() },
    popular: { filter: {}, state: emptyFeedPageState() },
  })
  /** Versi dirty yang sudah dikonsumsi (A-08). */
  const dirtySeen = useRef(showcaseFeedDirtyVersion())

  /**
   * Sesi dibaca lewat ref supaya `ensureFollowingSet` tetap stabil (hindari
   * refetch saat sesi dipulihkan di boot) — lihat revisi sebelumnya.
   */
  const hasSession = useHasSession()
  const revision = useSessionRevision()
  const dirtyVersion = useShowcaseDirtyVersion()
  const hasSessionRef = useRef(hasSession)
  hasSessionRef.current = hasSession

  const markGuest = useCallback(() => {
    followingOwner.current = null
    followingCache.current = null
    setFollowingSet((previous) => previous?.size === 0 ? previous : new Set())
    setFollowingGuest(true)
  }, [])

  /**
   * Muat daftar akun yang diikuti (maks 4×50 = 200 — cukup untuk feed).
   * A-03: hanya 401/403 yang berarti tamu; error lain di-RETHROW supaya
   * pemanggil menampilkan ErrorState, bukan pseudologin.
   * A-04: cache hanya dipakai bila `me.username` sama dengan pemilik cache.
   */
  const ensureFollowingSet = useCallback(
    async (signal: AbortSignal): Promise<ReadonlySet<string>> => {
      if (!hasSessionRef.current) {
        markGuest()
        return new Set()
      }
      try {
        const me = await fetchViaQueryCache(queryKeys.me(), (s) => api.users.getMe(s), signal)
        if (!me?.username) {
          markGuest()
          return new Set()
        }
        if (followingCache.current && followingOwner.current === me.username) return followingCache.current
        const set = new Set<string>()
        for (let page = 1; ; page++) {
          if (signal.aborted) throw new Error("Aborted")
          const res = await api.users.getFollowing(me.username, { page, limit: 50 }, signal)
          const previousSize = set.size
          for (const user of res.data) set.add(user.username)
          if (res.data.length > 0 && previousSize === set.size) throw new Error("Daftar mengikuti tidak dapat dilanjutkan.")
          if (res.data.length < 50 || page >= res.meta.totalPages) break
        }
        if (signal.aborted) throw new Error("Aborted")
        followingCache.current = set
        followingOwner.current = me.username
        setFollowingSet(set)
        setFollowingGuest(false)
        return set
      } catch (err) {
        if (signal.aborted) throw err
        if (isApiError(err) && (err.status === 401 || err.status === 403)) {
          markGuest()
          return new Set()
        }
        throw err
      }
    },
    [markGuest],
  )

  const fetchPage = useCallback(
    async (mode: "initial" | "refresh" | "more") => {
      if (mode === "more" && (loadMoreBusy.current || activeRequest.current)) return
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
        loadMoreBusy.current = false
        setLoadMoreError(null)
        setError(null)
      }

      const filter: ShowcaseFeedFilter = {
        search: debouncedSearch || undefined,
        category: category || undefined,
      }
      const entry = pageStates.current[kind]
      // Private transaction: no cursor advancement escapes before items commit.
      const slot: FeedPageState = { cursors: { ...entry.state.cursors }, hasMore: { ...entry.state.hasMore } }

      /**
       * A-01 (inti perbaikan): initial/refresh SELALU mulai dari halaman 1 —
       * dan bila filter berubah, posisi milik filter lama ditinggalkan
       * (kunci himpunan hasil = tab × search × kategori).
       */
      if (mode !== "more" || !sameFeedFilter(entry.filter, filter)) {
        resetFeedPageState(slot)
      }

      const query = {
        limit: FEED_LIMIT,
        search: filter.search,
        category: filter.category,
      }
      try {
        let incoming: ShowcaseSocialItem[] = []
        let nextHasMore = false

        if (kind === "latest" || kind === "popular") {
          const page = await getShowcaseFeed(
            { ...query, sort: kind, cursor: slot.cursors[kind] ?? undefined },
            controller.signal,
          )
          slot.cursors[kind] = page.nextCursor
          slot.hasMore[kind] = page.hasMore
          incoming = page.items
          nextHasMore = page.hasMore
        } else if (kind === "forYou") {
          // Dua sumber paralel; sisi yang habis (hasMore false) tidak
          // ditembak ulang pada load-more berikutnya.
          const pages = await Promise.allSettled([
            mode !== "more" || slot.hasMore.latest
              ? getShowcaseFeed({ ...query, sort: "latest", cursor: slot.cursors.latest ?? undefined }, controller.signal)
              : Promise.resolve(null),
            mode !== "more" || slot.hasMore.popular
              ? getShowcaseFeed({ ...query, sort: "popular", cursor: slot.cursors.popular ?? undefined }, controller.signal)
              : Promise.resolve(null),
          ])
          if (controller.signal.aborted) return
          if (pages.every((result) => result.status === "rejected")) {
            throw (pages[0] as PromiseRejectedResult).reason
          }
          const latestPage = pages[0].status === "fulfilled" ? pages[0].value : null
          const popularPage = pages[1].status === "fulfilled" ? pages[1].value : null
          if (pages[0].status === "rejected") slot.hasMore.latest = true
          if (pages[1].status === "rejected") slot.hasMore.popular = true
          if (pages.some((result) => result.status === "rejected")) {
            setError(translate("Sebagian karya belum dapat dimuat. Coba lagi."))
          }
          if (latestPage) {
            slot.cursors.latest = latestPage.nextCursor
            slot.hasMore.latest = latestPage.hasMore
          }
          if (popularPage) {
            slot.cursors.popular = popularPage.nextCursor
            slot.hasMore.popular = popularPage.hasMore
          }
          incoming = interleave(latestPage?.items ?? [], popularPage?.items ?? [])
          nextHasMore = (latestPage?.hasMore ?? slot.hasMore.latest) || (popularPage?.hasMore ?? slot.hasMore.popular)
        } else {
          // following: feed latest difilter ke akun yang diikuti (sisi klien).
          if (mode !== "more") setFollowingGuest(false)
          const set = await ensureFollowingSet(controller.signal)
          if (controller.signal.aborted) return
          /**
           * A-02: satu halaman mentah bisa lolos filter 0–1 item padahal
           * hasMore=true. Ambil halaman lanjutan otomatis (maks
           * FOLLOWING_MAX_PAGES per fetch) supaya kartu benar-benar terisi,
           * dan kosong = memang habis, bukan tak sempat termuat.
           */
          const collected: ShowcaseSocialItem[] = []
          for (let pageIndex = 0; set.size > 0 && pageIndex < FOLLOWING_MAX_PAGES; pageIndex++) {
            const page = await getShowcaseFeed(
              { ...query, sort: "latest", cursor: slot.cursors.latest ?? undefined },
              controller.signal,
            )
            if (controller.signal.aborted) return
            slot.cursors.latest = page.nextCursor
            slot.hasMore.latest = page.hasMore
            collected.push(...page.items.filter((item) => set.has(item.author.username)))
            if (collected.length >= FOLLOWING_MIN_ITEMS || !page.hasMore) break
          }
          incoming = collected
          nextHasMore = set.size > 0 && slot.hasMore.latest
        }

        if (controller.signal.aborted || activeRequest.current !== controller) return
        entry.state = slot
        entry.filter = filter
        setItems((previous) => (mode === "more" ? mergeById(previous, incoming) : incoming))
        setHasMore(nextHasMore)
      } catch (err) {
        if (controller.signal.aborted) return
        if (mode === "more") setLoadMoreError(userMessage(err))
        else setError(userMessage(err))
      } finally {
        if (activeRequest.current === controller) {
          activeRequest.current = null
          setLoading(false)
          setRefreshing(false)
          setLoadingMore(false)
          loadMoreBusy.current = false
        }
      }
    },
    [kind, debouncedSearch, category, ensureFollowingSet],
  )

  // Reset ke halaman 1 saat tab/search/kategori berubah (termasuk muat awal).
  useEffect(() => {
    followingCache.current = null
    followingOwner.current = null
    setItems([])
    setHasMore(false)
    void fetchPage("initial")
    return () => activeRequest.current?.abort()
  }, [fetchPage, revision, hasSession])

  /**
   * A-08: mutasi dari layar manajemen memanggil markShowcaseFeedDirty() —
   * saat tab ini fokus kembali dan ada tanda baru, segarkan diam-diam.
   * (Tab Expo tetap ter-mount; efek muat-awal tidak berjalan ulang.)
   */
  const isFocused = useIsFocused()
  useEffect(() => {
    if (!isFocused) return
    const current = showcaseFeedDirtyVersion()
    if (current !== dirtySeen.current || kind === "following") {
      followingCache.current = null
      followingOwner.current = null
      dirtySeen.current = current
      void fetchPage("refresh")
    }
  }, [isFocused, fetchPage, dirtyVersion, kind])

  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore && !refreshing && !loading) void fetchPage("more")
  }, [hasMore, loadingMore, refreshing, loading, fetchPage])

  const handleOpenComments = useCallback((item: ShowcaseSocialItem) => {
    setCommentItem(item)
  }, [])

  const handleOpenReport = useCallback((item: ShowcaseSocialItem) => {
    setReportItem(item)
  }, [])

  /** Komentar baru dari komposer sheet — hitungan kartu ikut bertambah. */
  const handleCommentAdded = useCallback((id: string) => {
    setItems((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, commentCount: entry.commentCount + 1 } : entry,
      ),
    )
  }, [])

  /** A-09: renderItem STABIL — hanya berganti bila handler/jumlah berubah. */
  const renderItem = useCallback(
    ({ item, index }: { item: ShowcaseSocialItem; index: number }) => (
      <FeedCard
        item={item}
        divider={index < items.length - 1}
        onOpenComments={handleOpenComments}
        onReport={handleOpenReport}
      />
    ),
    [handleOpenComments, handleOpenReport, items.length],
  )

  const emptyState = (() => {
    if (kind === "following" && followingGuest) {
      return (
        <EmptyState
          icon={Images}
          title="Masuk untuk melihat feed mengikuti"
          description="Masuk terlebih dahulu agar kami bisa menampilkan showcase dari akun yang kamu ikuti."
          action={
            <Button onPress={() => router.push(ROUTES.loginRequired("/showcase?kind=following"))}>Masuk</Button>
          }
        />
      )
    }
    if (kind === "following" && followingSet?.size === 0) {
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
          title={hasMore ? translate("Masih mencari karya dari akun yang diikuti") : translate("Belum ada showcase dari akun yang diikuti")}
          description={hasMore ? translate("Lanjutkan pencarian pada halaman berikutnya.") : translate("Saat akun yang kamu ikuti membagikan karya, karyanya muncul di sini.")}
        />
      )
    }
    return (
      <EmptyState
        icon={Images}
        title="Belum ada karya di etalase"
        description={
          debouncedSearch
            ? translate('Tidak ada hasil untuk "{x}".', { x: debouncedSearch })
            : "Karya publik dari penjual Kahade akan muncul di sini."
        }
      />
    )
  })()

  /** A-12: chip filter kategori aktif di atas list (scroll ikut konten). */
  const categoryChip = category ? (
    <View className="mt-3 flex-row items-center justify-between gap-2 rounded-full border border-border bg-surface py-1.5 pl-4 pr-1.5 mx-5">
      <Text variant="caption" tone="secondary" className="flex-1" numberOfLines={1}>
        {translate("Kategori: {x}", { x: category })}
      </Text>
      <IconButton
        icon={X}
        variant="ghost"
        size="sm"
        accessibilityLabel={translate("Hapus filter kategori {x}", { x: category })}
        onPress={onClearCategory}
      />
    </View>
  ) : null

  return (
    <View className="flex-1">
      {/* ── Header showcase — improved: logo + balance + inbox + profile ── */}
      <Animated.View
        style={[
          collapsing.containerStyle,
          { pointerEvents: collapsing.collapsed ? "none" : "auto" },
        ]}
      >
        <Animated.View style={collapsing.contentStyle} onLayout={collapsing.onHeaderLayout}>
          <ShowcaseHeader
            search={search}
            onSearchChange={setSearch}
            kind={kind}
            onKindChange={setKind}
            tabs={FEED_TABS}
          />
        </Animated.View>
      </Animated.View>

      <ModeShiftFade>
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
          followingCache.current = null
          setFollowingSet(null)
          followingOwner.current = null
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
        header={<View className="px-5"><Button variant="ghost" onPress={() => router.push(ROUTES.saved)}>Karya tersimpan</Button>{categoryChip}</View>}
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
        renderItem={renderItem}
      />
      </ModeShiftFade>

      {/* Komentar dibaca & ditulis di sheet — pengguna tidak kehilangan posisi feed. */}
      <ShowcaseCommentsSheet
        item={commentItem}
        onRequestClose={() => setCommentItem(null)}
        onCommentAdded={handleCommentAdded}
      />

      {/* A-11: SATU sheet laporan (audit: disalin dari versi inline lama). */}
      <ShowcaseReportSheet item={reportItem} onRequestClose={() => setReportItem(null)} />
    </View>
  )
}
