/**
 * Screen — Badge (GET /v1/badges + /my). Grid AchievementBadge.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Medal } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { Badge } from "@/lib/api/badges"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { AchievementBadgeGrid } from "@/components/ui/achievement-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"

export default function BadgesScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [items, setItems] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchBadges = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.badges.listMyBadges()
      setItems(res ?? [])
    } catch {
      setError("Gagal memuat badge.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchBadges()
  }, [fetchBadges])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchBadges()
    setRefreshing(false)
  }, [fetchBadges])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Badge" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={Medal} title="Memuat badge…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchBadges()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Medal}
            title="Belum ada badge"
            description="Selesaikan transaksi untuk membuka badge."
          />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Badge Anda" />
            <AchievementBadgeGrid
              items={items.map((b, i) => ({
                id: b.id,
                name: b.name,
                description: b.description,
                earned: !!b.earnedAt,
                earnedAt: b.earnedAt ? formatDateTime(b.earnedAt) : undefined,
                progress: b.progress
                  ? Math.round((b.progress.current / Math.max(1, b.progress.target)) * 100)
                  : undefined,
              }))}
              onPressItem={(item) => toast.show({ title: item.name, description: item.description, tone: "info" })}
            />
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
