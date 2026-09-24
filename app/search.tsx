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
import { useMemo, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ClockCounterClockwise, Images, MagnifyingGlass } from "phosphor-react-native"
import { router } from "expo-router"
import { api, type Order, type UserSearchResult, type WalletTransaction } from "@/lib/api"
import { getShowcaseFeed, type ShowcaseSocialItem } from "@/lib/api/showcase"
import { showcaseImages } from "@/lib/showcase-social"
import { formatDateTime, formatNumber } from "@/lib/format"
import { resolveMediaUrl } from "@/lib/media"
import { translate } from "@/lib/i18n/translate"
import { cn } from "@/lib/cn"
import { ROUTES } from "@/lib/routes"
import { showcasePriceLabelOrFallback } from "@/lib/showcase-labels"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { logWarn } from "@/lib/telemetry"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { HelpArticleListItem } from "@/components/ui/help-article-list-item"
import { Icon } from "@/components/ui/icon"
import { LiveRegion } from "@/components/ui/live-region"
import { FadeIn } from "@/components/ui/fade-in"
import { ListLoading } from "@/components/ui/paginated-list"
import { OrderCard } from "@/components/ui/order-card"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { PullToRefreshFlatList } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { ScrollRow } from "@/components/ui/scroll-row"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"
import { UserListItem } from "@/components/ui/user-list-item"
import { WalletTransactionRow } from "@/components/ui/wallet-transaction-row"
import { focusRing } from "@/lib/focus-ring"

type ResultRow = { id: string } & (
  | { kind: "user"; user: UserSearchResult }
  | { kind: "showcase"; showcase: ShowcaseSocialItem }
  | { kind: "order"; order: Order }
  | { kind: "transaction"; transaction: WalletTransaction }
  | { kind: "article"; article: { id: string; slug: string; title: string; snippet?: string } }
)

/** Cakupan hasil — "all" mengirim semua jenis, sisanya menyaring per sumber. */
type Scope = "all" | "users" | "posts" | "orders" | "transactions"

const SCOPES: ReadonlyArray<{ value: Scope; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "users", label: "Pengguna" },
  { value: "posts", label: "Postingan" },
  { value: "orders", label: "Pesanan" },
  { value: "transactions", label: "Mutasi" },
]

/** Parameter `types` untuk GET /v1/search per cakupan (postingan di luar endpoint ini). */
const SCOPE_TYPES: Record<Exclude<Scope, "posts">, string> = {
  all: "users,orders,transactions",
  users: "users",
  orders: "orders",
  transactions: "transactions",
}

/** Judul kelompok + jumlah hasil (dipakai di header tiap kelompok). */
const SECTION_TITLE: Record<ResultRow["kind"], string> = {
  user: "Pengguna",
  showcase: "Postingan",
  order: "Pesanan",
  transaction: "Mutasi",
  article: "Bantuan",
}

/** Minimal kata kunci sebelum request ditembakkan. */
const MIN_KEYWORD = 2

export default function SearchScreen() {
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
  const [scope, setScope] = useState<Scope>("all")
  const [clearingHistory, setClearingHistory] = useState(false)
  const enabled = keyword.trim().length >= MIN_KEYWORD
  const wantUsers = scope === "all" || scope === "users"
  const wantPosts = scope === "all" || scope === "posts"
  // Cakupan "Pengguna" dilayani endpoint dedikasi saja — tidak ada alasan
  // menembakkan GET /v1/search untuk daftar yang hasilnya dibuang.
  const usersOnly = scope === "users"
  // Cakupan "Postingan" juga DI LUAR /v1/search (jenis itu tidak didukung
  // endpoint) — dilayani feed etalase dengan parameter `search`.
  const postsOnly = scope === "posts"

  const result = useApiQuery(
    `search:${scope}:${keyword}`,
    (signal) =>
      api.search.globalSearch(
        { q: keyword, types: SCOPE_TYPES[scope as Exclude<Scope, "posts">], limit: 20 },
        signal,
      ),
    enabled && !usersOnly && !postsOnly,
  )
  const usersResult = useApiQuery(
    `search-users:${keyword}`,
    (signal) => api.users.searchUsers(keyword, { limit: 20 }, signal),
    enabled && wantUsers,
  )
  // Postingan etalase — feed publik (auth:"optional"), 12 hasil cukup untuk
  // satu layar; penelusuran lanjutan hidup di tab Etalase itu sendiri.
  const postsResult = useApiQuery(
    `search-posts:${keyword}`,
    (signal) => getShowcaseFeed({ search: keyword, limit: 12 }, signal),
    enabled && wantPosts,
  )
  // Keadaan daftar = gabungan ketiga request. Tanpa ini, cakupan "Pengguna"/
  // "Postingan" mengumumkan "Tidak ada hasil" sepersekian detik lebih awal
  // (query lain dimatikan sehingga `loading`-nya false) dan kesalahannya
  // tidak pernah tampil karena ErrorState hanya membaca `result.error`.
  const loading = enabled && (result.loading || usersResult.loading || postsResult.loading)
  const searchError = usersOnly
    ? usersResult.error
    : postsOnly
      ? postsResult.error
      : (result.error ?? postsResult.error)
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

  const handleClearHistory = async () => {
    if (clearingHistory) return
    setClearingHistory(true)
    try {
      await api.search.clearSearchHistory()
      historyQuery.setData([])
    } catch {
      // Gagal clear = riwayat tetap tampil; pull-to-refresh akan mengulang.
    } finally {
      setClearingHistory(false)
    }
  }

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
            }))
          : []))
    return [
      ...users.map((user) => ({ id: `user:${user.userId}`, kind: "user" as const, user })),
      ...(!wantPosts ? [] : (postsResult.data?.items ?? [])).map((showcase) => ({
        id: `showcase:${showcase.id}`,
        kind: "showcase" as const,
        showcase,
      })),
      ...(scope === "users" || scope === "posts" ? [] : (result.data?.orders ?? [])).map((order) => ({
        id: `order:${order.id}`,
        kind: "order" as const,
        order,
      })),
      ...(scope === "users" || scope === "posts" ? [] : (result.data?.transactions ?? [])).map(
        (transaction) => ({
          id: `transaction:${transaction.id}`,
          kind: "transaction" as const,
          transaction,
        }),
      ),
      ...(scope === "all" ? (result.data?.articles ?? []) : []).map((article) => ({
        id: `article:${article.id}`,
        kind: "article" as const,
        article,
      })),
    ]
  }, [result.data, usersResult.data, usersResult.error, postsResult.data, scope, wantUsers, wantPosts])

  /** Jumlah per jenis — ditampilkan di judul kelompok. */
  const counts = useMemo(() => {
    const next: Record<ResultRow["kind"], number> = {
      user: 0,
      showcase: 0,
      order: 0,
      transaction: 0,
      article: 0,
    }
    for (const row of rows) next[row.kind] += 1
    return next
  }, [rows])

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
   * Pengumuman hasil untuk screen reader (<LiveRegion> §10). Error memakai
   * "assertive" agar tidak kalah antrean dari pengumuman sopan.
   */
  const resultMessage = !enabled
    ? ""
    : searchError
      ? searchError
      : loading
        ? ""
        : rows.length === 0
          ? "Tidak ada hasil"
          : `${formatNumber(rows.length)} hasil ditemukan`

  /** Isi kolom dari chip saran/riwayat, atau kosongkan lewat `applyQuery("")`. */
  const applyQuery = (next: string) => {
    setSeed(next)
    setKeyword(next.trim())
  }

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Pencarian" />
      {/* v2: kolom cari fade-in tanpa geser (pola Transaksi/FAQ) — kontrol
          fungsional harus stabil. Hasil cari tidak direveal per-item. */}
      <FadeIn duration="fast" translate={false} className="px-5 pb-4">
        <DebouncedSearchField
          key={seedNonce}
          initialQuery={seed}
          onQueryChange={setKeyword}
          placeholder="Cari postingan, pengguna, pesanan, atau mutasi"
        />
      </FadeIn>
      <LiveRegion message={resultMessage} politeness={searchError ? "assertive" : "polite"} />
      <PullToRefreshFlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: tokens.layout.screenPaddingX,
          paddingBottom: insets.bottom + tokens.space[8],
        }}
        ListHeaderComponent={
          enabled ? (
            <View className="gap-3 pb-4">
              <ScrollRow bleed gap={2} accessibilityLabel={translate("Saring hasil pencarian")}>
                {SCOPES.map((option) => (
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
              {suggestionChips.length ? (
                <View className="gap-2">
                  <Text variant="caption" tone="tertiary">
                    Saran pencarian
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {suggestionChips.map((s) => (
                      <Chip key={s} onPress={() => applyQuery(s)}>
                        {s}
                      </Chip>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item, index }) => {
          const prev = rows[index - 1]
          const showSection = !prev || prev.kind !== item.kind
          const body =
            item.kind === "user" ? (
              <UserListItem
                padded={false}
                name={item.user.fullName || item.user.username || "Identitas belum tersedia"}
                username={item.user.username ?? undefined}
                avatar={item.user.avatarUrl ? { source: item.user.avatarUrl } : undefined}
                chevron
                onPress={
                  item.user.username
                    ? () => router.push(ROUTES.userProfile(item.user.username!))
                    : undefined
                }
              />
            ) : item.kind === "transaction" ? (
              <WalletTransactionRow
                transaction={item.transaction}
                href={ROUTES.walletTransaction(item.transaction.id)}
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
              <ShowcaseResultRow item={item.showcase} />
            ) : (
              (() => {
                const role =
                  item.order.myRole === "BUYER"
                    ? "buyer"
                    : item.order.myRole === "SELLER"
                      ? "seller"
                      : undefined
                const counterpart =
                  role === "buyer"
                    ? item.order.seller
                    : role === "seller"
                      ? item.order.buyer
                      : undefined
                return (
                  <OrderCard
                    orderId={item.order.id}
                    title={item.order.title}
                    amount={item.order.orderValue}
                    status={item.order.status}
                    role={role}
                    counterpart={{
                      name:
                        counterpart?.fullName ??
                        counterpart?.username ??
                        "Identitas belum tersedia",
                    }}
                    timestamp={formatDateTime(item.order.createdAt)}
                    href={ROUTES.orderDetail(item.order.id)}
                  />
                )
              })()
            )
          return (
            <View className="gap-2">
              {showSection ? (
                /* Judul kelompok + jumlah: dalam daftar campur, nama jenis
                   saja tidak memberi tahu seberapa banyak yang menunggu di
                   bawahnya tanpa menggulir. */
                <View className="flex-row items-baseline justify-between gap-3 pt-1">
                  <Text variant="label" tone="secondary">
                    {SECTION_TITLE[item.kind]}
                  </Text>
                  <Text variant="caption" tone="tertiary">
                    {formatNumber(counts[item.kind])}
                  </Text>
                </View>
              ) : null}
              {body}
            </View>
          )
        }}
        ListEmptyComponent={
          loading ? (
            <ListLoading />
          ) : searchError ? (
            <ErrorState
              title="Gagal mencari"
              description={searchError}
              onRetry={() => {
                void result.reload()
                void usersResult.reload()
                void postsResult.reload()
              }}
            />
          ) : !enabled && history.length > 0 ? (
            <View className="gap-3">
              <SectionHeader title="Riwayat pencarian" level="h3" />
              <View className="flex-row flex-wrap gap-2">
                {history.slice(0, 10).map((h, i) => (
                  <Chip key={`${h.query}-${i}`} onPress={() => applyQuery(h.query)}>
                    {h.query}
                  </Chip>
                ))}
              </View>
              <Button
                variant="ghost"
                size="sm"
                fullWidth={false}
                leftIcon={ClockCounterClockwise}
                loading={clearingHistory}
                onPress={() => void handleClearHistory()}
              >
                Hapus riwayat
              </Button>
            </View>
          ) : (
            <EmptyState
              icon={MagnifyingGlass}
              title={enabled ? "Tidak ada hasil" : "Mulai mencari"}
              description={
                enabled
                  ? "Coba kata kunci yang lebih spesifik, atau perluas cakupan ke Semua."
                  : "Masukkan setidaknya dua karakter untuk mencari postingan, pengguna, pesanan, dan mutasi."
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
                    }}
                  >
                    Atur ulang pencarian
                  </Button>
                ) : undefined
              }
            />
          )
        }
        // L-03 (audit 2026-09-23): postingan dibatasi 12 — tautan penelusuran
        // lanjutan ke feed Etalase (search=) saat hasil masih terpotong.
        ListFooterComponent={
          wantPosts && postsResult.data?.hasMore ? (
            <Button
              variant="ghost"
              fullWidth
              onPress={() => router.push(ROUTES.showcaseSearch(keyword.trim()))}
            >
              Lihat semua di Etalase
            </Button>
          ) : null
        }
        refreshing={result.refreshing || usersResult.refreshing || postsResult.refreshing}
        onRefresh={() => {
          void result.refresh()
          void usersResult.refresh()
          void postsResult.refresh()
        }}
        refreshEnabled={enabled && !loading}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        windowSize={7}
      />
    </Screen>
  )
}

/** Ukuran thumbnail hasil postingan — sejajar avatar baris Pengguna. */
const THUMB = 48

/**
 * Baris hasil POSTINGAN etalase (revisi 2026-09-23 — pencarian terpusat).
 *
 * Ringkas sengaja: thumbnail 48px + judul + harga · @penjual + waktu — cukup
 * untuk mengenali karya tanpa menggandakan bobot kartu feed. Ketukan membuka
 * halaman detail (bukan memutar galeri) supaya polanya sama dengan jenis
 * hasil lain di layar ini.
 */
function ShowcaseResultRow({ item }: { item: ShowcaseSocialItem }) {
  // L-02 (audit 2026-09-23): SATU resolver gambar bersama (showcaseImages),
  // bukan rantai `images[0] ?? coverImageUrl ?? imageUrl` milik sendiri.
  const image = showcaseImages(item)[0]?.url ?? null
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={translate("Postingan {x} oleh {y}", {
        x: item.title,
        y: item.author.fullName ?? item.author.username,
      })}
      accessibilityHint="Buka detail postingan"
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
          <Text variant="body" weight={600} numberOfLines={1} className="min-w-0 flex-1">
            {item.title}
          </Text>
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
          {`${showcasePriceLabelOrFallback(item)} · @${item.author.username}`}
        </Text>
      </View>
      <Text variant="caption" tone="tertiary" className="tabular-nums">
        {formatDateTime(item.createdAt)}
      </Text>
    </PressableScale>
  )
}
