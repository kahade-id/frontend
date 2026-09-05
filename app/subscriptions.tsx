/**
 * Screen — Langganan Premium (GET status/history/plans/benefits,
 * POST subscribe/cancel/renew).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CrownSimple } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/api/subscriptions"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SubscriptionBenefitList } from "@/components/ui/subscription-benefit-list"
import { SubscriptionPlanCard } from "@/components/ui/subscription-plan-card"
import { SubscriptionStatusCard } from "@/components/ui/subscription-status-card"
import { useToast } from "@/components/ui/toast"

export default function SubscriptionsScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [benefits, setBenefits] = useState<Array<{ key: string; title: string; description?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, p, b] = await Promise.all([
        api.subscriptions.getSubscriptionStatus().catch(() => null),
        api.subscriptions.getSubscriptionPlans(),
        api.subscriptions.getSubscriptionBenefits().catch(() => []),
      ])
      setStatus(s)
      setPlans(p ?? [])
      setBenefits(b ?? [])
    } catch {
      setError("Gagal memuat paket langganan.")
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

  const handleSubscribe = useCallback(async () => {
    if (!selectedPlan) return
    setSubscribing(true)
    try {
      await api.subscriptions.subscribe({
        plan: selectedPlan.key === "ANNUAL" ? "ANNUAL" : "MONTHLY",
        pin: "000000",
      })
      toast.show({ title: "Langganan aktif", tone: "success", duration: 3000 })
      setSelectedPlan(null)
      await fetchAll()
    } catch {
      toast.show({ title: "Gagal berlangganan", description: "Periksa PIN dompet Anda.", tone: "danger" })
    } finally {
      setSubscribing(false)
    }
  }, [selectedPlan, toast.show, fetchAll])

  const handleCancel = useCallback(async () => {
    setCancelling(true)
    try {
      await api.subscriptions.cancelSubscription()
      toast.show({ title: "Langganan dibatalkan", tone: "success", duration: 3000 })
      setCancelOpen(false)
      await fetchAll()
    } catch {
      toast.show({ title: "Gagal membatalkan langganan", tone: "danger" })
    } finally {
      setCancelling(false)
    }
  }, [toast.show, fetchAll])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Langganan" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={CrownSimple} title="Memuat paket…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            {status ? (
              <SubscriptionStatusCard
                status={status.active ? "ACTIVE" : "INACTIVE"}
                planName={status.plan ?? undefined}
                endsAt={status.expiresAt ? formatDateTime(status.expiresAt) : undefined}
                onCancel={status.active ? () => setCancelOpen(true) : undefined}
                onBrowsePlans={!status.active ? undefined : undefined}
              />
            ) : null}

            <SectionHeader title="Pilih paket" />
            <View className="gap-3">
              {plans.map((plan, i) => (
                <SubscriptionPlanCard
                  key={plan.id}
                  name={plan.name}
                  description={plan.name === "Premium Tahunan" ? "Hemat 20%" : undefined}
                  price={plan.price}
                  period={plan.key === "ANNUAL" ? "/tahun" : "/bulan"}
                  benefits={(plan.benefits ?? []).map((b, j) => ({
                    id: `${plan.id}-${j}`,
                    label: b,
                    included: true,
                  }))}
                  highlighted={i === plans.length - 1}
                  current={status?.active && status.plan === plan.name}
                  selected={selectedPlan?.id === plan.id}
                  onPress={() => setSelectedPlan(plan)}
                  onSubscribe={() => setSelectedPlan(plan)}
                />
              ))}
            </View>

            {selectedPlan ? (
              <Button loading={subscribing} onPress={() => void handleSubscribe()}>
                Berlangganan {selectedPlan.name}
              </Button>
            ) : null}

            {benefits.length > 0 ? (
              <>
                <SectionHeader title="Keuntungan" />
                <SubscriptionBenefitList
                  items={benefits.map((b) => ({
                    id: b.key,
                    label: b.title,
                    description: b.description,
                  }))}
                  unlimitedLabel="Tanpa batas"
                />
              </>
            ) : null}
          </View>
        )}
      </PullToRefresh>

      <Dialog
        title="Batalkan langganan?"
        description="Anda tetap dapat mengakses fitur premium sampai periode berakhir."
        visible={cancelOpen}
        destructive
        loading={cancelling}
        confirmLabel="Batalkan"
        cancelLabel="Tutup"
        onConfirm={() => void handleCancel()}
        onCancel={() => setCancelOpen(false)}
        onRequestClose={() => setCancelOpen(false)}
      />
    </Screen>
  )
}
