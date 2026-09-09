import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { canUsePaymentMethod } from "@/components/ui/payment-method-selector"
import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Langganan Premium.
 *
 * GET  /v1/subscriptions/status | /plans | /benefits | /history
 * POST /v1/subscriptions/subscribe { plan, pin, paymentMethod? }
 * POST /v1/subscriptions/renew     { pin }
 * POST /v1/subscriptions/cancel
 *
 * Alur berlangganan: pilih paket → pilih metode bayar (GET
 * /v1/wallet/payment-methods; default KAHADE_WALLET) → masukkan PIN dompet →
 * status diperbarui. Perpanjangan (renew) hanya butuh PIN.
 *
 * Keputusan non-obvious:
 *   - PIN SELALU diminta lewat <PinInput> — sebelumnya layar mengirim PIN
 *     literal "000000" yang tidak pernah bisa lolos verifikasi server.
 *   - `paymentMethod` di SubscribeDto opsional; kami kirim pilihan pengguna
 *     supaya biaya tidak selalu dipotong dari saldo. Jika daftar metode gagal
 *     dimuat, langkah metode dilewati (server memakai default-nya).
 *   - `GET /history` spec-nya page/limit REQUIRED → selalu kirim keduanya;
 *     respons tanpa meta, jadi akhir paginasi = halaman < PAGE_SIZE.
 *   - Status kartu: `expiresAt` dipakai untuk menghitung `daysLeft` supaya
 *     komponen bisa menandai EXPIRING (≤7 hari) dan menawarkan perpanjangan.
 *   - Label periode paket diambil dari `plan.key` (MONTHLY/ANNUAL); bila key
 *     tidak ada, fallback dari `durationDays` (≥ 300 hari dianggap tahunan).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ClockCounterClockwise, CrownSimple } from "phosphor-react-native"

import { api, isApiError, userMessage, type SubscribeDto } from "@/lib/api"
import type {
  SubscriptionHistoryEntry,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/lib/api/subscriptions"
import { formatDateTime, formatRupiah } from "@/lib/format"
import { toPaymentMethods } from "@/lib/payment-methods"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"

import { Alert } from "@/components/ui/alert"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { ListGroup, ListItem } from "@/components/ui/list-item"
import { LoadMore, type LoadMoreStatus } from "@/components/ui/load-more"
import { PaymentMethodSelector, type PaymentMethod } from "@/components/ui/payment-method-selector"
import { PinInput } from "@/components/ui/pin-input"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SubscriptionBenefitList } from "@/components/ui/subscription-benefit-list"
import { SubscriptionPlanCard } from "@/components/ui/subscription-plan-card"
import {
  SubscriptionStatusCard,
  type SubscriptionPeriod,
  type SubscriptionStatus as CardStatus,
} from "@/components/ui/subscription-status-card"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { mapValue } from "@/lib/has-own"

const PAGE_SIZE = 10
const MS_PER_DAY = 86_400_000

type Step = "plans" | "method" | "pin"
type PinPurpose = "subscribe" | "renew"

type Benefit = { key: string; title: string; description?: string }

const HISTORY_TONE: Partial<Record<string, BadgeTone>> = {
  ACTIVE: "success",
  SUCCESS: "success",
  PAID: "success",
  PENDING: "warning",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
  FAILED: "danger",
}

const HISTORY_LABELS: Record<string, string> = {
  ACTIVE: "Aktif",
  SUCCESS: "Berhasil",
  PAID: "Dibayar",
  PENDING: "Menunggu",
  EXPIRED: "Kedaluwarsa",
  CANCELLED: "Dibatalkan",
  FAILED: "Gagal",
}

function planPeriod(plan: SubscriptionPlan): SubscriptionPeriod {
  return plan.key
}

function toCardStatus(status: SubscriptionStatus | null): {
  status: CardStatus
  daysLeft?: number
} {
  if (!status) return { status: "NONE" }
  if (!status.active) return { status: status.expiresAt ? "EXPIRED" : "NONE" }
  if (!status.expiresAt) return { status: "ACTIVE" }
  const expiry = new Date(status.expiresAt).getTime()
  const daysLeft = Number.isFinite(expiry)
    ? Math.max(0, Math.ceil((expiry - Date.now()) / MS_PER_DAY))
    : undefined
  return { status: "ACTIVE", daysLeft }
}

export default function SubscriptionsScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  /**
   * Audit: lima state data + loading/error/refreshing dirakit manual. Cacat
   * terbukti dari kode lama: `handleRefresh` memanggil `fetchAll()` yang sama
   * dengan muat-awal, dan fungsi itu membuka dengan `setLoading(true)` —
   * tarik-untuk-menyegarkan mengganti status langganan, paket, benefit, DAN
   * metode pembayaran dengan kerangka sekaligus. Request juga tidak dibatalkan
   * saat layar ditutup.
   *
   * `.catch(() => [] as Benefit[])` DIPERTAHANKAN: benefit gagal diambil tidak
   * boleh mematikan status langganan.
   */
  const query = useApiQuery<{
    status: SubscriptionStatus
    plans: SubscriptionPlan[]
    benefits: Benefit[]
    benefitsError?: string
    methods: PaymentMethod[]
  }>("subscriptions", async (signal) => {
    const benefitsResult = api.subscriptions
      .getSubscriptionBenefits(signal)
      .then((data) => ({ data, error: undefined }))
      .catch((reason: unknown) => ({ data: [] as Benefit[], error: userMessage(reason) }))
    const [s, p, b, wallet, pm] = await Promise.all([
      api.subscriptions.getSubscriptionStatus(signal),
      api.subscriptions.getSubscriptionPlans(signal),
      benefitsResult,
      api.wallet.getWallet(signal),
      api.wallet.getPaymentMethods(signal),
    ])
    return {
      status: s,
      plans: p ?? [],
      benefits: b.data ?? [],
      benefitsError: b.error,
      methods: toPaymentMethods(pm, { walletBalance: wallet.availableBalance }).filter((method) =>
        (API_CONSTRAINTS.SubscribeDto.paymentMethod.enum as readonly string[]).includes(method.id),
      ),
    }
  })
  const bundle = query.data
  const status = bundle?.status ?? null
  const plans = bundle?.plans ?? []
  const benefits = bundle?.benefits ?? []
  const methods = bundle?.methods ?? []
  const { loading, error, refreshing } = query

  const [step, setStep] = useState<Step>("plans")
  const [pinPurpose, setPinPurpose] = useState<PinPurpose>("subscribe")
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [methodId, setMethodId] = useState<string>("")
  const submitLock = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [pinError, setPinError] = useState<string | undefined>()

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const [history, setHistory] = useState<SubscriptionHistoryEntry[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyStatus, setHistoryStatus] = useState<LoadMoreStatus>("idle")

  const fetchHistory = useCallback(async (page: number, replace: boolean) => {
    setHistoryStatus("loading")
    try {
      const rows =
        (await api.subscriptions.getSubscriptionHistory({ page, limit: PAGE_SIZE })) ?? []
      setHistory((prev) => (replace ? rows : [...prev, ...rows]))
      setHistoryPage(page)
      setHistoryStatus(rows.length < PAGE_SIZE ? "end" : "idle")
    } catch {
      setHistoryStatus("error")
    }
  }, [])

  /**
   * Dua hal yang dulu terjadi DI DALAM fetcher kini jadi effect, karena
   * keduanya efek samping pada state UI — bukan bagian dari data server:
   *   1. memilih metode pembayaran default (pilihan user dipertahankan selama
   *      masih tersedia), dan
   *   2. memuat ulang riwayat (`fetchHistory(1, true)`), yang paginatornya
   *      sengaja TIDAK diubah agar semantik "replace vs append" tetap sama.
   * Bergantung pada `bundle` supaya ikut jalan tiap penyegaran berhasil,
   * persis seperti perilaku lama.
   */
  useEffect(() => {
    if (!bundle) return
    setMethodId((previous) =>
      methods.some((m) => m.id === previous && !m.unavailable)
        ? previous
        : (methods.find((m) => !m.unavailable)?.id ?? ""),
    )
    void fetchHistory(1, true)
  }, [bundle, methods, fetchHistory])

  const card = useMemo(() => toCardStatus(status), [status])
  const currentPlan = useMemo(
    () =>
      plans.find((p) => p.name === status?.plan || p.key === status?.plan || p.id === status?.plan),
    [plans, status?.plan],
  )
  const hasMethods = methods.length > 0

  const startSubscribe = useCallback(
    (plan: SubscriptionPlan) => {
      if (loading || error) return
      setSelectedPlan(plan)
      setPinPurpose("subscribe")
      setPinError(undefined)
      setStep(hasMethods ? "method" : "pin")
    },
    [hasMethods, loading, error],
  )

  const startRenew = useCallback(() => {
    setPinPurpose("renew")
    setPinError(undefined)
    setStep("pin")
  }, [])

  const backToPlans = useCallback(() => {
    setStep("plans")
    setPinError(undefined)
  }, [])

  const closePin = useCallback(() => {
    if (submitting) return
    setStep(pinPurpose === "subscribe" && hasMethods ? "method" : "plans")
    setPinError(undefined)
  }, [submitting, pinPurpose, hasMethods])

  const handlePin = useCallback(
    async (pin: string) => {
      if (
        submitLock.current ||
        loading ||
        error ||
        (pinPurpose === "subscribe" &&
          (!selectedPlan ||
            !canUsePaymentMethod(
              methods.find((m) => m.id === methodId),
              selectedPlan.price,
            )))
      )
        return
      submitLock.current = true
      setSubmitting(true)
      setPinError(undefined)
      try {
        if (pinPurpose === "renew") {
          const next = await api.subscriptions.renewSubscription({ pin })
          query.setData((prev) => (prev ? { ...prev, status: next } : prev))
          toast.show({
            title:
              next.active === true ? "Langganan diperpanjang" : "Permintaan perpanjangan diterima",
            tone: next.active === true ? "success" : "info",
            duration: 3000,
          })
        } else {
          if (!selectedPlan) return
          const next = await api.subscriptions.subscribe({
            plan: planPeriod(selectedPlan),
            pin,
            // Kode metode berasal dari GET /wallet/payment-methods (string
            // bebas); enum SubscribeDto lebih sempit → cast terkontrol.
            paymentMethod: hasMethods ? (methodId as SubscribeDto["paymentMethod"]) : undefined,
          })
          query.setData((prev) => (prev ? { ...prev, status: next } : prev))
          toast.show({
            title: next.active === true ? "Langganan aktif" : "Permintaan langganan diterima",
            tone: next.active === true ? "success" : "info",
            duration: 3000,
          })
        }
        setSelectedPlan(null)
        setStep("plans")
        await query.refresh()
      } catch (err) {
        setPinError(
          isApiError(err) ? userMessage(err) : "PIN salah atau pembayaran gagal. Coba lagi.",
        )
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [pinPurpose, selectedPlan, hasMethods, methodId, toast.show, query, loading, error, methods],
  )

  const handleCancel = useCallback(async () => {
    setCancelling(true)
    try {
      const next = await api.subscriptions.cancelSubscription()
      query.setData((prev) => (prev ? { ...prev, status: next } : prev))
      toast.show({ title: "Langganan dibatalkan", tone: "success", duration: 3000 })
      setCancelOpen(false)
      await query.refresh()
    } catch (err: unknown) {
      toast.show({
        title: "Gagal membatalkan langganan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setCancelling(false)
    }
  }, [toast.show, query])

  const footer =
    step === "method" && selectedPlan ? (
      // Tanpa px-6 / paddingBottom sendiri: <Screen footer> membungkus node ini
      // dengan <FooterBar>, yang sudah memasang `px-6` (baris 62) dan
      // `paddingBottom = max(space[4], insets.bottom)` (baris 52). Menambahnya
      // lagi di sini membuat padding samping jadi 48px (tombol 264px, bukan
      // 312px, di layar 360px) dan inset bawah terhitung dua kali.
      <View>
        <Button
          fullWidth
          disabled={
            !selectedPlan ||
            !canUsePaymentMethod(
              methods.find((m) => m.id === methodId),
              selectedPlan.price,
            )
          }
          onPress={() => {
            setPinError(undefined)
            setStep("pin")
          }}
        >
          Lanjut · {formatRupiah(selectedPlan.price)}
        </Button>
      </View>
    ) : undefined

  return (
    <Screen edges={["top"]} padded={false} footer={footer}>
      <Header
        title="Langganan"
        onBack={
          step === "pin" ? closePin : step === "method" ? backToPlans : undefined
        }
      />
      <PullToRefresh
        onRefresh={() => void query.refresh()}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <ListLoading />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void query.reload()} />
        ) : step === "method" && selectedPlan ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader
              title="Metode pembayaran"
              subtitle={`${selectedPlan.name} · ${formatRupiah(selectedPlan.price)}`}
            />
            <PaymentMethodSelector
              methods={methods}
              amount={selectedPlan.price}
              value={methodId}
              onChange={setMethodId}
            />
          </View>
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SubscriptionStatusCard
              status={card.status}
              daysLeft={card.daysLeft}
              planName={status?.plan ?? undefined}
              period={currentPlan ? planPeriod(currentPlan) : undefined}
              endsAt={status?.expiresAt ? formatDateTime(status.expiresAt) : undefined}
              renewalPrice={currentPlan?.price}
              autoRenew={status?.autoRenew}
              onRenew={status?.plan ? startRenew : undefined}
              renewing={submitting && pinPurpose === "renew"}
              onCancel={status?.active ? () => setCancelOpen(true) : undefined}
            />

            <SectionHeader title="Pilih paket" />
            {plans.length === 0 ? (
              <EmptyState compact icon={CrownSimple} title="Belum ada paket tersedia" />
            ) : (
              <View className="gap-3">
                {plans.map((plan) => {
                  const period = planPeriod(plan)
                  const isCurrent = Boolean(status?.active && currentPlan?.id === plan.id)
                  return (
                    <SubscriptionPlanCard
                      key={plan.id}
                      name={plan.name}
                      description={period === "ANNUAL" ? "Bayar sekali untuk setahun" : undefined}
                      price={plan.price}
                      period={period === "ANNUAL" ? "/tahun" : "/bulan"}
                      benefits={(plan.benefits ?? []).map((b, j) => ({
                        id: `${plan.id}-${j}`,
                        label: b,
                        included: true,
                      }))}
                      highlighted={false}
                      current={isCurrent}
                      selected={selectedPlan?.id === plan.id}
                      onPress={() => setSelectedPlan(plan)}
                      onSubscribe={isCurrent ? undefined : () => startSubscribe(plan)}
                    />
                  )
                })}
              </View>
            )}

            {bundle?.benefitsError ? (
              <Alert tone="warning" title="Keuntungan belum dapat dimuat">
                {bundle.benefitsError}
              </Alert>
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

            <SectionHeader title="Riwayat langganan" />
            {history.length === 0 && historyStatus !== "loading" ? (
              <EmptyState compact icon={ClockCounterClockwise} title="Belum ada riwayat" />
            ) : (
              <ListGroup>
                {history.map((h, i) => (
                  <ListItem
                    key={h.id}
                    title={h.plan}
                    subtitle={`${formatDateTime(h.createdAt)}${h.expiresAt ? ` · s.d. ${formatDateTime(h.expiresAt)}` : ""}`}
                    trailing={
                      <View className="items-end gap-1">
                        <Text numberOfLines={1} variant="monoBody">{formatRupiah(h.amount)}</Text>
                        <Badge tone={mapValue(HISTORY_TONE, h.status, "neutral")} variant="soft">
                          {mapValue(HISTORY_LABELS, h.status, h.status)}
                        </Badge>
                      </View>
                    }
                    divider={i < history.length - 1}
                  />
                ))}
              </ListGroup>
            )}
            <LoadMore
              status={historyStatus}
              onLoadMore={() => void fetchHistory(historyPage + 1, false)}
              hideEnd
            />
          </View>
        )}
      </PullToRefresh>

      {/*
       * Sheet PIN — tanpa ini `step === "pin"` tidak merender apa pun:
       * alur berlangganan/perpanjang berhenti diam setelah user menekan
       * "Lanjut" (handlePin sudah ada tapi tidak punya pemicu). Bentuknya
       * disamakan dengan alur uang lain (withdraw/transfer/topup):
       * <BottomSheet avoidKeyboard> + <PinInput mode="enter"> (§10:
       * konfirmasi PIN = BottomSheet).
       */}
      <BottomSheet
        visible={step === "pin"}
        onRequestClose={closePin}
        title="Verifikasi PIN"
        description={
          pinPurpose === "renew"
            ? `Masukkan PIN dompet Anda untuk memperpanjang langganan${
                currentPlan ? ` ${currentPlan.name}` : ""
              }${currentPlan ? ` sebesar ${formatRupiah(currentPlan.price)}` : ""}.`
            : `Masukkan PIN dompet Anda untuk berlangganan${
                selectedPlan ? ` ${selectedPlan.name}` : ""
              }${selectedPlan ? ` sebesar ${formatRupiah(selectedPlan.price)}` : ""}.`
        }
        avoidKeyboard
      >
        <PinInput
          mode="enter"
          onComplete={(pin) => void handlePin(pin)}
          errorText={pinError}
          disabled={submitting}
        />
      </BottomSheet>

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