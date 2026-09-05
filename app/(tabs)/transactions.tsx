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
 * Fix audit:
 *  - K3/K5: hardcode 16/12 spacing diganti tokens.space, import tokens ditambah
 *  - M1: magic number 72 (tab bar height) diganti konstanta TAB_BAR_HEIGHT
 */
import { useCallback, useEffect, useState } from "react"
import { FlatList, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Plus } from "phosphor-react-native"

import { getTransactions } from "@/lib/api/transactions"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import type { Order, OrderStatus } from "@/lib/types"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FloatingActionButton } from "@/components/ui/floating-action-button"
import { Header } from "@/components/ui/header"
import { OrderCard } from "@/components/ui/order-card"
import { Screen } from "@/components/ui/screen"
import { SegmentedControl } from "@/components/ui/segmented-control"

type FilterValue = "all" | OrderStatus

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: "Semua", value: "all" },
  { label: "Aktif", value: "active" },
  { label: "Selesai", value: "completed" },
  { label: "Dibatalkan", value: "cancelled" },
]

/**
 * M1: Tinggi tab bar diambil dari konstanta agar FAB bottom offset
 * tidak bergantung pada magic number. Nilai 56 sesuai RouterBottomTabBar.
 * Bila tinggi tab bar berubah, update konstanta ini saja.
 */
const TAB_BAR_HEIGHT = 56

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets()

  const [filter, setFilter] = useState<FilterValue>("all")
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async (status: FilterValue) => {
    try {
      setLoading(true)
      setError(null)
      const res = await getTransactions(status === "all" ? undefined : { status })
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

  // M1: FAB_BOTTOM_OFFSET dari konstanta + safe area, bukan magic number
  const fabBottomOffset = insets.bottom + TAB_BAR_HEIGHT + tokens.space[4]

  return (
    <Screen edges={["top"]}>
      <Header title="Transaksi" />

      <SegmentedControl
        items={FILTERS.map((f) => f.label)}
        selectedIndex={FILTERS.findIndex((f) => f.value === filter)}
        onChange={(i) => setFilter(FILTERS[i]!.value)}
        className="mx-6 my-3"
      />

      {error ? (
        <ErrorState message={error} onRetry={() => fetchOrders(filter)} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() =>
                router.push(`${ROUTES.transactionDetail}/${item.id}` as Parameters<typeof router.push>[0])
              }
            />
          )}
          // K3: hardcode 16/12 → tokens.space[4/3]
          contentContainerStyle={{
            paddingHorizontal: tokens.space[4],
            gap: tokens.space[3],
            paddingBottom: fabBottomOffset,
          }}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                title="Belum ada transaksi"
                description="Transaksi kamu akan muncul di sini."
              />
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <FloatingActionButton
        icon={Plus}
        label="Buat Transaksi"
        onPress={() => router.push(ROUTES.createTransaction as Parameters<typeof router.push>[0])}
        style={{ bottom: fabBottomOffset }}
      />
    </Screen>
  )
}
