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

import { Crossfade } from "@/components/ui/fade-in"
import { ListLoading } from "@/components/ui/paginated-list"
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { translate } from "@/lib/i18n/translate"

import { api, isApiError, userMessage } from "@/lib/api"
import { referralUrl } from "@/lib/deeplinks"
import { formatDateTime, formatRupiah } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { shareContent } from "@/lib/share"
import { tokens } from "@/lib/tokens"

import { Avatar } from "@/components/ui/avatar"
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
import { Text } from "@/components/ui/text"
import { useApiQuery } from "@/lib/use-api-query"
import { useCopy } from "@/lib/clipboard"
import { logWarn } from "@/lib/telemetry"
import { useToast } from "@/components/ui/toast"

export default function ReferralScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copied, copy } = useCopy()

  /**
   * Audit: empat state data + loading/error/refreshing dirakit manual. Cacat
   * terbukti dari kode lama: `handleRefresh` memanggil `fetchAll()` yang sama
   * dengan muat-awal, dan fungsi itu membuka dengan `setLoading(true)` —
   * tarik-untuk-menyegarkan mengganti kode referral, statistik, riwayat, dan
   * rewards dengan kerangka sekaligus. Request juga tidak dibatalkan saat
   * layar ditutup.
   *
   * Keempat request tetap satu query (Promise.all) karena selalu dibutuhkan
   * bersamaan. Tiga di antaranya sudah punya `.catch()` fallback di kode lama
   * dan itu DIPERTAHANKAN: kegagalan stats/history/rewards tidak boleh
   * mematikan layar selama kode referral berhasil diambil.
   */
  const query = useApiQuery<{
    code: string
    stats: { totalReferred: number; qualified: number; totalReward: number } | null
    history: import("@/lib/api/referrals").ReferralHistoryEntry[]
    rewards: import("@/lib/api/referrals").ReferralReward[]
  }>("referral", async (signal) => {
    const [c, s, h, r] = await Promise.all([
      api.referrals.getMyReferralCode(signal),
      api.referrals.getReferralStats(signal).catch((err) => {
        logWarn("referral:stats", err)
        return null
      }),
      api.referrals.getReferralHistory(signal).catch(() => []),
      api.referrals.getReferralRewards(signal).catch(() => []),
    ])
    return {
      code: c?.code ?? "",
      stats: s
        ? {
            totalReferred: s.totalInvited,
            qualified: s.completed,
            totalReward: s.totalReward,
          }
        : null,
      history: h ?? [],
      rewards: r ?? [],
    }
  })
  const code = query.data?.code ?? ""
  const stats = query.data?.stats ?? null
  const history = query.data?.history ?? []
  const rewards = query.data?.rewards ?? []
  const { loading, error, refreshing } = query

  // Papan peringkat (GET /v1/referral/leaderboard) — query terpisah dengan
  // fallback null: papan peringkat gagal dimuat tidak boleh mematikan kode/
  // statistik (pola yang sama dengan stats di atas).
  const leaderboardQuery = useApiQuery<
    import("@/lib/api/referrals").ReferralLeaderboardEntry[]
  >(
    "referral-leaderboard",
    async (signal) =>
      (await api.referrals.getReferralLeaderboard(10, signal).catch((err) => {
        logWarn("referral:leaderboard", err)
        return undefined
      })) ?? [],
  )
  const leaderboard = (leaderboardQuery.data ?? []).slice(0, 10)

  const [regenerating, setRegenerating] = useState(false)
  const [applyCode, setApplyCode] = useState("")
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | undefined>()

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true)
    try {
      const res = await api.referrals.regenerateReferralCode()
      // Perbarui kode di dalam bundle milik useApiQuery (pengganti setCode).
      query.setData((prev) => (prev ? { ...prev, code: res?.code ?? prev.code } : prev))
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
      message: translate("Pakai kode referral saya {x} saat daftar di Kahade — transaksi aman dengan escrow.", {
        x: code,
      }),
      url,
    })
    if (outcome === "unavailable") {
      const ok = await copy(url)
      if (ok) haptic("select")
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
      await query.refresh()
    } catch (err) {
      setApplyError(
        isApiError(err) ? userMessage(err) : "Kode tidak valid atau sudah pernah dipakai.",
      )
    } finally {
      setApplying(false)
    }
  }, [applyCode, query, toast.show])

  return (
    <Screen edges={["top"]} padded={false} keyboardAvoiding>
      <Header title="Referral" />
      <PullToRefresh
        onRefresh={() => void query.refresh()}
        refreshing={refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <Crossfade loading={loading} skeleton={<ListLoading />}>
          {error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void query.reload()} />
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

            {leaderboard.length > 0 ? (
              <>
                <SectionHeader
                  title="Papan peringkat"
                  subtitle="10 undangan terbanyak (selalu 10 teratas)"
                />
                <View className="overflow-hidden rounded-md border border-border bg-surface">
                  {leaderboard.map((e, i) => (
                    <View
                      key={`${e.rank}-${e.username}`}
                      accessible
                      className="flex-row items-center gap-3 px-4 py-3"
                      accessibilityLabel={translate("Peringkat {x}, {y}, mengundang {z} orang, total reward {w}", {
                        x: e.rank,
                        y: e.fullName ?? e.username,
                        z: e.invitedCount,
                        w: formatRupiah(e.totalReward),
                      })}
                    >
                      <View className="w-6 items-center">
                        <Text
                          variant="monoBody"
                          tone={e.rank <= 3 ? "primary" : "secondary"}
                          weight={e.rank <= 3 ? 600 : 400}
                        >
                          {e.rank}
                        </Text>
                      </View>
                      <Avatar source={e.avatarUrl ?? undefined} name={e.fullName ?? e.username} size="sm" />
                      <View className="flex-1 gap-0">
                        <Text ellipsizeMode="tail" variant="body" weight={500} tone="primary" numberOfLines={1}>
                          {e.fullName ?? e.username}
                        </Text>
                        <Text variant="caption" tone="secondary" numberOfLines={1}>
                          {e.invitedCount} undangan
                        </Text>
                      </View>
                      <Text variant="monoBody" tone="secondary" numberOfLines={1}>
                        {formatRupiah(e.totalReward)}
                      </Text>
                      {i < leaderboard.length - 1 ? (
                        <View
                          accessibilityRole="none"
                          importantForAccessibility="no"
                          className="absolute inset-x-0 bottom-0 h-px bg-border"
                        />
                      ) : null}
                    </View>
                  ))}
                </View>
              </>
            ) : null}

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
                Terapkan kode
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
                    amount={r.amount}
                    status={r.status}
                    date={formatDateTime(r.createdAt)}
                  />
                ))}
              </>
            ) : null}
            </View>
          )}
        </Crossfade>
      </PullToRefresh>
    </Screen>
  )
}