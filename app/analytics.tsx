import { useApiQuery } from "@/lib/use-api-query"
import { DetailLoading } from "@/components/ui/paginated-list"
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
import { useMemo, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import { ANALYTICS_PERIODS, type AnalyticsPeriod } from "@/lib/api/users"
import { formatDecimal, formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { AnalyticsSummary } from "@/components/ui/analytics-summary"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SegmentedControl } from "@/components/ui/segmented-control"

const DEFAULT_PERIOD: AnalyticsPeriod = "30d"

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets()

  const [period, setPeriod] = useState<AnalyticsPeriod>(DEFAULT_PERIOD)
  const query = useApiQuery(`analytics:${period}`, () =>
    Promise.all([api.users.getMyStats(), api.users.getMyAnalytics(period)]),
  )
  const stats = query.data?.[0]
  const analytics = query.data?.[1]
  const { loading, error, refreshing, reload: fetchAll, refresh: handleRefresh } = query

  const revenue = useMemo(() => {
    if (analytics?.summary?.revenue != null) return analytics.summary.revenue
    if (analytics?.revenueByPeriod?.length)
      return analytics.revenueByPeriod.reduce((sum, p) => sum + p.value, 0)
    return null
  }, [analytics])

  const periodLabel = ANALYTICS_PERIODS.find((p) => p.value === period)?.label ?? ""

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Analitik" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <SegmentedControl
            accessibilityLabel="Pilih periode analitik"
            items={ANALYTICS_PERIODS}
            value={period}
            onChange={(v) => setPeriod(v as AnalyticsPeriod)}
          />
          {loading ? (
            <DetailLoading />
          ) : error ? (
            <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
          ) : (
            <AnalyticsSummary
              loading={false}
              periodLabel={`${periodLabel} terakhir`}
              stats={[
                {
                  id: "orders",
                  label: "Transaksi",
                  value: stats?.transactions ?? "—",
                  hint: "Total transaksi selesai",
                },
                {
                  id: "revenue",
                  label: "Pendapatan",
                  value: revenue != null ? formatRupiah(revenue) : "—",
                  hint:
                    analytics?.avgOrderValue != null
                      ? `Rata-rata ${formatRupiah(analytics.avgOrderValue)}`
                      : "Nilai order masuk",
                },
                {
                  id: "rating",
                  label: "Rating",
                  value: stats?.rating != null ? formatDecimal(stats.rating, 1) : "—",
                  hint: stats?.reviews != null ? `${stats.reviews} ulasan` : undefined,
                },
                {
                  id: "followers",
                  label: "Pengikut",
                  value: stats?.followers ?? "—",
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
          )}
        </View>
      </PullToRefresh>
    </Screen>
  )
}
