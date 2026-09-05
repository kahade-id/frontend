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
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Bank as BankIcon } from "phosphor-react-native"

import { api, type WithdrawDto } from "@/lib/api"
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

const MIN_AMOUNT = 50_000
const MAX_AMOUNT = 50_000_000
const PRESETS = [100_000, 250_000, 500_000, 1_000_000, 5_000_000]

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
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.wallet.createWithdraw>> | null>(null)

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const list = await api.bankAccounts.listBankAccounts()
      setAccounts(list ?? [])
      setAccountId((prev) => prev ?? (list?.[0]?.id ?? null))
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
    if (!amount || !accountId) return
    setPinError(undefined)
    setStep("pin")
  }, [amount, accountId])

  const handlePin = useCallback(
    async (value: string) => {
      if (!amount || !accountId) return
      setSubmitting(true)
      setPinError(undefined)
      try {
        const dto: WithdrawDto = { amount, bankAccountId: accountId, pin: value }
        const res = await api.wallet.createWithdraw(dto)
        setResult(res)
        if (res.requiresOtp || res.status === "PENDING_OTP") {
          setTxId(res.txId)
          setStep("otp")
        } else {
          setStep("done")
        }
      } catch {
        setPinError("PIN salah atau saldo tidak mencukupi. Coba lagi.")
      } finally {
        setSubmitting(false)
      }
    },
    [amount, accountId],
  )

  const handleConfirmOtp = useCallback(async (otp: string) => {
    if (!txId) return
    setSubmitting(true)
    setOtpError(undefined)
    try {
      const res = await api.wallet.confirmWithdrawOtp({ txId, otp })
      setResult(res)
      setStep("done")
      toast.show({ title: "Penarikan berhasil diproses", tone: "success" })
    } catch {
      setOtpError("Kode OTP salah atau kedaluwarsa. Periksa lalu coba lagi.")
    } finally {
      setSubmitting(false)
    }
  }, [txId, toast.show])

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
    if (!txId) return
    setCancelling(true)
    try {
      await api.wallet.cancelWithdraw({ txId })
      toast.show({ title: "Penarikan dibatalkan", tone: "success" })
    } catch {
      // Sudah kedaluwarsa/diproses di server — tetap kembalikan pengguna ke form.
      toast.show({ title: "Penarikan tidak bisa dibatalkan lagi", tone: "danger" })
    } finally {
      setCancelling(false)
      setTxId(null)
      setResult(null)
      setStep("form")
    }
  }, [txId, toast.show])

  const selected = accounts.find((a) => a.id === accountId)

  return (
    <Screen edges={["top"]} padded={false} footer={
      step === "form" ? (
        <View className="px-6 pb-4">
          <Button
            fullWidth
            disabled={!amount || amount < MIN_AMOUNT || !accountId}
            onPress={handleSubmitForm}
          >
            Lanjut
          </Button>
        </View>
      ) : undefined
    }>
      <Header title="Tarik Dana" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
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
            <PinInput mode="enter" onComplete={(p) => void handlePin(p)} errorText={pinError} disabled={submitting} />
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
              Bank Anda meminta konfirmasi tambahan. Masukkan kode 6 digit yang dikirim.
            </Text>
            <OtpInput
              length={6}
              onComplete={(code) => void handleConfirmOtp(code)}
              errorText={otpError}
              disabled={submitting || cancelling}
            />
            <View className="flex-row flex-wrap gap-2">
              <Button variant="ghost" fullWidth={false} onPress={() => void handleResend()} disabled={submitting}>
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
            <SectionHeader title="Berhasil diproses" />
            <Text variant="body">
              Penarikan {formatRupiah(amount)} sedang diproses ke {selected?.bankName}
              {selected ? ` ${maskAccountNumber(selected.accountNumber)}` : ""}.
            </Text>
            {result?.txId ? (
              <Text variant="monoBody" tone="secondary">
                Ref: {result.txId}
              </Text>
            ) : null}
            <Button variant="secondary" onPress={() => router.replace(ROUTES.withdrawHistory)}>
              Lihat Riwayat Penarikan
            </Button>
            <Button variant="ghost" fullWidth={false} onPress={() => router.back()}>
              Kembali ke Dompet
            </Button>
          </View>
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Nominal" inset />
            <AmountInput
              value={amount}
              onChange={setAmount}
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              presets={PRESETS}
              label="Nominal penarikan"
            />

            <SectionHeader title="Rekening tujuan" inset />
            {loading ? (
              <EmptyState icon={BankIcon} title="Memuat rekening…" />
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
                  <Button variant="secondary" fullWidth={false} onPress={() => router.push(ROUTES.bankAccounts)}>
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
