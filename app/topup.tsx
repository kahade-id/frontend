import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
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
import { AmountInput } from "@/components/ui/amount-input"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { ListLoading } from "@/components/ui/paginated-list"
import {
  PaymentMethodSelector,
  canUsePaymentMethod,
  type PaymentMethod,
} from "@/components/ui/payment-method-selector"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { TopupStatusCard, type PaymentStatus } from "@/components/ui/topup-status-card"
import { useToast } from "@/components/ui/toast"
import { mapValue } from "@/lib/has-own"

const POLL_MS = 5000

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

export default function TopupScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copied, copy } = useCopy()
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
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

  const fetchMethods = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const raw = await api.wallet.getPaymentMethods()
      const choices = toPaymentMethods(raw).filter((method) => isTopupMethod(method.id))
      setMethods(choices)
      setMethodId((previous) =>
        choices.some((m) => m.id === previous && !m.unavailable)
          ? previous
          : (choices.find((m) => !m.unavailable)?.id ?? null),
      )
    } catch (error) {
      setError(userMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void fetchMethods()
  }, [fetchMethods])

  const pollStatus = useCallback(async (id: string) => {
    if (pollLock.current) return
    pollLock.current = true
    setStatusLoading(true)
    try {
      const status = await api.wallet.getTopupStatus(id)
      // Status-only responses must not erase the original amount/VA/QR instructions.
      setResult((previous) =>
        previous?.paymentTxId === id ? { ...previous, ...status, paymentTxId: id } : previous,
      )
      setStatusError(null)
    } catch (error) {
      setStatusError(userMessage(error))
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

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      if (result?.paymentTxId) await pollStatus(result.paymentTxId)
      else await fetchMethods()
    } finally {
      setRefreshing(false)
    }
  }, [result?.paymentTxId, pollStatus, fetchMethods])

  const canPay =
    !loading &&
    !error &&
    isValidAmount(amount, AMOUNT_LIMITS.topup) &&
    isTopupMethod(methodId) &&
    canUsePaymentMethod(
      methods.find((m) => m.id === methodId),
      amount,
    )
  const handlePay = useCallback(async () => {
    if (!canPay || !isTopupMethod(methodId) || submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    try {
      const res = await api.wallet.createTopup({ amount, method: methodId })
      if (!res?.paymentTxId) throw new Error("Missing payment transaction ID")
      setResult(res)
      setStatusError(null)
      toast.show({ title: "Instruksi pembayaran dibuat", tone: "success" })
    } catch (error) {
      toast.show({
        title: "Top-up belum dapat dibuat",
        description: userMessage(error),
        tone: "danger",
      })
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }, [canPay, amount, methodId, toast.show])

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
        result ? undefined : (
          <View>
            <Button loading={submitting} disabled={!canPay} onPress={() => void handlePay()}>
              Lanjutkan Pembayaran
            </Button>
          </View>
        )
      }
    >
      <Header title="Isi Saldo" />
      <PullToRefresh
        onRefresh={refresh}
        refreshing={refreshing}
        contentContainerClassName="px-6 pt-3"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {result ? (
          <View className="gap-4">
            <TopupStatusCard
              status={
                mapValue(
                  STATUS,
                  result.status,
                  result.status === "PENDING" ? "PENDING" : "UNKNOWN",
                )
              }
              amount={result.amount}
              method={result.method}
              methodLabel={methods.find((m) => m.id === result.method)?.name ?? result.method}
              paymentCode={result.paymentCode ?? undefined}
              qrString={result.qrString ?? undefined}
              reference={result.reference ?? undefined}
              expiresAt={result.expiresAt ? new Date(result.expiresAt) : undefined}
              refreshing={statusLoading}
              onRefresh={() => void pollStatus(result.paymentTxId)}
              onDone={() => router.replace(ROUTES.topupHistory)}
              onRetry={() => {
                setResult(null)
                setStatusError(null)
              }}
              onCopy={(value) => void copy(value)}
              copied={copied}
            />
            {statusError ? (
              <ErrorState
                compact
                title="Status belum dapat diperbarui"
                description={statusError}
                onRetry={() => void pollStatus(result.paymentTxId)}
              />
            ) : null}
          </View>
        ) : (
          <View className="gap-4">
            <SectionHeader title="Pilih nominal" />
            <AmountInput
              value={amount}
              onChange={setAmount}
              min={AMOUNT_LIMITS.topup.minimum}
              max={AMOUNT_LIMITS.topup.maximum}
              presets={AMOUNT_PRESETS.topup}
              label="Nominal top-up"
            />
            <SectionHeader title="Metode pembayaran" />
            {loading ? (
              <ListLoading />
            ) : error ? (
              <ErrorState
                compact
                title="Gagal memuat metode"
                description={error}
                onRetry={() => void fetchMethods()}
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
        )}
      </PullToRefresh>
    </Screen>
  )
}
