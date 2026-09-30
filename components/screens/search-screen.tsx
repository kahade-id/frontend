/**
 * Layar Stack — Pencarian global (pengguna, POSTINGAN etalase, pesanan,
 * mutasi, artikel bantuan).
 *
 * Revisi 2026-09-23: kolom pencarian di header Etalase DIHAPUS — layar INI
 * satu-satunya pusat pencarian app (permintaan produk). Karena itu kini
 * mencari juga postingan etalase (GET /v1/showcase/feed?search=…, publik).
 *
 * Anatomi: kolom cari → (saat ada kata kunci) chip cakupan + chip saran →
 * hasil berkelompok → (saat kolom kosong) riwayat pencarian.
 *
 * Keputusan desain:
 *   - CAKUPAN bisa dipersempit (Semua | Pengguna | Postingan | Pesanan |
 *     Mutasi). Untuk jenis yang memang didukung `GET /v1/search`, cakupan
 *     dikirim sebagai parameter `types` — endpoint itu menerima daftar jenis,
 *     dan versi lama selalu mengirim semuanya lalu membuang sebagian hasilnya
 *     di klien. Menyaring di server berarti jatah `limit: 20` dipakai untuk
 *     jenis yang benar-benar diminta: mencari "budi" dengan cakupan Pengguna
 *     kini bisa mengembalikan 20 orang, bukan 20 hasil campur yang kebetulan
 *     berisi beberapa orang.
 *   - Postingan TIDAK lewat /v1/search (jenis itu tidak ada di endpoint
 *     tersebut) — ia memakai feed etalase dengan parameter `search`, pola
 *     yang sama dengan tab Etalase. Cakupan "Postingan" pun tidak
 *     menembakkan /v1/search sama sekali (paritas dengan cakupan Pengguna).
 *   - Chip cakupan HANYA muncul setelah ada kata kunci. Menawarkan filter
 *     atas hasil yang belum ada adalah kontrol tanpa objek.
 *   - Bagian "Pengguna" memakai endpoint dedikasi GET /v1/users/search (lebih
 *     kaya: membershipRank; throttle 10 rpm/IP) — /v1/search tetap dipakai
 *     untuk pesanan, mutasi, dan artikel. Bila endpoint dedikasi gagal, hasil
 *     user dari /v1/search dipakai sebagai fallback.
 *   - Judul kelompok membawa JUMLAH hasil. Dalam daftar campur, "Pesanan"
 *     saja tidak memberi tahu apakah ada 1 atau 40 pesanan di bawahnya, dan
 *     pengguna harus menggulir untuk tahu.
 *   - Pengumuman hasil lewat <LiveRegion> (§10): hasil berubah tanpa
 *     perpindahan fokus, jadi tanpa ini pengguna VoiceOver/TalkBack tidak
 *     pernah diberi tahu bahwa hasil sudah datang atau pencarian gagal.
 *     State `loading` SENGAJA tidak diumumkan — kata kunci berubah tiap
 *     ketikan dan "mencari…" akan menumpuk di antrean.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Platform, View, type ListRenderItem } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ArrowUpLeft, ChatCircleText, ClockCounterClockwise, Images, MagnifyingGlass, MapPin, TrendUp, X } from "phosphor-react-native"
import { router, useLocalSearchParams } from "expo-router"
import { api, type Order, type UserSearchResult, type WalletTransaction } from "@/lib/api"
import { getShowcaseFeed, type ShowcaseSocialItem } from "@/lib/api/showcase"
import { showcaseImages } from "@/lib/showcase-social"
import { formatDateTime, formatNumber, formatRupiah } from "@/lib/format"
import { resolveMediaUrl } from "@/lib/media"
import { translate } from "@/lib/i18n/translate"
import { buildResultMessage, getSearchEmptyStateCopy, pickDidYouMean } from "@/lib/search-ui"
import { useLanguage } from "@/lib/i18n"
import { cn } from "@/lib/cn"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { isSearchScope, useSetUiPrefs, useUiPref, type SearchScope } from "@/lib/ui-prefs"
import { useHasSession } from "@/lib/guest-gate"
import { logWarn } from "@/lib/telemetry"
import type { ChatSearchResult } from "@/lib/api/chat"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { Divider } from "@/components/ui/divider"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { HelpArticleListItem } from "@/components/ui/help-article-list-item"
import { Highlight } from "@/components/ui/highlight"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { LiveRegion } from "@/components/ui/live-region"
import { ListLoading } from "@/components/ui/paginated-list"
import { OrderCard } from "@/components/ui/order-card"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { PullToRefreshFlatList } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { ScrollRow } from "@/components/ui/scroll-row"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"
import { UserListItem } from "@/components/ui/user-list-item"
import { WalletTransactionRow } from "@/components/ui/wallet-transaction-row"
import { useWalletEnabled } from "@/lib/use-wallet-enabled"
import { focusRing } from "@/lib/focus-ring"

type ResultRow = { id: string } & (
  | { kind: "user"; user: UserSearchResult }
  | { kind: "showcase"; showcase: ShowcaseSocialItem }
  | { kind: "order"; order: Order }
  | { kind: "transaction"; transaction: WalletTransaction }
  | { kind: "article"; article: import("@/lib/api/search").SearchHelpArticle }
  | { kind: "chat"; chat: ChatSearchResult }
)

/**
 * Cakupan hasil — "all" mengirim semua jenis, sisanya menyaring per sumber.
 * Item 77 (mega-batch 2026-09-28): nilai ini kini PERSISTEN via ui-prefs
 * (`prefs.searchScope`) — pilihan cakupan terakhir diingat antar sesi.
 */
type Scope = SearchScope

/** i18n: label cakupan mengikuti bahasa aktif (dulu konstanta modul). */
function useScopes(): ReadonlyArray<{ value: Scope; label: string }> {
  const language = useLanguage()
  return useMemo(
    () => [
      { value: "all", label: translate("Semua") },
      { value: "users", label: translate("Pengguna") },
      { value: "posts", label: translate("Postingan") },
      { value: "orders", label: translate("Pesanan") },
      { value: "transactions", label: translate("Mutasi") },
      // Item 87 (mega-batch 2026-09-28): pencarian lintas-room.
      { value: "chats", label: translate("Pesan") },
    ],
    [language],
  )
}

/** Parameter `types` untuk GET /v1/search per cakupan (postingan & chat di luar endpoint ini). */
const SCOPE_TYPES: Record<Exclude<Scope, "posts" | "chats">, string> = {
  // DC-002: cakupan "all" meminta help-center agar section Bantuan hidup.
  all: "users,orders,transactions,help-center",
  users: "users",
  orders: "orders",
  transactions: "transactions",
}

/** Judul kelompok + jumlah hasil (dipakai di header tiap kelompok). */
/** i18n: judul seksi mengikuti bahasa aktif (dulu konstanta modul). */
function useSectionTitle(): Record<ResultRow["kind"], string> {
  const language = useLanguage()
  return useMemo(
    () => ({
      user: translate("Pengguna"),
      showcase: translate("Postingan"),
      order: translate("Pesanan"),
      transaction: translate("Mutasi"),
      article: translate("Bantuan"),
      chat: translate("Pesan"),
    }),
    [language],
  )
}

/** Minimal kata kunci sebelum request ditembakkan. */
const MIN_KEYWORD = 2

/**
 * R1-006 (2026-09-29, audit render-perf): separator stabil level modul —
 * inline arrow memaksa FlatList render ulang tiap render parent.
 */
function SearchItemSeparator() {
  return <View className="h-3" />
}

type SearchResultRowProps = {
  item: ResultRow
  showSection: boolean
  showSectionLabel: boolean
  sectionLabel: string
  sectionCount: number
  keyword: string
  onOpenUserProfile: (username: string) => void
}

/**
 * FE-008 (audit 2026-09-29): baris hasil pencarian di-memo — `renderItem`
 * inline yang berat (komputasi per jenis, IIFE baris order, translate per
 * baris) dipindah ke sini, hanya berjalan saat baris sendiri berubah.
 * `useLanguage()` agar label ikut berganti bahasa (pola ShowcaseFeedItem).
 */
const SearchResultRow = memo(function SearchResultRow({
  item,
  showSection,
  showSectionLabel,
  sectionLabel,
  sectionCount,
  keyword,
  onOpenUserProfile,
}: SearchResultRowProps) {
  useLanguage()
  const handleUserPress = useCallback(() => {
    if (item.kind === "user" && item.user.username) onOpenUserProfile(item.user.username)
  }, [item, onOpenUserProfile])

  const body =
    item.kind === "user" ? (
      <UserListItem
        padded={false}
        name={item.user.fullName || item.user.username || "Identitas belum tersedia"}
        username={item.user.username ?? undefined}
        avatar={item.user.avatarUrl ? { source: item.user.avatarUrl } : undefined}
        sealTier={item.user.sealTier ?? null}
        // Item 80: keyword ditonjolkan di nama. Item 84: rank
        // keanggotaan tampil di baris hasil (dari GET /v1/users/search).
        highlight={keyword}
        stat={
          item.user.membershipRank
            ? translate("Anggota {x}", { x: item.user.membershipRank })
            : undefined
        }
        chevron
        onPress={item.user.username ? handleUserPress : undefined}
      />
    ) : item.kind === "transaction" ? (
      <WalletTransactionRow
        transaction={item.transaction}
        href={ROUTES.walletTransaction(item.transaction.id)}
        highlight={keyword}
      />
    ) : item.kind === "article" ? (
      <HelpArticleListItem
        padded={false}
        title={item.article.title}
        snippet={item.article.snippet}
        highlight={keyword}
        href={ROUTES.helpArticle(item.article.slug, undefined, item.article.title)}
      />
    ) : item.kind === "showcase" ? (
      <ShowcaseResultRow item={item.showcase} keyword={keyword} />
    ) : item.kind === "chat" ? (
      <ChatResultRow result={item.chat} keyword={keyword} />
    ) : (
      <OrderRowBody order={item.order} keyword={keyword} />
    )

  return (
    <View className="gap-2">
      {showSection ? (
        // FE-086 (audit 2026-09-29): bila satu cakupan aktif, judul section
        // menduplikasi chip cakupan — sisakan angka jumlahnya saja.
        showSectionLabel ? (
          // Judul kelompok + jumlah: dalam daftar campur, nama jenis saja
          // tidak memberi tahu seberapa banyak yang menunggu di bawahnya
          // tanpa menggulir.
          <View className="flex-row items-baseline justify-between gap-3 pt-1">
            <Text variant="label" tone="secondary">
              {sectionLabel}
            </Text>
            <Text variant="caption" tone="tertiary">
              {formatNumber(sectionCount)}
            </Text>
          </View>
        ) : (
          <View className="flex-row justify-end pt-1">
            <Text variant="caption" tone="tertiary">
              {formatNumber(sectionCount)}
            </Text>
          </View>
        )
      ) : null}
      {body}
    </View>
  )
})

/** FE-008: komputasi per-baris jenis order (role/counterpart) — hanya dihitung saat baris di-memo me-render. */
function OrderRowBody({ order, keyword }: { order: Order; keyword: string }) {
  const role =
    order.myRole === "BUYER" ? "buyer" : order.myRole === "SELLER" ? "seller" : undefined
  const counterpart =
    role === "buyer" ? order.seller : role === "seller" ? order.buyer : undefined
  return (
    <OrderCard
      orderId={order.id}
      title={order.title}
      amount={order.orderValue}
      status={order.status}
      role={role}
      counterpart={{
        name: counterpart?.fullName ?? counterpart?.username ?? "Identitas belum tersedia",
      }}
      timestamp={formatDateTime(order.createdAt)}
      href={ROUTES.orderDetail(order.id)}
      highlight={keyword}
    />
  )
}

export default function SearchScreen() {
  // Mode Tanpa Wallet Internal (BI-safe): hasil mutasi dompet disembunyikan
  // saat kill-switch mati (tidak ada rute dompet yang bisa dibuka).
  const walletEnabled = useWalletEnabled()
  const scopes = useScopes()
  const sectionTitle = useSectionTitle()
  const insets = useSafeAreaInsets()
  /*
   * Hanya kata kunci yang sudah tenang yang tinggal di layar ini; teks mentah
   * dikurung di dalam <DebouncedSearchField>. Sebelumnya setiap ketukan huruf
   * merender ulang layar dan seluruh baris hasil yang terlihat (kartu pesanan,
   * avatar pengguna, baris mutasi) — padahal request-nya sendiri baru jalan
   * setelah pengguna berhenti mengetik.
   *
   * `seed` = teks yang disorongkan ke kolom dari luar (chip saran, chip
   * riwayat, tombol atur ulang). <DebouncedSearchField> menyinkronkan
   * perubahannya ke teks yang terlihat TANPA di-remount, jadi fokus dan
   * keyboard tidak hilang setiap kali pengguna memilih saran.
   *
   * `seedNonce` melengkapi satu kasus yang tidak bisa ditangani sinkronisasi
   * itu: atur ulang ketika seed belum pernah berubah (pengguna mengetik
   * manual, lalu menekan "Atur ulang pencarian"). Prop-nya tetap "" sehingga
   * tidak ada perubahan untuk disinkronkan; menaikkan nonce me-remount kolom
   * dalam keadaan kosong — dan karena <SearchField> default autoFocus, fokus
   * langsung kembali ke kolom kosong itu. Itu memang makna "mulai dari awal".
   */
  const [keyword, setKeyword] = useState("")
  const [seed, setSeed] = useState("")
  const [seedNonce, setSeedNonce] = useState(0)
  // Item 77 (mega-batch 2026-09-28): cakupan PERSISTEN via ui-prefs — pilihan
  // terakhir ("Semua" | "Pengguna" | …) diingat antar sesi.
  const searchScope = useUiPref("searchScope")
  const setPrefs = useSetUiPrefs()
  const scope: Scope = searchScope
  const setScope = (next: Scope) => setPrefs({ searchScope: next })
  /*
   * Filter lokasi (free-text, mis. "Jakarta"): hanya memengaruhi hasil
   * POSTINGAN — backend mencocokkan `users.address` milik owner
   * (case-insensitive) di feed etalase dan /v1/search jenis `showcase`.
   * State mentah dikurung di <DebouncedSearchField> (pola yang sama dengan
   * kata kunci): layar hanya menerima nilai yang sudah tenang supaya daftar
   * tidak refetch tiap ketukan huruf.
   */
  const [location, setLocation] = useState("")
  const [locationSeed, setLocationSeed] = useState("")
  const [locationNonce, setLocationNonce] = useState(0)
  const [clearingHistory, setClearingHistory] = useState(false)
  // DC-020: umpan balik bila hapus riwayat gagal (sebelumnya catch kosong —
  // user mengira riwayat terhapus padahal tidak).
  const [historyError, setHistoryError] = useState<string | null>(null)
  // Item 76 (mega-batch 2026-09-28): riwayat dibatasi 8 dengan toggle
  // "Lihat semua".
  const [historyExpanded, setHistoryExpanded] = useState(false)
  // Item 75 (mega-batch 2026-09-28): hapus per item + umpan balik gagal.
  const [deletingItem, setDeletingItem] = useState<string | null>(null)
  const [deleteItemError, setDeleteItemError] = useState<string | null>(null)
  const enabled = keyword.trim().length >= MIN_KEYWORD
  const wantUsers = scope === "all" || scope === "users"
  const wantPosts = scope === "all" || scope === "posts"
  // Item 87: chat lintas-room — endpoint dedikasi GET /v1/chat/search.
  const wantChats = scope === "all" || scope === "chats"
  // Cakupan "Pengguna" dilayani endpoint dedikasi saja — tidak ada alasan
  // menembakkan GET /v1/search untuk daftar yang hasilnya dibuang.
  const usersOnly = scope === "users"
  // Cakupan "Postingan" juga DI LUAR /v1/search (jenis itu tidak didukung
  // endpoint) — dilayani feed etalase dengan parameter `search`.
  const postsOnly = scope === "posts"
  // Cakupan "Pesan" DI LUAR /v1/search — dilayani GET /v1/chat/search.
  const chatsOnly = scope === "chats"

  const result = useApiQuery(
    `search:${scope}:${keyword}:${location}`,
    (signal) =>
      api.search.globalSearch(
        { q: keyword, types: SCOPE_TYPES[scope as Exclude<Scope, "posts" | "chats">], limit: 20, location: location || undefined },
        signal,
      ),
    enabled && !usersOnly && !postsOnly && !chatsOnly,
  )
  const usersResult = useApiQuery(
    `search-users:${keyword}`,
    (signal) => api.users.searchUsers(keyword, { limit: 20 }, signal),
    enabled && wantUsers,
  )
  // Postingan etalase — feed publik (auth:"optional"), 12 hasil cukup untuk
  // satu layar; penelusuran lanjutan hidup di tab Etalase itu sendiri.
  // Filter lokasi diteruskan ke feed (backend: users.address ILIKE).
  const postsResult = useApiQuery(
    `search-posts:${keyword}:${location}`,
    (signal) => getShowcaseFeed({ search: keyword, limit: 12, location: location || undefined }, signal),
    enabled && wantPosts,
  )
  // Item 87 (mega-batch 2026-09-28): pencarian lintas-room — GET
  // /v1/chat/search (`lib/api/chat.ts` searchAllMessages). auth:"required":
  // tamu tidak punya percakapan; query dimatikan untuk tamu agar error auth
  // tidak meracuni state error cakupan "Semua".
  const hasSession = useHasSession()
  const chatsResult = useApiQuery(
    `search-chats:${keyword}`,
    (signal) => api.chat.searchAllMessages(keyword, { limit: 20 }, signal),
    enabled && wantChats && hasSession,
  )
  // Keadaan daftar = gabungan keempat request. Tanpa ini, cakupan
  // "Pengguna"/"Postingan"/"Pesan" mengumumkan "Tidak ada hasil" sepersekian
  // detik lebih awal (query lain dimatikan sehingga `loading`-nya false) dan
  // kesalahannya tidak pernah tampil karena ErrorState hanya membaca
  // `result.error`.
  const loading = enabled && (result.loading || usersResult.loading || postsResult.loading || chatsResult.loading)
  const searchError = usersOnly
    ? usersResult.error
    : postsOnly
      ? postsResult.error
      : chatsOnly
        ? chatsResult.error
        : (result.error ?? postsResult.error ?? chatsResult.error)
  const suggestions = useApiQuery(
    `suggestions:${keyword}`,
    (signal) => api.search.getSearchSuggestions({ q: keyword }, signal),
    // Saran hanya berguna selagi cakupan "Semua": pada satu jenis hasil,
    // chip saran menyempitkan apa yang sudah dipersempit pengguna.
    enabled && scope === "all",
  )
  // Riwayat pencarian (GET /v1/search/history) — tampil saat kolom kosong;
  // gagal dimuat tidak boleh menghalangi pencarian (fallback kosong).
  const historyQuery = useApiQuery<import("@/lib/api/search").SearchHistoryEntry[]>(
    "search-history",
    async (signal) =>
      (await api.search.getSearchHistory(signal).catch((err) => {
        logWarn("search:history", err)
        return undefined
      })) ?? [],
  )
  const history = historyQuery.data ?? []

  // Batch 43 (item 7): trending keywords — publik, tampil saat kolom kosong.
  const trendingQuery = useApiQuery(
    "search-trending",
    (signal) => api.commerce.getSearchTrends(10, signal),
    true,
  )
  const trending = trendingQuery.data ?? []

  // Batch 43 (item 7): catat pencarian — fire-and-forget, sekali per keyword.
  const recordedKeyword = useRef<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    const q = keyword.trim()
    if (recordedKeyword.current === q) return
    recordedKeyword.current = q
    void api.commerce.recordSearchTrend(q)
  }, [enabled, keyword])

  // #6a (audit Discovery 2026-09-26): riwayat basi setelah mencari — backend
  // menyimpan riwayat secara async saat pencarian berjalan, jadi segarkan
  // saat kolom dikosongkan agar kata kunci barusan muncul tanpa remount.
  const wasSearching = useRef(false)
  useEffect(() => {
    if (wasSearching.current && !enabled) {
      void historyQuery.refresh()
    }
    wasSearching.current = enabled
  }, [enabled, historyQuery])

  const handleClearHistory = useCallback(async () => {
    if (clearingHistory) return
    setClearingHistory(true)
    setHistoryError(null)
    try {
      await api.search.clearSearchHistory()
      historyQuery.setData([])
    } catch (err) {
      // #6c (audit Discovery 2026-09-26): gagal clear = riwayat tetap tampil;
      // pengguna bisa mengulang lewat pull-to-refresh (kini aktif juga saat
      // kolom kosong). DC-020: beri tahu user + catat untuk observabilitas.
      logWarn("search:history-clear", err)
      setHistoryError(translate("Gagal menghapus riwayat. Coba lagi."))
    } finally {
      setClearingHistory(false)
    }
  }, [clearingHistory, historyQuery])

  /**
   * Item 75 (mega-batch 2026-09-28): hapus SATU entri riwayat — optimistis
   * (baris langsung hilang), rollback + pesan error bila request gagal.
   */
  const handleDeleteHistoryItem = useCallback(
    async (query: string) => {
      if (deletingItem) return
      setDeletingItem(query)
      setDeleteItemError(null)
      const prev = historyQuery.data ?? []
      historyQuery.setData(prev.filter((entry) => entry.query !== query))
      try {
        await api.search.deleteSearchHistoryItem(query)
      } catch (err) {
        historyQuery.setData(prev)
        logWarn("search:history-delete-item", err)
        setDeleteItemError(translate("Gagal menghapus \"{x}\". Coba lagi.", { x: query }))
      } finally {
        setDeletingItem(null)
      }
    },
    [deletingItem, historyQuery],
  )

  const rows = useMemo<ResultRow[]>(() => {
    const dedicated = usersResult.data?.users
    const users: UserSearchResult[] = !wantUsers
      ? []
      : (dedicated ??
        (usersResult.error
          ? (result.data?.users ?? []).map((u) => ({
              userId: u.id,
              username: u.username ?? null,
              fullName: u.fullName ?? "",
              avatarUrl: u.avatarUrl ?? null,
              sealTier: (u as { sealTier?: UserSearchResult["sealTier"] }).sealTier ?? null,
            }))
          : []))
    return [
      ...users.map((user) => ({ id: `user:${user.userId}`, kind: "user" as const, user })),
      ...(!wantPosts ? [] : (postsResult.data?.items ?? [])).map((showcase) => ({
        id: `showcase:${showcase.id}`,
        kind: "showcase" as const,
        showcase,
      })),
      ...(scope === "users" || scope === "posts" || scope === "chats" ? [] : (result.data?.orders ?? [])).map((order) => ({
        id: `order:${order.id}`,
        kind: "order" as const,
        order,
      })),
      ...(!walletEnabled
        ? []
        : scope === "users" || scope === "posts" || scope === "chats"
          ? []
          : (result.data?.transactions ?? [])
      ).map((transaction) => ({
        id: `transaction:${transaction.id}`,
        kind: "transaction" as const,
        transaction,
      })),
      ...(scope === "all" ? (result.data?.helpCenter ?? []) : []).map((article) => ({
        id: `article:${article.id}`,
        kind: "article" as const,
        article,
      })),
      // Item 87: hasil chat lintas-room — pesan yang cocok + info room.
      ...(!wantChats ? [] : (chatsResult.data?.results ?? [])).map((chat) => ({
        id: `chat:${chat.room.id}:${chat.message.id}`,
        kind: "chat" as const,
        chat,
      })),
    ]
  }, [result.data, usersResult.data, usersResult.error, postsResult.data, chatsResult.data, scope, wantUsers, wantPosts, wantChats])

  /**
   * Jumlah per jenis — DC-014: pakai totals dari server bila ada (angka benar
   * saat limit memotong: 20 tampil dari 40 total → "40", bukan "20").
   * Fallback ke hitungan rows lokal bila totals absen.
   */
  const counts = useMemo(() => {
    const totals = result.data?.totals
    const local: Record<ResultRow["kind"], number> = {
      user: 0,
      showcase: 0,
      order: 0,
      transaction: 0,
      article: 0,
      chat: 0,
    }
    for (const row of rows) local[row.kind] += 1
    return {
      // user, showcase & chat dilayani endpoint lain — totals /v1/search tidak
      // mencakupnya; tetap hitung lokal.
      user: local.user,
      showcase: local.showcase,
      chat: local.chat,
      order: totals && !usersOnly && !postsOnly && !chatsOnly ? Math.max(totals.orders, local.order) : local.order,
      transaction: totals && !usersOnly && !postsOnly && !chatsOnly ? Math.max(totals.transactions, local.transaction) : local.transaction,
      article: totals ? Math.max(totals.helpCenter, local.article) : local.article,
    } as Record<ResultRow["kind"], number>
  }, [rows, result.data?.totals, usersOnly, postsOnly, chatsOnly])

  /**
   * Item 78 (mega-batch 2026-09-28): ringkasan utama memakai TOTAL server
   * (bukan rows.length yang terpotong limit) — jumlah per jenis dijumlahkan.
   */
  const totalResults = counts.user + counts.showcase + counts.order + counts.transaction + counts.article + counts.chat

  /**
   * Chip saran HANYA boleh berisi string.
   *
   * `getSearchSuggestions()` sudah menormalkan respons menjadi `string[]`,
   * tetapi nilai di sini dirender LANGSUNG sebagai anak React (`<Chip>{s}</Chip>`).
   * Satu objek saja yang lolos → "Objects are not valid as a React child" →
   * seluruh layar jatuh ke ErrorBoundary ("Halaman tidak dapat ditampilkan").
   * Ini lapis kedua di sisi render: saring non-string, trim, dedupe.
   */
  const suggestionChips = useMemo(
    () =>
      scope === "all"
        ? [
            ...new Set(
              (suggestions.data ?? [])
                .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
                .map((s) => s.trim()),
            ),
          ]
        : [],
    [suggestions.data, scope],
  )

  /**
   * Batch 139 E08 — "Mungkin maksud Anda": saran backend ditawarkan sebagai
   * CHIP PILIHAN, tidak pernah mengganti keyword otomatis. Dihitung dari
   * saran mentah (semua cakupan), bukan suggestionChips yang dibatasi "all".
   */
  const didYouMean = useMemo(
    () =>
      pickDidYouMean(
        keyword,
        (suggestions.data ?? []).filter((s): s is string => typeof s === "string"),
      ),
    [keyword, suggestions.data],
  )

  /**
   * Batch 139 E09 — copy empty state per cakupan (bukan generik).
   */
  const emptyCopy = getSearchEmptyStateCopy(scope)

  /**
   * Pengumuman hasil untuk screen reader (<LiveRegion> §10). Error memakai
   * "assertive" agar tidak kalah antrean dari pengumuman sopan.
   * Pesan dibangun lewat helper teruji agar ikut bahasa aktif (UI-M005).
   */
  const resultMessage = buildResultMessage({
    enabled,
    error: searchError,
    loading,
    count: totalResults,
  })

  /** Isi kolom dari chip saran/riwayat, atau kosongkan lewat `applyQuery("")`. */
  // R1-006: useCallback agar identitasnya stabil untuk memo header list.
  const applyQuery = useCallback((next: string) => {
    setSeed(next)
    setKeyword(next.trim())
  }, [])

  /*
   * Query awal dari deep link /search?q=… (revisi 2026-09-28): pencarian dari
   * utility bar drawer mendorong rute ini dengan param `q`.
   *
   * Item 86 (mega-batch 2026-09-28): effect kini MERESPONS perubahan `q`
   * (bukan hanya sekali saat mount) — mendorong /search?q=baru selagi layar
   * sudah terbuka kini benar-benar mengganti kata kunci.
   *
   * Batch 139 E10: `scope` & `location` juga dibaca dari URL (deep link /
   * berbagi hasil pencarian di web). Hanya nilai whitelist yang diterima;
   * location dibatasi 100 karakter.
   */
  const params = useLocalSearchParams<{ q?: string | string[]; scope?: string | string[]; location?: string | string[] }>()
  const deepLinkQ = Array.isArray(params.q) ? params.q[0] : params.q
  const deepLinkScope = Array.isArray(params.scope) ? params.scope[0] : params.scope
  const deepLinkLocation = Array.isArray(params.location) ? params.location[0] : params.location
  const lastAppliedQ = useRef<string | null>(null)
  const lastAppliedScope = useRef<string | null>(null)
  const lastAppliedLocation = useRef<string | null>(null)
  useEffect(() => {
    const q = typeof deepLinkQ === "string" ? deepLinkQ.trim() : ""
    if (q && q !== lastAppliedQ.current) {
      lastAppliedQ.current = q
      applyQuery(q)
    }
    const s = typeof deepLinkScope === "string" ? deepLinkScope : ""
    if (s && s !== lastAppliedScope.current && isSearchScope(s)) {
      lastAppliedScope.current = s
      setScope(s)
    }
    const loc = typeof deepLinkLocation === "string" ? deepLinkLocation.trim().slice(0, 100) : ""
    if (loc && loc !== lastAppliedLocation.current) {
      lastAppliedLocation.current = loc
      setLocationSeed(loc)
      setLocation(loc)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkQ, deepLinkScope, deepLinkLocation])

  /*
   * Batch 139 E10: tulis kembali q/scope/location ke URL di WEB supaya hasil
   * pencarian bisa dibagikan/disegarkan tanpa kehilangan konteks. Anti-loop:
   * fingerprint guard + hanya memanggil setParams bila nilai URL memang
   * berubah; tidak berjalan di native (tidak ada URL bar).
   */
  const lastSyncedUrl = useRef("")
  useEffect(() => {
    if (Platform.OS !== "web") return
    const q = keyword.trim().slice(0, 100)
    const loc = location.trim().slice(0, 100)
    const fingerprint = `${q}|${scope}|${loc}`
    if (fingerprint === lastSyncedUrl.current) return
    lastSyncedUrl.current = fingerprint
    const next: Record<string, string> = {}
    if (q) next.q = q
    if (scope !== "all") next.scope = scope
    if (loc) next.location = loc
    router.setParams(next)
  }, [keyword, scope, location])

  /*
   * Tata letak (revisi 2026-09-26, permintaan produk): KOLOM CARI DI HEADER.
   *
   * Kolom pencarian kini menempati slot tengah <Header>, bukan baris sendiri
   * di bawah judul "Pencarian". Alasannya dua:
   *   1. Kolom itu SATU-SATUNYA alasan layar ini ada — ia harus yang pertama
   *      terlihat dan tidak pernah tergulir keluar; dan
   *   2. judul teks di atas kolom menghabiskan satu baris penuh (56px) hanya
   *      untuk mengulang apa yang sudah dikatakan placeholder.
   * `title` tetap dikirim ke <Header> supaya judul dokumen web terjaga — ia
   * hanya tidak dirender di baris bar (slot `center` yang mengambil alih).
   *
   * Sisanya mengikuti urutan lama, dengan dua penyempurnaan: ringkasan jumlah
   * hasil di bawah chip cakupan (daftar campuran tanpa angka memaksa pengguna
   * menggulir untuk tahu ada berapa hasil), dan riwayat pencarian sebagai
   * BARIS berikon — bukan kumpulan chip — supaya polanya sama dengan daftar di
   * layar lain dan tiap entri punya target sentuh penuh lebar.
   */
  /**
   * Item 82: kondisi CTA "Lihat semua" — hasil terpotong limit (20 untuk
   * pesanan/mutasi; postingan memakai hasMore dari feed).
   */
  const showAllPosts = wantPosts && (postsResult.data?.hasMore ?? false)
  const showAllOrders = (scope === "all" || scope === "orders") && counts.order >= 20
  const showAllTransactions =
    walletEnabled && (scope === "all" || scope === "transactions") && counts.transaction >= 20

  /**
   * R1-005/R1-006 (2026-09-29, audit render-perf): prop list distabilkan —
   * identitas baru tiap render memaksa VirtualizedList (PureComponent)
   * render ulang kontainer, terasa sebagai "kedip" tiap hasil tiba.
   */
  const searchKeyExtractor = useCallback((row: ResultRow) => row.id, [])
  // FE-008 (audit 2026-09-29): handler navigasi stabil per-username untuk
  // baris hasil yang di-memo (tidak ada closure per baris di renderItem).
  const openUserProfile = useCallback((username: string) => {
    router.push(ROUTES.userProfile(username))
  }, [])
  /**
   * FE-008 (audit 2026-09-29): renderItem stabil via useCallback —
   * komputasi berat dipindah ke SearchResultRow (memo); di sini hanya
   * boolean showSection yang murah dari `rows[index - 1]`.
   */
  const searchRenderItem: ListRenderItem<ResultRow> = useCallback(
    ({ item, index }) => {
      const prev = rows[index - 1]
      const showSection = !prev || prev.kind !== item.kind
      return (
        <SearchResultRow
          item={item}
          showSection={showSection}
          // FE-086 (audit 2026-09-29): judul section hanya saat daftar campur
          // ("all"); bila satu cakupan aktif, judul menduplikasi chip cakupan.
          showSectionLabel={scope === "all"}
          sectionLabel={sectionTitle[item.kind]}
          sectionCount={counts[item.kind]}
          keyword={keyword}
          onOpenUserProfile={openUserProfile}
        />
      )
    },
    [rows, scope, sectionTitle, counts, keyword, openUserProfile],
  )
  const searchContentStyle = useMemo(
    () => ({
      flexGrow: 1,
      paddingHorizontal: tokens.layout.screenPaddingX,
      paddingBottom: insets.bottom + tokens.space[8],
    }),
    [insets.bottom],
  )
  const searchListHeader = useMemo(
    () =>
      enabled ? (
        <View className="gap-3 pb-4 pt-1">
          <ScrollRow bleed gap={2} accessibilityLabel={translate("Saring hasil pencarian")}>
            {scopes.map((option) => (
              <Chip
                key={option.value}
                selected={scope === option.value}
                accessibilityState={{ selected: scope === option.value }}
                onPress={() => setScope(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </ScrollRow>
          {/*
           * Filter lokasi — hanya relevan untuk POSTINGAN (backend
           * mencocokkan users.address milik owner). Cakupan pengguna/
           * pesanan/mutasi/pesan tidak mengenal lokasi, jadi kontrol ini
           * disembunyikan di sana agar tidak menjanjikan filter yang
           * tidak bekerja.
           *
           * Item 83 (mega-batch 2026-09-28): setelah diterapkan, lokasi
           * tampil sebagai CHIP yang bisa dihapus (satu ketukan) — bukan
           * kolom teks yang terus memakan tempat.
           */}
          {wantPosts ? (
            location ? (
              <View className="flex-row">
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={translate("Hapus filter lokasi {x}", { x: location })}
                  onPress={() => {
                    setLocation("")
                    setLocationSeed("")
                    setLocationNonce((n) => n + 1)
                  }}
                  containerClassName="rounded-full"
                  className="flex-row items-center gap-1.5 rounded-full bg-surface px-3 py-1.5"
                >
                  <Icon icon={MapPin} size="sm" tone="default" />
                  <Text variant="caption" weight={600}>
                    {location}
                  </Text>
                  <Icon icon={X} size="sm" tone="default" />
                </PressableScale>
              </View>
            ) : (
              <DebouncedSearchField
                key={locationNonce}
                initialQuery={locationSeed}
                onQueryChange={setLocation}
                leftIcon={MapPin}
                placeholder={translate("Lokasi (cth. Jakarta)")}
                accessibilityLabel={translate("Filter lokasi")}
                accessibilityHint={translate("Batasi hasil postingan ke lokasi penjual")}
              />
            )
          ) : null}
          {/* Ringkasan hasil. Sengaja DISEMBUNYIKAN saat daftar kosong —
              <EmptyState> di bawah sudah mengatakannya, dan dua kalimat
              untuk satu keadaan hanya menambah kebisingan. */}
          {loading || rows.length > 0 ? (
            <Text variant="caption" tone="tertiary">
              {loading
                ? translate("Mencari…")
                : translate("{x} hasil untuk {y}", {
                    x: formatNumber(totalResults),
                    y: keyword.trim(),
                  })}
            </Text>
          ) : null}
          {/* Item 81 (mega-batch 2026-09-28): saran menampilkan status
              loading & error — sebelumnya gagal diam-diam. */}
          {scope === "all" ? (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Text variant="caption" tone="tertiary">
                  {translate("Saran pencarian")}
                </Text>
                {suggestions.loading ? (
                  <Spinner size="sm" accessibilityLabel={translate("Memuat saran")} />
                ) : null}
              </View>
              {suggestions.error ? (
                <Text variant="caption" tone="danger">
                  {translate("Gagal memuat saran.")}
                </Text>
              ) : suggestionChips.length ? (
                <View className="flex-row flex-wrap gap-2">
                  {suggestionChips.map((s) => (
                    <Chip key={s} onPress={() => applyQuery(s)}>
                      {s}
                    </Chip>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          {/* FE-085: catatan aturan internal dihapus — user tidak perlu tahu
              kenapa saran tidak muncul; saran ditampilkan apa adanya. */}
        </View>
      ) : history.length > 0 || trending.length > 0 ? (
        <View className="gap-2 pb-4 pt-1">
          {trending.length > 0 ? (
            <TrendingSearches entries={trending} onPick={applyQuery} />
          ) : null}
          {history.length > 0 ? (
            <RecentSearches
              entries={historyExpanded ? history : history.slice(0, 8)}
              totalCount={history.length}
              expanded={historyExpanded}
              onToggleExpanded={() => setHistoryExpanded((v) => !v)}
              clearing={clearingHistory}
              error={historyError}
              deleteError={deleteItemError}
              deletingItem={deletingItem}
              onPick={applyQuery}
              onClear={() => void handleClearHistory()}
              onDeleteItem={(query) => void handleDeleteHistoryItem(query)}
            />
          ) : null}
        </View>
      ) : null,
    [
      enabled,
      scopes,
      scope,
      setScope,
      wantPosts,
      location,
      locationSeed,
      locationNonce,
      setLocation,
      setLocationSeed,
      setLocationNonce,
      loading,
      rows,
      totalResults,
      keyword,
      suggestions,
      suggestionChips,
      applyQuery,
      trending,
      history,
      historyExpanded,
      clearingHistory,
      historyError,
      deleteItemError,
      deletingItem,
      handleClearHistory,
      handleDeleteHistoryItem,
    ],
  )
  const searchListEmpty = useMemo(
    () =>
      loading ? (
        <ListLoading />
      ) : searchError ? (
        <ErrorState
          title={translate("Gagal mencari")}
          description={searchError}
          onRetry={() => {
            void result.reload()
            void usersResult.reload()
            void postsResult.reload()
            void chatsResult.reload()
          }}
        />
      ) : (
        <EmptyState
          icon={MagnifyingGlass}
          title={enabled ? emptyCopy.title : translate("Mulai mencari")}
          description={
            enabled
              ? // DC-011: hint backend ditampilkan apa adanya (lebih
                // spesifik dari kalimat generik — mis. "tapi ada artikel
                // bantuan yang cocok").
                (result.data?.hint ?? emptyCopy.description)
              : translate("Ketik minimal 2 huruf untuk mulai mencari.")
          }
          action={
            enabled ? (
              <Button
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={() => {
                  setScope("all")
                  setSeed("")
                  setKeyword("")
                  setSeedNonce((n) => n + 1)
                  setLocationSeed("")
                  setLocation("")
                  setLocationNonce((n) => n + 1)
                }}
              >
                Atur ulang pencarian
              </Button>
            ) : undefined
          }
          secondaryAction={
            enabled && didYouMean.length > 0 ? (
              <View className="items-center gap-2 pt-1">
                <Text variant="caption" tone="secondary">
                  {translate("Mungkin maksud Anda:")}
                </Text>
                <View className="flex-row flex-wrap justify-center gap-2">
                  {didYouMean.map((s) => (
                    <Chip key={`dym-${s}`} onPress={() => applyQuery(s)}>
                      {s}
                    </Chip>
                  ))}
                </View>
              </View>
            ) : undefined
          }
        />
      ),
    [
      loading,
      searchError,
      result,
      usersResult,
      postsResult,
      chatsResult,
      enabled,
      emptyCopy,
      didYouMean,
      applyQuery,
      setScope,
    ],
  )
  // L-03 (audit 2026-09-23): postingan dibatasi 12 — tautan penelusuran
  // lanjutan ke feed Etalase (search=) saat hasil masih terpotong.
  // Item 82 (mega-batch 2026-09-28): CTA "Lihat semua" juga untuk
  // pesanan & mutasi — hasil pencarian dibatasi 20 per jenis.
  // R1-006: onRefresh stabil — arrow inline memaksa VirtualizedList
  // render ulang walau hasil tidak berubah.
  const searchRefresh = useCallback(() => {
    void result.refresh()
    void usersResult.refresh()
    void postsResult.refresh()
    void chatsResult.refresh()
    // #6c: segarkan juga riwayat saat kolom kosong.
    void historyQuery.refresh()
  }, [result, usersResult, postsResult, chatsResult, historyQuery])
  const searchListFooter = useMemo(    () =>
      enabled && (showAllPosts || showAllOrders || showAllTransactions) ? (
        <View className="gap-2 pt-2">
          {showAllPosts ? (
            <Button
              variant="ghost"
              fullWidth
              onPress={() => router.push(ROUTES.showcaseSearch(keyword.trim(), location || undefined))}
            >
              Lihat semua di Etalase
            </Button>
          ) : null}
          {showAllOrders ? (
            <Button variant="ghost" fullWidth onPress={() => router.push(ROUTES.transactions)}>
              {translate("Lihat semua pesanan")}
            </Button>
          ) : null}
          {showAllTransactions ? (
            <Button variant="ghost" fullWidth onPress={() => router.push(ROUTES.walletHistory)}>
              {translate("Lihat semua mutasi")}
            </Button>
          ) : null}
        </View>
      ) : null,
    [enabled, showAllPosts, showAllOrders, showAllTransactions, keyword, location],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title={translate("Pencarian")}
        center={
          <DebouncedSearchField
            key={seedNonce}
            initialQuery={seed}
            onQueryChange={setKeyword}
            placeholder={translate("Cari etalase, pengguna, pesanan…")}
            containerClassName="flex-1"
          />
        }
      />
      <LiveRegion message={resultMessage} politeness={searchError ? "assertive" : "polite"} />
      <PullToRefreshFlatList
        data={rows}
        keyExtractor={searchKeyExtractor}
        contentContainerStyle={searchContentStyle}
        ListHeaderComponent={searchListHeader}
        ItemSeparatorComponent={SearchItemSeparator}
        renderItem={searchRenderItem}
        ListEmptyComponent={searchListEmpty}
        // L-03 (audit 2026-09-23): postingan dibatasi 12 — tautan penelusuran
        // lanjutan ke feed Etalase (search=) saat hasil masih terpotong.
        // Item 82 (mega-batch 2026-09-28): CTA "Lihat semua" juga untuk
        // pesanan & mutasi — hasil pencarian dibatasi 20 per jenis.
        ListFooterComponent={searchListFooter}
        refreshing={result.refreshing || usersResult.refreshing || postsResult.refreshing || chatsResult.refreshing}
        onRefresh={searchRefresh}
        refreshEnabled={!loading}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
      />
    </Screen>
  )
}

/**
 * Riwayat pencarian (revisi 2026-09-26) — BARIS, bukan chip.
 *
 * Delapan entri terakhir sebagai baris berikon jam dengan target sentuh
 * sebesar barisnya; ikon panah di kanan menandai bahwa ketukan MENGISI kolom
 * (bukan membuka halaman baru). Sebelumnya riwayat berupa chip yang menumpuk
 * di satu baris melipat — kata kunci panjang terpotong dan tidak ada ruang
 * untuk tombol hapus yang jelas.
 *
 * Item 75 (mega-batch 2026-09-28): tiap baris punya tombol hapus (X) —
 * optimistis dengan rollback bila gagal. Item 76: bila riwayat > 8, toggle
 * "Lihat semua" membuka seluruh daftar.
 */
function RecentSearches({
  entries,
  totalCount,
  expanded,
  onToggleExpanded,
  clearing,
  error,
  deleteError,
  deletingItem,
  onPick,
  onClear,
  onDeleteItem,
}: {
  entries: readonly import("@/lib/api/search").SearchHistoryEntry[]
  totalCount: number
  expanded: boolean
  onToggleExpanded: () => void
  clearing: boolean
  /** DC-020: pesan bila hapus riwayat gagal. */
  error: string | null
  /** Item 75: pesan bila hapus satu entri gagal. */
  deleteError: string | null
  /** Item 75: query yang sedang dihapus (spinner di tombolnya). */
  deletingItem: string | null
  onPick: (query: string) => void
  onClear: () => void
  onDeleteItem: (query: string) => void
}) {
  return (
    <View className="gap-2 pb-4 pt-1">
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="label" tone="secondary">
          {translate("Riwayat pencarian")}
        </Text>
        <Button
          variant="ghost"
          size="sm"
          fullWidth={false}
          loading={clearing}
          onPress={onClear}
        >
          {translate("Hapus riwayat")}
        </Button>
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
      {deleteError ? (
        <Text variant="caption" tone="danger">
          {deleteError}
        </Text>
      ) : null}
      <Card variant="elevated" className="gap-0 p-0">
        {entries.map((entry, index) => (
          // Batch 139 E12: key stabil tanpa index — query + timestamp agar
          // entri yang sama tidak tertukar saat daftar berubah (hapus item).
          <View key={`hist-${entry.query}::${entry.searchedAt ?? "x"}`}>
            {index > 0 ? <Divider /> : null}
            <View className="w-full flex-row items-center gap-1 px-2 py-1">
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={translate("Cari {x}", { x: entry.query })}
                accessibilityHint={translate("Mengisi kolom pencarian dengan kata kunci ini")}
                onPress={() => onPick(entry.query)}
                containerClassName="min-w-0 flex-1 rounded-xs"
                className="min-w-0 flex-1 flex-row items-center gap-3 px-2 py-2"
              >
                <Icon icon={ClockCounterClockwise} size="sm" tone="default" />
                <Text variant="body" numberOfLines={1} className="min-w-0 flex-1">
                  {entry.query}
                </Text>
                <Icon icon={ArrowUpLeft} size="sm" tone="default" />
              </PressableScale>
              {/* Item 75: hapus satu entri — di luar Pressable pengisi kolom
                  agar tap X tidak ikut mengisi kata kunci. */}
              <IconButton
                icon={X}
                size="sm"
                variant="ghost"
                accessibilityLabel={translate("Hapus \"{x}\" dari riwayat", { x: entry.query })}
                loading={deletingItem === entry.query}
                disabled={deletingItem != null}
                onPress={() => onDeleteItem(entry.query)}
              />
            </View>
          </View>
        ))}
      </Card>
      {totalCount > 8 ? (
        <Button variant="ghost" size="sm" fullWidth={false} onPress={onToggleExpanded}>
          {expanded
            ? translate("Tampilkan lebih sedikit")
            : translate("Lihat semua ({x})", { x: formatNumber(totalCount) })}
        </Button>
      ) : null}
    </View>
  )
}

/** Ukuran thumbnail hasil postingan — sejajar avatar baris Pengguna. */
const THUMB = 48

/**
 * Batch 43 (item 7): kata kunci sedang tren — chip berikon, ketuk mengisi
 * kolom pencarian (pola sama dengan chip saran).
 */
function TrendingSearches({
  entries,
  onPick,
}: {
  entries: readonly { keyword: string; searchCount: number }[]
  onPick: (query: string) => void
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Icon icon={TrendUp} size="sm" tone="default" />
        <Text variant="label" tone="secondary">
          {translate("Sedang tren")}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {entries.map((entry) => (
          <Chip key={entry.keyword} onPress={() => onPick(entry.keyword)}>
            {entry.keyword}
          </Chip>
        ))}
      </View>
    </View>
  )
}

/**
 * Baris hasil POSTINGAN etalase (revisi 2026-09-23 — pencarian terpusat).
 *
 * Ringkas sengaja: thumbnail 48px + judul + harga · @penjual + waktu — cukup
 * untuk mengenali karya tanpa menggandakan bobot kartu feed. Ketukan membuka
 * halaman detail (bukan memutar galeri) supaya polanya sama dengan jenis
 * hasil lain di layar ini.
 *
 * Item 79 (mega-batch 2026-09-28): harga tampil di baris hasil — sebelumnya
 * hanya judul + penjual, pengguna harus membuka detail untuk tahu harga.
 * Item 80: judul memakai <Highlight> untuk keyword.
 */
function ShowcaseResultRow({ item, keyword }: { item: ShowcaseSocialItem; keyword: string }) {
  // L-02 (audit 2026-09-23): SATU resolver gambar bersama (showcaseImages),
  // bukan rantai `images[0] ?? coverImageUrl ?? imageUrl` milik sendiri.
  const image = showcaseImages(item)[0]?.url ?? null
  // Harga: rentang bila min≠max, tunggal bila sama, sembunyikan bila kosong.
  const priceLabel =
    item.priceMin != null && item.priceMax != null && item.priceMax > item.priceMin
      ? `${formatRupiah(item.priceMin)} – ${formatRupiah(item.priceMax)}`
      : item.priceMin != null
        ? formatRupiah(item.priceMin)
        : null
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={translate("Postingan {x} oleh {y}", {
        x: item.title,
        y: item.author.fullName ?? item.author.username,
      })}
      accessibilityHint={translate("Buka detail postingan")}
      onPress={() => router.push(ROUTES.showcaseDetail(item.id))}
      containerClassName={cn("min-h-14 w-full rounded-md", focusRing)}
      className="flex-row items-center gap-3 py-2"
    >
      {image ? (
        <Picture
          source={{ uri: resolveMediaUrl(image) }}
          alt=""
          width={THUMB}
          height={THUMB}
          radius="sm"
          bordered={false}
          recyclingKey={`search:${item.id}`}
        />
      ) : (
        <View className="h-12 w-12 items-center justify-center rounded-sm bg-surface">
          <Icon icon={Images} size="sm" tone="default" />
        </View>
      )}
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Highlight
            text={item.title}
            query={keyword}
            variant="body"
            weight={600}
            tone="primary"
            matchWeight={600}
            numberOfLines={1}
            className="min-w-0 flex-1"
          />
          {/* P-03 (audit 2026-09-24): pemilik tidak bisa membedakan karyanya
              sendiri (privat/nonaktif) dari karya publik di hasil pencarian.
              Badge hanya untuk pemilik — pengunjung tidak perlu tahu. */}
          {item.isOwner && item.isActive === false ? (
            <Badge variant="outline">{translate("Nonaktif")}</Badge>
          ) : item.isOwner && item.visibility && item.visibility !== "PUBLIC" ? (
            <Badge variant="outline">{translate("Privat")}</Badge>
          ) : null}
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {priceLabel ? `${priceLabel} · ` : ""}@{item.author.username}
        </Text>
      </View>
      <Text variant="caption" tone="tertiary" className="tabular-nums">
        {formatDateTime(item.createdAt)}
      </Text>
    </PressableScale>
  )
}

/**
 * Baris hasil PESAN — pencarian lintas-room (item 87, mega-batch 2026-09-28).
 *
 * GET /v1/chat/search mengembalikan pesan yang cocok beserta info room:
 * nama lawan bicara / subjek room + snippet isi pesan dengan keyword
 * ditonjolkan. Ketukan membuka room chat yang bersangkutan.
 */
function ChatResultRow({ result, keyword }: { result: ChatSearchResult; keyword: string }) {
  const { message, room } = result
  const counterpartName =
    room.counterpart?.fullName ?? room.counterpart?.username ?? null
  const roomLabel =
    room.subject?.trim() ||
    (room.order?.title ? translate("Transaksi: {x}", { x: room.order.title }) : null) ||
    counterpartName ||
    translate("Percakapan")
  const snippet = message.text?.trim() || translate("(lampiran)")
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={translate("Pesan di {x}: {y}", { x: roomLabel, y: snippet })}
      accessibilityHint={translate("Buka percakapan")}
      onPress={() => router.push(ROUTES.chatRoom(room.id, roomLabel))}
      containerClassName={cn("min-h-14 w-full rounded-md", focusRing)}
      className="flex-row items-center gap-3 py-2"
    >
      <View className="h-12 w-12 items-center justify-center rounded-sm bg-surface">
        <Icon icon={ChatCircleText} size="sm" tone="default" />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="body" weight={600} tone="primary" numberOfLines={1}>
          {roomLabel}
        </Text>
        <Highlight
          text={snippet}
          query={keyword}
          variant="caption"
          tone="secondary"
          numberOfLines={1}
          className="min-w-0"
        />
      </View>
      {message.createdAt ? (
        <Text variant="caption" tone="tertiary" className="tabular-nums">
          {formatDateTime(message.createdAt)}
        </Text>
      ) : null}
    </PressableScale>
  )
}
