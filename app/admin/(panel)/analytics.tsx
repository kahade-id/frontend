/**
 * Admin — Analitik: ringkasan platform (baca-saja).
 *
 * - Kartu overview: pengguna (total/baru), order (total/selesai/sengketa/
 *   dibatalkan + dispute rate), keuangan (GMV/revenue), pengguna aktif.
 * - Statistik order per periode (groupBy hari/minggu/bulan) sebagai list
 *   dengan bar horizontal dari <View> (disederhanakan, tanpa grafik canvas).
 * - Top users: list + chip metrik (order/volume/rating).
 * - Pertumbuhan user: list hari dengan bar horizontal + total kumulatif.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useIsFocused } from "@react-navigation/native"
import { ChartBar } from "phosphor-react-native"

import { translate } from "@/lib/i18n/translate"
import { formatDateTimeWIB, formatDecimal, formatNumber, formatRupiah } from "@/lib/format"
import { userMessage } from "@/lib/api/errors"
import { handleAdminApiError } from "@/lib/admin-session"
import {
  getAnalyticsOverview,
  getOrderStats,
  getTopUsers,
  getUserGrowth,
  type AnalyticsOverview,
  type OrderStatRow,
  type OrderStatsGroupBy,
  type TopUser,
  type TopUserMetric,
  type UserGrowthRow,
} from "@/lib/api/admin/analytics"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DataScreen } from "@/components/ui/data-screen"
import { Section } from "@/components/ui/section"
import { Text } from "@/components/ui/text"

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex-1" padded>
      <Text variant="caption" tone="secondary">
        {translate(label)}
      </Text>
      <Text variant="h3" className="mt-1" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </Card>
  )
}

/** Bar horizontal sederhana (ganti grafik canvas). */
function Bar({ ratio, toneClass }: { ratio: number; toneClass: string }) {
  const clamped = Math.max(0.02, Math.min(1, ratio))
  return (
    <View
      className="h-2 rounded-full bg-border"
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(clamped * 100), min: 0, max: 100 }}
    >
      <View
        className={`h-2 rounded-full ${toneClass}`}
        style={{ width: `${clamped * 100}%` }}
      />
    </View>
  )
}

const GROUP_BY: Array<{ value: OrderStatsGroupBy; label: string }> = [
  { value: "day", label: "Harian" },
  { value: "week", label: "Mingguan" },
  { value: "month", label: "Bulanan" },
]

const METRICS: Array<{ value: TopUserMetric; label: string }> = [
  { value: "orders", label: "Order terbanyak" },
  { value: "volume", label: "Volume terbesar" },
  { value: "rating", label: "Rating tertinggi" },
]

export default function AdminAnalyticsScreen() {
  const isFocused = useIsFocused()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [orderStats, setOrderStats] = useState<OrderStatRow[]>([])
  const [topUsers, setTopUsers] = useState<TopUser[]>([])
  const [growth, setGrowth] = useState<UserGrowthRow[]>([])
  const [groupBy, setGroupBy] = useState<OrderStatsGroupBy>("day")
  const [metric, setMetric] = useState<TopUserMetric>("orders")

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const [ov, os, tu, ug] = await Promise.all([
          getAnalyticsOverview(),
          getOrderStats({ groupBy }),
          getTopUsers({ limit: 10, metric }),
          getUserGrowth(),
        ])
        setOverview(ov)
        setOrderStats(os)
        setTopUsers(tu)
        setGrowth(ug)
      } catch (err) {
        if (!handleAdminApiError(err)) setError(userMessage(err))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [groupBy, metric],
  )

  useEffect(() => {
    if (isFocused) void load("initial")
  }, [isFocused, load])

  const recentStats = orderStats.slice(-10)
  const maxOrders = Math.max(1, ...recentStats.map((r) => num(r.totalOrders)))
  const recentGrowth = growth.slice(-14)
  const maxGrowth = Math.max(1, ...recentGrowth.map((r) => num(r.newUsers)))
  const latestCumulative = num(recentGrowth[recentGrowth.length - 1]?.cumulative)

  return (
    <DataScreen
      title={translate("Analitik")}
      state={{
        loading,
        refreshing,
        error,
        refresh: () => load("refresh"),
        reload: () => load("initial"),
      }}
      loadingMessage={translate("Memuat analitik…")}
      errorTitle={translate("Gagal memuat analitik")}
      empty={
        overview == null
          ? {
              icon: ChartBar,
              title: translate("Belum ada data"),
              description: translate("Belum ada data analitik platform."),
              compact: true,
            }
          : undefined
      }
    >
      {overview ? (
        <View className="gap-6">
          <Section title={translate("Ringkasan")}>
            <View>
              <View className="flex-row gap-3">
                <StatCard
                  label="Total pengguna"
                  value={formatNumber(num(overview.users?.total))}
                />
                <StatCard
                  label="Pengguna baru"
                  value={formatNumber(num(overview.users?.new))}
                />
              </View>
              <View className="flex-row gap-3 mt-3">
                <StatCard
                  label="Pengguna aktif"
                  value={formatNumber(num(overview.activeUsers))}
                />
                <StatCard
                  label="Total order"
                  value={formatNumber(num(overview.orders?.total))}
                />
              </View>
              <View className="flex-row gap-3 mt-3">
                <StatCard
                  label="Order selesai"
                  value={formatNumber(num(overview.orders?.completed))}
                />
                <StatCard
                  label="Disengketakan"
                  value={formatNumber(num(overview.orders?.disputed))}
                />
              </View>
              <View className="flex-row gap-3 mt-3">
                <StatCard
                  label="Dibatalkan"
                  value={formatNumber(num(overview.orders?.cancelled))}
                />
                <StatCard
                  label="Dispute rate"
                  value={`${formatDecimal(num(overview.orders?.disputeRate))}%`}
                />
              </View>
              <View className="flex-row gap-3 mt-3">
                <StatCard
                  label="GMV"
                  value={formatRupiah(num(overview.financial?.gmv))}
                />
                <StatCard
                  label="Revenue"
                  value={formatRupiah(num(overview.financial?.revenue))}
                />
              </View>
            </View>
          </Section>

          <Section title={translate("Statistik order")}>
            <View className="gap-3">
              <View className="flex-row gap-2">
                {GROUP_BY.map((g) => (
                  <Chip
                    key={g.value}
                    selected={groupBy === g.value}
                    onPress={() => setGroupBy(g.value)}
                    accessibilityLabel={translate("Periode {x}", {
                      x: g.label,
                    })}
                  >
                    {translate(g.label)}
                  </Chip>
                ))}
              </View>
              {recentStats.length === 0 ? (
                <Text variant="caption" tone="secondary">
                  {translate("Belum ada statistik order.")}
                </Text>
              ) : (
                <View className="gap-2">
                  {recentStats.map((r, i) => (
                    <View
                      key={`${r.period}-${i}`}
                      className="gap-1"
                      accessibilityLabel={translate(
                        "Periode {x}: {y} order",
                        {
                          x: r.period ?? "—",
                          y: String(num(r.totalOrders)),
                        },
                      )}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text variant="caption" tone="secondary">
                          {r.period ? formatDateTimeWIB(r.period) : "—"}
                        </Text>
                        <Text variant="body" weight={700}>
                          {formatNumber(num(r.totalOrders))}
                        </Text>
                      </View>
                      <Bar
                        ratio={num(r.totalOrders) / maxOrders}
                        toneClass="bg-primary"
                      />
                      <Text variant="caption" tone="secondary">
                        {translate("Selesai")}: {formatNumber(num(r.completed))} •{" "}
                        {translate("GMV")}: {formatRupiah(num(r.gmv))}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Section>

          <Section title={translate("Pengguna teratas")}>
            <View className="gap-3">
              <View className="flex-row flex-wrap gap-2">
                {METRICS.map((m) => (
                  <Chip
                    key={m.value}
                    selected={metric === m.value}
                    onPress={() => setMetric(m.value)}
                    accessibilityLabel={translate("Metrik {x}", {
                      x: m.label,
                    })}
                  >
                    {translate(m.label)}
                  </Chip>
                ))}
              </View>
              {topUsers.length === 0 ? (
                <Text variant="caption" tone="secondary">
                  {translate("Belum ada data pengguna teratas.")}
                </Text>
              ) : (
                <View className="gap-2">
                  {topUsers.map((u, i) => (
                    <Card key={u.userId ?? i} padded={false} className="px-4 py-3">
                      <View className="flex-row items-center gap-3">
                        <Text variant="h3" tone="secondary" className="w-7 text-center">
                          {i + 1}
                        </Text>
                        <View className="flex-1">
                          <Text variant="body" weight={600} numberOfLines={1}>
                            {u.fullName ?? u.username ?? "—"}
                          </Text>
                          <Text variant="caption" tone="secondary">
                            {metric === "orders"
                              ? translate("{x} order", {
                                  x: String(num(u.totalOrders)),
                                })
                              : metric === "volume"
                                ? formatRupiah(num(u.totalVolume))
                                : `${formatDecimal(num(u.avgRating))} (${formatNumber(num(u.ratingCount))})`}
                          </Text>
                        </View>
                        {u.isKycVerified ? (
                          <Badge tone="success">{translate("KYC")}</Badge>
                        ) : null}
                      </View>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          </Section>

          <Section
            title={translate("Pertumbuhan pengguna")}
            subtitle={
              latestCumulative > 0
                ? translate("Total kumulatif: {x}", {
                    x: formatNumber(latestCumulative),
                  })
                : undefined
            }
          >
            {recentGrowth.length === 0 ? (
              <Text variant="caption" tone="secondary">
                {translate("Belum ada data pertumbuhan.")}
              </Text>
            ) : (
              <View className="gap-2">
                {recentGrowth.map((r, i) => (
                  <View
                    key={`${r.day}-${i}`}
                    className="gap-1"
                    accessibilityLabel={translate("Tanggal {x}: {y} pengguna baru", {
                      x: r.day ?? "—",
                      y: String(num(r.newUsers)),
                    })}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text variant="caption" tone="secondary">
                        {r.day ? formatDateTimeWIB(r.day) : "—"}
                      </Text>
                      <Text variant="body" weight={700}>
                        +{formatNumber(num(r.newUsers))}
                      </Text>
                    </View>
                    <Bar
                      ratio={num(r.newUsers) / maxGrowth}
                      toneClass="bg-info"
                    />
                  </View>
                ))}
              </View>
            )}
          </Section>
        </View>
      ) : null}
    </DataScreen>
  )
}
