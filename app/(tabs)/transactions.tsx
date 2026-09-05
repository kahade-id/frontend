/**
 * Tab #2 — Transaksi
 *
 * Menampilkan list order milik user dari `GET /v1/orders`:
 *  - SegmentedControl filter status: Semua | Aktif | Selesai | Dibatalkan
 *      · "Aktif" mengirim `status=ACTIVE` — kontrak API:
 *        "Order status filter (use ACTIVE for all active statuses)".
 *        JANGAN mengganti dengan salah satu status spesifik.
 *  - SearchField (debounce 300ms bawaan komponen) → query `search` API
 *  - Paginasi `page`/`limit` (spec: default 10, maks 50) + LoadMore footer
 *  - Pull-to-refresh, skeleton saat loading pertama, EmptyState/ErrorState
 *  - FAB "Buat Transaksi" → ROUTES.createTransaction (screen belum dibuat;
 *    sementara toast info — saat route ada, ganti handler dengan router.push)
 *
 * Semua path rute diimpor dari lib/routes.ts — tidak ada literal route.
 * Format angka/tanggal dari lib/format, status dari satu sumber
 * (lib/api/orders.ts + components/ui/order-status-badge.tsx).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { FlatList, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router, type Href } from "expo-router"
import { Plus, Receipt } from "phosphor-react-native"

import { api, type Order, type OrderStatusFilter } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { useComingSoon } from "@/lib/navigation"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { TAB_BAR_HEIGHT } from "@/components/ui/bottom-tab-bar"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FloatingActionButton } from "@/components/ui/floating-action-button"
import { Header } from "@/components/ui/header"
import { LoadMore } from "@/components/ui/load-more"
import { OrderCard, OrderCardSkeleton } from "@/components/ui/order-card"
import { Screen } from "@/components/ui/screen"
import { SearchField } from "@/components/ui/search-field"
import { SegmentedControl, type SegmentItem } from "@/components/ui/segmented-control"
import { SkeletonGroup } from "@/components/ui/skeleton"

// ------------------------------------------------------------------
// Konstanta layar
// ------------------------------------------------------------------

type FilterKey = "all" | "active" | "completed" | "cancelled"

const FILTER_ITEMS: readonly SegmentItem<FilterKey>[] = [
  { value: "all", label: "Semua" },
  { value: "active", label: "Aktif" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
]

/**
 * Nilai `status` yang dikirim ke API per filter.
 * `ACTIVE` adalah kunci khusus backend untuk semua status berjalan
 * (lihat comment spec di lib/api/orders.ts) — bukan "IN_PROGRESS".
 */
const FILTER_STATUS_MAP: Record<FilterKey, OrderStatusFilter | undefined> = {
  all: undefined,
  active: "ACTIVE",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
}

/** Spec GET /v1/orders: limit max 50, default 10. */
const PAGE_SIZE = 20
const ON_END_THRESHOLD = 0.3
const SKELETON_COUNT = 4

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets()
  const comingSoon = useComingSoon()

  const [filter, setFilter] = useState<FilterKey>("all")
  const [search, setSearch] = useState("")
  const [orders, setOrders] = useState<Order[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Guard agar onEndReached tidak memicu dua fetch bersamaan.
  const busyRef = useRef(false)

  const fetchOrders = useCallback(
    async (nextPage: number, isRefresh = false) => {
      if (busyRef.current) return
      busyRef.current = true
      try {
        if (nextPage === 1 && !isRefresh) setLoading(true)
        else if (nextPage > 1) setLoadingMore(true)
        setError(null)

        // Query persis kontrak GET /v1/orders (lihat lib/api/orders.ts).
        const res = await api.orders.listOrders({
          page: nextPage,
          limit: PAGE_SIZE,
          status: FILTER_STATUS_MAP[filter],
          search: search.trim() || undefined,
        })

        setOrders((prev) => (isRefresh || nextPage === 1 ? res.data : [...prev, ...res.data]))
        setPage(nextPage)
        setHasMore(nextPage < res.meta.totalPages)
      } catch {
        if (nextPage === 1) setError("Gagal memuat transaksi. Coba lagi.")
        // load-more gagal: data yang sudah tampil tetap valid
      } finally {
        busyRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filter, search],
  )

  // Reset ke halaman pertama saat filter/query berubah.
  useEffect(() => {
    void fetchOrders(1)
  }, [fetchOrders])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchOrders(1, true)
    setRefreshing(false)
  }, [fetchOrders])

  const handleCreate = useCallback(() => {
    // ROUTES.createTransaction belum punya file route — jangan push ke
    // "Unmatched Route"; tampilkan info sampai screen dibuat.
    comingSoon("Buat Transaksi")
  }, [comingSoon])

  const fabBottomOffset = TAB_BAR_HEIGHT + tokens.space[4]

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Transaksi" />

      <View style={styles.controls}>
        <SegmentedControl
          items={FILTER_ITEMS}
          value={filter}
          onChange={setFilter}
        />
        <SearchField
          value={search}
          onChangeText={setSearch}
          onSearch={() => void fetchOrders(1)}
          autoFocus={false}
          placeholder="Cari transaksi, pihak, atau ID"
        />
      </View>

      {error ? (
        <ErrorState
          title="Gagal memuat transaksi"
          description="Periksa koneksi internet Anda, lalu coba lagi."
          onRetry={() => fetchOrders(1)}
        />
      ) : loading ? (
        <SkeletonGroup>
          <View style={styles.skeletonList}>
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <OrderCardSkeleton key={`order-skeleton-${i}`} />
            ))}
          </View>
        </SkeletonGroup>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderCard
              orderId={item.id}
              title={item.title}
              amount={item.orderValue}
              status={item.status}
              role={item.myRole === "SELLER" ? "seller" : "buyer"}
              counterpart={{
                name: counterpartName(item),
                avatar: counterpartAvatar(item),
                verified: undefined,
              }}
              timestamp={formatDateTime(item.createdAt)}
              deadlineAt={item.deliveryDeadlineAt ? new Date(item.deliveryDeadlineAt) : undefined}
              onPress={() => router.push(ROUTES.orderDetail(item.id) as Href)}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            orders.length === 0 && styles.listEmpty,
            { paddingBottom: fabBottomOffset + insets.bottom },
          ]}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReached={() => {
            if (hasMore && !loadingMore && !busyRef.current) fetchOrders(page + 1)
          }}
          onEndReachedThreshold={ON_END_THRESHOLD}
          ListFooterComponent={
            hasMore ? <LoadMore status={loadingMore ? "loading" : "idle"} onLoadMore={() => fetchOrders(page + 1)} /> : null
          }
          ListEmptyComponent={
            <EmptyState
              icon={Receipt}
              title={search ? "Tidak ada hasil" : "Belum ada transaksi"}
              description={
                search
                  ? `Tidak ada transaksi yang cocok dengan "${search}".`
                  : "Transaksi kamu akan muncul di sini."
              }
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <FloatingActionButton
        icon={Plus}
        accessibilityLabel="Buat Transaksi"
        label="Buat Transaksi"
        extended={orders.length === 0 && !loading}
        onPress={handleCreate}
        bottomOffset={fabBottomOffset}
      />
    </Screen>
  )
}

// ------------------------------------------------------------------
// Helpers (satu tempat untuk memetakan Order API → OrderCard)
// ------------------------------------------------------------------

/** Nama lawan transaksi dari sudut pandang user. */
function counterpartName(order: Order): string {
  const party = order.myRole === "SELLER" ? order.buyer : order.seller
  return party?.fullName ?? party?.username ?? "—"
}

/** URL avatar lawan transaksi. */
function counterpartAvatar(order: Order): string | undefined {
  const party = order.myRole === "SELLER" ? order.buyer : order.seller
  return party?.avatarUrl ?? undefined
}

// ------------------------------------------------------------------
// StyleSheet — padding via tokens (tidak ada magic number)
// ------------------------------------------------------------------

const styles = StyleSheet.create({
  controls: {
    gap: tokens.space[3],
    paddingHorizontal: tokens.layout.screenPaddingX,
    paddingTop: tokens.space[3],
    paddingBottom: tokens.space[2],
  },
  skeletonList: {
    gap: tokens.layout.cardGap,
    paddingHorizontal: tokens.layout.screenPaddingX,
    paddingTop: tokens.space[2],
  },
  listContent: {
    gap: tokens.layout.cardGap,
    paddingHorizontal: tokens.layout.screenPaddingX,
  },
  listEmpty: {
    flexGrow: 1,
  },
})
