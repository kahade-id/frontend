import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { useApiQuery } from "@/lib/use-api-query"
import { AmountInput } from "@/components/ui/amount-input"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Crossfade, FadeIn } from "@/components/ui/fade-in"
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
  /**
   * Audit: metode pembayaran dirakit manual (useState loading/error/refreshing
   * + useEffect). Cacat yang terbukti dari kode lama: `refresh` memanggil
   * `fetchMethods()` yang SAMA dengan muat-awal, dan fungsi itu membuka dengan
   * `setLoading(true)`. Karena cabang render `loading ? <ListLoading/>` duduk
   * di atas `<PaymentMethodSelector>`, tarik-untuk-menyegarkan MENGGANTI
   * daftar metode dengan kerangka — di layar tempat user sedang memilih cara
   * membayar. Request juga tidak dibatalkan saat layar ditutup.
   *
   * `useApiQuery` memisahkan `refreshing` dari `loading` sehingga data lama
   * tetap tampil selama penyegaran, dan meneruskan AbortSignal ke adapter.
   */
  const methodsQuery = useApiQuery<PaymentMethod[]>("topup-methods", async (signal) => {
    const raw = await api.wallet.getPaymentMethods(signal)
    return toPaymentMethods(raw).filter((method) => isTopupMethod(method.id))
  })
  const methods = useMemo(() => methodsQuery.data ?? [], [methodsQuery.data])
  const { loading, error } = methodsQuery
  const [pollRefreshing, setPollRefreshing] = useState(false)
  const refreshing = methodsQuery.refreshing || pollRefreshing
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

  /**
   * Pilih metode default begitu data tiba. Logika identik dengan yang lama:
   * pilihan user dipertahankan selama masih ada dan masih bisa dipakai;
   * ambil yang pertama tidak `unavailable`. Berupa effect (bukan di dalam
   * fetcher) karena `methodId` adalah state UI, bukan bagian dari data server.
   */
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
    // Cabang polling punya indikator sendiri; cabang metode memakai
    // `methodsQuery.refreshing` supaya daftar tidak dikosongkan.
    if (result?.paymentTxId) {
      setPollRefreshing(true)
      try {
        await pollStatus(result.paymentTxId)
      } finally {
        setPollRefreshing(false)
      }
      return
    }
    await methodsQuery.refresh()
  }, [result?.paymentTxId, pollStatus, methodsQuery.refresh])

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
            <Button loading={submitting} disabled={!canPay} haptic onPress={() => void handlePay()}>
              Lanjutkan pembayaran
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
        {/* v2: kartu status hasil reveal — momen "instruksi dibuat" adalah
            hasil kerja pengguna, jadi ia masuk dengan gerak. */}
        {result ? (
          <FadeIn duration="fast">
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
          </FadeIn>
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
            {/* v2: skeleton → metode crossfade (signature moment). */}
            <Crossfade loading={loading} skeleton={<ListLoading />}>
              {error ? (
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
            </Crossfade>
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
