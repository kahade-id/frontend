import { LoadingScreen } from "@/components/ui/loading-screen"
/**
 * Screen — Sengketa Saya (GET /v1/disputes/my).
 * List DisputeCard; tap → detail sengketa (route /dispute/[id]).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ShieldWarning } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import type { DisputeDetail } from "@/lib/api/disputes"
import { formatDateTime, formatRupiah } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { DisputeCard } from "@/components/ui/dispute-card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"

export default function DisputesScreen() {
  const insets = useSafeAreaInsets()

  const [items, setItems] = useState<DisputeDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchDisputes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.disputes.listMyDisputes({ page: 1, limit: 50 })
      setItems(res ?? [])
    } catch {
      setError("Gagal memuat daftar sengketa.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchDisputes()
  }, [fetchDisputes])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchDisputes()
    setRefreshing(false)
  }, [fetchDisputes])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Sengketa" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <LoadingScreen message="Memuat sengketa…" />
        ) : error ? (
          <ErrorState
            title="Gagal memuat"
            description={error}
            onRetry={() => void fetchDisputes()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ShieldWarning}
            title="Tidak ada sengketa"
            description="Sengketa pesanan akan muncul di sini."
          />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Sengketa saya" />
            {items.map((d) => (
              <DisputeCard
                key={d.id}
                disputeId={d.id}
                orderTitle={`Order ${d.orderId}`}
                status={d.status}
                updatedAt={formatDateTime(d.updatedAt ?? d.createdAt)}
                onPress={() => router.push(ROUTES.disputeDetail(d.id))}
              />
            ))}
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
