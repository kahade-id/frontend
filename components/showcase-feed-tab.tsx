/** Public cursor feed. Page data and cursors commit atomically; account/filter changes fence old responses.
 * Following remains a client-side filter until a server-side following-feed contract exists (audit A-17).
 *
 * Revisi audit Etalase 2026-09-23:
 *  - A-01/C-02 + F-01/C-01 (2026-09-24): aksi sosial (♥/komentar) TIDAK
 *    memanggil markShowcaseFeedDirty — sinyal dirty hanya untuk mutasi
 *    "etalase saya" (buat/ubah/hapus/urut). Hitungan komentar dari layar mana
 *    pun datang lewat ledger `queueShowcaseCommentCount()` dan diterapkan ke
 *    daftar yang sudah dimuat (lihat efek `appliedCommentSeq`), sehingga satu
 *    komentar tidak pernah lagi membuang halaman 2..N atau menimpa kenaikan
 *    optimistis. Koreksi 2026-09-24: docblock ini sebelumnya mengklaim hal itu
 *    padahal sheet komentar masih memanggil markShowcaseFeedDirty().
 *  - A-02: tab "Mengikuti" tidak lagi refetch penuh di SETIAP fokus — cukup
 *    saat dirty (mutasi manajemen) atau tarik-segarkan; fetch ganda saat mount
 *    (efek muat-awal + efek fokus) ikut hilang.
 *  - A-03: daftar following dibatasi FOLLOWING_MAX_PAGES dan diambil paralel
 *    kecil (bukan loop serial tanpa batas). Butuh endpoint
 *    GET /showcase/feed?following=true (A-17) untuk skala penuh.
 *  - A-04: cache daftar following per akun DI LEVEL MODUL — benar-benar
 *    dipakai (dulu selalu di-null sebelum sempat dibaca).
 *  - A-05: error parsial "Untuk Anda" saat load-more tampil di footer
 *    (loadMoreError), retry-nya melanjutkan halaman, bukan refresh penuh.
 *  - A-06: chip `?search=` kini bisa dihapus (sama seperti kategori).
 *  - A-07/A-08: renderItem stabil (divider via ref) dan FeedCard memo penuh.
 *  - Akses kelola dipusatkan pada pensil; simpan tersedia di pengaturan.
 *  - A-11/A-21: item per (tab × filter × sesi) di-cache — pindah tab instan.
 *  - A-12: filter following cocok per userId ATAU username-lowercase.
 *  - A-13: tarik-segarkan hanya menyentuh state following di tab Mengikuti.
 *  - A-16: debounce param URL dibuang (tidak ada input yang mengetiknya).
 *  - F-04: item yang sudah dilaporkan sesi ini disembunyikan dari feed.
 */
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react"
import { TextInput, View } from "react-native"
import Animated from "react-native-reanimated"
import { CurrencyCircleDollar, Images, X } from "phosphor-react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useIsFocused } from "@react-navigation/native"

import { api, isApiError, userMessage } from "@/lib/api"
import { getShowcaseFeed, type ShowcaseSocialItem } from "@/lib/api/showcase"
import { formatNumber } from "@/lib/format"
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
import {
  isShowcaseReported,
  dismissShowcase,
  undismissShowcase,
  showcaseCommentCountsSince,
  showcaseCommentCountSeq,
  useShowcaseCommentCountSeq,
  useShowcaseHiddenIds,
  showcaseFeedDirtyVersion,
  useShowcaseDirtyVersion,
} from "@/lib/showcase-social-prefs"
import { applyShowcaseCommentCountDelta } from "@/lib/showcase-social"
import { tokens } from "@/lib/tokens"
import { useCollapsingHeader } from "@/lib/use-collapsing-header"
import { useShowcaseSocialActions } from "@/lib/use-showcase-social-actions"
import { useToast } from "@/components/ui/toast"

import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { IconButton } from "@/components/ui/icon-button"
import { PaginatedList } from "@/components/ui/paginated-list"
import { ShowcaseCommentsSheet } from "@/components/ui/showcase-comments-sheet"
import { ShowcaseFeedItem } from "@/components/ui/showcase-feed-item"
import { ShowcaseReportSheet } from "@/components/ui/showcase-report-sheet"
import { ShowcaseShareSheet } from "@/components/ui/showcase-share-sheet"
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
/**
 * A-03: batas atas halaman daftar following (50 akun/halaman → 1.000 akun)
 * yang diambil per sesi, di paralel batch kecil. 5.000 follow tidak lagi
 * berarti 100 request serial sebelum paint; cache A-04 memastikan ini hanya
 * terjadi sekali per akun per sesi. Solusi penuh = endpoint server (A-17).
 */
const FOLLOWING_INDEX_MAX_PAGES = 20
const FOLLOWING_INDEX_PARALLEL = 4

// ------------------------------------------------------------------
// Tab Showcase (cursor/keyset) — header lipat + tab feed gaya profil publik
// ------------------------------------------------------------------

/** Urutan tab meniru strip tab profil publik (bukan chip Terbaru/Populer). */
function useFeedTabs() {
  // i18n: label tab mengikuti bahasa aktif (dulu konstanta modul).
  const language = useLanguage()
  return useMemo(
    () =>
      [
        { value: "forYou", label: translate("Untuk Anda") },
        { value: "following", label: translate("Mengikuti") },
        { value: "latest", label: translate("Terbaru") },
        { value: "popular", label: translate("Populer") },
      ] as const satisfies readonly { value: ShowcaseFeedKind; label: string }[],
    [language],
  )
}

/** A-04: cache daftar following per akun — lihat `followingIndexRef`. */
type FollowingIndex = { owner: string; keys: ReadonlySet<string> }

/** A-12: kunci identitas berikut — `u:{userId}` (stabil) ATAU `n:{username-lowercase}`. */
function followingKeysOf(users: readonly { userId?: string; username?: string }[]): Set<string> {
  const keys = new Set<string>()
  for (const user of users) {
    if (user?.userId) keys.add(`u:${user.userId}`)
    if (user?.username) keys.add(`n:${user.username.toLowerCase()}`)
  }
  return keys
}

function followedBy(keys: ReadonlySet<string>, item: ShowcaseSocialItem): boolean {
  return (
    (item.author.userId != null && keys.has(`u:${item.author.userId}`)) ||
    keys.has(`n:${item.author.username.toLowerCase()}`)
  )
}

/**
 * Kartu memo (A-08/A-09): membaca state sosialnya sendiri lewat hook, sehingga
 * `renderItem` induk bisa useCallback dan FlatList tidak menggambar ulang
 * sel lain di setiap render induk. Override suka/simpan berasal dari store
 * bersama — sinkron dengan layar detail & profil dalam satu sesi.
 * SEMUA callback dibungkus useCallback + `display` useMemo: identitas prop
 * <ShowcaseFeedItem> (yang `memo`) stabil di antara render FeedCard.
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
  const { liked, likeCount, saved, likePending, savedPending, toggleLike, toggleSave, share, shareSheetVisible, setShareSheetVisible } =
    useShowcaseSocialActions(item)
  const display = useMemo(
    () =>
      liked === (item.isLiked === true) && likeCount === item.likeCount
        ? item
        : { ...item, isLiked: liked, likeCount },
    [item, liked, likeCount],
  )
  // L-01/L-06: `kind` dibawa ke detail supaya badge kategori di sana
  // mempertahankan tab aktif.
  const { kind } = useLocalSearchParams<{ kind?: string }>()
  const handlePress = useCallback(
    () => router.push(ROUTES.showcaseDetail(item.id, { kind })),
    [item.id, kind],
  )
  const handleComments = useCallback(() => onOpenComments(item), [onOpenComments, item])
  const handleReport = useCallback(() => onReport(item), [onReport, item])
  return (
    <>
      <ShowcaseFeedItem
        item={display}
        onPress={handlePress}
        onToggleLike={toggleLike}
        onOpenComments={handleComments}
        onToggleSave={toggleSave}
        saved={saved}
        likePending={likePending}
        savePending={savedPending}
        onShare={share}
        onOptions={handleReport}
        divider={divider}
      />
      <ShowcaseShareSheet visible={shareSheetVisible} item={display} onClose={() => setShareSheetVisible(false)} />
    </>
  )
})

export type ShowcaseFeedTabProps = {
  bottomPadding: number
  /** A-12: filter kategori aktif (dari param rute /showcase?category=…). */
  category?: string
  onClearCategory?: () => void
  /** Filter lokasi aktif (dari param rute /showcase?location=…). */
  location?: string
  onClearLocation?: () => void
}

export function ShowcaseFeedTab({ bottomPadding, category, onClearCategory, location, onClearLocation }: ShowcaseFeedTabProps) {
  // i18n: label tab mengikuti bahasa aktif.
  const feedTabs = useFeedTabs()
  // DC-012: filter harga (state lokal — tidak perlu param rute). String untuk
  // input; dinormalisasi ke integer >= 0 saat diterapkan.
  const [minPriceInput, setMinPriceInput] = useState("")
  const [maxPriceInput, setMaxPriceInput] = useState("")
  const [priceFilter, setPriceFilter] = useState<{ min?: number; max?: number }>({})
  const [priceOpen, setPriceOpen] = useState(false)
  const params = useLocalSearchParams<{ kind?: string; search?: string }>()
  const kind: ShowcaseFeedKind = params.kind === "following" || params.kind === "latest" || params.kind === "popular" ? params.kind : "forYou"
  // Pencarian inline DIHAPUS dari header (2026-09-23): satu-satunya kolom
  // cari kini layar /search. Param `search` tetap dibaca agar URL lama
  // `/showcase?search=…` (deep link/bookmark) masih terfilter dengan benar —
  // dan chip-nya kini bisa DIHAPUS (A-06).
  const search = typeof params.search === "string" ? params.search.slice(0, 100) : ""
  const setKind = (next: ShowcaseFeedKind) => router.setParams({ kind: next })
  // A-16: debounce dibuang — tidak ada kolom ketik yang mengubah `search`
  // di layar ini; debounce hanya menunda fetch saat param URL berubah.
  const activeSearch = search.trim()
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
   * A-04: kepemilikan + cache-nya hidup di level modul (lihat above).
   */
  const [followingSet, setFollowingSet] = useState<ReadonlySet<string> | null>(null)
  /**
   * F-05 (audit 2026-09-24): penanda hasil TERPOTONG di tab "Mengikuti".
   * Daftar following masih dihitung di klien dengan plafon
   * FOLLOWING_MAX_PAGES, jadi feed bisa tampak "habis" padahal masih ada.
   */
  const [followingPartial, setFollowingPartial] = useState(false)
  /** Item yang komentarnya sedang dibuka di BottomSheet (null = tertutup). */
  const [commentItem, setCommentItem] = useState<ShowcaseSocialItem | null>(null)
  /** Item yang sedang dilaporkan (null = tertutup). */
  const hiddenIds = useShowcaseHiddenIds()
  const [actionItem, setActionItem] = useState<ShowcaseSocialItem | null>(null)
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
  /**
   * A-11/A-21: cache ITEM per (tab × filter × sesi) — pindah tab memulihkan
   * isi + posisi paginasi instan tanpa skeleton/fetch ulang.
   */
  const itemsCache = useRef<
    Partial<Record<ShowcaseFeedKind, { revision: number; filter: ShowcaseFeedFilter; items: ShowcaseSocialItem[]; hasMore: boolean }>>
  >({})
  /** Cermin `items` untuk commit atomik cache (tanpa side-effect di updater). */
  const itemsRef = useRef<ShowcaseSocialItem[]>([])
  /** A-07: panjang list terkini untuk `divider` — renderItem tetap stabil. */
  const visibleItems = useMemo(() => {
    const seen = new Set<string>()
    return items.filter((item) => {
      if (hiddenIds.has(item.id)) return false
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }, [items, hiddenIds])
  const itemsLengthRef = useRef(0)
  itemsLengthRef.current = visibleItems.length
  /**
   * A-04: cache daftar following per akun — hidup selama tab terpasang
   * (antar pindah tab TANPA fetch ulang), dibuang saat ganti sesi/akun
   * (lihat efek revision) atau tarik-segarkan di tab Mengikuti (A-13).
   */
  const followingIndexRef = useRef<FollowingIndex | null>(null)
  /** Versi dirty yang sudah dikonsumsi (A-08). */
  const dirtySeen = useRef(showcaseFeedDirtyVersion())

  /**
   * Sesi dibaca lewat ref supaya `ensureFollowingSet` tetap stabil (hindari
   * refetch saat sesi dipulihkan di boot) — lihat revisi sebelumnya.
   */
  const hasSession = useHasSession()
  const revision = useSessionRevision()
  const dirtyVersion = useShowcaseDirtyVersion()
  /** S-04: toast aksi "Tidak tertarik" membawa tombol Urungkan. */
  const toast = useToast()
  const hasSessionRef = useRef(hasSession)
  hasSessionRef.current = hasSession
  const revisionRef = useRef(revision)
  revisionRef.current = revision

  const markGuest = useCallback(() => {
    followingIndexRef.current = null
    setFollowingSet((previous) => previous?.size === 0 ? previous : new Set())
    setFollowingGuest(true)
  }, [])

  /** Filter aktif — kunci himpunan hasil (tab × search × kategori × lokasi × harga). */
  const filter: ShowcaseFeedFilter = useMemo(
    () => ({
      search: activeSearch || undefined,
      category: category || undefined,
      location: location || undefined,
      minPrice: priceFilter.min,
      maxPrice: priceFilter.max,
    }),
    [activeSearch, category, location, priceFilter],
  )

  /** DC-012: terapkan filter harga dari input (integer >= 0; kosong = lepas). */
  const applyPriceFilter = useCallback(() => {
    const toInt = (s: string): number | undefined => {
      const digits = s.replace(/[^0-9]/g, "")
      if (!digits) return undefined
      const n = Math.floor(Number(digits))
      return Number.isFinite(n) && n >= 0 ? n : undefined
    }
    const min = toInt(minPriceInput)
    const max = toInt(maxPriceInput)
    // Min > maks tidak valid — abaikan maks (bukan error yang menghalangi).
    setPriceFilter({ min, max: min !== undefined && max !== undefined && max < min ? undefined : max })
    setPriceOpen(false)
  }, [minPriceInput, maxPriceInput])

  const clearPriceFilter = useCallback(() => {
    setMinPriceInput("")
    setMaxPriceInput("")
    setPriceFilter({})
  }, [])

  /**
   * Muat daftar akun yang diikuti (A-03: maks FOLLOWING_INDEX_MAX_PAGES × 50,
   * paralel batch FOLLOWING_INDEX_PARALLEL). Hanya 401/403 yang berarti tamu;
   * error lain di-RETHROW supaya pemanggil menampilkan ErrorState, bukan
   * pseudologin. A-04: cache per akun (ref tab) — hanya fetch saat miss.
   */
  const ensureFollowingSet = useCallback(
    async (signal: AbortSignal): Promise<ReadonlySet<string>> => {
      if (!hasSessionRef.current) {
        markGuest()
        return new Set()
      }
      try {
        const me = await fetchViaQueryCache(queryKeys.me(), (s) => api.users.getMe(s), signal)
        const username = me?.username
        if (!username) {
          markGuest()
          return new Set()
        }
        const cached = followingIndexRef.current
        if (cached && cached.owner === username) {
          setFollowingSet(cached.keys)
          setFollowingGuest(false)
          return cached.keys
        }
        const first = await api.users.getFollowing(username, { page: 1, limit: 50 }, signal)
        const pages = [first]
        const total = Math.min(
          Math.max(typeof first.meta?.totalPages === "number" ? first.meta.totalPages : 1, 1),
          FOLLOWING_INDEX_MAX_PAGES,
        )
        for (let start = 2; start <= total; start += FOLLOWING_INDEX_PARALLEL) {
          if (signal.aborted) throw new Error("Aborted")
          const batch: number[] = []
          for (let page = start; page < Math.min(start + FOLLOWING_INDEX_PARALLEL, total + 1); page++) batch.push(page)
          const results = await Promise.all(
            batch.map((page) => api.users.getFollowing(username, { page, limit: 50 }, signal)),
          )
          pages.push(...results)
        }
        if (signal.aborted) throw new Error("Aborted")
        const keys = followingKeysOf(pages.flatMap((res) => res.data))
        followingIndexRef.current = { owner: username, keys }
        setFollowingSet(keys)
        setFollowingGuest(false)
        return keys
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
      /**
       * Watermark hitungan komentar diambil SEBELUM request: respons yang
       * mendarat nanti sudah memuat semua event sampai titik ini, sehingga
       * event yang datang SESUDAHNYA tetap diterapkan (tidak ada yang hilang,
       * tidak ada yang dihitung dua kali).
       */
      const commentSeqAtStart = showcaseCommentCountSeq()
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
        location: filter.location,
        minPrice: filter.minPrice,
        maxPrice: filter.maxPrice,
      }
      try {
        let incoming: ShowcaseSocialItem[] = []
        let nextHasMore = false
        /** F-05: di-set di cabang `following` bila plafon sisi klien tercapai. */
        let truncatedFollowing = false

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
            // A-05: saat load-more, error PARSIAL tampil di footer (retry
            // melanjutkan kursor) — jangan tukar seluruh list dengan banner
            // di atas yang "Coba lagi"-nya membuang halaman 2..N.
            const partial = translate("Sebagian karya belum dapat dimuat. Coba lagi.")
            if (mode === "more") setLoadMoreError(partial)
            else setError(partial)
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
          let pageIndex = 0
          for (; set.size > 0 && pageIndex < FOLLOWING_MAX_PAGES; pageIndex++) {
            const page = await getShowcaseFeed(
              { ...query, sort: "latest", cursor: slot.cursors.latest ?? undefined },
              controller.signal,
            )
            if (controller.signal.aborted) return
            slot.cursors.latest = page.nextCursor
            slot.hasMore.latest = page.hasMore
            collected.push(...page.items.filter((item) => followedBy(set, item)))
            if (collected.length >= FOLLOWING_MIN_ITEMS || !page.hasMore) break
          }
          truncatedFollowing = pageIndex >= FOLLOWING_MAX_PAGES && slot.hasMore.latest && set.size > 0
          incoming = collected
          nextHasMore = set.size > 0 && slot.hasMore.latest
        }

        if (controller.signal.aborted || activeRequest.current !== controller) return
        setFollowingPartial(kind === "following" && truncatedFollowing)
        entry.state = slot
        entry.filter = filter
        // F-04 (audit 2026-09-23): item yang sudah dilaporkan sesi ini
        // disembunyikan dari feed pelapor (moderasi ada di server).
        const visible = incoming.filter((item) => !isShowcaseReported(item.id))
        const nextItems = mode === "more" ? mergeById(itemsRef.current, visible) : visible
        appliedCommentSeq.current = Math.max(appliedCommentSeq.current, commentSeqAtStart)
        itemsRef.current = nextItems
        setItems(nextItems)
        setHasMore(nextHasMore)
        // A-11/A-21: simpan hasil untuk (tab × filter × sesi) — pindah tab instan.
        itemsCache.current[kind] = {
          revision: revisionRef.current,
          filter,
          items: nextItems,
          hasMore: nextHasMore,
        }
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
    [kind, filter, ensureFollowingSet],
  )

  // A-11/A-21: pindah tab/filter — pulihkan cache instan, fetch hanya bila
  // belum ada hasil tersimpan untuk himpunan (tab × filter × sesi) itu.
  useEffect(() => {
    const cached = itemsCache.current[kind]
    if (cached && cached.revision === revision && sameFeedFilter(cached.filter, filter)) {
      itemsRef.current = cached.items
      setItems(cached.items)
      setHasMore(cached.hasMore)
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
      setError(null)
      setLoadMoreError(null)
    } else {
      itemsRef.current = []
      setItems([])
      setHasMore(false)
      void fetchPage("initial")
    }
    return () => activeRequest.current?.abort()
  }, [fetchPage, revision, hasSession, kind, filter])

  /** Ganti sesi = ganti pemilik daftar following — buang cache-nya. */
  useEffect(() => {
    followingIndexRef.current = null
    setActionItem(null)
    setReportItem(null)
    setCommentItem(null)
  }, [revision])

  /**
   * A-08: mutasi dari layar manajemen memanggil markShowcaseFeedDirty() —
   * saat tab ini fokus kembali dan ada tanda baru, segarkan diam-diam.
   * (Tab Expo tetap ter-mounted; efek muat-awal tidak berjalan ulang.)
   * A-02: `kind === "following"` TIDAK lagi memaksa refetch — daftar
   * following cukup disegarkan tarik-ke-bawah (A-13) atau oleh dirty.
   */
  const isFocused = useIsFocused()
  useEffect(() => {
    if (!isFocused) return
    const current = showcaseFeedDirtyVersion()
    if (current !== dirtySeen.current) {
      // A-04: cache following TIDAK dibuang di sini — dirty = mutasi etalase,
      // bukan perubahan hubungan follow.
      dirtySeen.current = current
      void fetchPage("refresh")
    }
  }, [isFocused, fetchPage, dirtyVersion])

  /**
   * F-01/F-03/C-01 (audit 2026-09-24): hitungan komentar dari sheet/detail
   * diterapkan DI SINI — tanpa satu pun request jaringan. `appliedCommentSeq`
   * adalah watermark: hanya event yang belum pernah diterapkan ke daftar ini
   * yang diproses, jadi membuka dua permukaan (feed + tab profil) tidak
   * menghitung dua kali. Efek berjalan walau tab tidak fokus supaya daftar
   * sudah benar saat pengguna kembali.
   */
  const commentSeq = useShowcaseCommentCountSeq()
  const appliedCommentSeq = useRef(showcaseCommentCountSeq())
  useEffect(() => {
    const { events, seq } = showcaseCommentCountsSince(appliedCommentSeq.current)
    if (events.length === 0) return
    appliedCommentSeq.current = seq
    const next = applyShowcaseCommentCountDelta(itemsRef.current, events)
    if (next !== itemsRef.current) {
      itemsRef.current = next
      setItems(next)
    }
    const cached = itemsCache.current[kind]
    if (cached) {
      const patched = applyShowcaseCommentCountDelta(cached.items, events)
      if (patched !== cached.items) itemsCache.current[kind] = { ...cached, items: patched }
    }
  }, [commentSeq, kind])

  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore && !refreshing && !loading) void fetchPage("more")
  }, [hasMore, loadingMore, refreshing, loading, fetchPage])

  const handleOpenComments = useCallback((item: ShowcaseSocialItem) => {
    setCommentItem(item)
  }, [])

  const handleOpenReport = useCallback((item: ShowcaseSocialItem) => {
    setActionItem(item)
  }, [])

  /** A-07: renderItem STABIL — divider dihitung lewat ref, bukan closure items. */
  const renderItem = useCallback(
    ({ item, index }: { item: ShowcaseSocialItem; index: number }) => (
      <FeedCard
        item={item}
        divider={index < itemsLengthRef.current - 1}
        onOpenComments={handleOpenComments}
        onReport={handleOpenReport}
      />
    ),
    [handleOpenComments, handleOpenReport],
  )

  const emptyState = (() => {
    if (kind === "following" && followingGuest) {
      return (
        <EmptyState
          icon={Images}
          title={translate("Masuk untuk melihat feed mengikuti")}
          description={translate("Masuk terlebih dahulu agar kami bisa menampilkan karya dari akun yang Anda ikuti.")}
          action={
            <Button onPress={() => router.push(ROUTES.loginRequired("/showcase?kind=following"))}>{translate("Masuk")}</Button>
          }
        />
      )
    }
    if (kind === "following" && followingSet?.size === 0) {
      return (
        <EmptyState
          icon={Images}
          title={translate("Anda belum mengikuti siapa pun")}
          description={translate("Temukan penjual lewat tab Temukan, ikuti mereka, dan karyanya akan muncul di sini.")}
          // A-18 (audit 2026-09-23): tombol ke tujuan yang disebut copy-nya.
          action={<Button onPress={() => router.push(ROUTES.discover)}>{translate("Buka Temukan")}</Button>}
        />
      )
    }
    if (kind === "following") {
      return (
        <EmptyState
          icon={Images}
          title={hasMore ? translate("Masih mencari karya dari akun yang diikuti") : translate("Belum ada karya dari akun yang diikuti")}
          description={hasMore ? translate("Lanjutkan pencarian pada halaman berikutnya.") : translate("Saat akun yang Anda ikuti membagikan karya, karyanya muncul di sini.")}
        />
      )
    }
    return (
      <EmptyState
        icon={Images}
        // F-06 (audit 2026-09-24): copy menyebut konteks FEED, bukan halaman
        // etalase satu penjual — "penjual Kahade" membingungkan di sini.
        title={translate("Belum ada karya untuk ditampilkan")}
        description={
          activeSearch
            ? translate('Tidak ada hasil untuk "{x}".', { x: activeSearch })
            : translate("Karya publik dari pengguna Kahade akan muncul di sini.")
        }
        // A-20 (audit 2026-09-23): CTA isi etalase untuk pemilik akun.
        action={
          hasSession ? (
            <Button variant="secondary" onPress={() => router.push(ROUTES.showcaseManagement)}>
              Tambah karya
            </Button>
          ) : undefined
        }
      />
    )
  })()

  /**
   * F-05: tab "Mengikuti" memakai filter sisi klien (plafon
   * FOLLOWING_MAX_PAGES). Bila hasil terpotong, katakan apa adanya — jangan
   * biarkan pengguna mengira sudah melihat semua karya akun yang diikuti.
   * Usulan jangka panjang tetap: `GET /showcase/feed?following=true`.
   */
  const followingPartialNotice = kind === "following" && followingPartial ? (
    <View className="mx-5 mt-3 rounded-md border border-border bg-surface px-3 py-2">
      <Text variant="caption" tone="secondary">
        {translate("Sebagian karya belum dapat dimuat. Tarik untuk menyegarkan.")}
      </Text>
    </View>
  ) : null

  /** A-06: chip filter aktif di atas list (scroll ikut konten). */
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

  /** Chip `?location=` — pola sama dengan chip kategori (A-06/A-12). */
  const locationChip = location ? (
    <View className="mt-3 flex-row items-center justify-between gap-2 rounded-full border border-border bg-surface py-1.5 pl-4 pr-1.5 mx-5">
      <Text variant="caption" tone="secondary" className="flex-1" numberOfLines={1}>
        {translate("Lokasi: {x}", { x: location })}
      </Text>
      <IconButton
        icon={X}
        variant="ghost"
        size="sm"
        accessibilityLabel={translate("Hapus filter lokasi {x}", { x: location })}
        onPress={onClearLocation}
      />
    </View>
  ) : null

  /** A-06: chip `?search=` kini bisa dihapus, bukan mengunci feed selamanya. */
  const searchChip = activeSearch ? (
    <View className="mt-3 flex-row items-center justify-between gap-2 rounded-full border border-border bg-surface py-1.5 pl-4 pr-1.5 mx-5">
      <Text variant="caption" tone="secondary" className="flex-1" numberOfLines={1}>
        {translate('Cari: "{x}"', { x: activeSearch })}
      </Text>
      <IconButton
        icon={X}
        variant="ghost"
        size="sm"
        accessibilityLabel={translate("Hapus pencarian {x}", { x: activeSearch })}
        onPress={() => router.setParams({ search: undefined })}
      />
    </View>
  ) : null

  /** DC-012: label rentang harga aktif untuk chip. */
  const priceLabel = (() => {
    const { min, max } = priceFilter
    if (min === undefined && max === undefined) return null
    const fmt = (n: number) => `Rp${formatNumber(n)}`
    if (min !== undefined && max !== undefined) return `${fmt(min)} – ${fmt(max)}`
    if (min !== undefined) return `≥ ${fmt(min)}`
    return `≤ ${fmt(max!)}`
  })()

  /** DC-012: chip harga aktif + panel input min–maks. */
  const priceFilterUi = (
    <View className="mx-5 mt-3 gap-2">
      {priceLabel ? (
        <View className="flex-row items-center justify-between gap-2 rounded-full border border-border bg-surface py-1.5 pl-4 pr-1.5">
          <Text variant="caption" tone="secondary" className="flex-1" numberOfLines={1}>
            {translate("Harga: {x}", { x: priceLabel })}
          </Text>
          <IconButton
            icon={X}
            variant="ghost"
            size="sm"
            accessibilityLabel={translate("Hapus filter harga")}
            onPress={clearPriceFilter}
          />
        </View>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          fullWidth={false}
          leftIcon={CurrencyCircleDollar}
          onPress={() => setPriceOpen((v) => !v)}
          accessibilityLabel={translate("Filter harga")}
        >
          {translate("Harga")}
        </Button>
      )}
      {priceOpen && !priceLabel ? (
        <View className="gap-2 rounded-md border border-border bg-surface p-3">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text variant="caption" tone="secondary">
                {translate("Min (Rp)")}
              </Text>
              <TextInput
                value={minPriceInput}
                onChangeText={setMinPriceInput}
                keyboardType="numeric"
                placeholder="0"
                accessibilityLabel={translate("Harga minimum")}
                className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-base text-foreground"
              />
            </View>
            <View className="flex-1">
              <Text variant="caption" tone="secondary">
                {translate("Maks (Rp)")}
              </Text>
              <TextInput
                value={maxPriceInput}
                onChangeText={setMaxPriceInput}
                keyboardType="numeric"
                placeholder="—"
                accessibilityLabel={translate("Harga maksimum")}
                className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-base text-foreground"
              />
            </View>
          </View>
          <Button variant="primary" size="sm" fullWidth onPress={applyPriceFilter}>
            {translate("Terapkan")}
          </Button>
        </View>
      ) : null}
    </View>
  )

  return (
    <View className="flex-1">
      {/* ── Header showcase — pensil kelola · logo · notifikasi + tab feed ── */}
      <Animated.View
        style={[
          collapsing.containerStyle,
          { pointerEvents: collapsing.collapsed ? "none" : "auto" },
        ]}
      >
        <Animated.View style={collapsing.contentStyle} onLayout={collapsing.onHeaderLayout}>
          <ShowcaseHeader kind={kind} onKindChange={setKind} tabs={feedTabs} />
        </Animated.View>
      </Animated.View>

      <ModeShiftFade>
      <PaginatedList
        data={visibleItems}
        loading={loading}
        refreshing={refreshing}
        loadingMore={loadingMore}
        hasMore={hasMore}
        error={error}
        loadMoreError={loadMoreError}
        onRefresh={() => {
          // A-13: hanya tab "Mengikuti" yang punya cache hubungan follow —
          // jangan reset state following di tab lain (empty-state ikut kedip).
          if (kind === "following") {
            followingIndexRef.current = null
            setFollowingSet(null)
          }
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
        header={
          searchChip || categoryChip || locationChip || followingPartialNotice ? (
            <View>{searchChip}{categoryChip}{locationChip}{priceFilterUi}{followingPartialNotice}</View>
          ) : (
            // DC-012: tombol filter harga tetap tersedia walau tak ada chip lain.
            <View>{priceFilterUi}</View>
          )
        }
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
      <ShowcaseCommentsSheet item={commentItem} onRequestClose={() => setCommentItem(null)} />

      <BottomSheet visible={!!actionItem} onRequestClose={() => setActionItem(null)} title={translate("Pilihan karya")}>
        <View className="gap-3">
          <Button variant="ghost" onPress={() => {
            if (actionItem) {
              const dismissed = actionItem.id
              dismissShowcase(dismissed)
              // S-04 (audit 2026-09-24): tindakan yang menghilangkan kartu
              // tanpa jejak harus bisa dibatalkan.
              toast.show({
                title: translate("Karya disembunyikan dari feed"),
                action: { label: translate("Urungkan"), onPress: () => undismissShowcase(dismissed) },
              })
            }
            setActionItem(null)
          }}>{translate("Tidak tertarik")}</Button>
          <Button variant="ghost" onPress={() => {
            setReportItem(actionItem)
            setActionItem(null)
          }}>{translate("Laporkan karya")}</Button>
        </View>
      </BottomSheet>

      {/* A-11: SATU sheet laporan (audit: disalin dari versi inline lama). */}
      <ShowcaseReportSheet item={reportItem} onRequestClose={() => setReportItem(null)} />
    </View>
  )
}
