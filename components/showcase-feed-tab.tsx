/**
 * Kahade — <ShowcaseFeedTab> feed publik etalase (ekstrak G-11 dari
 * app/(tabs)/discover.tsx, revisi 2026-09-23).
 *
 * GET /v1/showcase/feed — cursor/keyset-based, dengan tab feed (Untuk Anda/
 * Mengikuti/Terbaru/Populer) + pencarian, dan header yang MELIPAT saat scroll
 * (pola X) — lihat catatan lengkap alur data di docblock app/(tabs)/discover.tsx.
 *
 * Keputusan non-obvious (disalin dari discover.tsx):
 *   - PAGINASI CURSOR (keyset), bukan page/offset: `nextCursor` diteruskan ke
 *     halaman berikutnya; hasMore=false = feed habis. Offset di feed yang
 *     terus bertambah menghasilkan duplikat/lompatan.
 *   - Perubahan tab/search mereset feed (kursor lama dari sumber lain tidak
 *     valid). Pencarian di-debounce.
 *   - Header lipat: SATU worklet dipakai dua jalur — Android via
 *     `onScrollWorklet` (UI thread), web/iOS via `onScroll` biasa. `onScroll`
 *     TIDAK boleh diisi `useAnimatedScrollHandler`: scroller-nya FlatList
 *     biasa (bukan Animated.FlatList) — lihat komentar use-collapsing-header.
 *   - Tab "Untuk Anda" & "Mengikuti" TIDAK punya endpoint backend (spec feed
 *     hanya sort latest|popular) — turunan SISI KLIEN yang jujur: Untuk Anda
 *     = selang-seling Popular + Latest; Mengikuti = Latest difilter ke akun
 *     yang diikuti (GET /v1/users/me + following, di-cache per refresh).
 *   - Aksi sosial LANGSUNG di feed: suka (optimistis, disinkronkan dengan
 *     `{liked, likeCount}` final), komentar (BottomSheet + komposer), simpan
 *     (lokal — kontrak showcase belum punya endpoint koleksi), bagikan.
 *   - State async dirakit manual (bukan useApiQuery/usePaginatedQuery) karena
 *     kursor keyset tidak cocok dengan helper offset-based; guard abort +
 *     stale-response tetap ada (activeRequest/loadMoreBusy).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import Animated from "react-native-reanimated"
import { Images } from "phosphor-react-native"
import { router } from "expo-router"

import { api, isApiError, userMessage } from "@/lib/api"
import {
  getShowcaseFeed,
  getShowcaseSharePayload,
  likeShowcase,
  unlikeShowcase,
  type ShowcaseSocialItem,
} from "@/lib/api/showcase"
import { useHasSession } from "@/lib/guest-gate"
import { fetchViaQueryCache } from "@/lib/query-cache"
import { queryKeys } from "@/lib/query-keys"
import { ROUTES } from "@/lib/routes"
import { CONTENT_REPORT_REASONS } from "@/lib/labels/report"
import { shareContent } from "@/lib/share"
import { tokens } from "@/lib/tokens"
import { translate } from "@/lib/i18n/translate"
import { useCollapsingHeader } from "@/lib/use-collapsing-header"
import { useDebouncedValue } from "@/lib/use-debounced-value"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Field } from "@/components/ui/field"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { ShowcaseCommentsSheet } from "@/components/ui/showcase-comments-sheet"
import { ShowcaseFeedItem } from "@/components/ui/showcase-feed-item"
import { ModeShiftFade } from "@/components/ui/mode-switcher"
import { ShowcaseHeader, type ShowcaseFeedKind } from "@/components/ui/showcase-header"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

const FEED_LIMIT = 20

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
  /** Item yang sedang dilaporkan (null = tertutup). */
  const [reportItem, setReportItem] = useState<ShowcaseSocialItem | null>(null)
  const [reportReason, setReportReason] = useState<string>("SPAM")
  const [reportDetail, setReportDetail] = useState<string>("")
  const [submittingReport, setSubmittingReport] = useState(false)
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
   * Sesi dibaca lewat ref supaya `ensureFollowingSet` tetap stabil: kalau
   * `hasSession` masuk daftar dependensi, identitas callback berubah saat sesi
   * dipulihkan di boot (tamu → login) dan `fetchPage` ikut berubah — feed yang
   * baru saja dimuat akan ditembak ulang tanpa sebab.
   */
  const hasSession = useHasSession()
  const hasSessionRef = useRef(hasSession)
  hasSessionRef.current = hasSession

  /**
   * Muat daftar akun yang diikuti (maks 4×50 = 200 — cukup untuk feed;
   * follow > 200 tetap terfilter pada 200 teratas halaman). Gagal/tamu →
   * set kosong + flag guest; empty state yang menjelaskan, bukan error.
   */
  const ensureFollowingSet = useCallback(async (signal: AbortSignal) => {
    if (followingSet.current) return followingSet.current
    /**
     * B-02 (audit): tamu tidak menembak `GET /v1/users/me` yang pasti 401 —
     * tiap 401 memicu refresh token dan berpotensi mengakhiri sesi yang
     * sebenarnya tidak ada. Empty state tamu sudah menangani kasusnya.
     */
    if (!hasSessionRef.current) {
      setFollowingGuest(true)
      followingSet.current = new Set()
      return followingSet.current
    }
    try {
      /**
       * C-02 (audit): profil dibaca lewat cache bersama `queryKeys.me()` — kunci
       * yang sama dipakai <ShowcaseHeader> di layar ini dan lintas layar lain.
       * Sebelumnya panggilan langsung di sini tidak pernah melihat cache,
       * sehingga GET /v1/users/me yang sama bisa ditembak berkali-kali dalam
       * hitungan detik.
       */
      const me = await fetchViaQueryCache(queryKeys.me(), (s) => api.users.getMe(s), signal)
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
            ? translate('Tidak ada hasil untuk "{x}".', { x: debouncedSearch })
            : "Item showcase publik akan muncul di sini."
        }
      />
    )
  })()

  const handleReportShowcase = useCallback(async () => {
    if (!reportItem) return
    setSubmittingReport(true)
    try {
      await api.showcase.reportShowcase(reportItem.id, {
        reason: reportReason,
        description: reportDetail.trim() || undefined,
      })
      toast.show({
        title: "Laporan terkirim",
        description: "Terima kasih telah membantu menjaga keamanan komunitas Kahade.",
        tone: "success",
        duration: 4000,
      })
      setReportItem(null)
      setReportDetail("")
    } catch (err: unknown) {
      toast.show({
        title: "Gagal mengirim laporan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSubmittingReport(false)
    }
  }, [reportItem, reportReason, reportDetail, toast])

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
            onReport={() => {
              setReportItem(item)
              setReportReason("SPAM")
              setReportDetail("")
            }}
            // Garis pemisah antar postingan; item terakhir tidak perlu garis
            // menggantung di ujung feed.
            divider={index < items.length - 1}
          />
        )}
      />
      </ModeShiftFade>

      {/* Komentar dibaca & ditulis di sheet — pengguna tidak kehilangan posisi feed. */}
      <ShowcaseCommentsSheet
        item={commentItem}
        onRequestClose={() => setCommentItem(null)}
        onCommentAdded={handleCommentAdded}
      />

      {/* Sheet Laporan Showcase */}
      <BottomSheet
        visible={!!reportItem}
        onRequestClose={() => setReportItem(null)}
        title="Laporkan Karya"
        description={reportItem ? translate('Laporkan postingan "{x}" jika melanggar panduan komunitas.', { x: reportItem.title }) : undefined}
        avoidKeyboard
        footer={
          <Button
            variant="destructive"
            loading={submittingReport}
            onPress={() => void handleReportShowcase()}
          >
            Kirim Laporan
          </Button>
        }
      >
        <View className="gap-4">
          <Field label="Alasan Laporan" required>
            <RadioGroup
              accessibilityLabel="Alasan Laporan"
              value={reportReason}
              onChange={setReportReason}
              variant="plain"
            >
              {CONTENT_REPORT_REASONS.map((r) => (
                <Radio key={r.value} value={r.value} label={r.label} description={r.description} />
              ))}
            </RadioGroup>
          </Field>
          <Field label="Keterangan tambahan (opsional)">
            <TextArea
              value={reportDetail}
              onChangeText={setReportDetail}
              placeholder="Jelaskan secara singkat detail pelanggaran..."
              maxLength={500}
              multiline
              numberOfLines={3}
            />
          </Field>
        </View>
      </BottomSheet>
    </View>
  )
}
