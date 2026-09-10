/**
 * Kahade — Tarik Dana (withdraw) v2 — alur 4 langkah dengan separator progress,
 * keypad nominal terpusat, dan kartu konfirmasi eksklusif.
 *
 * Alur (4 langkah, tanpa "Langkah X/Y"):
 *   1. Nominal     — AmountKeypad terpusat
 *   2. Rekening    — pilih rekening bank + ringkasan
 *   3. Verifikasi  — PIN (bottom sheet, konteks nominal+rekening); OTP bila required
 *   4. Selesai     — ringkasan hasil
 *
 * API:
 *   GET  /v1/bank-accounts              → BankAccount[]
 *   POST /v1/wallet/withdraw            → { txId, status, requiresOtp }
 *   POST /v1/wallet/withdraw/confirm-otp
 *   POST /v1/wallet/withdraw/resend-otp
 *   POST /v1/wallet/withdraw/cancel
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Bank as BankIcon } from "phosphor-react-native"

import { api, userMessage, type WithdrawDto } from "@/lib/api"
import type { BankAccount } from "@/lib/api/bank-accounts"
import { formatRupiah, maskAccountNumber } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { AMOUNT_LIMITS, AMOUNT_PRESETS, isValidAmount } from "@/lib/financial"
import { useApiQuery } from "@/lib/use-api-query"
import { walletTransactionStatus } from "@/lib/wallet-labels"

import { AmountKeypad } from "@/components/ui/amount-keypad"
import { BankAccountListItem } from "@/components/ui/bank-account-list-item"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FadeIn } from "@/components/ui/fade-in"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { KeyValue } from "@/components/ui/key-value"
import { ListLoading } from "@/components/ui/paginated-list"
import { OtpInput } from "@/components/ui/otp-input"
import { PinInput } from "@/components/ui/pin-input"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TransactionSummary } from "@/components/ui/transaction-summary"
import { useToast } from "@/components/ui/toast"

const MIN_AMOUNT = AMOUNT_LIMITS.withdraw.minimum
const MAX_AMOUNT = AMOUNT_LIMITS.withdraw.maximum
const PRESETS = AMOUNT_PRESETS.withdraw
const TOTAL_STEPS = 4

type Step = "amount" | "account" | "verify" | "done"

export default function WithdrawScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const accountsQuery = useApiQuery<BankAccount[]>("withdraw-accounts", async (signal) => {
    return (await api.bankAccounts.listBankAccounts(signal)) ?? []
  })
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const { loading, error } = accountsQuery

  // Ambil saldo dompet untuk membantu user pilih nominal (opsional)
  const balanceQuery = useApiQuery<{ balance: number }>("wallet-overview", async (signal) => {
    try {
      const w = await api.wallet.getWallet(signal)
      return { balance: w.balance ?? 0 }
    } catch {
      return { balance: 0 }
    }
  })
  const balance = balanceQuery.data?.balance

  const [amount, setAmount] = useState(0)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>("amount")
  const [verifyMode, setVerifyMode] = useState<"pin" | "otp">("pin")
  const [pinError, setPinError] = useState<string | undefined>()
  const [otpError, setOtpError] = useState<string | undefined>()
  const [txId, setTxId] = useState<string | null>(null)
  const submitLock = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof api.wallet.createWithdraw>
  > | null>(null)

  useEffect(() => {
    if (accounts.length === 0) return
    setAccountId((prev) =>
      accounts.some((a) => a.id === prev)
        ? prev
        : (accounts.find((a) => a.isPrimary)?.id ?? accounts[0]?.id ?? null),
    )
  }, [accounts])

  const stepIndex: Record<Step, number> = { amount: 1, account: 2, verify: 3, done: 4 }
  const progress = stepIndex[step] / TOTAL_STEPS

  const selected = accounts.find((a) => a.id === accountId)

  const canContinueAmount = isValidAmount(amount, AMOUNT_LIMITS.withdraw)
  const canContinueAccount =
    canContinueAmount &&
    !!selected &&
    accounts.some((a) => a.id === accountId) &&
    !loading &&
    !error

  const handleBack = useCallback(() => {
    if (step === "account") {
      setStep("amount")
      return
    }
    if (step === "verify") {
      // Jangan kembali dari PIN/OTP langsung keluar; tutup sheet saja.
      setStep("account")
      setVerifyMode("pin")
      return
    }
    if (router.canGoBack()) router.back()
    else router.replace(ROUTES.wallet)
  }, [step])

  const handleSubmitForm = useCallback(() => {
    if (!canContinueAccount) return
    setPinError(undefined)
    setVerifyMode("pin")
    setStep("verify")
  }, [canContinueAccount])

  const handlePin = useCallback(
    async (value: string) => {
      if (!canContinueAccount || submitLock.current) return
      submitLock.current = true
      setSubmitting(true)
      setPinError(undefined)
      try {
        const dto: WithdrawDto = { amount, bankAccountId: accountId!, pin: value }
        const res = await api.wallet.createWithdraw(dto)
        setResult(res)
        if ((res.requiresOtp || res.status === "PENDING_OTP") && res.txId) {
          setTxId(res.txId)
          setVerifyMode("otp")
        } else {
          setStep("done")
          toast.show({
            title:
              walletTransactionStatus(res.status) === "SUCCESS"
                ? "Penarikan berhasil"
                : "Permintaan penarikan diterima",
            tone: walletTransactionStatus(res.status) === "SUCCESS" ? "success" : "info",
          })
        }
      } catch (err) {
        setPinError(`${userMessage(err)} Periksa riwayat sebelum mengirim ulang.`)
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [amount, accountId, canContinueAccount, toast.show],
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
      } catch (err) {
        setOtpError(userMessage(err))
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
    } catch (err) {
      toast.show({ title: "Gagal mengirim OTP", description: userMessage(err), tone: "danger" })
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
    } catch (err) {
      setOtpError(userMessage(err))
    } finally {
      submitLock.current = false
      setCancelling(false)
    }
  }, [txId, toast.show])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title="Tarik Dana"
        progress={progress}
        onBack={step === "amount" || step === "done" ? undefined : handleBack}
        showBack={step === "account" || step === "verify"}
        safeArea={false}
      />

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        {step === "amount" ? (
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
                    Tarik ke rekening
                  </Heading>
                  <Text variant="body" tone="secondary" className="text-center text-pretty">
                    Masukkan jumlah dana yang akan ditarik ke rekening bank Anda.
                  </Text>
                </View>
              </FadeIn>
            </ScrollView>

            <AmountKeypad
              value={amount}
              onChange={setAmount}
              min={MIN_AMOUNT}
              max={balance && balance > 0 ? Math.min(MAX_AMOUNT, balance) : MAX_AMOUNT}
              presets={PRESETS}
              balance={balance}
              actionKey="check"
              actionEnabled={canContinueAmount}
              onAction={() => setStep("account")}
            />

            <View
              className="w-full border-t border-border bg-background px-6 pt-4"
              style={{ paddingBottom: Math.max(tokens.space[4], insets.bottom) }}
            >
              <Button
                onPress={() => setStep("account")}
                disabled={!canContinueAmount}
                haptic
              >
                Lanjutkan
              </Button>
            </View>
          </View>
        ) : step === "account" ? (
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
                      Pilih rekening tujuan
                    </Heading>
                    <Text variant="body" tone="secondary" className="text-pretty">
                      Dana akan ditransfer ke rekening yang Anda pilih. Pastikan rekening
                      aktif atas nama Anda.
                    </Text>
                  </View>

                  <TransactionSummary
                    label="Nominal penarikan"
                    amount={amount}
                    amountTone="primary"
                    subtitle={selected ? `${selected.bankName} • ${maskAccountNumber(selected.accountNumber)}` : "Pilih rekening di bawah"}
                  >
                    {selected ? (
                      <KeyValue
                        label="Pemilik rekening"
                        value={selected.accountName ?? "—"}
                      />
                    ) : null}
                  </TransactionSummary>

                  {loading ? (
                    <ListLoading />
                  ) : error ? (
                    <ErrorState
                      compact
                      title="Gagal memuat rekening"
                      description={error}
                      onRetry={() => void accountsQuery.reload()}
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
                          Tambah rekening
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
              </FadeIn>
            </ScrollView>

            <View
              className="w-full border-t border-border bg-background px-6 pt-4"
              style={{ paddingBottom: Math.max(tokens.space[4], insets.bottom) }}
            >
              <Button
                onPress={handleSubmitForm}
                disabled={!canContinueAccount}
                haptic
              >
                Lanjut ke verifikasi
              </Button>
              <Button variant="ghost" onPress={handleBack} disabled={submitting}>
                Kembali
              </Button>
            </View>
          </View>
        ) : step === "done" ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="px-6 pt-6"
          >
            <FadeIn duration="fast">
              <View className="gap-4">
                <TransactionSummary
                  label={
                    walletTransactionStatus(result?.status) === "SUCCESS"
                      ? "Penarikan berhasil"
                      : walletTransactionStatus(result?.status) === "FAILED"
                        ? "Penarikan gagal"
                        : "Permintaan diterima"
                  }
                  amount={amount}
                  amountTone={
                    walletTransactionStatus(result?.status) === "SUCCESS"
                      ? "success"
                      : walletTransactionStatus(result?.status) === "FAILED"
                        ? "danger"
                        : "primary"
                  }
                  subtitle={
                    selected
                      ? `${selected.bankName} ${maskAccountNumber(selected.accountNumber)} a.n. ${selected.accountName ?? ""}`
                      : undefined
                  }
                >
                  {result?.txId ? (
                    <KeyValue label="Nomor referensi" value={result.txId} mono />
                  ) : null}
                </TransactionSummary>

                <Text variant="body" tone="secondary" className="text-pretty">
                  {walletTransactionStatus(result?.status) === "SUCCESS"
                    ? "Dana akan masuk ke rekening tujuan dalam beberapa saat tergantung proses bank."
                    : "Permintaan penarikan Anda sedang diproses. Periksa riwayat untuk status terakhir."}
                </Text>

                <Button variant="secondary" onPress={() => router.replace(ROUTES.withdrawHistory)}>
                  Lihat riwayat penarikan
                </Button>
                <Button variant="ghost" fullWidth={false} onPress={() => router.replace(ROUTES.wallet)}>
                  Kembali ke dompet
                </Button>
              </View>
            </FadeIn>
          </ScrollView>
        ) : null}
      </KeyboardAvoiding>

      {/* Step verifikasi (PIN/OTP) dalam BottomSheet agar konteks di belakang
          tetap terlihat */}
      <BottomSheet
        visible={step === "verify"}
        onRequestClose={() => {
          if (!submitting && !cancelling) {
            setStep("account")
            setVerifyMode("pin")
          }
        }}
        title={verifyMode === "otp" ? "Konfirmasi OTP" : "Verifikasi PIN"}
        description={
          verifyMode === "otp"
            ? "Masukkan kode verifikasi yang dikirim oleh layanan untuk menyelesaikan penarikan."
            : `Masukkan PIN dompet Anda untuk menarik ${formatRupiah(amount)} ke ${selected?.bankName ?? "rekening Anda"} ${selected ? maskAccountNumber(selected.accountNumber) : ""}.`
        }
        avoidKeyboard
      >
        {verifyMode === "otp" ? (
          <View className="gap-4">
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
                variant="destructive"
                fullWidth={false}
                loading={cancelling}
                disabled={submitting}
                onPress={() => void handleCancelOtp()}
              >
                Batalkan penarikan
              </Button>
            </View>
          </View>
        ) : (
          <PinInput
            mode="enter"
            onComplete={(p) => void handlePin(p)}
            errorText={pinError}
            disabled={submitting}
          />
        )}
      </BottomSheet>
    </Screen>
  )
}
