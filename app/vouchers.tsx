import { router } from "expo-router"
import { ROUTES } from "@/lib/routes"
import { LoadingScreen } from "@/components/ui/loading-screen"
/**
 * Screen — Voucher (GET /v1/vouchers/available + /my-usage).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ticket } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { Voucher } from "@/lib/api/vouchers"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { VoucherCard } from "@/components/ui/voucher-card"
import { VoucherUsageListItem } from "@/components/ui/voucher-usage-list-item"
import { useToast } from "@/components/ui/toast"

export default function VouchersScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [available, setAvailable] = useState<Voucher[]>([])
  const [usage, setUsage] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [a, u] = await Promise.all([
        api.vouchers.listAvailableVouchers(),
        api.vouchers.listMyVoucherUsage(),
      ])
      setAvailable(a ?? [])
      setUsage(u ?? [])
    } catch {
      setError("Gagal memuat voucher.")
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

  const discountTypeOf = (v: Voucher) => {
    if (v.discountType === "PERCENT") return "PERCENTAGE" as const
    if (v.discountType === "FIXED") return "FIXED" as const
    return "PERCENTAGE" as const
  }

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Voucher" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <LoadingScreen message="Memuat voucher…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Tersedia untuk Anda" />
            {available.length === 0 ? (
              <EmptyState
                icon={Ticket}
                title="Belum ada voucher"
                description="Voucher promo akan muncul di sini."
              />
            ) : (
              available.map((v) => (
                <VoucherCard
                  key={v.code}
                  code={v.code}
                  title={v.title ?? v.code}
                  description={v.description}
                  discountType={discountTypeOf(v)}
                  discountValue={v.discountValue ?? Number.NaN}
                  maxDiscount={v.maxDiscount}
                  minOrderValue={v.minOrderValue}
                  expiresAt={v.expiresAt ? formatDateTime(v.expiresAt) : undefined}
                  expiresSoon={
                    v.expiresAt
                      ? new Date(v.expiresAt).getTime() - Date.now() < 3 * 86400_000
                      : false
                  }
                  onUse={() =>
                    router.push({
                      pathname: "/create-transaction",
                      params: { voucherCode: v.code },
                    })
                  }
                />
              ))
            )}

            <SectionHeader title="Riwayat pemakaian" />
            {usage.length === 0 ? (
              <EmptyState icon={Ticket} title="Belum ada pemakaian" />
            ) : (
              usage.map((u, index) => (
                <VoucherUsageListItem
                  key={u.usageId ?? `${u.code}:${index}`}
                  title={u.title ?? u.code}
                  code={u.code}
                  savedAmount={u.discountValue ?? Number.NaN}
                  usedAt={u.usedAt ? formatDateTime(u.usedAt) : undefined}
                />
              ))
            )}
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
