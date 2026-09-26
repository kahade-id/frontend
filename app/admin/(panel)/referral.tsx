/**
 * Admin — Referral: statistik platform + daftar kode referral.
 *
 * - Kartu statistik: total kode, kode aktif, relasi, reward (terkait &
 *   menunggu), total reward terbayar (rupiah).
 * - Daftar kode referral: filter Semua/Aktif/Nonaktif + pencarian sederhana
 *   lewat backend? — backend tidak mendukung pencarian, jadi filter lokal
 *   hanya pada halaman yang dimuat (catatan: tidak berlaku global).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useIsFocused } from "@react-navigation/native"
import { Gift } from "phosphor-react-native"

import { translate } from "@/lib/i18n/translate"
import { formatDateTimeWIB, formatNumber, formatRupiah } from "@/lib/format"
import { userMessage } from "@/lib/api/errors"
import { handleAdminApiError } from "@/lib/admin-session"
import {
  getReferralStats,
  listReferralCodes,
  type ReferralCodeItem,
  type ReferralStats,
} from "@/lib/api/admin/referral"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DataScreen } from "@/components/ui/data-screen"
import { Section } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const PAGE_SIZE = 20

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

export default function AdminReferralScreen() {
  const toast = useToast()
  const isFocused = useIsFocused()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [codes, setCodes] = useState<ReferralCodeItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined)

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const [s, res] = await Promise.all([
          getReferralStats(),
          listReferralCodes({
            page: 1,
            limit: PAGE_SIZE,
            active: activeFilter,
          }),
        ])
        setStats(s)
        setCodes(res.data)
        setTotal(res.total ?? res.meta?.total ?? res.data.length)
        setPage(1)
      } catch (err) {
        if (!handleAdminApiError(err)) setError(userMessage(err))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [activeFilter],
  )

  useEffect(() => {
    if (isFocused) void load("initial")
  }, [isFocused, load])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || codes.length >= total) return
    setLoadingMore(true)
    try {
      const res = await listReferralCodes({
        page: page + 1,
        limit: PAGE_SIZE,
        active: activeFilter,
      })
      setCodes((prev) => [...prev, ...res.data])
      setTotal(res.total ?? res.meta?.total ?? total)
      setPage((p) => p + 1)
    } catch (err) {
      toast.show({
        title: translate("Gagal memuat kode referral"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, codes.length, total, page, activeFilter, toast])

  return (
    <DataScreen
      title={translate("Referral")}
      state={{
        loading,
        refreshing,
        error,
        refresh: () => load("refresh"),
        reload: () => load("initial"),
      }}
      loadingMessage={translate("Memuat data referral…")}
      errorTitle={translate("Gagal memuat data referral")}
      empty={
        stats == null && codes.length === 0
          ? {
              icon: Gift,
              title: translate("Belum ada data"),
              description: translate("Belum ada data referral."),
              compact: true,
            }
          : undefined
      }
    >
      <View className="gap-6">
        {stats ? (
          <Section title={translate("Statistik")}>
            <View>
              <View className="flex-row gap-3">
                <StatCard
                  label="Total kode"
                  value={formatNumber(num(stats.totalCodes))}
                />
                <StatCard
                  label="Kode aktif"
                  value={formatNumber(num(stats.activeCodes))}
                />
              </View>
              <View className="flex-row gap-3 mt-3">
                <StatCard
                  label="Relasi referral"
                  value={formatNumber(num(stats.totalRelations))}
                />
                <StatCard
                  label="Total reward"
                  value={formatNumber(num(stats.totalRewards))}
                />
              </View>
              <View className="flex-row gap-3 mt-3">
                <StatCard
                  label="Reward menunggu"
                  value={formatNumber(num(stats.pendingRewards))}
                />
                <StatCard
                  label="Reward terbayar"
                  value={formatRupiah(num(stats.totalRewardsPaid))}
                />
              </View>
            </View>
          </Section>
        ) : null}

        <Section
          title={translate("Kode referral")}
          subtitle={
            total > 0
              ? translate("{x} kode", { x: String(total) })
              : undefined
          }
        >
          <View className="gap-3">
            <View className="flex-row gap-2">
              <Chip
                selected={activeFilter === undefined}
                onPress={() => setActiveFilter(undefined)}
                accessibilityLabel={translate("Filter semua kode")}
              >
                {translate("Semua")}
              </Chip>
              <Chip
                selected={activeFilter === true}
                onPress={() => setActiveFilter(true)}
                accessibilityLabel={translate("Filter kode aktif")}
              >
                {translate("Aktif")}
              </Chip>
              <Chip
                selected={activeFilter === false}
                onPress={() => setActiveFilter(false)}
                accessibilityLabel={translate("Filter kode nonaktif")}
              >
                {translate("Nonaktif")}
              </Chip>
            </View>
            {codes.length === 0 ? (
              <Text variant="caption" tone="secondary">
                {translate("Tidak ada kode referral pada filter ini.")}
              </Text>
            ) : (
              <View className="gap-2">
                {codes.map((c) => (
                  <Card key={c.id} padded={false} className="px-4 py-3">
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-1">
                        <Text variant="body" weight={700}>
                          {c.code ?? "—"}
                        </Text>
                        <Text variant="caption" tone="secondary" className="mt-0.5" numberOfLines={1}>
                          {c.user?.fullName ?? c.user?.username ?? "—"}
                          {c.createdAt ? ` • ${formatDateTimeWIB(c.createdAt)}` : ""}
                        </Text>
                        <Text variant="caption" tone="secondary" className="mt-0.5">
                          {translate("{x} referral", {
                            x: String(num(c.totalReferrals)),
                          })}
                          {" • "}
                          {formatRupiah(num(c.totalRewardEarned))}
                        </Text>
                      </View>
                      <Badge tone={c.isActive ? "success" : "neutral"}>
                        {translate(c.isActive ? "Aktif" : "Nonaktif")}
                      </Badge>
                    </View>
                  </Card>
                ))}
                {codes.length < total ? (
                  <Button
                    variant="secondary"
                    loading={loadingMore}
                    onPress={() => void handleLoadMore()}
                  >
                    {translate("Muat lebih banyak")}
                  </Button>
                ) : null}
              </View>
            )}
          </View>
        </Section>
      </View>
    </DataScreen>
  )
}
