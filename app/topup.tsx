/**
 * Kahade — Isi Saldo (top-up) v2 — alur multi-step dengan separator progress,
 * keypad nominal terpusat, dan kartu konfirmasi eksklusif.
 *
 * Alur (3 langkah, TANPA teks "Langkah X/Y" — separator progress tipis di
 * bawah header, seperti alur register):
 *   1. Nominal  — centered AmountKeypad (tidak ada keyboard OS)
 *   2. Metode   — pilih VA / e-wallet / QRIS + ringkasan
 *   3. Instruksi pembayaran (hasil createTopup) — TopupStatusCard
 *
 * Kontrak API:
 *   GET  /v1/wallet/payment-methods  → PaymentMethod[] (filter top-up saja)
 *   POST /v1/wallet/topup            → { paymentTxId, method, amount, paymentCode, qrString, … }
 *   GET  /v1/wallet/topup/:id/status → polling status pembayaran
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Wallet as WalletIcon } from "phosphor-react-native"

import { api, userMessage, type TopupDto } from "@/lib/api"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { AMOUNT_LIMITS, AMOUNT_PRESETS, isValidAmount } from "@/lib/financial"
import { useCopy } from "@/lib/clipboard"
import { toPaymentMethods } from "@/lib/payment-methods"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { usePolling } from "@/lib/use-polling"
import { useApiQuery } from "@/lib/use-api-query"
import { AmountKeypad } from "@/components/ui/amount-keypad"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FadeIn } from "@/components/ui/fade-in"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { ListLoading } from "@/components/ui/paginated-list"
import {
  PaymentMethodSelector,
  canUsePaymentMethod,
  type PaymentMethod,
} from "@/components/ui/payment-method-selector"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TopupStatusCard, type PaymentStatus } from "@/components/ui/topup-status-card"
import { TransactionSummary } from "@/components/ui/transaction-summary"
import { useToast } from "@/components/ui/toast"
import { mapValue } from "@/lib/has-own"

const POLL_MS = 5000
const TOTAL_STEPS = 3 // nominal → metode → instruksi (separator progress)

const STATUS: Partial<Record<string, PaymentStatus>> = {
  SUCCESS: "SUCCESS",
  COMPLETED: "SUCCESS",
  PAID: "SUCCESS",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
}
function isTopupMethod(value: string | null): value is TopupDto["method"] {
  return (
    value != null && (API_CONSTRAINTS.TopupDto.method.enum as readonly string[]).includes(value)
  )
}

type Step = "amount" | "method" | "result"

export default function TopupScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copied, copy } = useCopy()

  const methodsQuery = useApiQuery<PaymentMethod[]>("topup-methods", async (signal) => {
    const raw = await api.wallet.getPaymentMethods(signal)
    return toPaymentMethods(raw).filter((method) => isTopupMethod(method.id))
  })
  const methods = useMemo(() => methodsQuery.data ?? [], [methodsQuery.data])
  const { loading, error } = methodsQuery

  const [step, setStep] = useState<Step>("amount")
  const [amount, setAmount] = useState(0)
  const [methodId, setMethodId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.wallet.createTopup>> | null>(
    null,
  )
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const submitLock = useRef(false)
  const pollLock = useRef(false)

  // Progress bar — nilai kontinu mengikuti langkah aktif (register-style).
  const stepIndex: Record<Step, number> = { amount: 1, method: 2, result: 3 }
  const progress = stepIndex[step] / TOTAL_STEPS

  useEffect(() => {
    if (methods.length === 0) return
    setMethodId((previous) =>
      methods.some((m) => m.id === previous && !m.unavailable)
        ? previous
        : (methods.find((m) => !m.unavailable)?.id ?? null),
    )
  }, [methods])

  const pollStatus = useCallback(async (id: string) => {
    if (pollLock.current) return
    pollLock.current = true
    setStatusLoading(true)
    try {
      const status = await api.wallet.getTopupStatus(id)
      setResult((previous) =>
        previous?.paymentTxId === id ? { ...previous, ...status, paymentTxId: id } : previous,
      )
      setStatusError(null)
    } catch (err) {
      setStatusError(userMessage(err))
    } finally {
      pollLock.current = false
      setStatusLoading(false)
    }
  }, [])
  usePolling(
    async () => {
      if (result?.paymentTxId) await pollStatus(result.paymentTxId)
    },
    POLL_MS,
    Boolean(result?.paymentTxId && !mapValue(STATUS, result.status, undefined)),
  )

  const selectedMethod = methods.find((m) => m.id === methodId)
  const selectedFee = useMemo(() => {
    // Hitung biaya dari metode untuk pratinjau total (sumber kebenaran: server)
    if (!selectedMethod?.fee) return 0
    const f = selectedMethod.fee
    if (f.type === "free") return 0
    if (f.type === "flat") return f.amount
    if (f.type === "percent") return Math.round((amount * f.value) / 100)
    if (f.type === "combined") {
      const pct = f.percent ? Math.round((amount * f.percent) / 100) : 0
      const fixed = f.fixed ?? 0
      let total = pct + fixed
      if (f.freeLimit && amount >= f.freeLimit) total = 0
      if (f.minFee != null) total = Math.max(total, f.minFee)
      if (f.maxFee != null) total = Math.min(total, f.maxFee)
      return total
    }
    return 0
  }, [selectedMethod, amount])

  const canContinueAmount = isValidAmount(amount, AMOUNT_LIMITS.topup)
  const canPay =
    !loading &&
    !error &&
    canContinueAmount &&
    isTopupMethod(methodId) &&
    canUsePaymentMethod(selectedMethod, amount)

  const goNext = useCallback(() => {
    if (step === "amount" && canContinueAmount) {
      setStep("method")
      return
    }
  }, [step, canContinueAmount])

  const goBack = useCallback(() => {
    if (step === "method") {
      setStep("amount")
      return true
    }
    if (step === "result") {
      // Jangan kembali ke form saat pembayaran sedang aktif; biarkan back
      // sistem menutup layar.
      return false
    }
    return false
  }, [step])

  const handlePay = useCallback(async () => {
    if (!canPay || !isTopupMethod(methodId) || submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    try {
      const res = await api.wallet.createTopup({ amount, method: methodId })
      if (!res?.paymentTxId) throw new Error("Missing payment transaction ID")
      setResult(res)
      setStep("result")
      setStatusError(null)
      toast.show({ title: "Instruksi pembayaran dibuat", tone: "success" })
    } catch (err) {
      toast.show({
        title: "Top-up belum dapat dibuat",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }, [canPay, amount, methodId, toast.show])

  // Intersep tombol back agar kembali ke langkah sebelumnya, bukan langsung
  // keluar layar, selama bukan di langkah hasil.
  const handleBack = useCallback(() => {
    if (!goBack()) {
      if (router.canGoBack()) router.back()
      else router.replace(ROUTES.wallet)
    }
  }, [goBack, router])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title="Isi Saldo"
        progress={progress}
        onBack={step === "amount" || step === "result" ? undefined : handleBack}
        showBack={step === "method"}
        safeArea={false}
      />

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        {step === "amount" ? (
          // Langkah nominal: konten terpusat — hero di tengah, keypad di
          // bawah; footer CTA tunggal konsisten dengan pola register.
          <View className="flex-1">
            <ScrollView
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerClassName="px-6"
            >
              <FadeIn duration="fast">
                <View className="items-center gap-2 pt-6">
                  <Heading level={1} className="text-center text-balance">
                    Masukkan nominal
                  </Heading>
                  <Text variant="body" tone="secondary" className="text-center text-pretty">
                    Pilih atau ketik jumlah saldo yang ingin Anda isi. Minimal{" "}
                    Rp{AMOUNT_LIMITS.topup.minimum.toLocaleString("id-ID")}.
                  </Text>
                </View>
              </FadeIn>
            </ScrollView>

            <View className="px-0">
              <AmountKeypad
                value={amount}
                onChange={setAmount}
                min={AMOUNT_LIMITS.topup.minimum}
                max={AMOUNT_LIMITS.topup.maximum}
                presets={AMOUNT_PRESETS.topup}
                actionKey="check"
                actionEnabled={canContinueAmount}
                onAction={goNext}
              />
            </View>

            <View
              className="w-full border-t border-border bg-background px-6 pt-4"
              style={{ paddingBottom: Math.max(tokens.space[4], insets.bottom) }}
            >
              <Button
                onPress={goNext}
                disabled={!canContinueAmount}
                haptic
                loading={false}
              >
                Lanjutkan
              </Button>
            </View>
          </View>
        ) : step === "method" ? (
          // Langkah pilih metode: ringkasan + daftar metode, CTA "Bayar".
          <View className="flex-1">
            <ScrollView
              className="flex-1"
              contentContainerClassName="px-6 pb-6 pt-6"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <FadeIn duration="fast">
                <View className="gap-4">
                  <View className="gap-2">
                    <Heading level={1} className="text-balance">
                      Pilih metode pembayaran
                    </Heading>
                    <Text variant="body" tone="secondary" className="text-pretty">
                      Pilih cara top-up yang Anda inginkan. Biaya admin (jika ada) akan
                      ditampilkan di samping metode.
                    </Text>
                  </View>

                  <TransactionSummary
                    label="Nominal top-up"
                    amount={amount}
                    amountTone="primary"
                    subtitle={selectedMethod ? selectedMethod.name : "Pilih metode di bawah"}
                    totalLabel="Total yang dibayar"
                    totalValue={amount + selectedFee}
                    totalHint={selectedFee > 0 ? "Termasuk biaya admin" : "Tanpa biaya admin"}
                  />

                  {loading ? (
                    <ListLoading />
                  ) : error ? (
                    <ErrorState
                      compact
                      title="Gagal memuat metode"
                      description={error}
                      onRetry={() => void methodsQuery.reload()}
                    />
                  ) : methods.length ? (
                    <PaymentMethodSelector
                      methods={methods}
                      amount={amount}
                      value={methodId ?? undefined}
                      onChange={setMethodId}
                    />
                  ) : (
                    <EmptyState
                      icon={WalletIcon}
                      title="Metode pembayaran belum tersedia"
                      description="Metode top-up sedang tidak tersedia. Coba lagi nanti."
                    />
                  )}
                </View>
              </FadeIn>
            </ScrollView>

            <View
              className="w-full border-t border-border bg-background px-6 pt-4"
              style={{ paddingBottom: Math.max(tokens.space[4], insets.bottom) }}
            >
              <Button
                onPress={() => void handlePay()}
                loading={submitting}
                disabled={!canPay}
                haptic
              >
                Bayar sekarang
              </Button>
              <Button variant="ghost" onPress={handleBack} disabled={submitting}>
                Kembali
              </Button>
            </View>
          </View>
        ) : (
          // Langkah hasil (instruksi / status pembayaran)
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="px-6 pt-6"
          >
            <FadeIn duration="fast">
              <View className="gap-4">
                <TopupStatusCard
                  status={
                    mapValue(
                      STATUS,
                      result?.status,
                      result?.status === "PENDING" ? "PENDING" : "UNKNOWN",
                    )
                  }
                  amount={result?.amount ?? amount}
                  method={result?.method ?? methodId ?? ""}
                  methodLabel={
                    methods.find((m) => m.id === (result?.method ?? methodId))?.name ??
                    result?.method ??
                    ""
                  }
                  paymentCode={result?.paymentCode ?? undefined}
                  qrString={result?.qrString ?? undefined}
                  reference={result?.reference ?? undefined}
                  expiresAt={result?.expiresAt ? new Date(result.expiresAt) : undefined}
                  refreshing={statusLoading}
                  onRefresh={() => result && void pollStatus(result.paymentTxId)}
                  onDone={() => router.replace(ROUTES.topupHistory)}
                  onRetry={() => {
                    setResult(null)
                    setStatusError(null)
                    setStep("method")
                  }}
                  onCopy={(value) => void copy(value)}
                  copied={copied}
                />
                {statusError ? (
                  <ErrorState
                    compact
                    title="Status belum dapat diperbarui"
                    description={statusError}
                    onRetry={() => result && void pollStatus(result.paymentTxId)}
                  />
                ) : null}
              </View>
            </FadeIn>
          </ScrollView>
        )}
      </KeyboardAvoiding>
    </Screen>
  )
}
