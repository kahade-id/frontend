/**
 * Screen — Isi Saldo (top-up).
 *
 * POST /v1/wallet/topup -> GET /v1/wallet/topup-status/{paymentTxId} (poll).
 * DP: 10.000 – 50.000.000 IDR (TopupDto).
 *
 * Alur: pilih nominal → pilih metode (GET /v1/wallet/payment-methods) →
 * bayar → <TopupStatusCard> menampilkan VA/QRIS/retail sampai SUCCESS/EXPIRED.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Wallet as WalletIcon } from "phosphor-react-native"

import { api, type TopupDto } from "@/lib/api"
import { useCopy } from "@/lib/clipboard"
import { toPaymentMethods } from "@/lib/payment-methods"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { AmountInput } from "@/components/ui/amount-input"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PaymentMethodSelector, type PaymentMethod } from "@/components/ui/payment-method-selector"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { TopupStatusCard, type PaymentStatus } from "@/components/ui/topup-status-card"
import { useToast } from "@/components/ui/toast"

const MIN_AMOUNT = 10_000
const MAX_AMOUNT = 50_000_000
const PRESETS = [50_000, 100_000, 250_000, 500_000, 1_000_000]
const POLL_MS = 3000

/** Status API → PaymentStatus komponen (status di luar peta = masih menunggu). */
const STATUS_MAP: Partial<Record<string, PaymentStatus>> = {
  SUCCESS: "SUCCESS",
  COMPLETED: "SUCCESS",
  PAID: "SUCCESS",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
}
const PENDING_STATUSES = ["PENDING", "WAITING", "UNPAID"]

export default function TopupScreen() {
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
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.wallet.createTopup>> | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchMethods = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const raw = await api.wallet.getPaymentMethods()
      setMethods(toPaymentMethods(raw))
      setMethodId((prev) => prev ?? (raw?.[0]?.code ?? null))
    } catch {
      setError("Gagal memuat metode pembayaran.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMethods()
  }, [fetchMethods])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchMethods()
    setRefreshing(false)
  }, [fetchMethods])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const pollStatus = useCallback(
    async (paymentTxId: string) => {
      try {
        setStatusLoading(true)
        const status = await api.wallet.getTopupStatus(paymentTxId)
        setResult(status)
        if (!["PENDING", "WAITING", "UNPAID"].includes(status.status)) stopPolling()
      } catch {
        // Poll gagal: biarkan kartu terakhir tampil; user bisa tarik-refresh.
      } finally {
        setStatusLoading(false)
      }
    },
    [stopPolling],
  )

  useEffect(() => {
    if (!result?.paymentTxId || !PENDING_STATUSES.includes(result.status)) return
    pollRef.current = setInterval(() => void pollStatus(result.paymentTxId!), POLL_MS)
    return stopPolling
  }, [result?.paymentTxId, result?.status, pollStatus, stopPolling])

  const handlePay = useCallback(async () => {
    if (!amount || !methodId) return
    setSubmitting(true)
    try {
      const dto: TopupDto = { amount, method: methodId as TopupDto["method"] }
      const res = await api.wallet.createTopup(dto)
      setResult(res)
      toast.show({ title: "Instruksi pembayaran dibuat", tone: "success", duration: 3000 })
    } catch {
      toast.show({ title: "Top-up gagal", description: "Silakan coba lagi.", tone: "danger" })
    } finally {
      setSubmitting(false)
    }
  }, [amount, methodId, toast.show])

  const handleReset = useCallback(() => {
    stopPolling()
    setResult(null)
  }, [stopPolling])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Isi Saldo" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-0"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {result ? (
          <View style={{ marginTop: tokens.space[3] }}>
            <TopupStatusCard
              status={STATUS_MAP[result.status] ?? "PENDING"}
              amount={result.amount}
              method={result.method}
              methodLabel={
                methods.find((m) => m.id === result.method)?.name ?? result.method
              }
              paymentCode={result.paymentCode ?? undefined}
              qrString={result.qrString ?? undefined}
              reference={result.reference ?? undefined}
              expiresAt={result.expiresAt ? new Date(result.expiresAt) : undefined}
              refreshing={statusLoading}
              onRefresh={() => result.paymentTxId && void pollStatus(result.paymentTxId)}
              onDone={() => router.replace(ROUTES.topupHistory)}
              onRetry={handleReset}
              onCopy={(v) => void copy(v)}
              copied={copied}
              labels={{ status: { PENDING: "Menunggu pembayaran" } }}
            />
          </View>
        ) : (
          <View className="gap-4 px-6" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Pilih nominal" inset />
            <AmountInput
              value={amount}
              onChange={setAmount}
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              presets={PRESETS}
              label="Nominal top-up"
            />

            <SectionHeader title="Metode pembayaran" inset />
            {loading ? (
              <EmptyState icon={WalletIcon} title="Memuat metode…" />
            ) : error ? (
              <ErrorState
                compact
                title="Gagal memuat metode"
                description={error}
                onRetry={() => void fetchMethods()}
              />
            ) : methods.length === 0 ? (
              <EmptyState icon={WalletIcon} title="Belum ada metode" />
            ) : (
              <PaymentMethodSelector
                methods={methods}
                amount={amount}
                value={methodId ?? undefined}
                onChange={setMethodId}
              />
            )}

            <Button
              loading={submitting}
              disabled={!amount || !methodId || amount < MIN_AMOUNT}
              onPress={() => void handlePay()}
            >
              Lanjutkan Pembayaran
            </Button>
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
