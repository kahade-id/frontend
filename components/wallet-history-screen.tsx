import { useRouter } from "expo-router"
import { ArrowCircleDown, ArrowCircleUp } from "phosphor-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { WalletTransactionRow } from "@/components/ui/wallet-transaction-row"

export function WalletHistoryScreen({ kind }: { kind: "topup" | "withdraw" }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const query = usePaginatedQuery(`wallet-history:${kind}`, (page, signal) =>
    kind === "topup"
      ? api.wallet.getTopupHistory({ page, limit: 20 }, signal)
      : api.wallet.getWithdrawHistory({ page, limit: 20 }, signal),
  )
  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={kind === "topup" ? "Riwayat Top-up" : "Riwayat Penarikan"} />
      <PaginatedList
        {...query}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        gap={0}
        bottomPadding={insets.bottom + tokens.space[8]}
        empty={
          <EmptyState
            icon={kind === "topup" ? ArrowCircleDown : ArrowCircleUp}
            title={kind === "topup" ? "Belum ada top-up" : "Belum ada penarikan"}
            description="Riwayat transaksi akan muncul di sini."
          />
        }
        renderItem={({ item }) => (
          <WalletTransactionRow
            transaction={item}
            onPress={() => router.push(ROUTES.walletTransaction(item.id))}
          />
        )}
      />
    </Screen>
  )
}
