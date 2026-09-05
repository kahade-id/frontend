/**
 * Screen — Skor Kepercayaan (GET /v1/users/me/trust-score).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ShieldCheck } from "phosphor-react-native"

import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TrustScoreCard } from "@/components/ui/trust-score-card"

export default function TrustScoreScreen() {
  const insets = useSafeAreaInsets()

  const [data, setData] = useState<{
    score: number
    tier?: string
    factors?: Array<{ key: string; label: string; value: number; max: number }>
    updatedAt?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchScore = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.users.getMyTrustScore()
      setData(res)
    } catch {
      setError("Gagal memuat skor kepercayaan.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchScore()
  }, [fetchScore])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchScore()
    setRefreshing(false)
  }, [fetchScore])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Skor Kepercayaan" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={ShieldCheck} title="Memuat skor…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchScore()} />
        ) : data ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <TrustScoreCard
              score={data.score}
              tier={data.tier}
              factors={data.factors}
              updatedAt={data.updatedAt ? formatDateTime(data.updatedAt) : undefined}
            />
            <Text variant="body" tone="secondary">
              Skor kepercayaan dihitung dari verifikasi identitas, riwayat transaksi, dan ulasan Anda.
              Semakin tinggi skor, semakin dipercaya lawan transaksi.
            </Text>
          </View>
        ) : null}
      </PullToRefresh>
    </Screen>
  )
}
