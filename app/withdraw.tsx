import { walletTransactionStatus } from "@/lib/wallet-labels"
import { AMOUNT_LIMITS, AMOUNT_PRESETS, isValidAmount } from "@/lib/financial"
import { LoadingScreen } from "@/components/ui/loading-screen"
/**
 * Screen — Tarik Dana (withdraw).
 *
 * GET /v1/bank-accounts → pilih rekening → PIN (PinInput) →
 * POST /v1/wallet/withdraw (50.000 – 50.000.000) → OTP bila required →
 * POST /v1/wallet/withdraw/confirm-otp (resend via /resend-otp; batal via
 * /withdraw/cancel — hanya PENDING_OTP).
 *
 * Keputusan non-obvious:
 *   - Nominal & nomor rekening diformat lib/format (`formatRupiah`,
 *     `maskAccountNumber`) — bukan `toLocaleString` (§13: format manual,
 *     tanpa Intl, konsisten di semua platform).
 *   - Membatalkan di langkah OTP memanggil `cancelWithdraw` supaya dana yang
 *     sudah ditahan (hold) dilepas — cukup "kembali" akan meninggalkan
 *     penarikan menggantung sampai OTP kedaluwarsa.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Bank as BankIcon } from "phosphor-react-native"

import { api, userMessage, type WithdrawDto } from "@/lib/api"
import { formatRupiah, maskAccountNumber } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { AmountInput } from "@/components/ui/amount-input"
import type { BankAccount } from "@/lib/api/bank-accounts"
import { BankAccountListItem } from "@/components/ui/bank-account-list-item"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { OtpInput } from "@/components/ui/otp-input"
import { PinInput } from "@/components/ui/pin-input"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const MIN_AMOUNT = AMOUNT_LIMITS.withdraw.minimum
const MAX_AMOUNT = AMOUNT_LIMITS.withdraw.maximum
const PRESETS = AMOUNT_PRESETS.withdraw

type Step = "form" | "pin" | "otp" | "done"

export default function WithdrawScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [amount, setAmount] = useState(0)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>("form")
  const [pinError, setPinError] = useState<string | undefined>()
  const [otpError, setOtpError] = useState<string | undefined>()
  const [txId, setTxId] = useState<string | null>(null)
  const submitLock = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof api.wallet.createWithdraw>
  > | null>(null)

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const list = await api.bankAccounts.listBankAccounts()
      setAccounts(list ?? [])
      setAccountId((prev) =>
        list.some((a) => a.id === prev)
          ? prev
          : (list.find((a) => a.isPrimary)?.id ?? list[0]?.id ?? null),
      )
    } catch {
      setError("Gagal memuat rekening bank.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAccounts()
  }, [fetchAccounts])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAccounts()
    setRefreshing(false)
  }, [fetchAccounts])

  const handleSubmitForm = useCallback(() => {
    if (
      submitLock.current ||
      !isValidAmount(amount, AMOUNT_LIMITS.withdraw) ||
      !accountId ||
      !accounts.some((a) => a.id === accountId) ||
      loading ||
      error
    )
      return
    setPinError(undefined)
    setStep("pin")
  }, [amount, accountId, accounts, submitting, loading, error])

  const handlePin = useCallback(
    async (value: string) => {
      if (
        submitLock.current ||
        !isValidAmount(amount, AMOUNT_LIMITS.withdraw) ||
        !accountId ||
        !accounts.some((a) => a.id === accountId) ||
        loading ||
        error
      )
        return
      submitLock.current = true
      setSubmitting(true)
      setPinError(undefined)
      try {
        const dto: WithdrawDto = { amount, bankAccountId: accountId, pin: value }
        const res = await api.wallet.createWithdraw(dto)
        setResult(res)
        if ((res.requiresOtp || res.status === "PENDING_OTP") && res.txId) {
          setTxId(res.txId)
          setStep("otp")
        } else {
          setStep("done")
        }
      } catch (error) {
        setPinError(`${userMessage(error)} Periksa riwayat sebelum mengirim ulang.`)
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [amount, accountId, accounts, loading, error],
  )

  const handleConfirmOtp = useCallback(
    async (otp: string) => {
      if (!txId || submitLock.current) return
      submitLock.current = true
      setSubmitting(true)
      setOtpError(undefined)
      try {
        const res = await api.wallet.confirmWithdrawOtp({ txId, otp })
        setResult(res)
        setStep("done")
        toast.show({
          title:
            walletTransactionStatus(res.status) === "SUCCESS"
              ? "Penarikan selesai"
              : "Konfirmasi penarikan diterima",
          tone: walletTransactionStatus(res.status) === "SUCCESS" ? "success" : "info",
        })
      } catch (error) {
        setOtpError(userMessage(error))
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [txId, toast.show],
  )

  const handleResend = useCallback(async () => {
    if (!txId) return
    try {
      await api.wallet.resendWithdrawOtp({ txId })
      setOtpError(undefined)
      toast.show({ title: "OTP dikirim ulang", tone: "success" })
    } catch {
      toast.show({ title: "Gagal mengirim OTP", tone: "danger" })
    }
  }, [txId, toast.show])

  const handleCancelOtp = useCallback(async () => {
    if (!txId || submitLock.current) return
    submitLock.current = true
    setCancelling(true)
    try {
      await api.wallet.cancelWithdraw({ txId })
      toast.show({ title: "Permintaan pembatalan diterima", tone: "info" })
      router.replace(ROUTES.withdrawHistory)
    } catch (error) {
      // Keep the pending transaction and OTP visible. Failure is NOT cancellation.
      setOtpError(userMessage(error))
    } finally {
      submitLock.current = false
      setCancelling(false)
    }
  }, [txId, toast.show])

  const selected = accounts.find((a) => a.id === accountId)

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
        step === "form" ? (
          <View>
            <Button
              fullWidth
              disabled={
                !isValidAmount(amount, AMOUNT_LIMITS.withdraw) || !accountId || loading || !!error
              }
              onPress={handleSubmitForm}
            >
              Lanjut
            </Button>
          </View>
        ) : undefined
      }
    >
      <Header title="Tarik Dana" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {step === "pin" ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Verifikasi PIN" />
            <Text variant="body" tone="secondary">
              Masukkan PIN dompet Anda untuk menarik{" "}
              <Text variant="monoBody" tone="primary">
                {formatRupiah(amount)}
              </Text>{" "}
              ke {selected?.bankName ?? "rekening Anda"}.
            </Text>
            <PinInput
              mode="enter"
              onComplete={(p) => void handlePin(p)}
              errorText={pinError}
              disabled={submitting}
            />
            <Button
              variant="ghost"
              fullWidth={false}
              onPress={() => setStep("form")}
              disabled={submitting}
            >
              Batal
            </Button>
          </View>
        ) : step === "otp" ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Konfirmasi OTP" />
            <Text variant="body" tone="secondary">
              Selesaikan verifikasi tambahan dengan kode yang dikirim oleh layanan.
            </Text>
            <OtpInput
              length={6}
              onComplete={(code) => void handleConfirmOtp(code)}
              errorText={otpError}
              disabled={submitting || cancelling}
            />
            <View className="flex-row flex-wrap gap-2">
              <Button
                variant="ghost"
                fullWidth={false}
                onPress={() => void handleResend()}
                disabled={submitting}
              >
                Kirim ulang OTP
              </Button>
              <Button
                variant="ghost"
                fullWidth={false}
                loading={cancelling}
                disabled={submitting}
                onPress={() => void handleCancelOtp()}
              >
                Batalkan penarikan
              </Button>
            </View>
          </View>
        ) : step === "done" ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader
              title={
                walletTransactionStatus(result?.status) === "SUCCESS"
                  ? "Penarikan selesai"
                  : walletTransactionStatus(result?.status) === "FAILED"
                    ? "Penarikan gagal"
                    : "Permintaan penarikan diterima"
              }
            />
            <Text variant="body">
              Permintaan penarikan {formatRupiah(amount)} ke {selected?.bankName}
              {selected ? ` ${maskAccountNumber(selected.accountNumber)}` : ""}. Periksa riwayat
              untuk memastikan status terakhir.
            </Text>
            {result?.txId ? (
              <Text variant="monoBody" tone="secondary">
                Ref: {result.txId}
              </Text>
            ) : null}
            <Button variant="secondary" onPress={() => router.replace(ROUTES.withdrawHistory)}>
              Lihat Riwayat Penarikan
            </Button>
            <Button variant="ghost" fullWidth={false} onPress={() => router.replace(ROUTES.wallet)}>
              Kembali ke Dompet
            </Button>
          </View>
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Nominal" />
            <AmountInput
              value={amount}
              onChange={setAmount}
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              presets={PRESETS}
              label="Nominal penarikan"
            />

            <SectionHeader title="Rekening tujuan" />
            {loading ? (
              <LoadingScreen message="Memuat rekening…" />
            ) : error ? (
              <ErrorState
                compact
                title="Gagal memuat rekening"
                description={error}
                onRetry={() => void fetchAccounts()}
              />
            ) : accounts.length === 0 ? (
              <EmptyState
                icon={BankIcon}
                title="Belum ada rekening"
                description="Tambahkan rekening bank terlebih dahulu untuk menarik dana."
                action={
                  <Button
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => router.push(ROUTES.bankAccounts)}
                  >
                    Tambah Rekening
                  </Button>
                }
              />
            ) : (
              <View className="gap-2">
                {accounts.map((acc, i) => (
                  <BankAccountListItem
                    key={acc.id}
                    bankName={acc.bankName ?? acc.bankCode}
                    bankCode={acc.bankCode}
                    accountNumber={acc.accountNumber}
                    accountHolder={acc.accountName}
                    primary={acc.isPrimary}
                    verified={acc.isVerified}
                    selectable
                    selected={acc.id === accountId}
                    divider={i < accounts.length - 1}
                    onPress={() => setAccountId(acc.id)}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
