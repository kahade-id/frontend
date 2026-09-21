/**
 * Kahade — Tarik Dana (withdraw) v2 — alur 3 langkah dengan separator progress,
 * keypad nominal terpusat, dan kartu konfirmasi eksklusif.
 *
 * Alur (3 langkah, tanpa "Langkah X/Y"):
 *   1. Nominal + rekening — AmountKeypad terpusat; rekening dipilih lewat
 *      kartu di atas keypad yang membuka BottomSheet
 *   2. Verifikasi  — PIN (bottom sheet, konteks nominal+rekening); OTP bila required
 *   3. Selesai     — ringkasan hasil
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
import { router, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Bank as BankIcon } from "phosphor-react-native"

import { api, isApiError, userMessage, type WithdrawDto } from "@/lib/api"
import type { BankAccount } from "@/lib/api/bank-accounts"
import { formatRupiah, maskAccountNumber } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { AMOUNT_LIMITS, AMOUNT_PRESETS, isValidAmount } from "@/lib/financial"
import { useApiQuery } from "@/lib/use-api-query"
import { useResultTimer } from "@/lib/use-result-timer"
import { recordPendingAction, resolvePendingAction, toEpochMs } from "@/lib/pending-actions"
import { walletTransactionStatus } from "@/lib/wallet-labels"

import { Alert } from "@/components/ui/alert"
import { AmountKeypad } from "@/components/ui/amount-keypad"
import { BankAccountListItem } from "@/components/ui/bank-account-list-item"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { KeypadOptionCard } from "@/components/ui/keypad-option-card"
import { Button } from "@/components/ui/button"
import { Countdown, useCountdown } from "@/components/ui/countdown"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Dialog } from "@/components/ui/modal"
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
import { TransactionProgressOverlay } from "@/components/ui/transaction-progress-overlay"
import { TransactionSummary } from "@/components/ui/transaction-summary"
import { useToast } from "@/components/ui/toast"

const MIN_AMOUNT = AMOUNT_LIMITS.withdraw.minimum
const MAX_AMOUNT = AMOUNT_LIMITS.withdraw.maximum
const PRESETS = AMOUNT_PRESETS.withdraw
// Alur: nominal + rekening (satu layar, rekening dipilih lewat BottomSheet)
// → verifikasi PIN/OTP (sheet) → selesai.
const TOTAL_STEPS = 3

type Step = "amount" | "verify" | "done"
/** State overlay progres setelah PIN/OTP disubmit (processing → sukses/gagal). */
type ProgressState = "PROCESSING" | "SUCCESS" | "FAILURE"
/**
 * Cooldown resend OTP default (detik) — dipakai bila backend tidak mengirim
 * `cooldownSeconds` (A-07: paritas dengan alur OTP auth, verify-otp.tsx).
 */
const DEFAULT_OTP_COOLDOWN_S = 60

export default function WithdrawScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  /**
   * J-02/J-04 (audit): `?resume=<txId>` membuka kembali langkah OTP untuk
   * penarikan PENDING_OTP yang ditinggalkan (banner "aksi menunggu" di
   * Beranda). confirm-otp hanya butuh txId+otp, jadi resume aman tanpa
   * membuat penarikan baru.
   */
  const params = useLocalSearchParams<{ resume?: string; resumeAmount?: string }>()
  const resumeTxId = typeof params.resume === "string" && params.resume.trim() ? params.resume.trim() : null
  const resumeAmount = Number(params.resumeAmount) || 0

  const accountsQuery = useApiQuery<BankAccount[]>("withdraw-accounts", async (signal) => {
    return (await api.bankAccounts.listBankAccounts(signal)) ?? []
  })
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const { loading, error } = accountsQuery

  // Ambil saldo dompet untuk membantu user pilih nominal.
  // A-09 (audit): kegagalan TIDAK disamarkan menjadi "Rp0" — error tampil +
  // retry; key "wallet-overview" dibagi dengan transfer/home agar cache F-03
  // mendedupe GET /v1/wallet.
  const balanceQuery = useApiQuery<{ balance: number }>(
    "wallet-overview",
    async (signal) => {
      const w = await api.wallet.getWallet(signal)
      return { balance: w.balance ?? 0 }
    },
    true,
    { retry: 1 },
  )
  const balance = balanceQuery.data?.balance
  const balanceError = balanceQuery.error

  const [amount, setAmount] = useState(0)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [accountSheetOpen, setAccountSheetOpen] = useState(false)
  const [step, setStep] = useState<Step>("amount")
  const [verifyMode, setVerifyMode] = useState<"pin" | "otp">("pin")
  const [pinError, setPinError] = useState<string | undefined>()
  const [otpError, setOtpError] = useState<string | undefined>()
  const [txId, setTxId] = useState<string | null>(null)
  const submitLock = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  // Overlay progres: muncul begitu PIN/OTP disubmit, hasil mengganti kontennya.
  const [progressState, setProgressState] = useState<ProgressState | null>(null)
  const [progressError, setProgressError] = useState<string | undefined>()
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof api.wallet.createWithdraw>
  > | null>(null)
  /** A-07: cooldown resend OTP (epoch ms) — dari `cooldownSeconds` backend. */
  const [otpCooldownUntil, setOtpCooldownUntil] = useState<number | null>(null)
  const [resending, setResending] = useState(false)
  /** A-06: dialog "penarikan masih menunggu OTP" saat sheet ditutup. */
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const scheduleResult = useResultTimer()

  const resendCountdown = useCountdown({ until: otpCooldownUntil ?? undefined })
  const cooldownActive = otpCooldownUntil != null && resendCountdown.remaining > 0

  // A-02 (audit): tombol biometrik DIHAPUS dari sheet PIN withdraw —
  // `WithdrawDto` mewajibkan `pin` mentah dan tidak ada jalur backend
  // "biometrik → tiket", jadi prompt yang sukses tidak pernah mengirim apa
  // pun (placebo). Lihat components/app-lock-gate.tsx untuk biometrik yang
  // benar-benar berfungsi (kunci aplikasi).

  // J-04: resume penarikan PENDING_OTP dari banner "aksi menunggu".
  useEffect(() => {
    if (!resumeTxId) return
    setTxId(resumeTxId)
    if (resumeAmount > 0) setAmount(resumeAmount)
    setVerifyMode("otp")
    setStep("verify")
  }, [resumeTxId, resumeAmount])

  const selected = accounts.find((a) => a.id === accountId)

  useEffect(() => {
    if (accounts.length === 0) return
    setAccountId((prev) =>
      accounts.some((a) => a.id === prev)
        ? prev
        : (accounts.find((a) => a.isPrimary)?.id ?? accounts[0]?.id ?? null),
    )
  }, [accounts])

  const stepIndex: Record<Step, number> = { amount: 1, verify: 2, done: 3 }
  const progress = stepIndex[step] / TOTAL_STEPS

  const canContinueAmount =
    isValidAmount(amount, AMOUNT_LIMITS.withdraw) &&
    !!selected &&
    accounts.some((a) => a.id === accountId) &&
    !loading &&
    !error
  const canContinueAccount = canContinueAmount

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
      setProgressError(undefined)
      setProgressState("PROCESSING")
      try {
        const dto: WithdrawDto = { amount, bankAccountId: accountId!, pin: value }
        const res = await api.wallet.createWithdraw(dto)
        setResult(res)
        if ((res.requiresOtp || res.status === "PENDING_OTP") && res.txId) {
          // Lanjut ke langkah OTP: overlay ditutup, sheet berganti mode OTP.
          setTxId(res.txId)
          setVerifyMode("otp")
          setProgressState(null)
          // A-07: OTP baru saja dikirim — mulai cooldown resend (default 60 d
          // bila server tidak mengirim angka).
          setOtpCooldownUntil(Date.now() + DEFAULT_OTP_COOLDOWN_S * 1000)
          // J-02/J-04: catat aksi menggantung — bila app ditutup/sheet
          // ditinggalkan, Beranda bisa menawarkan pemulihan.
          recordPendingAction({
            kind: "withdraw-otp",
            txId: res.txId,
            amount,
            createdAt: Date.now(),
            expiresAt: toEpochMs(res.expiresAt),
          })
        } else {
          setProgressState("SUCCESS")
          scheduleResult(() => {
            setProgressState(null)
            setStep("done")
          })
        }
      } catch (err) {
        // A-08 (audit): "periksa riwayat" HANYA untuk kegagalan yang tidak
        // pasti (jaringan/timeout/abort — request mungkin sempat terkirim).
        // Error pasti (PIN salah, validasi) tidak menyuruh pengguna memeriksa apa
        // pun; pola disalin dari transfer.tsx.
        const uncertain = !isApiError(err) || err.isTransient || err.code === "ABORTED"
        const base = userMessage(err)
        const msg = uncertain
          ? `${base} Status penarikan mungkin sudah diproses — periksa riwayat sebelum mengirim ulang.`
          : base
        setProgressError(msg)
        setProgressState("FAILURE")
        scheduleResult(() => {
          setProgressState(null)
          setPinError(msg)
        })
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [amount, accountId, canContinueAccount, scheduleResult],
  )

  const handleConfirmOtp = useCallback(
    async (otp: string) => {
      if (!txId || submitLock.current) return
      submitLock.current = true
      setSubmitting(true)
      setOtpError(undefined)
      setProgressError(undefined)
      setProgressState("PROCESSING")
      try {
        const res = await api.wallet.confirmWithdrawOtp({ txId, otp })
        setResult(res)
        // Status final diketahui — aksi menggantung selesai (J-02).
        resolvePendingAction("withdraw-otp", txId)
        setProgressState("SUCCESS")
        scheduleResult(() => {
          setProgressState(null)
          setStep("done")
        })
      } catch (err) {
        setProgressError(userMessage(err))
        setProgressState("FAILURE")
        scheduleResult(() => {
          setProgressState(null)
          setOtpError(userMessage(err))
        })
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [txId, scheduleResult],
  )

  const handleResend = useCallback(async () => {
    // A-07 (audit): rate-limit sisi klien — tombol dikunci countdown selama
    // cooldown (menghormati `cooldownSeconds` backend). Spam resend = biaya
    // SMS per pesan + memperpanjang throttle backend.
    if (!txId || resending || cooldownActive) return
    setResending(true)
    try {
      const res = await api.wallet.resendWithdrawOtp({ txId })
      const cooldownS = res.cooldownSeconds ?? DEFAULT_OTP_COOLDOWN_S
      setOtpCooldownUntil(Date.now() + cooldownS * 1000)
      if (res.success) {
        setOtpError(undefined)
        toast.show({ title: "OTP dikirim ulang", tone: "success" })
      } else {
        toast.show({
          title: "OTP belum dikirim ulang",
          description: res.message ?? "Coba lagi setelah hitung mundur selesai.",
          tone: "warning",
        })
      }
    } catch (err) {
      toast.show({ title: "Gagal mengirim OTP", description: userMessage(err), tone: "danger" })
    } finally {
      setResending(false)
    }
  }, [txId, resending, cooldownActive, toast.show])

  const handleCancelOtp = useCallback(async () => {
    if (!txId || submitLock.current) return
    submitLock.current = true
    setCancelling(true)
    try {
      await api.wallet.cancelWithdraw({ txId })
      resolvePendingAction("withdraw-otp", txId)
      setCloseConfirmOpen(false)
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
      <Header title="Tarik Dana" progress={progress} safeArea={false} />

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        {step === "amount" ? (
          <View className="flex-1">
            {/* Judul + kartu rekening + keypad dalam SATU area scroll dengan
                `justify-between` — kartu selalu tepat di atas keypad dan judul
                tidak pernah tertutup di layar pendek (lihat transfer.tsx). */}
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between" }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <FadeIn duration="fast">
                <View className="items-center gap-2 px-5 pt-6">
                  <Heading level={1} className="text-center text-balance">
                    Tarik ke rekening
                  </Heading>
                  <Text variant="body" tone="secondary" className="text-center text-pretty">
                    Masukkan jumlah dana yang akan ditarik ke rekening bank Anda.
                  </Text>
                </View>
              </FadeIn>

              {/* A-09: saldo gagal dimuat → terlihat, bukan "Rp0". */}
              {balanceError ? (
                <View className="px-5 pt-4">
                  <Alert tone="warning" title="Saldo tidak dapat dimuat">
                    Nominal tetap bisa dimasukkan; server memvalidasi saldo saat penarikan.
                  </Alert>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 self-start"
                    onPress={() => void balanceQuery.reload()}
                  >
                    Muat ulang saldo
                  </Button>
                </View>
              ) : null}

              <View>
                {/* Rekening tujuan dipilih DI SINI lewat BottomSheet (kartu
                    tepat di atas keypad), bukan di langkah terpisah. */}
                <View className="px-5 pb-2 pt-4">
                  <KeypadOptionCard
                    label="Rekening tujuan"
                    value={selected ? `${selected.bankName ?? selected.bankCode}` : undefined}
                    placeholder={loading ? "Memuat rekening…" : "Pilih rekening tujuan"}
                    icon={BankIcon}
                    description={
                      selected
                        ? `${maskAccountNumber(selected.accountNumber)} · a.n. ${selected.accountName ?? "—"}`
                        : undefined
                    }
                    onPress={() => setAccountSheetOpen(true)}
                  />
                </View>

                <AmountKeypad
                  value={amount}
                  onChange={setAmount}
                  min={MIN_AMOUNT}
                  max={balance && balance > 0 ? Math.min(MAX_AMOUNT, balance) : MAX_AMOUNT}
                  presets={PRESETS}
                  balance={balance}
                />
              </View>
            </ScrollView>

            <View
              className="w-full border-t border-border bg-background px-5 pt-4"
              style={{ paddingBottom: Math.max(tokens.space[4], insets.bottom) }}
            >
              <Button
                onPress={handleSubmitForm}
                disabled={!canContinueAccount}
                haptic
              >
                Lanjut ke verifikasi
              </Button>
            </View>
          </View>
        ) : step === "done" ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="px-5 pt-6"
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
                      ? `${selected.bankName ?? selected.bankCode} ${maskAccountNumber(selected.accountNumber)} a.n. ${selected.accountName ?? ""}`
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

      {/* Pilih rekening tujuan — sheet di halaman nominal */}
      <BottomSheet
        visible={accountSheetOpen}
        onRequestClose={() => setAccountSheetOpen(false)}
        title="Pilih rekening tujuan"
        description="Dana ditransfer ke rekening atas nama Anda yang dipilih di sini."
        footer={
          <View
            className="flex-row gap-3 px-5"
            style={{ paddingBottom: Math.max(tokens.space[4], insets.bottom) }}
          >
            {accounts.length === 0 ? (
              <Button
                variant="secondary"
                onPress={() => {
                  setAccountSheetOpen(false)
                  router.push(ROUTES.bankAccounts)
                }}
              >
                Tambah rekening
              </Button>
            ) : null}
            <Button
              onPress={() => setAccountSheetOpen(false)}
              disabled={!selected}
              className="flex-1"
            >
              Selesai
            </Button>
          </View>
        }
      >
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
          />
        ) : (
          <View className="gap-2">
            {accounts.map((acc) => (
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
                onPress={() => {
                  setAccountId(acc.id)
                  setAccountSheetOpen(false)
                }}
              />
            ))}
          </View>
        )}
      </BottomSheet>

      {/* Progres transaksi full-screen setelah PIN/OTP disubmit (§8 signature) */}
      <TransactionProgressOverlay
        visible={progressState !== null}
        state={progressState ?? "PROCESSING"}
        processingMessage={
          verifyMode === "otp"
            ? "Mengonfirmasi penarikan…"
            : `Menarik ${formatRupiah(amount)} ke rekening…`
        }
        successMessage="Penarikan berhasil"
        failureMessage={progressError ?? "Penarikan gagal. Coba lagi."}
      />

      {/* Step verifikasi (PIN/OTP) dalam BottomSheet agar konteks di belakang
          tetap terlihat */}
      <BottomSheet
        visible={step === "verify"}
        onRequestClose={() => {
          if (submitting || cancelling) return
          // A-06 (audit): saat OTP pending, `txId` sudah dibuat di server —
          // menutup sheet begitu saja meninggalkan penarikan PENDING_OTP yang
          // menahan saldo sampai TTL. Tawarkan pembatalan eksplisit.
          if (verifyMode === "otp" && txId) {
            setCloseConfirmOpen(true)
            return
          }
          setStep("amount")
          setVerifyMode("pin")
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
            <View className="flex-row flex-wrap items-center gap-2">
              {cooldownActive ? (
                <Countdown until={otpCooldownUntil ?? undefined} prefix="Kirim ulang dalam" />
              ) : (
                <Button
                  variant="ghost"
                  fullWidth={false}
                  loading={resending}
                  onPress={() => void handleResend()}
                  disabled={submitting}
                >
                  Kirim ulang OTP
                </Button>
              )}
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

      {/* A-06 (audit): sheet OTP ditutup (backdrop/back Android) saat txId
          masih PENDING_OTP — jangan biarkan penarikan menggantung tanpa
          keputusan pengguna. */}
      <Dialog
        visible={closeConfirmOpen}
        title="Penarikan masih menunggu OTP"
        description={`Penarikan ${formatRupiah(amount)} sudah dibuat dan menunggu kode OTP. Bila ditinggalkan, dana tetap tertahan sampai permintaan kedaluwarsa. Batalkan sekarang agar saldo langsung bebas, atau kembali untuk menyelesaikan OTP.`}
        confirmLabel="Batalkan penarikan"
        cancelLabel="Kembali ke OTP"
        destructive
        onConfirm={() => void handleCancelOtp()}
        onRequestClose={() => setCloseConfirmOpen(false)}
      />
    </Screen>
  )
}
