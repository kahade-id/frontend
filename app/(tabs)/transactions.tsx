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
 */
import { useCallback, useEffect, useState } from "react"
import { FlatList, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Plus } from "phosphor-react-native"

import { getTransactions } from "@/lib/api/transactions"
import { ROUTES } from "@/lib/routes"
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

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets()

  const [filter, setFilter] = useState<FilterValue>("all")
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(
    // fix M1: pisah setLoading/setRefreshing di finally agar tidak ada
    // race-condition saat isRefresh=true — loading tidak salah tersisa true.
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }
        setError(null)

        const res = await getTransactions({ status: filter })
        setOrders(res.data)
      } catch {
        setError("Gagal memuat transaksi. Coba lagi.")
      } finally {
        if (isRefresh) {
          setRefreshing(false)
        } else {
          setLoading(false)
        }
      }
    },
    [filter],
  )

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleRefresh = useCallback(() => fetchOrders(true), [fetchOrders])

  const handleOrderPress = useCallback((order: Order) => {
    router.push(ROUTES.orderDetail(order.id))
  }, [])

  const handleCreate = useCallback(() => {
    router.push(ROUTES.createTransaction)
  }, [])

  // Tab bar tinggi ~56px + 16px gap = 72. bottomOffset prop menghitung
  // insets.bottom secara internal, jadi cukup kirim 72 sebagai clearance.
  const FAB_BOTTOM_OFFSET = insets.bottom + 72

  return (
    <Screen edges={["top"]}>
      <Header title="Transaksi" />

      {/* Filter status */}
      <View className="px-4 py-2">
        <SegmentedControl
          segments={FILTERS.map((f) => f.label)}
          selectedIndex={FILTERS.findIndex((f) => f.value === filter)}
          onChange={(index) => setFilter(FILTERS[index].value)}
        />
      </View>

      {error ? (
        <ErrorState
          message={error}
          onRetry={() => fetchOrders()}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => handleOrderPress(item)}
            />
          )}
          contentContainerStyle={[
            { paddingHorizontal: 16, gap: 12 },
            orders.length === 0 && { flex: 1, justifyContent: "center" },
            { paddingBottom: insets.bottom + 80 },
          ]}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                title="Belum ada transaksi"
                description="Transaksi yang kamu buat akan muncul di sini."
              />
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* fix T1 & T2: icon harus IconComponent (bukan string), accessibilityLabel required */}
      <FloatingActionButton
        icon={Plus}
        accessibilityLabel="Buat transaksi baru"
        onPress={handleCreate}
        bottomOffset={FAB_BOTTOM_OFFSET}
      />
    </Screen>
  )
}
