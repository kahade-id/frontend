/**
 * Screen — Referral (my-code, stats, history, rewards, regenerate).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Gift } from "phosphor-react-native"

import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { ReferralCodeCard } from "@/components/ui/referral-code-card"
import { ReferralHistoryListItem } from "@/components/ui/referral-history-list-item"
import { ReferralRewardListItem } from "@/components/ui/referral-reward"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useCopy } from "@/lib/clipboard"
import { useToast } from "@/components/ui/toast"

export default function ReferralScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copied, copy } = useCopy()

  const [code, setCode] = useState("")
  const [stats, setStats] = useState<{ totalReferred: number; qualified: number; totalReward: number } | null>(null)
  const [history, setHistory] = useState<Array<{ id: string; invitedUsername: string; status: string; reward?: number; createdAt: string }>>([])
  const [rewards, setRewards] = useState<Array<{ id: string; code: string; amount: number; status: string; createdAt: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, s, h, r] = await Promise.all([
        api.referrals.getMyReferralCode(),
        api.referrals.getReferralStats().catch(() => null),
        api.referrals.getReferralHistory().catch(() => []),
        api.referrals.getReferralRewards().catch(() => []),
      ])
      setCode(c?.code ?? "")
      setStats(
        s
          ? {
              totalReferred: s.totalInvited,
              qualified: s.completed,
              totalReward: s.totalReward,
            }
          : null,
      )
      setHistory(h ?? [])
      setRewards(r ?? [])
    } catch {
      setError("Gagal memuat data referral.")
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

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true)
    try {
      const res = await api.referrals.regenerateReferralCode()
      setCode(res?.code ?? code)
      toast.show({ title: "Kode referral baru dibuat", tone: "success", duration: 3000 })
    } catch {
      toast.show({ title: "Gagal membuat kode baru", tone: "danger" })
    } finally {
      setRegenerating(false)
    }
  }, [code, toast.show])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Referral" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={Gift} title="Memuat referral…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <ReferralCodeCard
              code={code}
              shareUrl={code ? `kahade://referral/${code}` : undefined}
              stats={stats ?? undefined}
              copied={copied}
              onCopy={(v) => void copy(v)}
              onRegenerate={() => void handleRegenerate()}
              regenerating={regenerating}
            />

            {history.length > 0 ? (
              <>
                <SectionHeader title="Riwayat undangan" />
                {history.map((h, i) => (
                  <ReferralHistoryListItem
                    key={h.id}
                    name={h.invitedUsername}
                    status={h.status}
                    joinedAt={formatDateTime(h.createdAt)}
                    rewardAmount={h.reward}
                    divider={i < history.length - 1}
                  />
                ))}
              </>
            ) : null}

            {rewards.length > 0 ? (
              <>
                <SectionHeader title="Reward" />
                {rewards.map((r) => (
                  <ReferralRewardListItem
                    key={r.id}
                    referredName={r.code}
                    amount={r.amount}
                    status={r.status}
                    date={formatDateTime(r.createdAt)}
                  />
                ))}
              </>
            ) : null}
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
