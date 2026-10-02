/**
 * Tab Transaksi — daftar order escrow milik pengguna.
 *
 * Dua sumbu saring, dan keduanya dipertahankan karena menjawab pertanyaan
 * yang berbeda:
 *   1. PERAN  (Penjual | Pembeli) → `GET /v1/orders?role=SELLER|BUYER`.
 *      Pertanyaan pertama pengguna saat membuka tab ini: "ini transaksi saya
 *      sebagai penjual atau pembeli?"
 *   2. STATUS (chip) → `GET /v1/orders?status=…`.
 *      Sempat DIHAPUS dengan alasan "tab Aktif/Selesai/Dibatalkan hanya
 *      menampung sebagian kecil keadaan". Alasan itu benar untuk TIGA tab,
 *      tetapi kesimpulannya keliru: jawabannya bukan membuang filter status,
 *      melainkan memakai status yang sebenarnya. Enum backend (lihat
 *      `OrderStatus` di lib/api/orders.ts) punya tujuh keadaan — menunggu
 *      konfirmasi, menunggu pembayaran, diproses, dalam pengiriman, selesai,
 *      sengketa, dibatalkan — dan chip horizontal menampung semuanya tanpa
 *      memaksa pengguna memilih salah satu dari tiga kotak.
 *
 * Keputusan non-obvious:
 *   - Label chip diambil dari `ORDER_STATUS_LABELS` dan daftarnya dari
 *     `ORDER_STATUS_FILTERS`, jadi teks di chip dan teks di badge kartu order
 *     tidak mungkin berbeda. Menulis label sendiri di layar inilah yang
 *     membuat filter dan badge sempat menceritakan dua kisah.
 *   - "Aktif" dikirim sebagai `status=ACTIVE` — kunci magis backend untuk
 *     SEMUA status berjalan (didokumentasikan spec di query `status`), bukan
 *     gabungan beberapa chip.
 *   - "Semua" TIDAK mengirim `status` sama sekali; mengirim string kosong
 *     membuat backend menyaring untuk status "" dan mengembalikan daftar kosong.
 *   - Urutan kontrol: peran → status → cari. Dua saringan berdampingan, kolom
 *     cari paling dekat dengan daftar yang dipersempitnya (dan paling dekat
 *     dengan keyboard saat terbuka).
 *   - Hanya kata kunci yang SUDAH tenang yang disimpan di state layar. Teks
 *     mentah tinggal di dalam <DebouncedSearchField>, supaya mengetik tidak
 *     merender ulang layar ini beserta seluruh kartu pesanan yang terlihat.
 *   - Saringan STATUS hidup di bloknya sendiri di bawah pil peran (revisi
 *     2026-09-26): menempel langsung di bawah <SegmentedControl> membuat dua
 *     kontrol berbeda terbaca sebagai satu kelompok tab.
 *
 * Redesign premium 2026-09-27 (presentasi saja — logika/filter/API identik):
 *   - Segmen peran memakai ikon (ShoppingBag = Pembeli, Storefront = Penjual)
 *     dan diurutkan Pembeli dulu — mayoritas pengguna escrow adalah pembeli
 *     (konsisten dengan default preferensi J-08).
 *   - Label "Filter status" memakai ikon funnel kecil; struktur blok tidak berubah.
 *   - Daftar dikelompokkan per hari kalender WIB ("Hari ini"/"Kemarin"/tanggal)
 *     lewat `groupOrdersByDay` (lib/transaction-grouping.ts, murni & ter-test)
 *     — pola yang sama dengan Riwayat Dompet. Tiap kelompok: kepala hari
 *     (label + tanggal pendek + "N transaksi") lalu kartu-kartu order.
 *   - Loading pertama memakai <OrderCardSkeleton> sebentuk kartu asli
 *     (bukan kartu generik) supaya layout tidak melompat saat data masuk.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, type FlatList } from "react-native"
import { Funnel, Plus, Receipt, ShoppingBag, Storefront, Wallet } from "phosphor-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { api } from "@/lib/api"
import { ORDER_STATUS_FILTERS } from "@/lib/api/orders"
import { formatDateTimeWIB, formatNumber, formatRupiah } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { toEpochMs } from "@/lib/pending-actions"
import { ROUTES } from "@/lib/routes"
import { queryKeys } from "@/lib/query-keys"
import { writeQueryCache } from "@/lib/query-cache"
import { tokens } from "@/lib/tokens"
import { groupOrdersByDay, type OrderDayGroup } from "@/lib/transaction-grouping"
import { TAB_BAR_HEIGHT } from "@/components/ui/bottom-tab-bar"
import type { Order } from "@/lib/api/orders"
import { useHasSession } from "@/lib/guest-gate"
import { useWalletEnabled } from "@/lib/use-wallet-enabled"
import { useApiQuery } from "@/lib/use-api-query"
import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"
import { useSetUiPrefs, useUiPref } from "@/lib/ui-prefs"
import { useScrollElevation } from "@/lib/use-scroll-elevation"
import { useShellTabReselect } from "@/lib/shell-tab-reselect"
import { ORDER_STATUS_LABELS } from "@/components/ui/order-status-badge"
import { Button } from "@/components/ui/button"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { EmptyState } from "@/components/ui/empty-state"
import { FadeIn } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { DrawerMenuButton } from "@/components/ui/drawer-menu-button"
import { ModeShiftFade } from "@/components/ui/mode-switcher"
import { OrderCard } from "@/components/ui/order-card"
import { PaginatedList } from "@/components/ui/paginated-list"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { SegmentedControl, type SegmentItem } from "@/components/ui/segmented-control"
import { TransactionStatusSheet } from "@/components/ui/transaction-status-sheet"
import { TransactionsTabListSkeleton } from "@/components/ui/tab-loading-skeletons"

/** Peran pengguna pada order — nilai yang dikirim ke `GET /v1/orders?role=`. */
type RoleTab = "seller" | "buyer"

/**
 * Urutan segmen: Pembeli dulu — mayoritas pengguna escrow adalah pembeli
 * (konsisten dengan default preferensi `transactionsTab: "buyer"` di J-08).
 */
const ROLE_TABS: readonly SegmentItem<RoleTab>[] = [
  { value: "buyer", label: "Pembeli", icon: ShoppingBag },
  { value: "seller", label: "Penjual", icon: Storefront },
]

const ROLE_PARAM: Record<RoleTab, "SELLER" | "BUYER"> = {
  seller: "SELLER",
  buyer: "BUYER",
}

/** `null` = jangan kirim parameter `status` sama sekali. */
const ALL_STATUS = "ALL"

/**
 * Chip status: "Semua" + "Aktif" (kunci magis backend) + tujuh status enum.
 * Dibangun sekali di luar komponen — daftarnya statis, dan membangunnya per
 * render hanya membuat identitas array berubah tiap ketikan.
 */
const STATUS_CHIPS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "Semua status", value: ALL_STATUS },
  { label: "Aktif", value: "ACTIVE" },
  ...ORDER_STATUS_FILTERS.map((status) => ({
    value: status,
    label: ORDER_STATUS_LABELS[status] ?? status,
  })),
]

/**
 * Kepala kelompok hari: label hari (600) + jumlah order.
 * FE-089: sub tanggal pendek dihapus (redundan) — lihat
 * lib/transaction-grouping.ts. Dipisah sebagai komponen supaya `renderItem`
 * PaginatedList tetap ramping.
 */
function TransactionDayHeader({
  label,
  count,
}: {
  label: string
  count: number
}) {
  return (
    <View className="flex-row items-baseline justify-between gap-3 px-1">
      <Text variant="body" weight={600} tone="primary" numberOfLines={1} className="min-w-0 flex-1">
        {label}
      </Text>
      <Text variant="caption" tone="tertiary" className="shrink-0 tabular-nums">
        {translate("{n} transaksi", { n: formatNumber(count) })}
      </Text>
    </View>
  )
}

/**
 * Satu kartu order — pemetaan Order → props <OrderCard> yang sama persis
 * seperti sebelum redesign (peran, lawan transaksi, timestamp WIB, tenggat
 * epoch-ms). Hanya dibungkus supaya daftar kelompok bisa memetakannya.
 *
 * LR-006 (perf-fix): dibungkus `memo` — nominal, status, dan perilaku TIDAK
 * berubah; hanya mencegah re-render kartu saat parent re-render (mis. saat
 * mengetik di pencarian). `order` dan `onDeadline` (scheduleRefresh, sudah
 * useCallback) adalah identitas stabil.
 */
const TransactionOrderCard = memo(function TransactionOrderCard({
  order,
  onDeadline,
}: {
  order: Order
  onDeadline: () => void
}) {
  // PERF-FIX (network P1): prefetch press-in — titipkan Order lengkap dari
  // daftar ke cache kanonis `queryKeys.order(id)`; layar detail
  // mengonsumsinya via `fetchViaQueryCache` tanpa request `getOrder` ulang
  // (doktrin C-02). Stabil per `order` agar tidak menjebol memo.
  const handlePressIn = useCallback(() => {
    writeQueryCache(queryKeys.order(order.id), order)
  }, [order])
  const cardRole =
    order.myRole === "SELLER" ? "seller" : order.myRole === "BUYER" ? "buyer" : undefined
  const counterpart =
    cardRole === "seller" ? order.buyer : cardRole === "buyer" ? order.seller : undefined
  return (
    <OrderCard
      orderId={order.id}
      title={order.title}
      amount={order.orderValue}
      status={order.status}
      role={cardRole}
      counterpart={{
        name: counterpart?.fullName ?? counterpart?.username ?? "Identitas belum tersedia",
        avatar: counterpart?.avatarUrl ?? undefined,
      }}
      // FE-128 (audit frontend 2026-09-29): daftar transaksi memakai waktu
      // ABSOLUT WIB — semua yang berbau uang satu konvensi; waktu relatif
      // hanya untuk konteks sosial/chat/notifikasi. Cap WIB eksplisit juga
      // tampil di layar detail transaksi (§13).
      timestamp={formatDateTimeWIB(order.createdAt)}
      deadlineAt={
        // M-54 (audit end-to-end, issue #72): `toEpochMs` (domain jam
        // C-04) — `new Date("1700000000")` string epoch-detik = Invalid
        // Date dan countdown tenggat menampilkan "—".
        // R2 (audit ronde-2, butir #65): teruskan EPOCH MS primitif,
        // bukan `new Date()` per render — identitas prop yang baru tiap
        // render merangkai-ulang effect countdown tanpa alasan.
        toEpochMs(order.deliveryDeadlineAt) ?? undefined
      }
      onDeadline={onDeadline}
      href={ROUTES.orderDetail(order.id)}
      onPressIn={handlePressIn}
    />
  )
})

export default function TransactionsScreen() {
  // FE-064: elemen header kiri yang stabil — <DrawerMenuButton> tanpa prop,
  // aman dipakai ulang antar render agar memo <Header> bisa bail-out.
  const headerLeft = useMemo(() => <DrawerMenuButton />, [])

  const insets = useSafeAreaInsets()
  /**
   * J-08 (audit): tab peran dibaca dari preferensi persisten (default
   * "buyer" — mayoritas pengguna escrow adalah pembeli) dan diingat setiap
   * kali pengguna menggantinya; sebelumnya selalu mulai di "Penjual".
   *
   * Filter status SENGAJA tidak dipersisten: peran adalah identitas ("saya
   * penjual"), status adalah pertanyaan sesaat ("mana yang belum dibayar?").
   * Mengingat status membuat daftar terasa hilang tanpa sebab saat layar
   * dibuka minggu depan.
   */
  const transactionsTab = useUiPref("transactionsTab")
  const setPrefs = useSetUiPrefs()
  const role: RoleTab = transactionsTab
  const [status, setStatus] = useState(ALL_STATUS)
  const [sheetOpen, setSheetOpen] = useState(false)
  // Efek scroll: header terangkat (bayangan) saat daftar digulir.
  const { elevated, onScrollWorklet } = useScrollElevation()
  const listRef = useRef<FlatList<OrderDayGroup<Order>>>(null)
  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [])
  useShellTabReselect("transactions", scrollToTop)
  /**
   * B-02 (audit): tab Transaksi terbuka bagi tamu web
   * (WEB_GUEST_TAB_SCREENS), sedangkan `GET /v1/orders` `auth:"required"` —
   * tanpa gate token setiap fokus tab menembak 401 → refresh → potensi
   * `expireSession`. Tamu kini melihat ajakan masuk, bukan daftar kosong.
   */
  const hasSession = useHasSession()
  const router = useRouter()
  // Mode Tanpa Wallet Internal (BI-safe): chip saldo mini disembunyikan —
  // aplikasi tidak boleh menampilkan saldo dompet internal saat flag false.
  const walletEnabled = useWalletEnabled()
  /**
   * T5-003-minimal: jalan pintas visual ke Dompet — chip saldo mini di
   * header. Memakai kunci cache `wallet` yang SAMA dengan layar Dompet
   * (F-03), jadi tidak menembak GET ganda bila Dompet baru dibuka.
   * BUKAN tab baru (keputusan produk — tab penuh di-defer).
   */
  const walletQuery = useApiQuery(
    queryKeys.wallet(),
    (signal) => api.wallet.getWallet(signal),
    // Mode Tanpa Wallet Internal: jangan menembak endpoint dompet saat
    // kill-switch mati (backend menonaktifkannya; hemat 401/403).
    hasSession && walletEnabled,
  )
  const walletBalance = walletQuery.data?.balance
  const query = usePaginatedQuery(
    `orders:${role}:${status}`,
    (page, signal) =>
      api.orders.listOrders(
        {
          page,
          limit: 20,
          role: ROLE_PARAM[role],
          status: status === ALL_STATUS ? undefined : status,
        },
        signal,
      ),
    // F-01 (audit): bayar/selesaikan pesanan di layar lain lalu kembali ke
    // tab ini — status basi tidak boleh bertahan tanpa pull-to-refresh manual.
    // C-08 (audit): pesanan baru bisa masuk saat sesi berjalan; tanpa
    // pembanding ini baris lama tetap di posisinya walau server sudah
    // mengurutkan ulang.
    {
      refreshOnFocus: true,
      // NC-003 (audit performa ronde-3): status transaksi → jendela lebih
      // pendek (10 dtk); mutasi order membatalkan prefix "order" di transport.
      refreshOnFocusStaleMs: 10_000,
      enabled: hasSession,
      compare: byTimestampDesc<Order>((order) => order.createdAt),
      keepPreviousOnKeyChange: true,
    },
  )
  const filtered = status !== ALL_STATUS

  // FE-064: prop `right` header di-memo agar memo <Header> bisa bail-out.
  // Deps: walletBalance (label chip) + filtered (state tombol funnel) +
  // walletEnabled (chip disembunyikan saat kill-switch dompet mati).
  // PERF-FIX (TIM1-P2): handler tombol stabil via useCallback.
  const handleWalletPress = useCallback(() => router.push(ROUTES.wallet), [router])
  const handleFilterSheetOpen = useCallback(() => setSheetOpen(true), [])
  const handleClearStatusFilter = useCallback(() => setStatus(ALL_STATUS), [])
  const handleCreateTransactionPress = useCallback(() => router.push(ROUTES.createTransaction), [router])
  const handleShowcasePress = useCallback(() => router.push(ROUTES.showcase), [router])
  const headerRight = useMemo(    () => (
      <View className="flex-row items-center gap-2">
        {walletEnabled ? (
          /*
           * T5-003-minimal: chip saldo mini → Dompet. Satu ketukan, tanpa
           * menambah tab (keputusan produk: tab penuh di-defer).
           * Mode Tanpa Wallet Internal: disembunyikan saat flag false.
           */
          <PressableScale
            onPress={handleWalletPress}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
            accessibilityLabel={
              typeof walletBalance === "number"
                ? `Buka Dompet, saldo ${formatRupiah(walletBalance)}`
                : "Buka Dompet"
            }
            className="flex-row items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5"
          >
            <Icon icon={Wallet} size="sm" tone="active" />
            <Text variant="caption" weight={600}>
              {typeof walletBalance === "number"
                ? formatRupiah(walletBalance)
                : "Dompet"}
            </Text>
          </PressableScale>
        ) : null}
        <IconButton
          icon={Funnel}
          variant="ghost"
          active={filtered}
          accessibilityLabel={translate("Filter status transaksi")}
          accessibilityHint={
            filtered ? translate("Filter aktif, ketuk untuk mengubah") : translate("Ketuk untuk memfilter")
          }
          onPress={handleFilterSheetOpen}
        />
        <IconButton
          icon={Plus}
          variant="ghost"
          accessibilityLabel={translate("Buat transaksi baru")}
          onPress={handleCreateTransactionPress}
        />
      </View>
    ),
    [walletBalance, filtered, walletEnabled, handleWalletPress, handleFilterSheetOpen, handleCreateTransactionPress],
  )

  /**
   * R1-005 (2026-09-29, audit render-perf): placeholder & empty distabilkan —
   * identitas baru tiap render membatalkan `useMemo` di dalam <PaginatedList>
   * dan memaksa VirtualizedList render ulang kontainer.
   */
  const trxListLoading = useMemo(() => <TransactionsTabListSkeleton />, [])
  const trxListEmpty = useMemo(
    () => (
      <EmptyState
        icon={Receipt}
        title={filtered ? "Tidak ada hasil" : "Belum ada transaksi"}
        // Dua string peran ditulis INLINE (bukan di map): generator
        // katalog i18n hanya memindai nilai pada atribut/properti bernama
        // teks, jadi string di dalam map `Record<Role, string>` tidak
        // pernah masuk katalog dan tidak akan ikut diterjemahkan.
        description={
          filtered
            ? "Tidak ada transaksi yang cocok dengan saringan ini."
            : role === "seller"
              ? // T1-004: beri tahu penjual cara MULAI menerima order.
                "Bagikan etalase Anda atau buat tautan pembayaran untuk mulai menerima order."
              : // T1-004: beri tahu pembeli cara memulai transaksi pertama.
                "Belum ada transaksi. Mulai dengan membeli dari etalase, atau minta tautan pembayaran ke penjual."
        }
        // Jalan keluar satu ketukan: empty state yang hanya menyuruh
        // "ubah filter" membiarkan pengguna mencari sendiri chip mana yang
        // tadi ditekan. Tombol ini me-reset kedua sumbu sekaligus.
        // T1-004: empty state non-filter mendapat tombol aksi primer —
        // user baru tahu cara memulai transaksi pertama.
        action={
          filtered ? (
            <Button
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={handleClearStatusFilter}
            >
              Hapus filter
            </Button>
          ) : role === "seller" ? (
            <Button
              size="sm"
              fullWidth={false}
              onPress={handleCreateTransactionPress}
            >
              Buat tautan pembayaran
            </Button>
          ) : (
            <Button
              size="sm"
              fullWidth={false}
              onPress={handleShowcasePress}
            >
              Lihat etalase
            </Button>
          )
        }
      />
    ),
    [filtered, role, handleClearStatusFilter, handleCreateTransactionPress, handleShowcasePress],
  )
  /**
   * G-03 (audit escrow 2026-09-24): N kartu yang countdown tenggatnya habis
   * bersamaan (batch order) dulu memicu N `query.refresh()` beruntun yang
   * saling membatalkan (tiap load meng-abort load sebelumnya) — daftar bisa
   * gagal segar justru saat status berubah. Refresh digabung: yang pertama
   * menjadwal, semua kejadian dalam jendela 750 ms dihitung satu refresh.
   */
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) return
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null
      void query.refresh()
    }, 750)
  }, [query])
  useEffect(
    () => () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    },
    [],
  )
  /**
   * Pengelompokan per hari kalender WIB — murni presentasi atas `query.data`
   * (urutan & isi tidak berubah; `byTimestampDesc` di query menjaga urutan
   * server). Pagination yang memotong satu hari menjadi dua kelompok adalah
   * perilaku yang sama dengan Riwayat Dompet — diterima.
   */
  const groups = useMemo<OrderDayGroup<Order>[]>(() => groupOrdersByDay(query.data), [query.data])
  /**
   * LR-006 (perf-fix): renderItem stabil via useCallback — identitasnya tidak
   * berubah tiap render, sehingga PaginatedList tidak me-render ulang semua
   * baris saat parent re-render (mis. saat mengetik di pencarian).
   */
  const renderGroup = useCallback(
    ({ item: group }: { item: OrderDayGroup<Order> }) => (
      <View className="gap-3">
        <TransactionDayHeader label={group.label} count={group.count} />
        {group.orders.map((order) => (
          <TransactionOrderCard key={order.id} order={order} onDeadline={scheduleRefresh} />
        ))}
      </View>
    ),
    [scheduleRefresh],
  )
  if (!hasSession) {
    return (
      <Screen edges={["top"]} padded={false}>
        <Header title="Transaksi" showBack={false} separator={false} titleAlign="left" />
        <GuestLoginPrompt bare next="/transactions" />
      </Screen>
    )
  }
  return (
    <Screen edges={["top"]} padded={false}>
      {/* Aksi header tetap kontekstual: buat transaksi, filter status, dan
          pintasan dompet opsional. Utility lain tetap berada di drawer. */}
      {/* Header tanpa separator; status dipilih melalui sheet funnel. */}
      <Header
        title="Transaksi"
        titleAlign="left"
        showBack={false}
        separator={false}
        elevated={elevated}
        // T5-002 (audit UI/UX intuitif 2026-09-29): drawer bisa dibuka dari
        // semua tab, bukan cuma Etalase.
        left={headerLeft}
        right={headerRight}
      />
      <ModeShiftFade>
      {/* v2: kontrol filter fade-in cepat TANPA geser — kontrol fungsional
          harus terasa stabil, tidak "naik". Item list sendiri mendapat Layout
          animation dari dalam <PaginatedList> (hanya saat tambah/hapus).
          z-sticky (defense-in-depth, akar bug fade-in collapse sudah diperbaiki
          di fade-in.tsx): pagar stacking — apa pun yang terjadi pada geometri
          daftar, teks list TIDAK PERNAH bisa ter-cat di atas pill kontrol. */}
      <FadeIn duration="fast" translate={false} className="z-sticky bg-background px-5 pb-3 pt-3">
        <SegmentedControl
          accessibilityLabel="Peran transaksi"
          items={ROLE_TABS}
          value={role}
          onChange={(next) => setPrefs({ transactionsTab: next })}
        />
      </FadeIn>
      {/* v2 (2026-09-27): blok saringan chip DIHAPUS atas permintaan produk —
          filter cukup ikon funnel di header yang membuka sheet pilihan status.
          Logika `status`/`filtered`/query tidak berubah. */}
      <TransactionStatusSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        options={STATUS_CHIPS}
        value={status}
        onSelect={setStatus}
      />
      <PaginatedList
        {...query}
        data={groups}
        listRef={listRef}
        onScrollWorklet={onScrollWorklet}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        bottomPadding={insets.bottom + TAB_BAR_HEIGHT + tokens.space[4]}
        loadingPlaceholder={trxListLoading}
        empty={trxListEmpty}
        renderItem={renderGroup}
      />
      </ModeShiftFade>
    </Screen>
  )
}
