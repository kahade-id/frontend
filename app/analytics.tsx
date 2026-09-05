/**
 * Screen — Analitik (GET /v1/users/me/stats + /v1/users/me/analytics).
 * AnalyticsSummary (StatCard grid + BarChart volume) — PullToRefresh.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChartLineUp } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { UserAnalytics, UserStats } from "@/lib/api/users"
import { formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { AnalyticsSummary } from "@/components/ui/analytics-summary"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets()

  const [stats, setStats] = useState<UserStats | null>(null)
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, a] = await Promise.all([
        api.users.getMyStats().catch(() => null),
        api.users.getMyAnalytics().catch(() => null),
      ])
      setStats(s)
      setAnalytics(a)
    } catch {
      setError("Gagal memuat analitik.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Analitik" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={ChartLineUp} title="Memuat analitik…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : (
          <View style={{ paddingTop: tokens.space[3] }}>
            <AnalyticsSummary
              loading={false}
              periodLabel="30 hari terakhir"
              stats={[
                {
                  id: "orders",
                  label: "Transaksi",
                  value: stats?.transactions ?? 0,
                  hint: "Total transaksi selesai",
                },
                {
                  id: "revenue",
                  label: "Pendapatan",
                  value: formatRupiah(stats?.completedOrders ? 0 : 0),
                  hint: "Nilai order masuk",
                },
                {
                  id: "rating",
                  label: "Rating",
                  value: stats?.rating != null ? stats.rating.toFixed(1) : "—",
                  hint: stats?.reviews != null ? `${stats.reviews} ulasan` : undefined,
                },
                {
                  id: "followers",
                  label: "Followers",
                  value: stats?.followers ?? 0,
                  hint: stats?.following != null ? `${stats.following} mengikuti` : undefined,
                },
              ]}
              chart={analytics?.volumeByPeriod?.map((p) => ({ label: p.label, value: p.value }))}
              chartTitle="Volume transaksi"
              formatChartValue={(v) => formatRupiah(v, { compact: true })}
              ratios={
                analytics?.completionRate != null
                  ? [
                      {
                        id: "completion",
                        label: "Tingkat penyelesaian",
                        value: `${Math.round(analytics.completionRate * 100)}%`,
                      },
                    ]
                  : undefined
              }
              ratiosTitle="Kualitas"
            />
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
