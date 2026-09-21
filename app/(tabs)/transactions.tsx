/**
 * Tab Transaksi — daftar order escrow milik pengguna.
 *
 * Sejak 2026-09-17 filter dipisah per PERAN, bukan per status:
 *   Penjual | Pembeli  → `GET /v1/orders?role=SELLER|BUYER`
 *
 * Alasan (dari pemakaian nyata): status escrow ada SEPULUH (menunggu
 * pembayaran, dana di escrow, diproses, dikirim, menunggu konfirmasi, selesai,
 * sengketa, dibatalkan, dana dikembalikan, kedaluwarsa) sehingga tab
 * "Aktif/Selesai/Dibatalkan" hanya menampung sebagian kecil keadaan — sisanya
 * (mis. SHIPPED, DELIVERED, REFUNDED) tidak bisa disaring sama sekali.
 * Pertanyaan pertama pengguna saat membuka tab ini justru "ini transaksi saya
 * sebagai penjual atau pembeli?", dan itulah yang kini jadi tab. Status tetap
 * terlihat di tiap kartu lewat <OrderStatusBadge> + garis aksen warna
 * (<OrderCard>) — jadi tidak ada informasi yang hilang.
 *
 * Keputusan non-obvious:
 *   - Urutan tab mengikuti urutan peran di kontrak (`role=SELLER` lebih dulu)
 *     dan tab pertama dipilih saat layar dibuka; peran yang tidak dipilih
 *     tetap satu ketukan jauhnya.
 *   - Kata kunci pencarian tetap ada dan berlaku di dalam peran terpilih
 *     (`search` diteruskan apa adanya ke API) — mencari ID order lintas peran
 *     tetap mungkin dengan berpindah tab.
 *   - Hanya kata kunci yang SUDAH tenang yang disimpan di state layar. Teks
 *     mentah tinggal di dalam <DebouncedSearchField>, supaya mengetik tidak
 *     merender ulang layar ini beserta seluruh kartu pesanan yang terlihat.
 */
import { useState } from "react"
import { useRouter } from "expo-router"
import { Copy, MagnifyingGlass, Plus, Receipt } from "phosphor-react-native"
import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { useUiPrefs } from "@/lib/ui-prefs"
import { EmptyState } from "@/components/ui/empty-state"
import { FadeIn } from "@/components/ui/fade-in"
import { FAB_SIZE, FloatingActionButton } from "@/components/ui/floating-action-button"
import { Header } from "@/components/ui/header"
import { IconButton } from "@/components/ui/icon-button"
import { OrderCard } from "@/components/ui/order-card"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
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

export default function TransactionsScreen() {
  const router = useRouter()
  /**
   * J-08 (audit): tab peran dibaca dari preferensi persisten (default
   * "buyer" — mayoritas pengguna escrow adalah pembeli) dan diingat setiap
   * kali pengguna menggantinya; sebelumnya selalu mulai di "Penjual".
   */
  const { prefs, setPrefs } = useUiPrefs()
  const role: RoleTab = prefs.transactionsTab
  /*
   * Hanya kata kunci yang SUDAH tenang yang disimpan di sini. Teks mentah
   * tinggal di dalam <DebouncedSearchField>, supaya mengetik tidak merender
   * ulang layar ini beserta seluruh kartu pesanan yang terlihat.
   */
  const [debounced, setDebounced] = useState("")
  const query = usePaginatedQuery(
    `orders:${role}:${debounced}`,
    (page, signal) =>
      api.orders.listOrders(
        { page, limit: 20, role: ROLE_PARAM[role], search: debounced || undefined },
        signal,
      ),
    // F-01 (audit): bayar/selesaikan pesanan di layar lain lalu kembali ke
    // tab ini — status PENDING_PAYMENT basi tidak boleh bertahan tanpa
    // pull-to-refresh manual.
    { refreshOnFocus: true },
  )
  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title="Transaksi"
        showBack={false}
        right={
          <>
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
      {/* v2: kontrol filter fade-in cepat TANPA geser — kontrol fungsional
          harus terasa stabil, tidak "naik". Item list sendiri mendapat Layout
          animation dari dalam <PaginatedList> (hanya saat tambah/hapus). */}
      <FadeIn duration="fast" translate={false} className="gap-3 px-5 pb-3 pt-3">
        <SegmentedControl
          items={ROLE_TABS}
          value={role}
          onChange={(next) => setPrefs({ transactionsTab: next })}
        />
        <DebouncedSearchField
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
        // FAB melayang DI ATAS list: sisakan tinggi FAB + offset bawahnya
        // + satu gap, supaya baris terakhir tidak tertutup tombol.
        bottomPadding={FAB_SIZE + tokens.space[4] + tokens.space[8]}
        empty={
          <EmptyState
            icon={Receipt}
            title={debounced ? "Tidak ada hasil" : "Belum ada transaksi"}
            // Dua string peran ditulis INLINE (bukan di map): generator
            // katalog i18n hanya memindai nilai pada atribut/properti bernama
            // teks, jadi string di dalam map `Record<Role, string>` tidak
            // pernah masuk katalog dan tidak akan ikut diterjemahkan.
            description={
              debounced
                ? `Tidak ada transaksi yang cocok dengan “${debounced}”.`
                : role === "seller"
                  ? "Transaksi Anda sebagai penjual akan muncul di sini."
                  : "Transaksi Anda sebagai pembeli akan muncul di sini."
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
              onDeadline={() => void query.refresh()}
              href={ROUTES.orderDetail(item.id)}
            />
          )
        }}
      />
      <FloatingActionButton
        icon={Plus}
        accessibilityLabel="Buat Transaksi"
        label="Buat Transaksi"
        extended={query.data.length === 0 && !query.loading}
        onPress={() => router.push(ROUTES.createTransaction)}
        bottomOffset={tokens.space[4]}
        safeArea={false}
      />
    </Screen>
  )
}
