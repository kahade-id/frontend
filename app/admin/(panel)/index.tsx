/**
 * Admin — Dasbor: ringkasan platform + navigasi ke tiap antrean.
 *
 * - Kartu ringkasan: total pengguna, total order, escrow aktif, serta
 *   antrean menunggu (KYC, sengketa, penarikan) dari getDashboardSummary().
 * - Distribusi status order dari getDashboardOrderStats().
 * - Aktivitas terbaru dari getRecentActivity().
 * - Menu kartu tekan → router.push ke tiap antrean.
 * - Tombol "Keluar" → logoutAdminAndRedirect().
 */
import { Tray } from "phosphor-react-native"
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { Stack, router } from "expo-router"
import { useIsFocused } from "@react-navigation/native"

import { translate } from "@/lib/i18n/translate"
import { formatDateTimeWIB, formatNumber } from "@/lib/format"
import { userMessage } from "@/lib/api/errors"
import { handleAdminApiError } from "@/lib/admin-session"
import {
  getDashboardOrderStats,
  getDashboardSummary,
  getRecentActivity,
  type DashboardSummary,
  type OrderStats,
  type RecentActivityItem,
} from "@/lib/api/admin/dashboard"
import { logoutAdminAndRedirect } from "@/app/admin/(panel)/_layout"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataScreen } from "@/components/ui/data-screen"
import { EmptyState } from "@/components/ui/empty-state"
import { Section } from "@/components/ui/section"
import { Text } from "@/components/ui/text"

const MENU: Array<{ title: string; description: string; route: string }> = [
  {
    title: "Verifikasi KYC",
    description: "Antrean verifikasi identitas pengguna",
    route: "/admin/kyc",
  },
  {
    title: "Verifikasi Bisnis",
    description: "Antrean verifikasi badan usaha",
    route: "/admin/business",
  },
  {
    title: "Sengketa",
    description: "Sengketa escrow yang perlu putusan",
    route: "/admin/disputes",
  },
  {
    title: "Tiket Bantuan",
    description: "Tiket dukungan pengguna",
    route: "/admin/tickets",
  },
  {
    title: "Laporan Pengguna",
    description: "Laporan konten & akun",
    route: "/admin/reports",
  },
  {
    title: "Moderasi Chat",
    description: "Pantau percakapan pengguna",
    route: "/admin/chat",
  },
  {
    title: "Badge & Centang Emas",
    description: "Kelola badge verifikasi",
    route: "/admin/badges",
  },
]

const ORDER_LABEL: Record<string, string> = {
  WAITING_CONFIRMATION: "Menunggu konfirmasi",
  WAITING_PAYMENT: "Menunggu pembayaran",
  PROCESSING: "Diproses",
  IN_DELIVERY: "Dikirim",
  COMPLETED: "Selesai",
  DISPUTED: "Disengketakan",
  CANCELLED: "Dibatalkan",
}

const ORDER_TONE: Record<string, BadgeTone> = {
  WAITING_CONFIRMATION: "warning",
  WAITING_PAYMENT: "warning",
  PROCESSING: "info",
  IN_DELIVERY: "info",
  COMPLETED: "success",
  DISPUTED: "danger",
  CANCELLED: "neutral",
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex-1" padded>
      <Text variant="caption" tone="secondary">
        {translate(label)}
      </Text>
      <Text variant="h3" className="mt-1">
        {value}
      </Text>
    </Card>
  )
}

export default function AdminDashboardScreen() {
  const isFocused = useIsFocused()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [orderStats, setOrderStats] = useState<OrderStats>([])
  const [activity, setActivity] = useState<RecentActivityItem[]>([])

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const [sum, stats, act] = await Promise.all([
        getDashboardSummary(),
        getDashboardOrderStats(),
        getRecentActivity({ limit: 10 }),
      ])
      setSummary(sum)
      setOrderStats(stats)
      setActivity(act)
    } catch (e) {
      if (!handleAdminApiError(e)) setError(userMessage(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (isFocused) void load("initial")
  }, [isFocused, load])

  const totalOrderCount = orderStats.reduce(
    (acc, s) => acc + (typeof s.count === "number" ? s.count : 0),
    0,
  )

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DataScreen
        title={translate("Dasbor Admin")}
        state={{
          loading,
          refreshing,
          error,
          refresh: () => load("refresh"),
          reload: () => load("initial"),
        }}
        loadingMessage={translate("Memuat dasbor…")}
        errorTitle={translate("Gagal memuat dasbor")}
      >
        {summary ? (
          <View className="gap-6 pb-8">
            <Section title={translate("Ringkasan")}>
              <View>
                <View className="flex-row gap-3">
                  <StatCard
                    label="Total pengguna"
                    value={formatNumber(num(summary.totalUsers))}
                  />
                  <StatCard
                    label="Total order"
                    value={formatNumber(num(summary.totalOrders))}
                  />
                </View>
                <View className="flex-row gap-3 mt-3">
                  <StatCard
                    label="Escrow aktif"
                    value={formatNumber(num(summary.activeEscrow))}
                  />
                  <StatCard
                    label="KYC menunggu"
                    value={formatNumber(num(summary.pendingKyc))}
                  />
                </View>
                <View className="flex-row gap-3 mt-3">
                  <StatCard
                    label="Sengketa menunggu"
                    value={formatNumber(num(summary.pendingDisputes))}
                  />
                  <StatCard
                    label="Penarikan menunggu"
                    value={formatNumber(num(summary.pendingWithdrawals))}
                  />
                </View>
              </View>
            </Section>

            <Section
              title={translate("Status order")}
              subtitle={
                totalOrderCount > 0
                  ? translate("{x} order tercatat", {
                      x: String(totalOrderCount),
                    })
                  : undefined
              }
            >
              {orderStats.length === 0 ? (
                <EmptyState
                  icon={Tray}
                  title={translate("Belum ada data")}
                  description={translate("Belum ada order tercatat.")}
                  compact
                />
              ) : (
                <View className="gap-2">
                  {orderStats.map((s) => (
                    <Card
                      key={String(s.status)}
                      padded={false}
                      className="px-4 py-3"
                    >
                      <View className="flex-row items-center justify-between gap-2">
                        <Badge tone={ORDER_TONE[String(s.status)] ?? "neutral"}>
                          {translate(ORDER_LABEL[String(s.status)] ?? String(s.status))}
                        </Badge>
                        <Text variant="body" weight={700}>
                          {formatNumber(
                            typeof s.count === "number" ? s.count : 0,
                          )}
                        </Text>
                      </View>
                    </Card>
                  ))}
                </View>
              )}
            </Section>

            <Section title={translate("Aktivitas terbaru")}>
              {activity.length === 0 ? (
                <EmptyState
                  icon={Tray}
                  title={translate("Belum ada data")}
                  description={translate("Belum ada aktivitas admin.")}
                  compact
                />
              ) : (
                <View className="gap-2">
                  {activity.map((item) => (
                    <Card
                      key={item.id}
                      padded={false}
                      className="px-4 py-3"
                    >
                      <Text variant="body" weight={600}>
                        {item.action}
                      </Text>
                      {item.description ? (
                        <Text
                          variant="caption"
                          tone="secondary"
                          className="mt-0.5"
                        >
                          {item.description}
                        </Text>
                      ) : null}
                      <Text variant="caption" tone="secondary" className="mt-0.5">
                        {[item.adminName, formatDateTimeWIB(item.createdAt)]
                          .filter(Boolean)
                          .join(" • ")}
                      </Text>
                    </Card>
                  ))}
                </View>
              )}
            </Section>

            <Section title={translate("Menu admin")}>
              <View className="gap-2">
                {MENU.map((m) => (
                  <Card
                    key={m.route}
                    padded={false}
                    className="px-4 py-3"
                    onPress={() => router.push(m.route)}
                    accessibilityLabel={translate("Buka {x}", {
                      x: m.title,
                    })}
                  >
                    <Text variant="body" weight={600}>
                      {translate(m.title)}
                    </Text>
                    <Text variant="caption" tone="secondary" className="mt-0.5">
                      {translate(m.description)}
                    </Text>
                  </Card>
                ))}
              </View>
            </Section>

            <Button
              variant="secondary"
              onPress={() => void logoutAdminAndRedirect()}
              accessibilityLabel={translate("Keluar dari panel admin")}
            >
              {translate("Keluar")}
            </Button>
          </View>
        ) : null}
      </DataScreen>
    </>
  )
}
