/**
 * Screen — Analitik (GET /v1/users/me/stats + /v1/users/me/analytics?period=).
 * AnalyticsSummary (StatCard grid + BarChart volume) — PullToRefresh.
 *
 * Keputusan non-obvious:
 *   - `period` WAJIB di spec; pilihan periode dirender <SegmentedControl>
 *     dari `ANALYTICS_PERIODS` (lib/api/users) — bukan label statis
 *     "30 hari terakhir" tanpa parameter.
 *   - Pendapatan dijumlahkan dari `revenueByPeriod` (fallback
 *     `summary.revenue`) — sebelumnya selalu Rp0 karena ekspresi konstan.
 *   - Rating/persentase diformat lib/format (`formatDecimal`) — koma desimal
 *     §13, bukan `toFixed`.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChartLineUp } from "phosphor-react-native"

import { api } from "@/lib/api"
import { ANALYTICS_PERIODS, type AnalyticsPeriod, type UserAnalytics, type UserStats } from "@/lib/api/users"
import { formatDecimal, formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { AnalyticsSummary } from "@/components/ui/analytics-summary"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SegmentedControl } from "@/components/ui/segmented-control"

const DEFAULT_PERIOD: AnalyticsPeriod = "30d"

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets()

  const [period, setPeriod] = useState<AnalyticsPeriod>(DEFAULT_PERIOD)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, a] = await Promise.all([api.users.getMyStats(), api.users.getMyAnalytics(period)])
      setStats(s)
      setAnalytics(a)
    } catch {
      setError("Gagal memuat analitik.")
    } finally {
      setLoading(false)
    }
  }, [period])

  const revenue = useMemo(() => {
    if (analytics?.summary?.revenue != null) return analytics.summary.revenue
    if (analytics?.revenueByPeriod?.length) return analytics.revenueByPeriod.reduce((sum, p) => sum + p.value, 0)
    return null
  }, [analytics])

  const periodLabel = ANALYTICS_PERIODS.find((p) => p.value === period)?.label ?? ""

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
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SegmentedControl
              items={ANALYTICS_PERIODS}
              value={period}
              onChange={(v) => setPeriod(v as AnalyticsPeriod)}
            />
            <AnalyticsSummary
              loading={false}
              periodLabel={`${periodLabel} terakhir`}
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
                  value: revenue != null ? formatRupiah(revenue) : "—",
                  hint: analytics?.avgOrderValue != null ? `Rata-rata ${formatRupiah(analytics.avgOrderValue)}` : "Nilai order masuk",
                },
                {
                  id: "rating",
                  label: "Rating",
                  value: stats?.rating != null ? formatDecimal(stats.rating, 1) : "—",
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
                        value: `${formatDecimal(analytics.completionRate <= 1 ? analytics.completionRate * 100 : analytics.completionRate, 0)}%`,
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
