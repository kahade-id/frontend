/**
 * Screen — Kahade+ : daftar paket.
 *
 * Mode Tanpa Wallet Internal (BI-safe): langganan/perpanjangan dibayar
 * LANGSUNG via DANA — daftar metode = cerminan kontrak backend
 * (QRIS/VA/BALANCE, `lib/subscription-checkout.ts`), intent via
 * `POST /v1/subscriptions/subscribe-dana`, polling
 * `GET /v1/subscriptions/dana-status/:id` sampai ACTIVE. TIDAK ADA PIN
 * dompet, TIDAK ADA pilihan "Saldo Wallet" — langganan tidak bisa dibayar
 * dari saldo.
 *
 * Fail-closed: pembayaran gagal/kedaluwarsa → langganan TIDAK aktif, pesan
 * eksplisit + tombol coba lagi / ganti metode. Status langganan dibaca dari
 * `useKahadePlus()` — SATU-SATUNYA sumber status di UI. Anggota aktif
 * dialihkan ke /kahade-plus/manage.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import { Redirect, router } from "expo-router"
import { CrownSimple } from "phosphor-react-native"

import { userMessage } from "@/lib/api/errors"
import {
  getKahadePlusPlans,
  type KahadePlusPlan,
  type KahadePlusPlanKey,
} from "@/lib/api/subscriptions"
import type { OrderPaymentMethod } from "@/lib/api/orders"
import { formatRupiah } from "@/lib/format"
import { KAHADE_PLUS_BENEFITS } from "@/lib/kahade-plus-benefits"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"
import { useKahadePlus, invalidateKahadePlus } from "@/lib/use-kahade-plus"
import {
  resolveSubscriptionPaymentMethods,
  selectDefaultCheckoutMethod,
} from "@/lib/subscription-checkout"
import { useSubscriptionPayment } from "@/lib/use-subscription-payment"
import { translate } from "@/lib/i18n/translate"
import { useCopy } from "@/lib/clipboard"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { DanaCheckoutSheet } from "@/components/dana-checkout-sheet"
import { SectionHeader } from "@/components/ui/section"
import { SubscriptionBenefitList } from "@/components/ui/subscription-benefit-list"
import { SubscriptionPlanCard } from "@/components/ui/subscription-plan-card"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const PLAN_LABEL: Record<KahadePlusPlanKey, string> = {
  MONTHLY: "Bulanan",
  YEARLY: "Tahunan",
}

/** "~Rp74.917/bulan · hemat ~24%" untuk kartu tahunan — dihitung dari data server. */
function yearlySummary(plan: KahadePlusPlan, monthlyPrice: number | null): string | undefined {
  const months = Math.max(1, Math.round(plan.durationDays / 30.44))
  const perMonth = plan.price / months
  const perMonthText = formatRupiah(perMonth)
  if (perMonthText === "—") return undefined
  if (monthlyPrice && monthlyPrice > 0 && perMonth < monthlyPrice) {
    const savePct = Math.round((1 - perMonth / monthlyPrice) * 100)
    if (savePct > 0)
      return translate("~{x}/bulan · hemat ~{y}%", { x: perMonthText, y: savePct })
  }
  return translate("~{x}/bulan", { x: perMonthText })
}

export default function KahadePlusPlansScreen() {
  const plus = useKahadePlus()
  const toast = useToast()
  const { copied, copy } = useCopy()

  const plansQuery = useApiQuery<KahadePlusPlan[]>("kahade-plus-plans", (signal) =>
    getKahadePlusPlans(signal),
  )
  const plans = useMemo(
    () =>
      [...(plansQuery.data ?? [])].sort((a, b) =>
        a.plan === b.plan ? 0 : a.plan === "MONTHLY" ? -1 : 1,
      ),
    [plansQuery.data],
  )
  const monthlyPrice = useMemo(
    () => plans.find((p) => p.plan === "MONTHLY")?.price ?? null,
    [plans],
  )

  const [selected, setSelected] = useState<KahadePlusPlan | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [methods, setMethods] = useState<OrderPaymentMethod[]>([])
  const [methodsLoading, setMethodsLoading] = useState(false)
  const [methodsError, setMethodsError] = useState<string | null>(null)
  const [methodCode, setMethodCode] = useState<string | null>(null)
  const methodsAbortRef = useRef<AbortController | null>(null)

  const selectedMethod = useMemo(
    () => methods.find((m) => m.code === methodCode) ?? null,
    [methods, methodCode],
  )

  const payment = useSubscriptionPayment({
    plan: selected?.plan ?? null,
    methodCode: methodCode ?? "QRIS",
    methodLabel: selectedMethod?.name,
    fallbackAmount: selected?.price ?? 0,
    active: sheetOpen,
    onPaid: () => {
      void (async () => {
        await invalidateKahadePlus()
        setSheetOpen(false)
        setSelected(null)
        toast.show({ title: "Selamat datang di Kahade+", tone: "success", duration: 3000 })
        router.replace(ROUTES.kahadePlusManage)
      })()
    },
    // Klasifikasi toast: KEEP manual — onError hook pembayaran sudah
    // terklasifikasi (message final, bukan err mentah untuk showMutationError).
    onError: (message) =>
      toast.show({ title: "Gagal membuat pembayaran", description: message, tone: "danger" }),
  })

  const loadMethods = useCallback(async () => {
    methodsAbortRef.current?.abort()
    const controller = new AbortController()
    methodsAbortRef.current = controller
    setMethodsLoading(true)
    setMethodsError(null)
    try {
      const { methods: list } = await resolveSubscriptionPaymentMethods({
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      setMethods(list)
      setMethodCode((prev) => prev ?? selectDefaultCheckoutMethod(list)?.code ?? null)
    } catch (err) {
      if (controller.signal.aborted) return
      setMethodsError(userMessage(err))
    } finally {
      if (!controller.signal.aborted) setMethodsLoading(false)
    }
  }, [])

  const startSubscribe = useCallback(
    (plan: KahadePlusPlan) => {
      setSelected(plan)
      setMethodCode(null)
      setMethods([])
      setSheetOpen(true)
      payment.reset()
    },
    [payment],
  )

  const closeSheet = useCallback(() => {
    setSheetOpen(false)
    setSelected(null)
    payment.reset()
  }, [payment])

  // Muat metode saat sheet dibuka untuk paket terpilih.
  useEffect(() => {
    if (sheetOpen && selected) void loadMethods()
    return () => methodsAbortRef.current?.abort()
  }, [sheetOpen, selected, loadMethods])

  // Anggota aktif tidak memilih paket di sini — kelola di layar manage.
  if (!plus.loading && !plus.error && plus.isActive) {
    return <Redirect href={ROUTES.kahadePlusManage} />
  }

  const loading = plus.loading || plansQuery.loading
  const error = plus.error ?? plansQuery.error

  // Fail-closed: intent terminal-gagal → langganan TIDAK aktif; pesan
  // eksplisit + jalan keluar (coba lagi / metode lain), bukan dead-end.
  const paymentFailed =
    payment.status != null && ["FAILED", "EXPIRED", "CANCELLED"].includes(payment.status)

  return (
    <>
      <DataScreen
        title="Kahade+"
        state={{
          loading,
          error,
          refresh: () => {
            void plansQuery.refresh()
            void plus.refetch()
          },
          reload: () => {
            void plansQuery.reload()
            void plus.refetch()
          },
        }}
        loadingMessage="Memuat paket Kahade+…"
        errorTitle="Gagal memuat paket"
        empty={
          plans.length === 0 && {
            icon: CrownSimple,
            title: "Belum ada paket tersedia",
          }
        }
      >
        <SectionHeader
          title="Pilih paket"
          subtitle="Batalkan kapan saja — akses premium tetap sampai periode berakhir."
        />
        <View className="gap-3">
          {plans.map((plan) => (
            <SubscriptionPlanCard
              key={plan.plan}
              name={plan.label || PLAN_LABEL[plan.plan]}
              description={
                plan.plan === "YEARLY"
                  ? (yearlySummary(plan, monthlyPrice) ?? "Bayar sekali untuk setahun")
                  : "Ditagih setiap bulan"
              }
              price={plan.price}
              period={plan.plan === "YEARLY" ? "/tahun" : "/bulan"}
              benefits={KAHADE_PLUS_BENEFITS.map((b) => ({
                id: `${plan.plan}-${b.key}`,
                label: b.title,
                included: true,
              }))}
              highlighted={plan.plan === "YEARLY"}
              selected={selected?.plan === plan.plan && sheetOpen}
              onPress={() => setSelected(plan)}
              onSubscribe={() => startSubscribe(plan)}
              subscribing={sheetOpen && selected?.plan === plan.plan}
            />
          ))}
        </View>

        <SectionHeader title="7 keuntungan Kahade+" />
        <SubscriptionBenefitList
          items={KAHADE_PLUS_BENEFITS.map((b) => ({
            id: b.key,
            label: b.title,
            description: b.description,
          }))}
        />
      </DataScreen>

      <DanaCheckoutSheet
        open={sheetOpen}
        onClose={closeSheet}
        title="Berlangganan Kahade+"
        description={
          selected
            ? translate("Paket {x} — {y}. Bayar langsung, tanpa saldo.", {
                x: selected.label || PLAN_LABEL[selected.plan],
                y: formatRupiah(selected.price),
              })
            : undefined
        }
        methods={methods}
        selectedMethod={selectedMethod}
        onSelectMethod={setMethodCode}
        methodsLoading={methodsLoading}
        methodsError={methodsError}
        onRetryMethods={() => void loadMethods()}
        payment={payment}
        methodAction={
          selectedMethod ? (
            <Button loading={payment.creating} onPress={() => void payment.createIntent()}>
              {translate("Bayar dengan {m}", { m: selectedMethod.name })}
            </Button>
          ) : undefined
        }
        intentTopExtra={
          paymentFailed ? (
            <Alert tone="danger" title="Pembayaran gagal — langganan belum aktif">
              <Text variant="caption" tone="secondary">
                Coba lagi dengan metode yang sama, atau pilih metode pembayaran lain di bawah.
              </Text>
            </Alert>
          ) : undefined
        }
        copied={copied}
        onCopy={(value) => void copy(value)}
        onRequestRecreate={() => {
          payment.reset()
          void payment.createIntent()
        }}
        onUseOtherMethod={() => {
          payment.reset()
          toast.show({
            title: "Silakan pilih metode pembayaran lain.",
            tone: "info",
            duration: 2500,
          })
        }}
      />
    </>
  )
}
