/**
 * Screen — Riwayat Top-up (GET /v1/wallet/topup-history).
 * PullToRefresh + paginasi LoadMore; item dirender WalletTransactionListItem.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DownloadSimple } from "phosphor-react-native"

import { api, type WalletTransaction } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadMore } from "@/components/ui/load-more"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { WalletTransactionListItem } from "@/components/ui/wallet-transaction-list-item"

const PAGE_SIZE = 20

export default function TopupHistoryScreen() {
  const insets = useSafeAreaInsets()
  const [items, setItems] = useState<WalletTransaction[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetch = useCallback(async (nextPage: number, refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.wallet.getTopupHistory({ page: nextPage, limit: PAGE_SIZE })
      const incoming = res.data ?? []
      setItems((prev) => (refresh || nextPage === 1 ? incoming : [...prev, ...incoming]))
      setPage(nextPage)
      setHasMore(nextPage < (res.meta?.totalPages ?? 1))
    } catch {
      if (nextPage === 1) setError("Gagal memuat riwayat top-up.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetch(1)
  }, [fetch])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetch(1, true)
    setRefreshing(false)
  }, [fetch])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Riwayat Top-up" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {items.length === 0 && !loading ? (
          error ? (
            <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetch(1)} />
          ) : (
            <EmptyState
              icon={DownloadSimple}
              title="Belum ada top-up"
              description="Riwayat pengisian saldo akan muncul di sini."
            />
          )
        ) : (
          <View className="gap-1" style={{ paddingTop: tokens.space[3] }}>
            {items.map((item, i) => (
              <WalletTransactionListItem
                key={item.id}
                title="Top-up Saldo"
                type="CREDIT"
                amount={item.amount}
                kind="topup"
                status={item.status === "FAILED" ? "FAILED" : "SUCCESS"}
                timestamp={formatDateTime(item.createdAt)}
                reference={item.referenceId ?? undefined}
                divider={i < items.length - 1}
              />
            ))}
            {hasMore && items.length > 0 ? (
              <LoadMore
                status={loading ? "loading" : "idle"}
                onLoadMore={() => void fetch(page + 1)}
              />
            ) : null}
            {items.length === 0 && loading ? (
              <Text variant="body" tone="secondary" className="py-8 text-center">
                Memuat…
              </Text>
            ) : null}
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
