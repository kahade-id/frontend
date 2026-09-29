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
import { useCallback, useEffect, useMemo, useRef, useState, memo, useSyncExternalStore } from "react"
import { View, type FlatList, type View as RNView } from "react-native"
import Animated, { runOnJS } from "react-native-reanimated"
import { Images, X, ArrowUp } from "phosphor-react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useIsFocused } from "@react-navigation/native"

import { api, isApiError, userMessage } from "@/lib/api"
import { getShowcaseFeed, type ShowcaseFeedSort, type ShowcaseSocialItem } from "@/lib/api/showcase"
import { useHasSession, useSessionRevision } from "@/lib/guest-gate"
import { fetchViaQueryCache } from "@/lib/query-cache"
import { queryKeys } from "@/lib/query-keys"
import { ROUTES } from "@/lib/routes"
import {
  emptyFeedPageState,
  reconcileFeedItems,
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
import { showcaseMedia } from "@/lib/showcase-social"
import { prefetchShowcaseDetail } from "@/lib/showcase-detail-prefetch"
import { tokens } from "@/lib/tokens"
import { modes } from "@/lib/tokens"
import { describeSheetFilters, countActiveFeedFilters } from "@/lib/showcase-filters"
import { useSetUiPrefs, useUiPref, parseShowcaseFeedTab, type ShowcaseFeedTab as SavedFeedTab } from "@/lib/ui-prefs"
import { useCollapsingHeader } from "@/lib/use-collapsing-header"
import { useShowcaseSocialActions } from "@/lib/use-showcase-social-actions"
import { useToast } from "@/components/ui/toast"
import { useTheme } from "@/components/theme-provider"
import { elevationStyle } from "@/lib/elevation"

import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { CoachMark } from "@/components/ui/coach-mark"
import { EmptyState } from "@/components/ui/empty-state"
import { FeedOrientationOverlay } from "@/components/ui/feed-orientation-overlay"
import { IconButton } from "@/components/ui/icon-button"
import { ImageViewer } from "@/components/ui/image-viewer"
import { PaginatedList } from "@/components/ui/paginated-list"
import { ShowcaseCommentsSheet } from "@/components/ui/showcase-comments-sheet"
import { ShowcaseFeedItem } from "@/components/ui/showcase-feed-item"
import { ShowcaseFilterSheet } from "@/components/ui/showcase-filter-sheet"
import {
  DEFAULT_SHOWCASE_FILTERS,
  isDefaultShowcaseFilters,
  type ShowcaseFeedFilters,
} from "@/components/ui/showcase-filter-sheet"
import { ShowcaseReportSheet } from "@/components/ui/showcase-report-sheet"
import { ShowcaseShareSheet } from "@/components/ui/showcase-share-sheet"
import { ModeShiftFade } from "@/components/ui/mode-switcher"
import { ShowcaseHeader, type ShowcaseFeedKind } from "@/components/ui/showcase-header"
import {
  buildFeedPositionKey,
  isFeedPositionRestorable,
  selectTopVisibleAnchor,
} from "@/lib/showcase-feed-position"
import { ShowcaseFeedSkeleton } from "@/components/ui/showcase-feed-skeleton"
import { PushRationaleSheet } from "@/components/ui/push-rationale-sheet"
import { WebGuestBanner } from "@/components/ui/web-guest-banner"
import { Text } from "@/components/ui/text"
import {
  hasSeenFeedOrientation,
  markFeedOrientationSeen,
  hasSeenPushRationale,
  markPushRationaleSeen,
} from "@/lib/first-run"

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
function followingKeysOf(users: readonly { userId?: string | null; username?: string | null }[]): Set<string> {
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
 * PERF-FIX (LR-004): store visibilitas kartu — di luar React state.
 *
 * Masalah: `visibleIds` sebagai useState masuk deps `renderItem`
 * (useCallback) → identitas renderItem berubah di SETIAP tick viewability →
 * FlatList me-render ulang SEMUA sel yang terlihat (mahal: galeri + teks +
 * bar aksi + animasi hati di-mount ulang, jank saat scroll).
 *
 * Pola baru: `onViewableItemsChanged` mem-publish ke store eksternal TANPA
 * me-render induk; tiap FeedCard subscribe via `useSyncExternalStore` dan
 * HANYA kartu yang visibilitasnya berubah yang render ulang. Autoplay video
 * tetap akurat (sinyal yang sama, jalur yang lebih murah).
 */
type VisibilityListener = () => void
const visibilityListeners = new Set<VisibilityListener>()
let visibleIdsSnapshot: ReadonlySet<string> = new Set()
function publishVisibleIds(next: ReadonlySet<string>): void {
  visibleIdsSnapshot = next
  for (const listener of visibilityListeners) listener()
}
function subscribeVisibleIds(listener: VisibilityListener): () => void {
  visibilityListeners.add(listener)
  return () => {
    visibilityListeners.delete(listener)
  }
}
function getVisibleIdsSnapshot(): ReadonlySet<string> {
  return visibleIdsSnapshot
}
/** true bila kartu dengan id ini sedang terlihat di feed (→ video autoplay). */
export function useFeedItemVisible(itemId: string): boolean {
  const snapshot = useSyncExternalStore(subscribeVisibleIds, getVisibleIdsSnapshot)
  return snapshot.has(itemId)
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
  /**
   * R1-003 (2026-09-29, audit render-perf): tab feed aktif dari param rute,
   * dibaca SEKALI di induk — bukan `useLocalSearchParams` per kartu (tiap
   * kartu dulu berlangganan 2x: di sini + di <ShowcaseFeedItem>).
   */
  feedKind?: string
}

const FeedCard = memo(function FeedCard({
  item,
  divider,
  onOpenComments,
  onReport,
  feedKind,
}: FeedCardProps) {
  const { liked, likeCount, saved, likePending, savedPending, toggleLike, toggleSave, share, shareSheetVisible, setShareSheetVisible } =
    useShowcaseSocialActions(item)
  // PERF-FIX (LR-004): visibilitas dibaca dari store eksternal — kartu ini
  // hanya render ulang bila visibilitasnya SENDIRI berubah.
  const visible = useFeedItemVisible(item.id)
  const display = useMemo(
    () =>
      liked === (item.isLiked === true) && likeCount === item.likeCount
        ? item
        : { ...item, isLiked: liked, likeCount },
    [item, liked, likeCount],
  )
  // L-01/L-06: `kind` dibawa ke detail supaya badge kategori di sana
  // mempertahankan tab aktif. R1-003: dioper dari induk sebagai prop —
  // bukan `useLocalSearchParams` per kartu.
  const handlePress = useCallback(
    () => router.push(ROUTES.showcaseDetail(item.id, { kind: feedKind })),
    [item.id, feedKind],
  )
  // C05 (batch 139): press-in pada judul = niat buka detail → prefetch
  // metadata ringan (hanya JSON; video TIDAK diunduh, aman mode hemat data).
  const handlePressIn = useCallback(() => prefetchShowcaseDetail(item.id), [item.id])
  const handleComments = useCallback(() => onOpenComments(item), [onOpenComments, item])
  const handleReport = useCallback(() => onReport(item), [onReport, item])
  /** Viewer gambar layar penuh: ketuk media (bukan judul) membuka ini. */
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  // Batch 19: slide galeri (gambar/video). Viewer hanya menampilkan gambar —
  // indeks media dipetakan ke indeks gambar (video tidak masuk viewer).
  const media = useMemo(() => showcaseMedia(display), [display])
  const viewerImages = useMemo(
    // PERF-FIX (NP-001/LR-002): viewer layar penuh memakai full-res
    // (`fullUrl`), bukan varian thumbnail yang dipakai slide feed.
    () => media.filter((m) => m.kind === "image").map((m) => ({ url: m.fullUrl ?? m.url, alt: item.title })),
    [media, item.title],
  )
  const handleOpenMedia = useCallback(
    (mediaIndex: number) => {
      const slide = media[mediaIndex]
      const imageIndex = media
        .filter((m) => m.kind === "image")
        .findIndex((m) => m.id === slide?.id)
      if (imageIndex >= 0) setViewerIndex(imageIndex)
    },
    [media],
  )
  return (
    <>
      <ShowcaseFeedItem
        item={display}
        feedKind={feedKind}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onOpenMedia={handleOpenMedia}
        autoplayActive={visible}
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
      {viewerIndex != null ? (
        <ImageViewer
          visible
          images={viewerImages}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          title={item.title}
        />
      ) : null}
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
  const params = useLocalSearchParams<{ kind?: string; search?: string }>()
  // Item 47 (FE-IMP-1): tab terakhir yang dibuka persist per perangkat
  // (lib/ui-prefs `showcaseFeedTab`). Param URL (deep link) tetap menang
  // bila ada; kalau tidak, pakai tab terakhir yang disimpan.
  // R1-002: selector per-key — hanya perubahan tab yang membangunkan.
  const showcaseFeedTab = useUiPref("showcaseFeedTab")
  const setUiPrefs = useSetUiPrefs()
  const kindParam: ShowcaseFeedKind | undefined =
    typeof params.kind === "string" ? parseShowcaseFeedTab(params.kind) : undefined
  const kind: ShowcaseFeedKind = kindParam ?? parseShowcaseFeedTab(showcaseFeedTab)
  /**
   * R1-003: nilai mentah param `kind` untuk diteruskan ke kartu —
   * `useLocalSearchParams` hanya dipanggil sekali di sini, bukan per kartu.
   */
  const routeKind = typeof params.kind === "string" ? params.kind : undefined
  // Pencarian inline DIHAPUS dari header (2026-09-23): satu-satunya kolom
  // cari kini layar /search. Param `search` tetap dibaca agar URL lama
  // `/showcase?search=…` (deep link/bookmark) masih terfilter dengan benar —
  // dan chip-nya kini bisa DIHAPUS (A-06).
  const search = typeof params.search === "string" ? params.search.slice(0, 100) : ""
  const setKind = (next: ShowcaseFeedKind) => {
    // Item 47: simpan tab terakhir supaya kembali ke sini saat feed dibuka lagi.
    setUiPrefs({ showcaseFeedTab: next as SavedFeedTab })
    router.setParams({ kind: next })
  }
  const { mode: themeMode } = useTheme()
  // A-16: debounce dibuang — tidak ada kolom ketik yang mengubah `search`
  // di layar ini; debounce hanya menunda fetch saat param URL berubah.
  const activeSearch = search.trim()
  const collapsing = useCollapsingHeader()

  /**
   * Item 58 (FE-IMP-1): tombol "Kembali ke atas". Muncul setelah scroll
   * > 600px, hilang di < 400px (histeresis anti-kedip). Pelacakan offset
   * digabung dengan collapsing header — TIDAK menggantikannya:
   *   - web/iOS: onScroll JS biasa;
   *   - Android: worklet offset (state React disentuh via runOnJS — worklet
   *     tidak boleh menyentuh state langsung).
   */
  const listRef = useRef<FlatList<ShowcaseSocialItem>>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  /**
   * C02 (batch 139): offset terakhir selalu dicerminkan ke ref (bukan hanya
   * state tombol) — bahan pemulihan posisi saat pindah tab/filter.
   */
  const scrollOffsetRef = useRef(0)
  const trackScrollOffset = useCallback((offsetY: number) => {
    scrollOffsetRef.current = offsetY
    setShowScrollTop((prev) => (offsetY > 600 ? true : offsetY < 400 ? false : prev))
  }, [])
  const handleListScroll = useCallback(
    (event: { nativeEvent?: { contentOffset?: { y?: number } } }) => {
      collapsing.onScroll(event as never)
      const y = event?.nativeEvent?.contentOffset?.y
      if (typeof y === "number" && Number.isFinite(y)) trackScrollOffset(y)
    },
    [collapsing, trackScrollOffset],
  )
  const handleListScrollWorklet = useCallback(
    (offsetY: number) => {
      "worklet"
      collapsing.scrollWorklet(offsetY)
      runOnJS(trackScrollOffset)(offsetY)
    },
    [collapsing, trackScrollOffset],
  )
  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [])

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
  /**
   * Kontrak final Tim A #D (2026-09-28): filter sheet (kondisi, rating
   * penjual, harga) → dipetakan ke query server di `filter` di bawah.
   */
  const [sheetFilters, setSheetFilters] = useState<ShowcaseFeedFilters>(DEFAULT_SHOWCASE_FILTERS)
  const [filterSheetVisible, setFilterSheetVisible] = useState(false)
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
  /**
   * C02 (batch 139): cache POSISI scroll per (tab × filter × sesi) — pindah
   * tab/filter lalu kembali memulihkan offset, bukan kembali ke atas.
   * Kunci memakai JSON filter (objek datar berisi string/number/undefined).
   */
  const positionCache = useRef<Record<string, { offset: number; anchorId: string | null }>>({})
  /** Kunci (tab × filter × sesi) yang terakhir aktif — untuk menyimpan posisi. */
  const lastPositionKeyRef = useRef<string | null>(null)
  /** Pemulihan offset yang menunggu daftar selesai di-render ulang. */
  const pendingRestoreRef = useRef<{ offset: number } | null>(null)
  const positionKey = useCallback(
    (kindValue: ShowcaseFeedKind, filterValue: ShowcaseFeedFilter, revisionValue: number) =>
      // C02: kunci cache posisi per tab × filter × revision/sesi.
      buildFeedPositionKey(kindValue, revisionValue, filterValue),
    [],
  )
  /** Simpan offset + anchor tab/filter yang sedang aktif. */
  const savePosition = useCallback(() => {
    const key = lastPositionKeyRef.current
    if (!key) return
    positionCache.current[key] = {
      offset: scrollOffsetRef.current,
      anchorId: topVisibleRef.current?.id ?? null,
    }
  }, [])
  /**
   * Jadwalkan pemulihan offset untuk kunci ini. Anchor harus masih ada di
   * dataset — bila tidak, dataset berubah dan posisi TIDAK dipulihkan.
   */
  const restorePosition = useCallback((key: string) => {
    const saved = positionCache.current[key]
    // C02: guard murni — offset positif + anchor masih ada.
    if (!isFeedPositionRestorable(saved, itemsRef.current.map((item) => item.id))) return
    pendingRestoreRef.current = { offset: saved.offset }
  }, [])
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
   * Batch 19 (item 16) + PERF-FIX (LR-004): id item yang terlihat di layar —
   * penggerak autoplay video (hanya item terlihat yang `autoplayActive`).
   * `onViewableItemsChanged` harus stabil (FlatList memaksa identitas) →
   * useCallback kosong. Hasilnya di-publish ke store eksternal (bukan
   * useState) supaya `renderItem` tidak berubah identitas di setiap tick.
   */
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60, minimumViewTime: 250 }).current
  /** C02 (batch 139): anchor = item terlihat paling atas (indeks terkecil). */
  const topVisibleRef = useRef<{ id: string } | null>(null)
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { item: ShowcaseSocialItem; index?: number | null }[] }) => {
      publishVisibleIds(new Set(viewableItems.map((v) => v.item.id)))
      // C02: anchor = item terlihat paling atas (indeks terkecil).
      const top = selectTopVisibleAnchor(viewableItems)
      topVisibleRef.current = top ? { id: top.id } : null
    },
    [],
  )
  // LR-004: store visibilitas hidup di level modul — reset saat tab
  // terpasang ulang supaya id basi dari mount sebelumnya tidak memicu
  // autoplay kartu yang tak terlihat.
  useEffect(() => {
    publishVisibleIds(new Set())
  }, [])
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
  /**
   * U5-003/U5-005 (journey): mesin fase first-run di feed — BERURUTAN, tidak
   * bertumpuk: (1) overlay orientasi 3 kartu (U5-005, semua user termasuk
   * tamu), (2) bottom sheet rationale notifikasi (U5-003, hanya yang login),
   * (3) selesai → coach mark orientasi beli boleh tampil (U5-004).
   */
  type FirstRunPhase = "checking" | "orientation" | "push" | "done"
  const [firstRunPhase, setFirstRunPhase] = useState<FirstRunPhase>("checking")
  useEffect(() => {
    let alive = true
    void (async () => {
      const [orientationSeen, pushSeen] = await Promise.all([
        hasSeenFeedOrientation(),
        hasSeenPushRationale(),
      ])
      if (!alive) return
      if (!orientationSeen) setFirstRunPhase("orientation")
      else if (hasSession && !pushSeen) setFirstRunPhase("push")
      else setFirstRunPhase("done")
    })()
    return () => {
      alive = false
    }
  }, [hasSession])
  const dismissOrientation = useCallback(() => {
    void markFeedOrientationSeen()
    // Setelah orientasi: lanjut ke sheet notifikasi bila login & belum pernah.
    void hasSeenPushRationale().then((seen) => {
      setFirstRunPhase(hasSessionRef.current && !seen ? "push" : "done")
    })
  }, [])
  const closePushSheet = useCallback(() => {
    void markPushRationaleSeen()
    setFirstRunPhase("done")
  }, [])

  const markGuest = useCallback(() => {
    followingIndexRef.current = null
    setFollowingSet((previous) => previous?.size === 0 ? previous : new Set())
    setFollowingGuest(true)
  }, [])

  /**
   * Filter aktif — kunci himpunan hasil (tab × search × kategori × lokasi ×
   * kondisi × rating × harga). Perubahan nilai → `sameFeedFilter` false →
   * kursor & cache di-reset (A-01).
   */
  const filter: ShowcaseFeedFilter = useMemo(
    () => ({
      search: activeSearch || undefined,
      category: category || undefined,
      location: location || undefined,
      // Kontrak final Tim A #D: NEW/USED → baru/bekas; 4/4_5 → 4.0/4.5.
      condition: sheetFilters.condition === "NEW" ? "baru" : sheetFilters.condition === "USED" ? "bekas" : undefined,
      minSellerRating:
        sheetFilters.minRating === "4" ? 4 : sheetFilters.minRating === "4_5" ? 4.5 : undefined,
      minPrice: sheetFilters.price.min ?? undefined,
      maxPrice: sheetFilters.price.max ?? undefined,
    }),
    [activeSearch, category, location, sheetFilters],
  )

  /**
   * D1-006 (perf 2026-09-29): SATU request `GET /v1/users/me/following-ids`
   * (satu query follow.findMany di backend) — gantikan loop hingga
   * FOLLOWING_INDEX_MAX_PAGES halaman getFollowing. Hanya 401/403 yang
   * berarti tamu; error lain di-RETHROW supaya pemanggil menampilkan
   * ErrorState, bukan pseudologin. A-04: cache per akun (ref tab) — hanya
   * fetch saat miss; dibuang saat ganti sesi/akun atau tarik-segarkan.
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
        if (signal.aborted) throw new Error("Aborted")
        const rows = await api.users.getMyFollowingIds(signal)
        if (signal.aborted) throw new Error("Aborted")
        const keys = followingKeysOf(rows)
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
        condition: filter.condition,
        minSellerRating: filter.minSellerRating,
        minPrice: filter.minPrice,
        maxPrice: filter.maxPrice,
      }
      try {
        let incoming: ShowcaseSocialItem[] = []
        let nextHasMore = false
        /** F-05: di-set di cabang `following` bila plafon sisi klien tercapai. */
        let truncatedFollowing = false

        if (kind === "latest" || kind === "popular" || kind === "forYou") {
          // "Untuk Anda" diranking di server via sort=foryou (personal per
          // user dari sinyal like/follow/view; permintaan produk 2026-09-28)
          // — tidak lagi interleave latest+popular di klien.
          const sort: ShowcaseFeedSort = kind === "forYou" ? "foryou" : kind
          const cursorKey = kind === "forYou" ? "forYou" : kind
          const page = await getShowcaseFeed(
            { ...query, sort, cursor: slot.cursors[cursorKey] ?? undefined },
            controller.signal,
          )
          slot.cursors[cursorKey] = page.nextCursor
          slot.hasMore[cursorKey] = page.hasMore
          incoming = page.items
          nextHasMore = page.hasMore
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
          /**
           * NP-005 (audit performa): tampilkan parsial — halaman pertama yang
           * lolos filter langsung di-commit ke layar (kartu tampil setelah
           * ~1× RTT), halaman lanjutan tetap diambil di latar sampai
           * FOLLOWING_MIN_ITEMS terkumpul / plafon tercapai. Dulu 3 halaman
           * serial menahan paint kartu pertama sampai SEMUA selesai
           * (3× RTT di 3G) + halaman mentah yang terbuang.
           * Bukan renderItem/viewability (milik Tim A): hanya titik commit.
           */
          let partialCommitted = false
          for (; set.size > 0 && pageIndex < FOLLOWING_MAX_PAGES; pageIndex++) {
            const page = await getShowcaseFeed(
              { ...query, sort: "latest", cursor: slot.cursors.latest ?? undefined },
              controller.signal,
            )
            if (controller.signal.aborted) return
            slot.cursors.latest = page.nextCursor
            slot.hasMore.latest = page.hasMore
            collected.push(...page.items.filter((item) => followedBy(set, item)))
            if (!partialCommitted && collected.length > 0) {
              partialCommitted = true
              // Interim: data lama (refresh) diganti parsial — final commit di
              // bawah menimpa lagi dengan hasil lengkap; mode "more" merge
              // per-id (reconcileFeedItems) sehingga tidak ada duplikat.
              const visiblePartial = collected.filter((item) => !isShowcaseReported(item.id))
              const partialItems = reconcileFeedItems(mode, itemsRef.current, visiblePartial)
              itemsRef.current = partialItems
              setItems(partialItems)
              if (mode === "initial") setLoading(false)
            }
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
        // C03: refresh/initial mengganti daftar (data lama tetap tampil
        // selama fetch); "more" menggabungkan.
        const nextItems = reconcileFeedItems(mode, itemsRef.current, visible)
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
  // C02 (batch 139): posisi scroll ikut dipulihkan bila dataset tidak berubah.
  useEffect(() => {
    // Simpan posisi tab/filter LAMA sebelum beralih.
    savePosition()
    const key = positionKey(kind, filter, revision)
    lastPositionKeyRef.current = key
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
      restorePosition(key)
    } else {
      itemsRef.current = []
      setItems([])
      setHasMore(false)
      void fetchPage("initial")
    }
    return () => {
      activeRequest.current?.abort()
      // C02: simpan posisi saat tab dilepas (unmount/ganti kunci).
      savePosition()
    }
  }, [fetchPage, revision, hasSession, kind, filter, positionKey, savePosition, restorePosition])

  /**
   * C02 (batch 139): terapkan pemulihan offset SETELAH daftar ter-render
   * ulang (dua frame — pastikan FlatList sudah me-layout item yang
   * dipulihkan dari cache).
   */
  useEffect(() => {
    const pending = pendingRestoreRef.current
    if (!pending) return
    pendingRestoreRef.current = null
    let cancelled = false
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) listRef.current?.scrollToOffset({ offset: pending.offset, animated: false })
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [items])

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

  /** A-07: renderItem STABIL — divider dihitung lewat ref, bukan closure items.
   * PERF-FIX (LR-004): `visible` tidak lagi lewat prop — tiap FeedCard
   * subscribe visibilitasnya sendiri via `useFeedItemVisible`, sehingga
   * renderItem tidak berubah identitas di setiap tick viewability.
   *
   * R1-003: `kind` rute dibaca sekali di induk → oper sebagai prop
   * `feedKind` (bukan 2 langganan useLocalSearchParams per kartu).
   *
   * U5-004 (journey): kartu pertama dibungkus View ber-ref sebagai jangkar
   * coach mark orientasi beli ("feed-buy"). Wrapper polos tanpa style —
   * tidak mengubah layout (kolom flex default).
   */
  const firstCardRef = useRef<RNView | null>(null)
  const renderItem = useCallback(
    ({ item, index }: { item: ShowcaseSocialItem; index: number }) => {
      const card = (
        <FeedCard
          item={item}
          divider={index < itemsLengthRef.current - 1}
          onOpenComments={handleOpenComments}
          onReport={handleOpenReport}
          feedKind={routeKind}
        />
      )
      return index === 0 ? (
        <View ref={firstCardRef} collapsable={false}>
          {card}
        </View>
      ) : (
        card
      )
    },
    [handleOpenComments, handleOpenReport, routeKind],
  )

  /**
   * Item 55 (FE-IMP-1): satu tombol reset menghapus SEMUA filter aktif
   * (search + kategori + lokasi + filter sheet). Didefinisikan di sini
   * supaya dipakai empty state di bawah.
   */
  const filtersActive =
    activeSearch !== "" || !!category || !!location || !isDefaultShowcaseFilters(sheetFilters)
  const resetAllFilters = useCallback(() => {
    setSheetFilters(DEFAULT_SHOWCASE_FILTERS)
    onClearCategory?.()
    onClearLocation?.()
    // `search` hidup di param URL — hapus paramnya.
    router.setParams({ search: undefined })
  }, [onClearCategory, onClearLocation])

  const emptyState = (() => {
    if (kind === "following" && followingGuest) {
      return (
        <EmptyState
          icon={Images}
          title={translate("Masuk untuk melihat feed mengikuti")}
          action={
            <Button fullWidth={false} onPress={() => router.push(ROUTES.loginRequired("/showcase?kind=following"))}>{translate("Masuk")}</Button>
          }
        />
      )
    }
    if (kind === "following" && followingSet?.size === 0) {
      return (
        <EmptyState
          icon={Images}
          title={translate("Anda belum mengikuti siapa pun")}
          // A-18 (audit 2026-09-23): tombol ke tujuan yang disebut copy-nya.
          action={<Button fullWidth={false} onPress={() => router.push(ROUTES.discover)}>{translate("Buka Temukan")}</Button>}
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
        // Item 55 (FE-IMP-1): bila hasil KOSONG karena filter aktif, SATU
        // tombol "Atur ulang filter" menghapus search + kategori + lokasi +
        // filter sheet sekaligus — jangan biarkan pengguna menebak filter
        // mana yang menyembunyikan hasil.
        action={
          filtersActive ? (
            <Button variant="secondary" fullWidth={false} onPress={resetAllFilters}>
              {translate("Atur ulang filter")}
            </Button>
          ) : // A-20 (audit 2026-09-23): CTA isi etalase untuk pemilik akun.
          hasSession ? (
            <Button variant="secondary" fullWidth={false} onPress={() => router.push(ROUTES.showcaseManagement)}>
              {translate("Tambah karya")}
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
  const sheetFilterChip = !isDefaultShowcaseFilters(sheetFilters) ? (
    <View className="mt-3 flex-row items-center justify-between gap-2 rounded-full border border-border bg-surface py-1.5 pl-4 pr-1.5 mx-5">
      <Text variant="caption" tone="secondary" className="flex-1" numberOfLines={1}>
        {describeSheetFilters(sheetFilters)}
      </Text>
      <IconButton
        icon={X}
        variant="ghost"
        size="sm"
        accessibilityLabel={translate("Hapus semua filter")}
        onPress={() => setSheetFilters(DEFAULT_SHOWCASE_FILTERS)}
      />
    </View>
  ) : null

  /**
   * C15 (batch 139): aksi "Atur ulang" SELALU terlihat selama ada filter
   * aktif — satu ketuk menghapus search + kategori + lokasi + filter sheet.
   * (Chip individual di atas tetap ada untuk hapus satu per satu.)
   */
  const resetAllChip = filtersActive ? (
    <View className="mt-3 flex-row items-center justify-between gap-2 rounded-full border border-border bg-surface py-1.5 pl-4 pr-1.5 mx-5">
      <Text variant="caption" weight={600} className="flex-1" numberOfLines={1}>
        {translate("{x} filter aktif", { x: countActiveFeedFilters({
          search: activeSearch,
          category,
          location,
          sheet: sheetFilters,
        }) })}
      </Text>
      <Button
        variant="ghost"
        size="sm"
        onPress={resetAllFilters}
        accessibilityLabel={translate("Atur ulang semua filter")}
      >
        {translate("Atur ulang")}
      </Button>
    </View>
  ) : null

  return (
    <View className="flex-1">
      {/* U5-017 (journey): banner ramping tamu web — di atas header. */}
      <WebGuestBanner />
      {/* ── Header showcase — pensil kelola · logo · notifikasi + tab feed ── */}
      <Animated.View
        style={[
          collapsing.containerStyle,
          { pointerEvents: collapsing.collapsed ? "none" : "auto" },
        ]}
      >
        <Animated.View style={collapsing.contentStyle} onLayout={collapsing.onHeaderLayout}>
          <ShowcaseHeader
            kind={kind}
            onKindChange={setKind}
            tabs={feedTabs}
            onFilterPress={() => setFilterSheetVisible(true)}
            // C15 (batch 139): badge menghitung SEMUA filter aktif (sheet +
            // pencarian + kategori + lokasi) supaya pengguna tidak lupa
            // filter harga/kategori masih aktif.
            filterBadgeCount={countActiveFeedFilters({
              search: activeSearch,
              category,
              location,
              sheet: sheetFilters,
            })}
          />
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
        onScroll={handleListScroll}
        onScrollWorklet={handleListScrollWorklet}
        listRef={listRef}
        // Feed bergaya postingan sosial: media full-bleed memotong gutter —
        // teks di dalam <ShowcaseFeedItem> membawa px-5 sendiri.
        padded={false}
        // Jarak antar postingan 20px: divider di akhir tiap item jatuh
        // hampir tepat di tengah celah (lihat <ShowcaseFeedItem divider>).
        gap={tokens.space[5]}
        bottomPadding={bottomPadding}
        header={
          searchChip || categoryChip || locationChip || followingPartialNotice || resetAllChip ? (
            <View>{searchChip}{categoryChip}{locationChip}{sheetFilterChip}{resetAllChip}{followingPartialNotice}</View>
          ) : undefined
        }
        // Skeleton sebentuk <ShowcaseFeedItem> (anatomi: penulis · media ·
        // teks · baris aksi) — layout tidak melompat saat data tiba.
        loadingPlaceholder={<ShowcaseFeedSkeleton />}
        empty={emptyState}
        renderItem={renderItem}
        // Batch 19 (item 16): lacak item terlihat untuk autoplay video feed.
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
      </ModeShiftFade>

      {/* Item 58: tombol melayang "Kembali ke atas" — muncul hanya setelah
          scroll jauh; posisi di atas bottom padding tab. */}
      {showScrollTop ? (
        <View
          className="absolute bottom-6 right-5"
          style={{ marginBottom: bottomPadding }}
        >
          <View
            className="rounded-full"
            style={[{ backgroundColor: modes[themeMode].surface }, elevationStyle("medium", themeMode)]}
          >
            <IconButton
              icon={ArrowUp}
              variant="ghost"
              size="md"
              accessibilityLabel={translate("Kembali ke atas")}
              accessibilityHint={translate("Gulir feed ke posisi paling atas")}
              onPress={scrollToTop}
            />
          </View>
        </View>
      ) : null}

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

      {/* Kontrak final Tim A #D: sheet filter kondisi/rating/harga. */}
      <ShowcaseFilterSheet
        visible={filterSheetVisible}
        initial={sheetFilters}
        onApply={setSheetFilters}
        onRequestClose={() => setFilterSheetVisible(false)}
      />

      {/*
       * U5-005 (journey): overlay orientasi first-run — 3 kartu konsep +
       * 1 baris per tab. Tampil sekali; fase "push" menyusul setelahnya.
       */}
      <FeedOrientationOverlay
        visible={firstRunPhase === "orientation"}
        onDismiss={dismissOrientation}
      />
      {/*
       * U5-003 (journey): rationale izin notifikasi sebagai bottom sheet di
       * feed pada login pertama (pengganti layar welcome). "Nanti" = tutup.
       */}
      <PushRationaleSheet
        visible={firstRunPhase === "push"}
        onClose={closePushSheet}
      />
      {/*
       * U5-004 (journey): coach mark orientasi BELI — kunjungan pertama ke
       * feed, didahulukan dari coach mark "+". Jangkar = kartu feed pertama.
       * Baru di-mount setelah fase first-run selesai agar tidak bertumpuk
       * dengan overlay/sheet di atas.
       */}
      {firstRunPhase === "done" ? (
        <CoachMark
          id="feed-buy"
          targetRef={firstCardRef}
          message="Ini feed produk — ketuk barang untuk lihat detail & beli via escrow"
          delayMs={900}
        />
      ) : null}
    </View>
  )
}
