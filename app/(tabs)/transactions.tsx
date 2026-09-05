/**
 * Tab #2 — Transaksi
 *
 * Menampilkan list order milik user dengan filter status:
 * Semua | Aktif | Selesai | Dibatalkan
 *
 * Fitur:
 *  - SegmentedControl filter status
 *  - FlatList order cards
 *  - Pull-to-refresh
 *  - EmptyState saat tidak ada order
 *  - FAB "Buat Transaksi" → ROUTES.createTransaction
 *
 * Audit fix (round 2):
 *  T1/T2 [BUG] FilterValue "active"/"completed"/"cancelled" adalah label UI
 *         informal — tidak cocok OrderStatus enum backend. FILTER_STATUS_MAP
 *         memetakan label UI → OrderStatus[] yang benar.
 *  T3    FILTERS[i]! non-null assertion → FILTERS[i]?.value ?? "all"
 *  T4    verbose cast → as Href (konsisten dengan wallet.tsx)
 *  T5    tidak ada skeleton loading → SkeletonGroup + OrderCardSkeleton
 */
import { useCallback, useEffect, useState } from "react"
import { FlatList, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router, type Href } from "expo-router"
import { Plus } from "phosphor-react-native"

import { getTransactions } from "@/lib/api/transactions"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import type { Order, OrderStatus } from "@/lib/types"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FloatingActionButton } from "@/components/ui/floating-action-button"
import { Header } from "@/components/ui/header"
import { OrderCard, OrderCardSkeleton } from "@/components/ui/order-card"
import { Screen } from "@/components/ui/screen"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { SkeletonGroup } from "@/components/ui/skeleton"

// T1: FilterKey adalah label UI; FILTER_STATUS_MAP resolve ke OrderStatus
type FilterKey = "all" | "active" | "completed" | "cancelled"

const FILTERS: { label: string; value: FilterKey }[] = [
  { label: "Semua", value: "all" },
  { label: "Aktif", value: "active" },
  { label: "Selesai", value: "completed" },
  { label: "Dibatalkan", value: "cancelled" },
]

/**
 * T2: Peta FilterKey → OrderStatus yang dikirim ke API.
 * "active" mewakili semua status in-progress — sesuaikan bila OrderStatus berubah.
 */
const FILTER_STATUS_MAP: Record<FilterKey, OrderStatus | undefined> = {
  all: undefined,
  active: "IN_PROGRESS",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
}

/**
 * M1: Tinggi tab bar dari konstanta agar FAB offset tidak pakai magic number.
 * Nilai 56 sesuai RouterBottomTabBar. Update sini bila tinggi tab bar berubah.
 */
const TAB_BAR_HEIGHT = 56

/** Jumlah skeleton card saat loading pertama */
const SKELETON_COUNT = 4

/** Threshold scroll untuk load-more */
const ON_END_THRESHOLD = 0.3

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets()

  const [filter, setFilter] = useState<FilterKey>("all")
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async (key: FilterKey) => {
    try {
      setLoading(true)
      setError(null)
      // T2: resolve FilterKey ke OrderStatus yang benar
      const status = FILTER_STATUS_MAP[key]
      const res = await getTransactions(status ? { status } : undefined)
      setOrders(res.data)
    } catch {
      setError("Gagal memuat transaksi. Coba lagi.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchOrders(filter)
  }, [filter, fetchOrders])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchOrders(filter)
    setRefreshing(false)
  }, [filter, fetchOrders])

  const fabBottomOffset = insets.bottom + TAB_BAR_HEIGHT + tokens.space[4]

  return (
    <Screen edges={["top"]}>
      <Header title="Transaksi" />

      <SegmentedControl
        items={FILTERS.map((f) => f.label)}
        selectedIndex={FILTERS.findIndex((f) => f.value === filter)}
        // T3: bounds-safe — tidak pakai non-null assertion buta
        onChange={(i) => setFilter(FILTERS[i]?.value ?? "all")}
        className="mx-6 my-3"
      />

      {error ? (
        <ErrorState message={error} onRetry={() => fetchOrders(filter)} />
      ) : loading ? (
        // T5: skeleton saat loading pertama, bukan layar kosong
        <SkeletonGroup>
          <View
            style={{
              paddingHorizontal: tokens.space[4],
              gap: tokens.space[3],
              paddingTop: tokens.space[2],
            }}
          >
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <OrderCardSkeleton key={`skeleton-${i}`} />
            ))}
          </View>
        </SkeletonGroup>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              // T4: as Href konsisten
              onPress={() => router.push(`${ROUTES.transactionDetail}/${item.id}` as Href)}
            />
          )}
          contentContainerStyle={{
            paddingHorizontal: tokens.space[4],
            gap: tokens.space[3],
            paddingBottom: fabBottomOffset,
          }}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReachedThreshold={ON_END_THRESHOLD}
          ListEmptyComponent={
            <EmptyState
              title="Belum ada transaksi"
              description="Transaksi kamu akan muncul di sini."
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <FloatingActionButton
        icon={Plus}
        label="Buat Transaksi"
        onPress={() => router.push(ROUTES.createTransaction as Href)}
        style={{ bottom: fabBottomOffset }}
      />
    </Screen>
  )
}
