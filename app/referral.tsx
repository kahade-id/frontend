import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Referral (my-code, stats, history, rewards, regenerate, apply).
 *
 * Keputusan non-obvious:
 *   - "Bagikan kode" memakai share sheet native (`shareContent`), bukan
 *     hanya salin; bila tidak tersedia (web desktop) jatuh ke salin + toast.
 *   - Form "Punya kode dari teman?" (POST /v1/referral/apply) ditampilkan di
 *     bawah — backend yang menentukan kelayakan (biasanya hanya akun baru);
 *     pesan error server diteruskan apa adanya.
 *   - Tautan undangan dibentuk `referralUrl()` (lib/deeplinks) — tanpa
 *     literal skema di layar.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, isApiError, userMessage } from "@/lib/api"
import { referralUrl } from "@/lib/deeplinks"
import { formatDateTime } from "@/lib/format"
import { shareContent } from "@/lib/share"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
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
  const [stats, setStats] = useState<{
    totalReferred: number
    qualified: number
    totalReward: number
  } | null>(null)
  const [history, setHistory] = useState<
    Array<{
      id: string
      invitedUsername: string
      status: string
      reward?: number
      createdAt: string
    }>
  >([])
  const [rewards, setRewards] = useState<
    Array<{ id: string; code: string; amount: number; status: string; createdAt: string }>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [applyCode, setApplyCode] = useState("")
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | undefined>()

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
    } catch (err) {
      setError(userMessage(err))
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
    } catch (err: unknown) {
      toast.show({
        title: "Gagal membuat kode baru",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setRegenerating(false)
    }
  }, [code, toast.show])

  const handleShare = useCallback(async () => {
    if (!code) return
    const url = referralUrl(code)
    const outcome = await shareContent({
      title: "Ajak teman ke Kahade",
      message: `Pakai kode referral saya ${code} saat daftar di Kahade — transaksi aman dengan escrow.`,
      url,
    })
    if (outcome === "unavailable") {
      const ok = await copy(url)
      toast.show({
        title: ok ? "Tautan undangan disalin" : "Tidak bisa membagikan",
        tone: ok ? "success" : "danger",
      })
    }
  }, [code, copy, toast.show])

  const handleApply = useCallback(async () => {
    const value = applyCode.trim().toUpperCase()
    if (!value) return
    setApplying(true)
    setApplyError(undefined)
    try {
      await api.referrals.applyReferralCode({ code: value })
      setApplyCode("")
      toast.show({ title: "Kode referral diterapkan", tone: "success" })
      await fetchAll()
    } catch (err) {
      setApplyError(
        isApiError(err) ? userMessage(err) : "Kode tidak valid atau sudah pernah dipakai.",
      )
    } finally {
      setApplying(false)
    }
  }, [applyCode, fetchAll, toast.show])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Referral" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <ListLoading />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <ReferralCodeCard
              code={code}
              shareUrl={code ? referralUrl(code) : undefined}
              stats={stats ?? undefined}
              copied={copied}
              onCopy={(v) => void copy(v)}
              onShare={code ? () => void handleShare() : undefined}
              onRegenerate={() => void handleRegenerate()}
              regenerating={regenerating}
            />

            <FormSection
              title="Punya kode dari teman?"
              description="Masukkan kode referral yang Anda terima."
            >
              <Input
                label="Kode referral"
                value={applyCode}
                onChangeText={(v) => setApplyCode(v.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                errorText={applyError}
                returnKeyType="done"
                onSubmitEditing={() => void handleApply()}
              />
              <Button
                variant="secondary"
                loading={applying}
                disabled={!applyCode.trim()}
                onPress={() => void handleApply()}
              >
                Terapkan Kode
              </Button>
            </FormSection>

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
