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
import { ScrollView, View, type FlatList } from "react-native"
import { AirplaneTilt, ArrowLeft, CalendarCheck, CaretRight, FileText, Funnel, LinkSimple, Package, Plus, Receipt, ShieldWarning, ShoppingBag, Storefront, UsersThree, Wallet } from "phosphor-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter, type Href } from "expo-router"
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
import { Icon, type IconComponent } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { ListItem } from "@/components/ui/list-item"
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

/**
 * Poin 1 (2026-10-04, keputusan produk): semua urusan transaksi satu tempat.
 * Tiga entri sheet "Toko Saya" yang dihapus — Jastip, Patungan, Booking Jasa —
 * pindah ke tab ini sebagai segmen. Segmen "Saya selenggarakan" vs
 * "Saya ikuti" TIDAK didukung struktur backend (jastip = host-only via
 * /v1/jastip/trips/mine, patungan = discovery publik, booking = buyer-only
 * via /v1/commerce/service-slots/bookings/mine), jadi tiap layanan mendapat
 * hub ringkas yang menaut ke layarnya masing-masing — flow
 * jastip/patungan/booking TIDAK di-refactor (itu Poin 2).
 *
 * Poin 2 (2026-10-04): baris "Kelola" (header daftar segmen orders) —
 * "Template Transaksi", "Tautan Pesanan", "Sengketa Saya" pindah dari drawer
 * ke sini. Dipilih BARIS (bukan segmen ke-5/6/7): segmented control sudah
 * penuh 4 segmen; baris ikut scroll bersama daftar sehingga chrome tetap
 * ramping.
 */
/**
 * Sidebar 2026-10-05: section "manage" = hub Kelola Transaksi (tautan
 * pesanan, template, sengketa, retur). BUKAN segmen ke-5 yang terlihat —
 * <SegmentedControl> 4 segmen sudah penuh; "manage" hanya dibuka via
 * deep-link sidebar (?section=manage, ROUTES.transactionsManage) atau kartu
 * "Kelola transaksi" di segmen Transaksi. Satu sumber kebenaran: komponen
 * <TrxManageHub> di file ini — TIDAK ada layar duplikat.
 */
type TrxSection = "orders" | "jastip" | "patungan" | "bookings" | "manage"

const TRX_SECTIONS: readonly SegmentItem<Exclude<TrxSection, "manage">>[] = [
  { value: "orders", label: "Transaksi", icon: Receipt },
  { value: "jastip", label: "Jastip", icon: AirplaneTilt },
  { value: "patungan", label: "Patungan", icon: UsersThree },
  { value: "bookings", label: "Booking", icon: CalendarCheck },
]

function parseTrxSection(raw: unknown): TrxSection {
  return raw === "jastip" || raw === "patungan" || raw === "bookings" || raw === "manage" ? raw : "orders"
}

const TRX_SERVICE_HUBS: Record<
  Exclude<TrxSection, "orders" | "manage">,
  {
    icon: IconComponent
    title: string
    description: string
    actionLabel: string
    route: Href
    secondaryLabel?: string
    secondaryRoute?: Href
  }
> = {
  jastip: {
    icon: AirplaneTilt,
    title: "Jastip",
    description: "Trip jastip yang Anda selenggarakan — atur katalog, pantau peserta, dan kunci harga.",
    actionLabel: "Buka Jastip saya",
    route: ROUTES.jastip,
    secondaryLabel: "Cara kerja Jastip",
    secondaryRoute: ROUTES.jastipHowItWorks,
  },
  patungan: {
    icon: UsersThree,
    title: "Patungan",
    description: "Kumpulkan iuran bersama — buat grup baru atau kelola yang sudah berjalan.",
    actionLabel: "Buka Patungan",
    route: ROUTES.patungan,
    secondaryLabel: "Cara kerja Patungan",
    secondaryRoute: ROUTES.patunganHowItWorks,
  },
  bookings: {
    icon: CalendarCheck,
    title: "Booking",
    description: "Jadwal booking jasa Anda — lihat detail dan batalkan bila berubah rencana.",
    actionLabel: "Buka Booking saya",
    route: ROUTES.serviceBookings,
  },
}

/** Hub ringkas satu layanan: penjelasan + tombol ke layar penuhnya. */
function TrxServiceHub({ section }: { section: Exclude<TrxSection, "orders" | "manage"> }) {
  const router = useRouter()
  const hub = TRX_SERVICE_HUBS[section]
  return (
    <View className="gap-4">
      <View className="gap-3 rounded-2xl border border-border bg-surface p-5">
        <Icon icon={hub.icon} size="lg" tone="active" weight="bold" />
        <Text variant="h3" weight={700}>
          {translate(hub.title)}
        </Text>
        <Text variant="body" tone="secondary">
          {translate(hub.description)}
        </Text>
      </View>
      <Button onPress={() => router.push(hub.route)}>{translate(hub.actionLabel)}</Button>
      {hub.secondaryLabel && hub.secondaryRoute ? (
        <Button variant="ghost" onPress={() => router.push(hub.secondaryRoute!)}>
          {translate(hub.secondaryLabel)}
        </Button>
      ) : null}
    </View>
  )
}

/**
 * Sidebar 2026-10-05: hub "Kelola Transaksi" — SATU-SATUNYA rumah untuk
 * semua yang berkaitan dengan transaksi (pindahan drawer Poin 2, kini
 * di-improve dari baris ringkas menjadi hub rapi):
 *
 *   Tautan Pesanan · Template Transaksi · Sengketa · Retur
 *
 * Satu pola sengketa/retur: hub menaut ke LAYAR DAFTAR (/disputes,
 * /returns); pengajuan baru selalu per-order dari detail transaksi —
 * TIDAK ADA form tempel-ID manual (sesuai unifikasi transaksi).
 * Sidebar "Kelola Transaksi" deep-link ke sini (?section=manage); kartu
 * ringkas di segmen Transaksi membuka section yang sama. Satu sumber
 * kebenaran: TRX_MANAGE_ITEMS + <TrxManageHub> di file ini.
 */
const TRX_MANAGE_ITEMS: ReadonlyArray<{
  id: string
  icon: IconComponent
  label: string
  description: string
  route: Href
}> = [
  { id: "order-links", icon: LinkSimple, label: "Tautan Pesanan", description: "Buat & kelola tautan pembayaran", route: ROUTES.orderLinks },
  { id: "templates", icon: FileText, label: "Template Transaksi", description: "Format pesanan siap pakai ulang", route: ROUTES.transactionTemplates },
  { id: "disputes", icon: ShieldWarning, label: "Sengketa", description: "Pantau & tanggapi sengketa", route: ROUTES.disputes },
  { id: "returns", icon: Package, label: "Retur", description: "Pantau pengembalian barang", route: ROUTES.returns },
]

/** Kartu ringkas di puncak segmen Transaksi → membuka section Kelola. */
function TrxManageLink({ onOpen }: { onOpen: () => void }) {
  return (
    <PressableScale
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={translate("Buka Kelola Transaksi")}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
    >
      <Icon icon={Receipt} size="md" tone="default" weight="bold" />
      <View className="flex-1 gap-0.5">
        <Text variant="body" weight={600}>
          {translate("Kelola Transaksi")}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {translate("Tautan, template, sengketa, retur")}
        </Text>
      </View>
      <Icon icon={CaretRight} size="sm" tone="default" weight="bold" />
    </PressableScale>
  )
}

/** Section Kelola: daftar rapi semua tautan transaksi. */
function TrxManageHub({ onBack }: { onBack: () => void }) {
  return (
    <View className="gap-4">
      <PressableScale
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={translate("Kembali ke daftar transaksi")}
        className="flex-row items-center gap-1 self-start py-1"
      >
        <Icon icon={ArrowLeft} size="sm" tone="active" weight="bold" />
        <Text variant="body" weight={600} tone="primary">
          {translate("Transaksi")}
        </Text>
      </PressableScale>
      <View className="gap-2">
        <Text variant="h3" weight={700}>
          {translate("Kelola Transaksi")}
        </Text>
        <Text variant="body" tone="secondary">
          {translate("Semua keperluan transaksi Anda dalam satu tempat.")}
        </Text>
      </View>
      <View className="w-full overflow-hidden rounded-md bg-surface">
        {TRX_MANAGE_ITEMS.map((item) => (
          <ListItem
            key={item.id}
            title={translate(item.label)}
            titleVariant="bodyLarge"
            subtitle={translate(item.description)}
            leading={item.icon}
            chevron
            divider={false}
            href={item.route}
          />
        ))}
      </View>
    </View>
  )
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
  // Poin 1: segmen bagian tab — `?section=jastip|patungan|bookings` dari
  // deep-link (mis. tap notifikasi) membuka segmen layanan langsung;
  // bukaan biasa default ke daftar order.
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>()
  const [section, setSection] = useState<TrxSection>(() => parseTrxSection(sectionParam))
  useEffect(() => {
    setSection(parseTrxSection(sectionParam))
  }, [sectionParam])
  // Efek scroll: header terangkat (bayangan) saat daftar digulir.
  const { onScrollWorklet } = useScrollElevation()
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
  // walletEnabled (chip disembunyikan saat kill-switch dompet mati) +
  // section (aksi khusus-order — filter status & buat transaksi — hanya
  // tampil di segmen Transaksi; segmen layanan punya CTA-nya sendiri).
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
        {section === "orders" ? (
          <>
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
          </>
        ) : null}
      </View>
    ),
    [walletBalance, filtered, walletEnabled, section, handleWalletPress, handleFilterSheetOpen, handleCreateTransactionPress],
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
   * Sidebar 2026-10-05: kartu ringkas "Kelola Transaksi" sebagai header
   * daftar segmen orders — membuka section Kelola (hub penuh di bawah).
   * Distabilkan seperti placeholder/empty di atas (R1-005).
   */
  const handleOpenManage = useCallback(() => setSection("manage"), [])
  const handleBackToOrders = useCallback(() => setSection("orders"), [])
  const trxManageRow = useMemo(() => <TrxManageLink onOpen={handleOpenManage} />, [handleOpenManage])
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
        elevated={false}
        // T5-002 (audit UI/UX intuitif 2026-09-29): drawer bisa dibuka dari
        // semua tab, bukan cuma Etalase.
        left={headerLeft}
        right={headerRight}
      />
      <ModeShiftFade>
      {/* Poin 1: segmen bagian — Transaksi | Jastip | Patungan | Booking.
          Tiga layanan pindahan sheet "Toko Saya"; semua urusan transaksi
          satu tempat (keputusan produk). Sidebar 2026-10-05: section
          "manage" menyembunyikan segmen (nilainya tak ada di daftar) dan
          merender hub Kelola penuh dengan tombol kembali sendiri. */}
      {section === "manage" ? null : (
        <FadeIn duration="fast" translate={false} className="z-sticky bg-background px-5 pt-3">
          <SegmentedControl
            accessibilityLabel={translate("Bagian transaksi")}
            items={TRX_SECTIONS}
            value={section}
            onChange={setSection}
          />
        </FadeIn>
      )}
      {section === "orders" ? (
        <>
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
        header={trxManageRow}
        renderItem={renderGroup}
      />
        </>
      ) : section === "manage" ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_HEIGHT + tokens.space[4] }}
        >
          <TrxManageHub onBack={handleBackToOrders} />
        </ScrollView>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_HEIGHT + tokens.space[4] }}
        >
          <TrxServiceHub section={section} />
        </ScrollView>
      )}
      </ModeShiftFade>
    </Screen>
  )
}
