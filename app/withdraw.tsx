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
import { BackHandler, ScrollView, View, type ViewInstance } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useFocusEffect, useNavigation, usePreventRemove } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Bank as BankIcon } from "phosphor-react-native"

import { api, isApiError, isPinNotSetError, userMessage, type WithdrawDto } from "@/lib/api"
import { assertDeviceNotCompromised } from "@/lib/device-integrity"
import { createIdempotencyKey } from "@/lib/api/client"
import type { BankAccount } from "@/lib/api/bank-accounts"
import { formatRupiah, maskAccountNumber } from "@/lib/format"
import { queryKeys } from "@/lib/query-keys"
import { ROUTES } from "@/lib/routes"
import { serverNow } from "@/lib/server-time"
import { tokens } from "@/lib/tokens"
import { AMOUNT_LIMITS, AMOUNT_PRESETS, isValidAmount } from "@/lib/financial"
import { invalidateQueryCache, useApiQuery } from "@/lib/use-api-query"
import { useResultTimer } from "@/lib/use-result-timer"
import { recordPendingAction, resolvePendingAction, toEpochMs } from "@/lib/pending-actions"
import { walletTransactionStatus } from "@/lib/wallet-labels"
import { useWalletGate } from "@/lib/use-wallet-enabled"

import { Alert } from "@/components/ui/alert"
import { AmountKeypad } from "@/components/ui/amount-keypad"
import { hasOpenOverlay } from "@/components/ui/backdrop"
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
import { ListLoading } from "@/components/ui/paginated-list"
import { OtpInput, OTP_MIN_LENGTH, OTP_MAX_LENGTH } from "@/components/ui/otp-input"
import { PinInput } from "@/components/ui/pin-input"
import { ScreenCaptureGuard } from "@/components/security/screen-capture-guard"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TransactionProgressOverlay } from "@/components/ui/transaction-progress-overlay"
import { ReceiptTicket } from "@/components/receipt/ReceiptTicket"
import { shareReceipt } from "@/components/receipt/shareReceipt"
import { useReceiptQr } from "@/components/receipt/use-receipt-qr"
import { makeReceiptId, type ReceiptStatus } from "@/lib/receipt"
import { useToast } from "@/components/ui/toast"
import { translate } from "@/lib/i18n/translate"

const PRESETS = AMOUNT_PRESETS.withdraw
// Alur: nominal + rekening (satu layar, rekening dipilih lewat BottomSheet)
// → verifikasi PIN/OTP (sheet) → selesai.
// (FX-010: MIN/MAX nominal kini dari `withdrawLimits` di dalam komponen —
// batas server via `GET /v1/wallet/limits`, fallback statis bila fetch gagal.)
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
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  /**
   * Mode Tanpa Wallet Internal: layar ini satu-satunya yang diizinkan tetap
   * hidup saat flag mati — sebagai jalur SATU ARAH mengosongkan sisa saldo
   * lama ke rekening bank. Top-up/transfer/terima/riwayat tetap tertutup.
   */
  const walletGate = useWalletGate({ allowLegacyWithdrawal: true })
  const isLegacy = walletGate === "legacy"
  /**
   * FX-010 (audit): batas nominal diambil dari server (`GET /v1/wallet/limits`)
   * agar selaras dengan guard of record. Fallback = salinan statis
   * `AMOUNT_LIMITS.withdraw` bila fetch gagal — validasi client tidak boleh
   * lebih longgar dari sebelumnya hanya karena jaringan gagal.
   */
  const limitsQuery = useApiQuery(queryKeys.walletLimits(), (signal) =>
    api.wallet.getWalletLimits(signal),
  )
  const withdrawLimits = limitsQuery.data?.withdraw ?? AMOUNT_LIMITS.withdraw
  /**
   * J-02/J-04 (audit): `?resume=<txId>` membuka kembali langkah OTP untuk
   * penarikan PENDING_OTP yang ditinggalkan (banner "aksi menunggu" di
   * Beranda). confirm-otp hanya butuh txId+otp, jadi resume aman tanpa
   * membuat penarikan baru.
   */
  const params = useLocalSearchParams<{ resume?: string; resumeAmount?: string }>()
  const resumeTxId = typeof params.resume === "string" && params.resume.trim() ? params.resume.trim() : null
  /**
   * A-11 (audit 2026-09-22): nilai dari URL dipakai apa adanya sebagai nominal
   * uang — `Number(params.resumeAmount)` meloloskan `99999999999` maupun tipe
   * `string[]` (param berulang), sehingga keypad terisi angka di luar kontrak
   * `WithdrawDto.amount` dan baru gagal di server setelah pengguna mengetik PIN.
   */
  const resumeAmountRaw = Array.isArray(params.resumeAmount)
    ? params.resumeAmount[0]
    : params.resumeAmount
  const resumeAmountCandidate = Number(resumeAmountRaw ?? Number.NaN)
  const resumeAmount = isValidAmount(resumeAmountCandidate, withdrawLimits)
    ? resumeAmountCandidate
    : 0

  // C-02 (audit): kunci disatukan dengan layar rekening/jadwal penarikan —
  // endpoint dan parameternya identik, jadi tidak perlu tiga salinan daftar
  // rekening yang berbeda di cache.
  const accountsQuery = useApiQuery<BankAccount[]>(queryKeys.bankAccounts(), async (signal) => {

  return (await api.bankAccounts.listBankAccounts(signal)) ?? []
  })
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const { loading, error } = accountsQuery

  // Ambil saldo dompet untuk membantu user pilih nominal.
  // A-09 (audit): kegagalan TIDAK disamarkan menjadi "Rp0" — error tampil +
  // retry.
  // C-02 (audit): kunci disatukan dengan Beranda/Dompet/Transfer
  // (`queryKeys.wallet()`) dan proyeksi dihitung lewat `select`, bukan lewat
  // request terpisah di bawah kunci sendiri.
  const balanceQuery = useApiQuery(
    queryKeys.wallet(),
    (signal) => api.wallet.getWallet(signal),
    true,
    {
      retry: 1,
      // Batas keypad memakai saldo TERSEDIA (bukan total): dana yang
      // tertahan di escrow tidak bisa ditarik, jadi user tidak perlu
      // ditolak server setelah memasukkan PIN.
      select: (w) => ({
        balance: w.availableBalance ?? w.balance ?? 0,
        // FE-IMP-4 item 13: limit tarik harian dari server (display-only —
        // klien tidak menghitung ulang, hanya `limit - terpakai`).
        todayWithdrawAmount: w.todayWithdrawAmount ?? 0,
        dailyWithdrawLimit: w.dailyWithdrawLimit,
        // T3-004 (audit UI/UX): sinyal "belum punya PIN" untuk jalan
        // "Buat PIN" di dalam sheet PIN.
        hasPin: w.hasPin ?? undefined,
      }),
    },
  )
  const balance = balanceQuery.data?.balance
  const balanceError = balanceQuery.error
  // T3-004: `false` = user terkonfirmasi belum punya PIN dompet —
  // sheet PIN menawarkan jalan "Buat PIN", bukan error "PIN salah".
  const hasPin = balanceQuery.data?.hasPin
  const withdrawLimitLeft =
    balanceQuery.data?.dailyWithdrawLimit != null
      ? Math.max(0, balanceQuery.data.dailyWithdrawLimit - (balanceQuery.data.todayWithdrawAmount ?? 0))
      : undefined

  const [amount, setAmount] = useState(0)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [accountSheetOpen, setAccountSheetOpen] = useState(false)
  const [step, setStep] = useState<Step>("amount")
  const [verifyMode, setVerifyMode] = useState<"pin" | "otp">("pin")
  const [pinError, setPinError] = useState<string | undefined>()
  // T3-004: true bila server menolak karena PIN belum pernah diatur —
  // melengkapi sinyal `hasPin === false` dari GET /v1/wallet.
  const [pinNotSet, setPinNotSet] = useState(false)
  const [otpError, setOtpError] = useState<string | undefined>()
  /**
   * DBL-007 (audit integrasi 2026-10-01): kode OTP yang sedang diketik
   * (6–10 digit, dinamis). Dipakai tombol "Konfirmasi" manual — auto-submit
   * via onComplete hanya terjadi di 10 digit, jadi kode lebih pendek butuh
   * submit eksplisit.
   */
  const [otpCode, setOtpCode] = useState("")
  const [txId, setTxId] = useState<string | null>(null)
  const submitLock = useRef(false)
  /** M-08 (issue #5): satu `Idempotency-Key` per siklus penarikan (lihat order/[id]). */
  const withdrawKeyRef = useRef<string | null>(null)
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

  // QR verifikasi struk penarikan — defensif: null = tiket tanpa QR (lib/receipt).
  // D1-007: hanya fetch bila tiket benar-benar dirender (step "done") —
  // resume PENDING_OTP menyetel txId saat masih di step "verify".
  const withdrawTicketRef = useRef<ViewInstance | null>(null)
  const withdrawQr = useReceiptQr("WITHDRAWAL", result?.txId ?? txId, {
    enabled: step === "done",
  })

  const canContinueAmount =
    isValidAmount(amount, withdrawLimits) &&
    !!selected &&
    accounts.some((a) => a.id === accountId) &&
    !loading &&
    !error
  const canContinueAccount = canContinueAmount

  const handleSubmitForm = useCallback(() => {
    if (!canContinueAccount) return
    setPinError(undefined)
    setPinNotSet(false)
    setVerifyMode("pin")
    setStep("verify")
  }, [canContinueAccount])

  const handlePin = useCallback(
    async (value: string) => {
      if (!canContinueAccount || submitLock.current) return
      // M-1 (audit ronde-2): blokir penarikan di perangkat rooted/jailbroken.
      if (!(await assertDeviceNotCompromised())) return
      submitLock.current = true
      setSubmitting(true)
      setPinError(undefined)
      setPinNotSet(false)
      setProgressError(undefined)
      setProgressState("PROCESSING")
      try {
        const dto: WithdrawDto = { amount, bankAccountId: accountId!, pin: value }
        const res = await api.wallet.createWithdraw(
          dto,
          withdrawKeyRef.current ?? (withdrawKeyRef.current = createIdempotencyKey()),
        )
        withdrawKeyRef.current = null
        setResult(res)
        // Saldo tersedia sudah berkurang saat reservasi dibuat — segarkan
        // cache dompet agar tab Dompet tidak menampilkan angka basi.
        invalidateQueryCache()
        if ((res.requiresOtp || res.status === "PENDING_OTP") && res.txId) {
          // Lanjut ke langkah OTP: overlay ditutup, sheet berganti mode OTP.
          setTxId(res.txId)
          setVerifyMode("otp")
          setProgressState(null)
          // A-07: OTP baru saja dikirim — mulai cooldown resend (default 60 d
          // bila server tidak mengirim angka).
          setOtpCooldownUntil(serverNow() + DEFAULT_OTP_COOLDOWN_S * 1000)
          // J-02/J-04: catat aksi menggantung — bila app ditutup/sheet
          // ditinggalkan, Beranda bisa menawarkan pemulihan.
          recordPendingAction({
            kind: "withdraw-otp",
            txId: res.txId,
            amount,
            createdAt: serverNow(),
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
        const uncertain =
          !isApiError(err) || err.isTransient || err.code === "ABORTED" || err.code === "PARSE"
        // M-08: gagal pasti = penarikan baru boleh dicoba (kunci baru);
        // tak pasti menahan kunci yang sama. PARSE = nasib dana tak terbaca.
        if (!uncertain) withdrawKeyRef.current = null
        const base = userMessage(err)
        const msg = uncertain
          ? `${base} Status penarikan mungkin sudah diproses — periksa riwayat sebelum mengirim ulang.`
          : base
        setProgressError(msg)
        setProgressState("FAILURE")
        // T3-004: penolakan "PIN belum diatur" BUKAN PIN salah — sheet PIN
        // beralih ke ajakan buat PIN.
        setPinNotSet(isPinNotSetError(err))
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
      setOtpCooldownUntil(serverNow() + cooldownS * 1000)
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
      /*
       * A-10 (audit 2026-09-22): pembatalan dipicu dari Dialog konfirmasi,
       * sedangkan `otpError` hanya terlihat di dalam sheet OTP di belakangnya.
       * Saat gagal, pengguna melihat dialog yang tidak melakukan apa pun tanpa
       * penjelasan — padahal dana masih tertahan. Pesan sekarang juga lewat
       * toast supaya terlihat di mana pun dialog berada.
       */
      setOtpError(userMessage(err))
      toast.show({
        title: "Gagal membatalkan penarikan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      submitLock.current = false
      setCancelling(false)
    }
  }, [txId, toast.show])

  // UI-W010: tombol back header saat sheet verifikasi terbuka harus melewati
  // penjagaan yang sama dengan menutup sheet (A-06) — jangan langsung
  // router.back() saat OTP penarikan masih pending.
  // B3O-40: saat overlay hasil (progressState != null) tampil, hasil sudah
  // final — telan back, jangan tawarkan dialog "Batalkan penawaran".
  const handleHeaderBack = useCallback(() => {
    if (step === "verify") {
      if (progressState != null) return
      if (submitting || cancelling) return
      if (verifyMode === "otp" && txId) {
        setCloseConfirmOpen(true)
        return
      }
      setStep("amount")
      setVerifyMode("pin")
      return
    }
    if (router.canGoBack()) router.back()
    else router.replace(isLegacy ? ROUTES.bankAccounts : ROUTES.wallet)
  }, [step, verifyMode, txId, submitting, cancelling, isLegacy, progressState])

  // TX2-P1: hardware back = seperti tombol back header (jaga OTP pending).
  // Tanpa ini hardware back pop mentah melewati guard dialog pembatalan.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        handleHeaderBack()
        return true
      })
      return () => sub.remove()
    }, [handleHeaderBack]),
  )
  // B3W-01 + B3O-21: pasangan web & iOS untuk guard TX2-P1 di atas.
  // `BackHandler` tidak pernah fire di web (no-op react-native-web) maupun
  // iOS swipe-back, jadi browser back & swipe butuh `usePreventRemove` —
  // replika persis handleHeaderBack agar perilaku lintas platform identik
  // (terutama dialog "penarikan masih menunggu OTP"). Aksi non-back
  // (replace internal: batal OTP → riwayat, ganti PIN, dsb.) diteruskan apa
  // adanya. Keluar layar ditunda ke efek (pola create-transaction).
  // B3O-40: back ditelan selama overlay hasil (~1,4 dtk) & submit/batal
  // berjalan. Murni guard navigasi; logika uang tidak disentuh.
  const [intentionalLeave, setIntentionalLeave] = useState(false)
  const withdrawDirty = result == null && (amount > 0 || accountId != null)
  usePreventRemove((step === "verify" || withdrawDirty) && !intentionalLeave, ({ data }) => {
    // Overlay/dialog terbuka → serahkan ke overlay terdalam (B3W-02).
    if (hasOpenOverlay()) return
    const action = data.action
    const isBack =
      action?.type === "POP" || action?.type === "GO_BACK" || action?.type === "POP_TO_TOP"
    if (!isBack) {
      navigation.dispatch(action)
      return
    }
    if (step === "verify") {
      // B3O-40: seperti Android — telan back selama overlay hasil & submit/batal berjalan.
      if (progressState != null) return
      if (submitting || cancelling) return
      if (verifyMode === "otp" && txId) {
        setCloseConfirmOpen(true)
        return
      }
      setStep("amount")
      setVerifyMode("pin")
      return
    }
    setIntentionalLeave(true)
  })
  useEffect(() => {
    if (!intentionalLeave) return
    if (router.canGoBack()) router.back()
    else router.replace(isLegacy ? ROUTES.bankAccounts : ROUTES.wallet)
  }, [intentionalLeave, isLegacy])

  // TX2-P1: hardware back = seperti tombol back header (jaga OTP pending).
  // Tanpa ini hardware back pop mentah melewati guard dialog pembatalan.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        handleHeaderBack()
        return true
      })
      return () => sub.remove()
    }, [handleHeaderBack]),
  )

  return (
    // SEC-404: proteksi screen-capture iOS di layar tarik dana (PIN + nominal).
    <ScreenCaptureGuard>
      <Screen edges={["top"]} padded={false}>
      <Header title={isLegacy ? "Tarik Saldo Lama" : "Tarik Dana"} progress={progress} safeArea={false} onBack={handleHeaderBack} />

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        {step === "amount" ? (
          hasPin === false ? (
            // FE-049: belum punya PIN — JANGAN biarkan user mengisi nominal
            // dulu baru tahu di sheet verifikasi. Callout + CTA langsung di
            // langkah nominal, sebelum keypad/form. Fallback `pinNotSet` di
            // sheet tetap dipertahankan (server bisa baru mengungkapkannya
            // saat submit).
            <View className="flex-1 justify-center gap-4 px-5">
              <Alert tone="warning" title="Buat PIN dulu">
                Penarikan dana memerlukan PIN dompet. Buat PIN dulu sebelum memasukkan nominal.
              </Alert>
              <Button onPress={() => router.push(ROUTES.changePin)} haptic>
                Buat PIN sekarang
              </Button>
            </View>
          ) : (
          <View className="flex-1">
            {/* Judul + peringatan saldo adalah SATU-SATUNYA bagian yang
                menggulir (`shrink`); keypad terpin di bawah sehingga baris
                "0 / hapus" tidak pernah jatuh ke bawah lipatan. Kartu
                rekening tujuan pindah ke `slot` keypad: selalu TEPAT di atas
                keypad, di bawah nominal (permintaan produk 2026-09-21). */}
            <ScrollView
              className="shrink"
              contentContainerClassName="gap-2 px-5 pt-6 pb-2"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <FadeIn duration="fast">
                <View className="items-center gap-2">
                  <Heading level={1} className="text-center text-balance">
                    Tarik ke rekening
                  </Heading>
                  {isLegacy ? (
                    <Text variant="body" tone="secondary" className="text-center text-pretty">
                      Dompet Kahade tidak lagi aktif — tarik sisa saldo lamamu ke rekening bank.
                    </Text>
                  ) : (
                    <Text variant="body" tone="secondary" className="text-center text-pretty">
                      Masukkan jumlah dana yang akan ditarik ke rekening bank Anda.
                    </Text>
                  )}
                  {/* FE-048: ekspektasi jujur di awal — threshold OTP ditentukan
                      server (`requiresOtp`), jadi tidak ada angka yang dikarang. */}
                  <Text variant="caption" tone="secondary" className="text-center text-pretty">
                    Penarikan tertentu memerlukan OTP tambahan via SMS ke nomor terdaftar.
                  </Text>
                </View>
              </FadeIn>

              {/* A-09: saldo gagal dimuat → terlihat, bukan "Rp0". */}
              {balanceError ? (
                <View>
                  <Alert tone="warning" title="Saldo tidak dapat dimuat">
                    Nominal tetap bisa dimasukkan.
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
            </ScrollView>

            {/* Rekening tujuan dipilih DI SINI lewat BottomSheet, bukan di
                langkah terpisah. */}
            <AmountKeypad
              value={amount}
              onChange={setAmount}
              min={withdrawLimits.minimum}
              // T3-002 (audit UI/UX): pola A-05 transfer — nol dan
              // tidak-diketahui dibedakan. Saldo Rp0 tidak boleh
              // dilonggarkan ke batas server (user mengetik + masukkan PIN
              // baru ditolak server); validasi akhir tetap di server.
              max={balance == null ? withdrawLimits.maximum : Math.min(withdrawLimits.maximum, Math.max(0, balance))}
              presets={PRESETS}
              balance={balance}
              slot={
                <View className="gap-2 px-5">
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
                  {/* FE-IMP-4 item 13: sisa limit tarik hari ini (server). */}
                  {withdrawLimitLeft != null && balance != null ? (
                    <Text variant="caption" tone="secondary">
                      Sisa limit tarik hari ini {formatRupiah(withdrawLimitLeft)}
                    </Text>
                  ) : null}
                  {/* T3-002: hint jujur saat saldo habis — jangan biarkan
                      user mengetik nominal lalu memasukkan PIN untuk ditolak
                      server. Mode legacy: tidak ada "isi saldo" (top-up mati). */}
                  {balance === 0 ? (
                    <Text variant="caption" tone="secondary">
                      {isLegacy
                        ? "Tidak ada sisa saldo lama."
                        : "Saldo Anda Rp0 — isi saldo dulu untuk menarik dana."}
                    </Text>
                  ) : null}
                </View>
              }
            />

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
          )
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
                {(() => {
                  const doneStatus = walletTransactionStatus(result?.status)
                  const receiptStatus: ReceiptStatus =
                    doneStatus === "SUCCESS"
                      ? "SUCCESS"
                      : doneStatus === "FAILED"
                        ? "FAILED"
                        : "PENDING"
                  return (
                    <ReceiptTicket
                      status={receiptStatus}
                      title={
                        doneStatus === "SUCCESS"
                          ? "Penarikan berhasil"
                          : doneStatus === "FAILED"
                            ? "Penarikan gagal"
                            : "Permintaan diterima"
                      }
                      amount={amount}
                      // Uang keluar — merah, konsisten dengan baris riwayat.
                      amountTone="danger"
                      // Kartu "Rekening tujuan" premium di bawah nominal —
                      // nilai tetap dari `selected` (bank · no. rekening · a.n.).
                      recipientLabel="Rekening tujuan"
                      recipient={
                        selected
                          ? {
                              name: selected.accountName ?? "—",
                              detail: `${selected.bankName ?? selected.bankCode} · ${maskAccountNumber(selected.accountNumber)}`,
                            }
                          : null
                      }
                      receiptId={result?.txId ?? txId ?? makeReceiptId()}
                      qrDataUrl={withdrawQr}
                      ticketRef={withdrawTicketRef}
                      onShare={() => void shareReceipt(withdrawTicketRef.current)}
                      // FE-IMP-4 item 7: rincian biaya penarikan. Biaya & bersih
                      // hanya ditampilkan bila SERVER mengirim fieldnya — klien
                      // tidak menghitung biaya/net sendiri (fail closed: tanpa
                      // data server, tidak ada baris biaya palsu).
                      rows={[
                        { label: "Nominal penarikan", value: formatRupiah(amount), mono: true },
                        ...(() => {
                          const res = result as { fee?: unknown; netAmount?: unknown } | null
                          const fee = res?.fee
                          if (typeof fee !== "number" || !Number.isFinite(fee) || fee < 0) {
                            return []
                          }
                          const rows = [{ label: "Biaya layanan", value: formatRupiah(fee), mono: true }]
                          // Net hanya bila server mengirim netAmount — jangan
                          // hitung amount - fee sendiri (aturan FE-IMP-4).
                          const net = res?.netAmount
                          if (typeof net === "number" && Number.isFinite(net) && net >= 0) {
                            rows.push({
                              label: "Diterima bersih",
                              value: formatRupiah(net),
                              mono: true,
                            })
                          }
                          return rows
                        })(),
                      ]}
                    />
                  )
                })()}

                <Text variant="body" tone="secondary" className="text-pretty">
                  {walletTransactionStatus(result?.status) === "SUCCESS"
                    ? "Dana akan masuk ke rekening tujuan dalam beberapa saat tergantung proses bank."
                    : "Permintaan penarikan Anda sedang diproses. Periksa riwayat untuk status terakhir."}
                </Text>

                {/* Mode legacy: riwayat penarikan & dompet mati — jangan tawarkan
                    tombol ke layar yang diblokir. */}
                {isLegacy ? null : (
                  <Button variant="secondary" onPress={() => router.replace(ROUTES.withdrawHistory)}>
                    Lihat riwayat penarikan
                  </Button>
                )}
                <Button
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => router.replace(isLegacy ? ROUTES.bankAccounts : ROUTES.wallet)}
                >
                  {isLegacy ? "Kembali ke rekening" : "Kembali ke dompet"}
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
          // Wrapper footer BottomSheet sudah px-5 pt-4 -> tanpa px-5 lagi.
          <View
            className="flex-row gap-3"
            style={{ paddingBottom: Math.max(tokens.space[4], insets.bottom) }}
          >
            {accounts.length === 0 ? (
              <Button
                variant="secondary"
                onPress={() => {
                  setAccountSheetOpen(false)
                  router.push(ROUTES.bankAccounts)
                }}
                containerClassName="flex-1"
              >
                Tambah rekening
              </Button>
            ) : null}
            <Button
              onPress={() => setAccountSheetOpen(false)}
              disabled={!selected}
              containerClassName="flex-1"
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
                accountNumber={acc.accountNumber ?? ""}
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
            : translate("Menarik {x} ke rekening…", { x: formatRupiah(amount) })
        }
        successMessage="Penarikan berhasil"
        failureMessage={progressError ?? "Penarikan gagal. Coba lagi."}
      />

      {/* Step verifikasi (PIN/OTP) dalam BottomSheet agar konteks di belakang
          tetap terlihat */}
      <BottomSheet
        visible={step === "verify"}
        onRequestClose={() => {
          // B3O-40: overlay hasil sedang tampil (progressState != null) =
          // penarikan sudah final — telan tutup, jangan tawarkan dialog
          // "Batalkan penawaran" yang salah sasaran.
          if (progressState != null) return
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
          setPinNotSet(false)
        }}
        title={verifyMode === "otp" ? "Konfirmasi OTP" : "Verifikasi PIN"}
        description={
          verifyMode === "otp"
            ? // FE-048: kanal OTP = SMS (komentar kode menyebut biaya SMS) —
              // jangan samarkan sebagai "dikirim oleh layanan".
              "Masukkan kode OTP yang dikirim via SMS ke nomor terdaftar untuk menyelesaikan penarikan."
            : translate("Masukkan PIN dompet Anda untuk menarik {x} ke {y} {z}.", {
                x: formatRupiah(amount),
                y: selected?.bankName ?? "rekening Anda",
                z: selected ? maskAccountNumber(selected.accountNumber) : "",
              })
        }
        avoidKeyboard
      >
        {verifyMode === "otp" ? (
          <View className="gap-4">
            {/* DBL-007: panjang OTP dinamis 6–10 digit (mirror BE
                @Length(6,10)). Auto-submit hanya di 10 digit — kode lebih
                pendek dikonfirmasi via tombol manual di bawah. */}
            <OtpInput
              dynamicLength
              onChange={setOtpCode}
              onComplete={(code) => void handleConfirmOtp(code)}
              errorText={otpError}
              helperText={otpError ? undefined : `Masukkan ${OTP_MIN_LENGTH}–${OTP_MAX_LENGTH} digit kode OTP yang dikirim via SMS`}
              disabled={submitting || cancelling}
            />
            <Button
              onPress={() => void handleConfirmOtp(otpCode)}
              loading={submitting}
              disabled={submitting || cancelling || otpCode.length < OTP_MIN_LENGTH}
            >
              Konfirmasi
            </Button>
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
          <View className="gap-3">
            {/*
             * TRX-002 (audit UI/UX 2026-09-28): konfirmasi PIN WAJIB
             * menampilkan biaya admin + angka yang dipakai saat submit.
             * Backend saat ini TIDAK memungut biaya admin penarikan dan TIDAK
             * punya endpoint estimasi biaya withdraw (terverifikasi dari
             * wallet.service.ts: debit = nominal penuh, tanpa FEE_DEDUCT;
             * respons create/confirm-otp tanpa field fee/netAmount) — jadi
             * angka yang ditampilkan di sini SAMA dengan yang didebit server:
             * nominal penuh. Bila backend kelak menambah biaya withdraw,
             * blok ini HARUS diganti membaca endpoint estimasi server
             * (follow-up backend).
             */}
            <View className="gap-1 rounded-md bg-surface px-4 py-3">
              <View className="flex-row items-center justify-between">
                <Text variant="caption" tone="secondary">
                  Nominal penarikan
                </Text>
                <Text variant="body" weight={600}>
                  {formatRupiah(amount)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text variant="caption" tone="secondary">
                  Biaya layanan
                </Text>
                <Text variant="body" weight={600}>
                  {/*
                   * BATCH4-A3: JANGAN hardcode Rp0 — "Rp0" terlihat seperti
                   * hasil hitungan. Backend saat ini tidak memungut biaya
                   * (terverifikasi wallet.service.ts), jadi tampilkan "Gratis"
                   * sebagai kebijakan, bukan angka. Bila backend kelak menambah
                   * fee, blok ini HARUS diganti membaca endpoint estimasi
                   * server (follow-up backend).
                   */}
                  Gratis
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                {/* TRX-002: instruksi audit eksplisit — tampilkan "biaya admin +
                    nominal bersih yang diterima". Fee withdraw server saat ini
                    Rp0 (terverifikasi di wallet.service.ts), jadi bersih =
                    nominal. Bila backend kelak menambah fee, wajib ada endpoint
                    estimasi kanonis — bukan hitungan lokal. */}
                <Text variant="caption" tone="secondary">
                  Diterima bersih
                </Text>
                <Text variant="body" weight={600}>
                  {formatRupiah(amount)}
                </Text>
              </View>
            </View>
            {hasPin === false || pinNotSet ? (
              // T3-004 (audit UI/UX): user belum punya PIN — satu-satunya
              // jalan yang benar adalah membuatnya, bukan menebak 6 digit
              // sampai kena rate-limit.
              <View className="gap-3">
                <Text variant="body" tone="secondary">
                  Anda belum punya PIN dompet. Buat PIN dulu untuk menarik dana.
                </Text>
                <Button onPress={() => router.push(ROUTES.changePin)} haptic>
                  Buat PIN sekarang
                </Button>
              </View>
            ) : (
              <PinInput
                mode="enter"
                onComplete={(p) => void handlePin(p)}
                errorText={pinError}
                disabled={submitting}
              />
            )}
            {/* FE-IMP-4 item 6: ETA di konfirmasi penarikan — informasi umum
                (bukan janji per transaksi), agar user punya ekspektasi yang
                jelas sebelum dana dipotong. */}
            <Text variant="caption" tone="secondary" className="text-center">
              {/* FE-103: rentang "beberapa menit hingga 1 hari kerja" nyaris
                  tidak informatif — cukup batas atasnya. */}
              {translate("Estimasi sampai: maks. 1 hari kerja.")}
            </Text>
          </View>
        )}
      </BottomSheet>

      {/* A-06 (audit): sheet OTP ditutup (backdrop/back Android) saat txId
          masih PENDING_OTP — jangan biarkan penarikan menggantung tanpa
          keputusan pengguna. */}
      <Dialog
        visible={closeConfirmOpen}
        title="Penarikan masih menunggu OTP"
        description={translate(
          "Dana tertahan sampai permintaan kedaluwarsa. Batalkan sekarang agar saldo langsung bebas.",
        )}
        confirmLabel="Batalkan penarikan"
        cancelLabel="Kembali ke OTP"
        destructive
        onConfirm={() => void handleCancelOtp()}
        onRequestClose={() => setCloseConfirmOpen(false)}
      />
      </Screen>
    </ScreenCaptureGuard>
  )
}
