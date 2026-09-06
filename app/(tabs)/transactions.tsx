import { useState } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"
import { Copy, MagnifyingGlass, Plus, Receipt } from "phosphor-react-native"
import { api, type OrderStatusFilter } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { EmptyState } from "@/components/ui/empty-state"
import { FAB_SIZE, FloatingActionButton } from "@/components/ui/floating-action-button"
import { Header } from "@/components/ui/header"
import { IconButton } from "@/components/ui/icon-button"
import { OrderCard } from "@/components/ui/order-card"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"
import { SegmentedControl, type SegmentItem } from "@/components/ui/segmented-control"

type Filter = "all" | "active" | "completed" | "cancelled"
const FILTERS: readonly SegmentItem<Filter>[] = [
  { value: "all", label: "Semua" },
  { value: "active", label: "Aktif" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
]
const STATUS: Record<Filter, OrderStatusFilter | undefined> = {
  all: undefined,
  active: "ACTIVE",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
}

export default function TransactionsScreen() {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>("all")
  /*
   * Hanya kata kunci yang SUDAH tenang yang disimpan di sini. Teks mentah
   * tinggal di dalam <DebouncedSearchField>, supaya mengetik tidak merender
   * ulang layar ini beserta seluruh kartu pesanan yang terlihat.
   */
  const [debounced, setDebounced] = useState("")
  const query = usePaginatedQuery(`orders:${filter}:${debounced}`, (page, signal) =>
    api.orders.listOrders(
      { page, limit: 20, status: STATUS[filter], search: debounced || undefined },
      signal,
    ),
  )
  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title="Transaksi"
        showBack={false}
        right={
          <>
            <IconButton accessibilityHint="Ketuk untuk berinteraksi"
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
      <View accessible={false} className="gap-3 px-6 pb-3 pt-3">
        <SegmentedControl items={FILTERS} value={filter} onChange={setFilter} />
        <DebouncedSearchField
          onQueryChange={setDebounced}
          autoFocus={false}
          placeholder="Cari transaksi, pihak, atau ID"
        />
      </View>
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
            description={
              debounced
                ? `Tidak ada transaksi yang cocok dengan “${debounced}”.`
                : "Transaksi Anda akan muncul di sini."
            }
          />
        }
        renderItem={({ item }) => {
          const role =
            item.myRole === "SELLER" ? "seller" : item.myRole === "BUYER" ? "buyer" : undefined
          const counterpart =
            role === "seller" ? item.buyer : role === "buyer" ? item.seller : undefined
          return (
            <OrderCard
              orderId={item.id}
              title={item.title}
              amount={item.orderValue}
              status={item.status}
              role={role}
              counterpart={{
                name: counterpart?.fullName ?? counterpart?.username ?? "Identitas belum tersedia",
                avatar: counterpart?.avatarUrl ?? undefined,
              }}
              timestamp={formatDateTime(item.createdAt)}
              deadlineAt={item.deliveryDeadlineAt ? new Date(item.deliveryDeadlineAt) : undefined}
              onPress={() => router.push(ROUTES.orderDetail(item.id))}
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