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
 *   - Header memuat empat <IconButton variant="ghost"> (order link, sengketa,
 *     template, pencarian global). <Header> mengukur lebar sisi kanan dan
 *     tetap menengahkan judul, jadi empat ikon tidak menggeser "Transaksi".
 */
import { useState } from "react"
import { useRouter } from "expo-router"
import { Copy, Link, MagnifyingGlass, Receipt, Scales } from "phosphor-react-native"
import { api } from "@/lib/api"
import { ORDER_STATUS_FILTERS } from "@/lib/api/orders"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import type { Order } from "@/lib/api/orders"
import { useHasSession } from "@/lib/guest-gate"
import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"
import { useCallback, useEffect, useRef } from "react"
import { useUiPrefs } from "@/lib/ui-prefs"
import { ORDER_STATUS_LABELS } from "@/components/ui/order-status-badge"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { EmptyState } from "@/components/ui/empty-state"
import { FadeIn } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { ModeShiftFade } from "@/components/ui/mode-switcher"
import { IconButton } from "@/components/ui/icon-button"
import { OrderCard } from "@/components/ui/order-card"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { ScrollRow } from "@/components/ui/scroll-row"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"
import { SegmentedControl, type SegmentItem } from "@/components/ui/segmented-control"

/** Peran pengguna pada order — nilai yang dikirim ke `GET /v1/orders?role=`. */
type RoleTab = "seller" | "buyer"

const ROLE_TABS: readonly SegmentItem<RoleTab>[] = [
  { value: "seller", label: "Penjual" },
  { value: "buyer", label: "Pembeli" },
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

export default function TransactionsScreen() {
  const router = useRouter()
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
  const { prefs, setPrefs } = useUiPrefs()
  const role: RoleTab = prefs.transactionsTab
  const [status, setStatus] = useState(ALL_STATUS)
  /*
   * Hanya kata kunci yang SUDAH tenang yang disimpan di sini. Teks mentah
   * tinggal di dalam <DebouncedSearchField>, supaya mengetik tidak merender
   * ulang layar ini beserta seluruh kartu pesanan yang terlihat.
   */
  const [debounced, setDebounced] = useState("")
  /**
   * <DebouncedSearchField> memegang teksnya sendiri (itu sebabnya mengetik
   * tidak merender ulang layar), jadi mengosongkan `debounced` saja TIDAK
   * mengosongkan kolomnya — pengguna akan melihat kata kunci masih tertulis
   * sementara hasilnya sudah tidak disaring. Menaikkan key ini me-remount
   * field dengan `initialQuery` kosong, persis pola `seed` di app/search.tsx.
   */
  const [fieldKey, setFieldKey] = useState(0)
  /**
   * B-02 (audit): tab Transaksi terbuka bagi tamu web
   * (WEB_GUEST_TAB_SCREENS), sedangkan `GET /v1/orders` `auth:"required"` —
   * tanpa gate token setiap fokus tab menembak 401 → refresh → potensi
   * `expireSession`. Tamu kini melihat ajakan masuk, bukan daftar kosong.
   */
  const hasSession = useHasSession()
  const query = usePaginatedQuery(
    `orders:${role}:${status}:${debounced}`,
    (page, signal) =>
      api.orders.listOrders(
        {
          page,
          limit: 20,
          role: ROLE_PARAM[role],
          status: status === ALL_STATUS ? undefined : status,
          search: debounced || undefined,
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
      enabled: hasSession,
      compare: byTimestampDesc<Order>((order) => order.createdAt),
    },
  )
  const filtered = status !== ALL_STATUS || Boolean(debounced)
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
  if (!hasSession) {
    return (
      <Screen edges={["top"]} padded={false}>
        <Header title="Transaksi" showBack={false} />
        <GuestLoginPrompt bare next="/transactions" />
      </Screen>
    )
  }
  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title="Transaksi"
        showBack={false}
        right={
          <>
            <IconButton
              icon={Link}
              variant="ghost"
              accessibilityLabel="Order Link"
              onPress={() => router.push(ROUTES.orderLinks)}
            />
            <IconButton
              icon={Scales}
              variant="ghost"
              accessibilityLabel="Sengketa"
              onPress={() => router.push(ROUTES.disputes)}
            />
            <IconButton
              icon={Copy}
              variant="ghost"
              accessibilityLabel="Template transaksi"
              onPress={() => router.push(ROUTES.transactionTemplates)}
            />
            <IconButton
              icon={MagnifyingGlass}
              variant="ghost"
              accessibilityLabel="Pencarian global"
              onPress={() => router.push(ROUTES.search)}
            />
          </>
        }
      />
      <ModeShiftFade>
      {/* v2: kontrol filter fade-in cepat TANPA geser — kontrol fungsional
          harus terasa stabil, tidak "naik". Item list sendiri mendapat Layout
          animation dari dalam <PaginatedList> (hanya saat tambah/hapus). */}
      <FadeIn duration="fast" translate={false} className="gap-3 px-5 pb-3 pt-3">
        <SegmentedControl
          accessibilityLabel="Peran transaksi"
          items={ROLE_TABS}
          value={role}
          onChange={(next) => setPrefs({ transactionsTab: next })}
        />
        <ScrollRow bleed gap={2} accessibilityLabel="Saring transaksi berdasarkan status">
          {STATUS_CHIPS.map((chip) => (
            <Chip
              key={chip.value}
              selected={status === chip.value}
              accessibilityState={{ selected: status === chip.value }}
              onPress={() => setStatus(chip.value)}
            >
              {chip.label}
            </Chip>
          ))}
        </ScrollRow>
        <DebouncedSearchField
          key={fieldKey}
          onQueryChange={setDebounced}
          autoFocus={false}
          placeholder="Cari transaksi, pihak, atau ID"
        />
      </FadeIn>
      <PaginatedList
        {...query}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        bottomPadding={tokens.space[8]}
        empty={
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
                  ? "Transaksi Anda sebagai penjual akan muncul di sini."
                  : "Transaksi Anda sebagai pembeli akan muncul di sini."
            }
            // Jalan keluar satu ketukan: empty state yang hanya menyuruh
            // "ubah filter" membiarkan pengguna mencari sendiri chip mana yang
            // tadi ditekan. Tombol ini me-reset kedua sumbu sekaligus.
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onPress={() => {
                    setStatus(ALL_STATUS)
                    setDebounced("")
                    setFieldKey((key) => key + 1)
                  }}
                >
                  Hapus filter
                </Button>
              ) : undefined
            }
          />
        }
        renderItem={({ item }) => {
          const cardRole =
            item.myRole === "SELLER" ? "seller" : item.myRole === "BUYER" ? "buyer" : undefined
          const counterpart =
            cardRole === "seller" ? item.buyer : cardRole === "buyer" ? item.seller : undefined
          return (
            <OrderCard
              orderId={item.id}
              title={item.title}
              amount={item.orderValue}
              status={item.status}
              role={cardRole}
              counterpart={{
                name: counterpart?.fullName ?? counterpart?.username ?? "Identitas belum tersedia",
                avatar: counterpart?.avatarUrl ?? undefined,
              }}
              timestamp={formatDateTime(item.createdAt)}
              deadlineAt={item.deliveryDeadlineAt ? new Date(item.deliveryDeadlineAt) : undefined}
              onDeadline={scheduleRefresh}
              href={ROUTES.orderDetail(item.id)}
            />
          )
        }}
      />
      </ModeShiftFade>
    </Screen>
  )
}
