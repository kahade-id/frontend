/**
 * Kahade — Isi Saldo (top-up) v2 — alur multi-step dengan separator progress,
 * keypad nominal terpusat, dan kartu konfirmasi eksklusif.
 *
 * Alur (3 langkah, TANPA teks "Langkah X/Y" — separator progress tipis di
 * bawah header, seperti alur register):
 *   1. Nominal  — centered AmountKeypad (tidak ada keyboard OS); metode
 *      dipilih lewat kartu di atas keypad yang membuka BottomSheet
 *   2. Konfirmasi — ringkasan nominal + metode (ubah lewat kartu/sheet)
 *   3. Instruksi pembayaran (hasil createTopup) — TopupStatusCard
 *
 * Kontrak API:
 *   GET  /v1/wallet/payment-methods  → PaymentMethod[] (filter top-up saja)
 *   POST /v1/wallet/topup            → { paymentTxId, method, amount, paymentCode, qrString, … }
 *   GET  /v1/wallet/topup/:id/status → polling status pembayaran
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BackHandler, ScrollView, View, type ViewInstance } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useFocusEffect, useNavigation, usePreventRemove } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Wallet as WalletIcon } from "phosphor-react-native"

import { api, isApiError, userMessage, type TopupDto } from "@/lib/api"
import type { TopupFeeEstimate } from "@/lib/api/wallet"
import { createIdempotencyKey } from "@/lib/api/client"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { AMOUNT_LIMITS, AMOUNT_PRESETS, isValidAmount } from "@/lib/financial"
import { useCopy } from "@/lib/clipboard"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { formatRupiah } from "@/lib/format"
import { toPaymentMethods } from "@/lib/payment-methods"
import { ROUTES } from "@/lib/routes"
import { serverNow } from "@/lib/server-time"
import { tokens } from "@/lib/tokens"
import { usePolling } from "@/lib/use-polling"
import { useApiQuery } from "@/lib/use-api-query"
import { useWalletGate } from "@/lib/use-wallet-enabled"
import { assertDeviceNotCompromised } from "@/lib/device-integrity"
import { recordPendingAction, resolvePendingAction, toEpochMs } from "@/lib/pending-actions"
import { Alert } from "@/components/ui/alert"
import { Amount } from "@/components/ui/amount"
import { AmountKeypad } from "@/components/ui/amount-keypad"
import { hasOpenOverlay } from "@/components/ui/backdrop"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FadeIn } from "@/components/ui/fade-in"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeypadOptionCard } from "@/components/ui/keypad-option-card"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { KeyValue } from "@/components/ui/key-value"
import { ListLoading } from "@/components/ui/paginated-list"
import {
  PaymentMethodSelector,
  canUsePaymentMethod,
  paymentMethodKindIcon,
  type PaymentMethod,
} from "@/components/ui/payment-method-selector"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TopupStatusCard, type PaymentStatus } from "@/components/ui/topup-status-card"
import { TransactionSummary } from "@/components/ui/transaction-summary"
import { ScreenCaptureGuard } from "@/components/security/screen-capture-guard"
import { ReceiptTicket } from "@/components/receipt/ReceiptTicket"
import { shareReceipt } from "@/components/receipt/shareReceipt"
import { useReceiptQr } from "@/components/receipt/use-receipt-qr"
import { makeReceiptId, type ReceiptStatus } from "@/lib/receipt"
import { useToast } from "@/components/ui/toast"
import { WalletDisabledScreen } from "@/components/ui/wallet-disabled"
import { mapValue } from "@/lib/has-own"

const POLL_MS_FAST = 5000
const POLL_MS_SLOW = 15000
/**
 * PERF-FIX (network P1): polling adaptif dua fase (cermin disiplin
 * `useDanaIntent`). Fase cepat 5 dtk selama ~60 dtk pertama — responsif saat
 * user baru membayar; fase lambat 15 dtk setelahnya. Dulu flat 5 dtk × 180;
 * kini anggaran wall-clock SAMA (~15 menit) dengan ~2,6× lebih sedikit
 * request. Terminal-stop tidak berubah (lihat `enabled` di bawah).
 */
const FAST_POLLS = 12 // 12 × 5 dtk = 60 dtk
const MAX_POLL_COUNT = 68 // 60 dtk + 56 × 15 dtk ≈ 15 menit
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
  const navigation = useNavigation()
  // Mode Tanpa Wallet Internal (BI-safe): flag false = layar diganti
  // <WalletDisabledScreen/> (deep link ikut tertutup).
  const walletGate = useWalletGate()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copied, copy } = useCopy()
  const params = useLocalSearchParams<{ resumePayment?: string; from?: string; orderId?: string; amount?: string }>()

  // FE-IMP-4 item 3: "Lanjutkan bayar" dari riwayat — deep link
  // `/topup?resumePayment=<paymentTxId>` langsung membuka status pembayaran.
  const resumePaymentId =
    typeof params.resumePayment === "string" && params.resumePayment.trim()
      ? params.resumePayment.trim()
      : null

  /**
   * FE-043: konteks "isi saldo dari sheet bayar order". Bila ada, struk
   * sukses menampilkan CTA "Kembali bayar RpX" (kembali ke order — sheet
   * pembayaran masih terbuka di bawahnya) dan header back menuju order,
   * bukan dompet.
   */
  const fromOrderPay = params.from === "order-pay"
  const returnPayAmount = (() => {
    const n = Number(params.amount)
    return params.amount != null && params.amount !== "" && Number.isFinite(n) && n > 0 ? n : null
  })()

  const methodsQuery = useApiQuery<PaymentMethod[]>("topup-methods", async (signal) => {
    const raw = await api.wallet.getPaymentMethods(signal)
    return (
      toPaymentMethods(raw)
        .filter((method) => isTopupMethod(method.id))
        // M-23 (audit end-to-end, issue #58): kartu kredit DITARIK dari daftar
        // top-up — DTO produksi mensyaratkan `cardToken` untuk CREDIT_CARD dan
        // UI ini TIDAK punya alur tokenisasi kartu; menawarkannya = jalan buntu
        // pasti 400. Saat alur kartu hadir, kembalikan dengan form token-nya.
        .filter((method) => method.id !== "CREDIT_CARD")
    )
  })
  const methods = useMemo(() => methodsQuery.data ?? [], [methodsQuery.data])
  const { loading, error } = methodsQuery

  const [step, setStep] = useState<Step>("amount")
  const [amount, setAmount] = useState(0)
  const [methodId, setMethodId] = useState<string | null>(null)
  const [methodSheetOpen, setMethodSheetOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.wallet.createTopup>> | null>(
    null,
  )
  const [statusLoading, setStatusLoading] = useState(false)

  /**
   * Batch 139 E17 — penanda kedaluwarsa lokal dari <Countdown> (server-synced).
   * Begitu hitung mundur mencapai nol, status efektif menjadi EXPIRED: CTA
   * pembayaran (cek status/batalkan) diganti struk kedaluwarsa + CTA
   * "Buat kode pembayaran baru". Ini berdasarkan waktu server, bukan jam
   * perangkat; bila server ternyata masih PENDING, polling manual akan
   * mengoreksi saat pengguna mengetuk periksa status.
   */
  const [locallyExpired, setLocallyExpired] = useState(false)
  useEffect(() => {
    setLocallyExpired(false)
  }, [result?.paymentTxId])
  const [statusError, setStatusError] = useState<string | null>(null)
  const submitLock = useRef(false)
  /** M-08 (issue #5): satu `Idempotency-Key` per siklus top-up (lihat order/[id]). */
  const payKeyRef = useRef<string | null>(null)
  const pollLock = useRef(false)
  const pollCount = useRef(0)
  // PERF-FIX (network P1): fase polling — `false` = 5 dtk (60 dtk pertama),
  // `true` = 15 dtk. Berpindah sekali; `usePolling` menjadwal ulang dengan
  // interval baru karena `intervalMs` masuk deps effect-nya.
  const [pollSlow, setPollSlow] = useState(false)
  /**
   * A-12 (audit): true setelah cap polling tercapai — UI memberi tahu bahwa
   * pemantauan otomatis berhenti dan "Cek status" adalah jalur manualnya.
   * Sebelumnya polling mati diam-diam dan kartu terus terlihat "hidup".
   */
  const [pollStopped, setPollStopped] = useState(false)

  // FE-IMP-4 item 3: resume pembayaran pending langsung ke kartu status.
  useEffect(() => {
    if (!resumePaymentId || result || statusLoading) return
    let cancelled = false
    setStatusLoading(true)
    api.wallet
      .getTopupStatus(resumePaymentId)
      .then((st) => {
        if (cancelled) return
        setResult({ ...st, paymentTxId: resumePaymentId })
        if (typeof st.amount === "number" && st.amount > 0) setAmount(st.amount)
        if (typeof st.method === "string" && st.method) setMethodId(st.method)
        setStep("result")
      })
      .catch((err: unknown) => {
        if (cancelled) return
        toast.show({
          title: "Gagal memuat status pembayaran",
          description: userMessage(err),
          tone: "danger",
        })
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumePaymentId])

  // Progress bar — nilai kontinu mengikuti langkah aktif (register-style).
  const stepIndex: Record<Step, number> = { amount: 1, method: 2, result: 3 }
  const progress = stepIndex[step] / TOTAL_STEPS

  // QR verifikasi struk top-up — defensif: null = tiket tanpa QR (lib/receipt).
  // D1-007: hanya fetch bila tiket struk benar-benar dirender (status final;
  // fase instruksi PENDING tidak menampilkan tiket).
  const topupTicketRef = useRef<ViewInstance | null>(null)
  const topupQr = useReceiptQr("TOPUP", result?.paymentTxId, {
    enabled: locallyExpired || (result != null && result.status in STATUS),
  })

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
      // J-02: status final (SUCCESS/FAILED/EXPIRED/CANCELLED) diketahui →
      // aksi menggantung diselesaikan; banner pemulihan tidak lagi relevan.
      if (mapValue(STATUS, status?.status, undefined)) {
        resolvePendingAction("topup-unpaid", id)
      }
    } catch (err) {
      setStatusError(userMessage(err))
    } finally {
      pollLock.current = false
      setStatusLoading(false)
    }
  }, [])
  usePolling(
    async () => {
      if (result?.paymentTxId) {
        if (pollCount.current >= MAX_POLL_COUNT) {
          setPollStopped(true)
          return
        }
        pollCount.current += 1
        // PERF-FIX (network P1): tepat sekali, setelah 60 dtk pertama —
        // turunkan laju 5 dtk → 15 dtk untuk sisa masa tunggu.
        if (pollCount.current === FAST_POLLS) setPollSlow(true)
        await pollStatus(result.paymentTxId)
      }
    },
    pollSlow ? POLL_MS_SLOW : POLL_MS_FAST,
    Boolean(result?.paymentTxId && !mapValue(STATUS, result.status, undefined) && pollCount.current < MAX_POLL_COUNT),
  )

  const selectedMethod = methods.find((m) => m.id === methodId)

  /**
   * FE-IMP-4 item 5 + SEC-403: estimasi biaya SATU-SATUNYA dari server (GET
   * /v1/wallet/topup/fee-estimate) — memakai logika fee yang SAMA dengan
   * jalur charge, jadi angka di konfirmasi = angka yang ditagih gateway.
   * Hitungan lokal DIHAPUS: duplikat logika backend yang bisa menyimpang
   * saat skema fee berubah, dan user akan menyetujui "Total RpX" lalu
   * didebit RpY. Bila estimasi server gagal → tombol Bayar DIBLOKIR sampai
   * estimasi berhasil (bukan hanya saat loading).
   */
  const debouncedAmount = useDebouncedValue(amount, 400)
  const feeEstimateQuery = useApiQuery<TopupFeeEstimate>(
    `topup-fee:${debouncedAmount}:${methodId ?? "none"}`,
    (signal) => api.wallet.getTopupFeeEstimate(debouncedAmount, methodId ?? "", signal),
    step === "method" &&
      methodId != null &&
      isTopupMethod(methodId) &&
      isValidAmount(debouncedAmount, AMOUNT_LIMITS.topup),
  )
  const serverFeeEstimate = feeEstimateQuery.data
  const feeLoading = feeEstimateQuery.loading && serverFeeEstimate == null
  // SEC-403: siap = estimasi server ADA. Gagal (error, bukan loading) juga
  // false — tombol Bayar mati sampai retry berhasil.
  const feeReady = serverFeeEstimate != null
  const displayFee = serverFeeEstimate?.fee
  const displayTotal = serverFeeEstimate?.total

  const canContinueAmount = isValidAmount(amount, AMOUNT_LIMITS.topup)
  const canPay =
    !loading &&
    !error &&
    canContinueAmount &&
    isTopupMethod(methodId) &&
    canUsePaymentMethod(selectedMethod, amount) &&
    feeReady

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

  // P1-T4: hardware back Android = mundur satu langkah (seperti tombol back
  // header), bukan pop layar yang menghapus input diam-diam.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => goBack())
      return () => sub.remove()
    }, [goBack]),
  )
  // B3W-01 + B3O-21: pasangan web & iOS untuk guard P1-T4 di atas.
  // `BackHandler` tidak pernah fire di web (no-op react-native-web) maupun
  // iOS swipe-back, jadi browser back & swipe butuh `usePreventRemove` —
  // replika persis `goBack()` agar perilaku lintas platform identik.
  // Overlay terbuka → serahkan ke overlay terdalam (B3W-02).
  // Murni guard navigasi; logika uang tidak disentuh.
  const wizardDirty = result == null && (amount > 0 || methodId != null)
  usePreventRemove(step === "method" || wizardDirty, ({ data }) => {
    // Overlay terbuka (mis. sheet pilih metode) → serahkan ke overlay
    // terdalam (B3W-02); jangan step-back wizard.
    if (hasOpenOverlay()) return
    const action = data.action
    const isBack =
      action?.type === "POP" || action?.type === "GO_BACK" || action?.type === "POP_TO_TOP"
    if (isBack && goBack()) return
    navigation.dispatch(action)
  })

  // Web: peringatan bawaan browser sebelum tab ditutup/refresh dengan isian hidup.
  useEffect(() => {
    if (typeof window === "undefined" || !wizardDirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [wizardDirty])

  const handlePay = useCallback(async () => {
    // SEC-403 (penguat TRX-001): jangan buat intent selagi estimasi biaya
    // server belum BERHASIL — `canPay` sudah mencakup `feeReady`, jadi
    // estimasi yang gagal (bukan hanya loading) ikut memblokir. Angka yang
    // disetujui user harus angka kanonis server, bukan tebakan lokal.
    if (!canPay || !isTopupMethod(methodId) || submitLock.current) return
    // M-1 (audit ronde-2): blokir pembuatan intent top-up di perangkat
    // rooted/jailbroken — sebelum intent dibuat & dana bergerak.
    if (!(await assertDeviceNotCompromised())) return
    submitLock.current = true
    setSubmitting(true)
    try {
      const res = await api.wallet.createTopup(
        { amount, method: methodId },
        payKeyRef.current ?? (payKeyRef.current = createIdempotencyKey()),
      )
      payKeyRef.current = null
      if (!res?.paymentTxId) throw new Error("Missing payment transaction ID")
      setResult(res)
      setStep("result")
      setStatusError(null)
      pollCount.current = 0
      setPollSlow(false)
      setPollStopped(false)
      // J-04: catat top-up belum dibayar — bila layar ditutup/app mati,
      // Beranda menawarkan pemulihan ("periksa riwayat top-up").
      recordPendingAction({
        kind: "topup-unpaid",
        paymentTxId: res.paymentTxId,
        amount,
        createdAt: serverNow(),
        expiresAt: toEpochMs(res.expiresAt),
      })
      toast.show({ title: "Instruksi pembayaran dibuat", tone: "success" })
    } catch (err) {
      // M-08: gagal tak pasti MENAHAN kunci (tekan ulang = top-up yang sama di
      // mata server); gagal pasti menggantinya. PARSE = 200 body rusak → bisa
      // jadi top-up sudah terbit → ikut ditahan.
      const uncertain =
        !isApiError(err) || err.isTransient || err.code === "ABORTED" || err.code === "PARSE"
      if (!uncertain) payKeyRef.current = null
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

  if (walletGate === "off") {
    return <WalletDisabledScreen />
  }

  return (
    // SEC-404 (selective): layar top-up menampilkan nominal + kode bayar —
    // blokir screenshot/recording per-layar, bukan app-wide.
    <ScreenCaptureGuard>
      <Screen edges={["top"]} padded={false}>
      <Header
        title="Isi Saldo"
        progress={progress}
        // P1-T2: showBack selalu true — langkah pertama tanpa back = jebakan
        // cold start. handleBack sudah punya fallback ke wallet.
        onBack={handleBack}
        showBack
        safeArea={false}
      />

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        {step === "amount" ? (
          // Langkah nominal: konten terpusat — hero di tengah, keypad di
          // bawah; footer CTA tunggal konsisten dengan pola register.
          <View className="flex-1">
            {/* Judul + penjelasan adalah SATU-SATUNYA bagian yang boleh
                menggulir (`shrink`): keypad di bawahnya terpin, jadi baris
                "0 / hapus" tidak pernah jatuh ke bawah lipatan — bug lama
                ("di layar besar angka 0-9 dan hapus tertutup, harus
                scroll") muncul karena keypad ikut berada di dalam ScrollView
                bersama judul dan kartu metode. */}
            <ScrollView
              className="shrink"
              contentContainerClassName="items-center gap-2 px-5 pt-6 pb-2"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <FadeIn duration="fast">
                <View className="items-center gap-2">
                  <Heading level={1} className="text-center text-balance">
                    Masukkan nominal
                  </Heading>
                  <Text variant="body" tone="secondary" className="text-center text-pretty">
                    Pilih atau ketik jumlah saldo yang ingin Anda isi. Minimal{" "}
                    {formatRupiah(AMOUNT_LIMITS.topup.minimum)}.
                  </Text>
                </View>
              </FadeIn>
            </ScrollView>

            {/* Keypad + kartu metode. Urutan bacanya: nominal → preset →
                metode pembayaran → keypad (permintaan produk 2026-09-21:
                kartu metode di bawah pilihan nominal, tepat di atas keypad). */}
            <AmountKeypad
              value={amount}
              onChange={setAmount}
              min={AMOUNT_LIMITS.topup.minimum}
              max={AMOUNT_LIMITS.topup.maximum}
              presets={AMOUNT_PRESETS.topup}
              slot={
                <View className="px-5">
                  <KeypadOptionCard
                    label="Metode pembayaran"
                    value={selectedMethod?.name}
                    placeholder={loading ? "Memuat metode…" : "Pilih metode pembayaran"}
                    icon={selectedMethod ? paymentMethodKindIcon[selectedMethod.kind] : WalletIcon}
                    // SEC-403: pratinjau biaya lokal DIHAPUS — biaya hanya
                    // dihitung server di langkah konfirmasi. Jangan tampilkan
                    // angka tebakan di sini.
                    onPress={() => setMethodSheetOpen(true)}
                  />
                </View>
              }
            />

            <View
              className="w-full border-t border-border bg-background px-5 pt-4"
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
              contentContainerClassName="px-5 pb-6 pt-6"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <FadeIn duration="fast">
                <View className="gap-4">
                  <View className="gap-2">
                    <Heading level={1} className="text-balance">
                      Konfirmasi pembayaran
                    </Heading>
                    <Text variant="body" tone="secondary" className="text-pretty">
                      Periksa nominal dan metode pembayaran Anda.
                    </Text>
                  </View>

                  {/*
                   * FE-005: SATU total final hanya di area pin tepat di atas
                   * tombol Bayar — kartu ringkasan ini hanya memuat rincian
                   * (biaya admin), bukan total kedua.
                   */}
                  <TransactionSummary
                    label="Nominal top-up"
                    amount={amount}
                    amountTone="primary"
                    subtitle={selectedMethod ? selectedMethod.name : "Pilih metode di bawah"}
                  >
                    <KeyValue
                      label="Biaya layanan"
                      // SEC-403: satu-satunya sumber angka = server. Gagal
                      // (bukan loading) → pesan jelas, bukan angka tebakan.
                      // BATCH4-A4: angka ini ESTIMASI server (bukan tagihan
                      // final) — label eksplisit agar tidak dibaca sebagai fakta.
                      value={
                        feeLoading
                          ? "Menghitung…"
                          : feeReady
                            ? displayFee != null && displayFee > 0
                              ? formatRupiah(displayFee)
                              : "Gratis"
                            : "Biaya belum bisa dihitung — coba lagi"
                      }
                      hint={feeReady ? "Estimasi dari server" : undefined}
                    />
                  </TransactionSummary>

                  {/*
                   * SEC-403: estimasi server gagal → jelaskan + tawarkan
                   * percobaan ulang. Tombol Bayar di bawah tetap mati sampai
                   * estimasi server berhasil (lihat `canPay`/`feeReady`).
                   */}
                  {!feeLoading && !feeReady ? (
                    <View className="gap-2">
                      <Alert tone="danger" title="Biaya belum bisa dihitung">
                        Total yang dibayar tidak dapat dipastikan sekarang. Coba lagi —
                        tombol pembayaran aktif setelah biaya dari server berhasil dimuat.
                      </Alert>
                      <Button
                        variant="secondary"
                        size="sm"
                        onPress={() => void feeEstimateQuery.reload()}
                      >
                        Coba lagi
                      </Button>
                    </View>
                  ) : null}

                  {/* Pemilihan metode ada di halaman nominal lewat BottomSheet
                      (ketuk kartu metode di atas keypad). Halaman ini hanya
                      ringkasan + tombol ubah. */}
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
                    <KeypadOptionCard
                      label="Metode pembayaran"
                      value={selectedMethod?.name}
                      icon={selectedMethod ? paymentMethodKindIcon[selectedMethod.kind] : WalletIcon}
                      // FE-005: rincian biaya hanya di dalam kartu ringkasan
                      // di atas — bukan ganda di kartu metode.
                      onPress={() => setMethodSheetOpen(true)}
                      accessibilityHint="Ketuk untuk mengganti metode pembayaran"
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
              className="w-full border-t border-border bg-background px-5 pt-4"
              style={{ paddingBottom: Math.max(tokens.space[4], insets.bottom) }}
            >
              {/*
               * D10 (batch 139): status metode dari server. Metode bisa masuk
               * gangguan SETELAH dipilih (data metode di-cache) — jangan
               * biarkan tombol Bayar mati diam-diam; jelaskan dan tawarkan
               * ganti metode. Total tidak pernah diganti diam-diam: biaya
               * selalu dihitung ulang dari metode yang dipilih.
               */}
              {selectedMethod?.unavailable ? (
                <View className="pb-3">
                  <Alert
                    tone="warning"
                    title="Metode pembayaran tidak tersedia"
                  >
                    {selectedMethod.unavailableReason ??
                      "Metode ini sedang gangguan atau maintenance. Pilih metode lain untuk melanjutkan."}
                  </Alert>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    onPress={() => setMethodSheetOpen(true)}
                  >
                    Pilih metode lain
                  </Button>
                </View>
              ) : null}
              {/*
               * FE-005: SATU total final BESAR tepat di atas tombol Bayar —
               * satu-satunya tampilan "Total yang dibayar" di layar ini.
               * Rincian biaya hanya di dalam kartu ringkasan di atas.
               * D06 (batch 139): total TETAP di area pin di atas CTA — bukan
               * hanya di dalam ScrollView. Saat keyboard terbuka (mis. dari
               * sheet pilih metode) atau konten di-scroll, total yang dibayar
               * tetap terbaca tepat sebelum tombol Bayar.
               */}
              <View className="flex-row items-end justify-between gap-4 pb-3">
                <Text variant="body" weight={600} tone="secondary">
                  Total yang dibayar
                </Text>
                {/* SEC-403: total hanya dari server. Tanpa estimasi server →
                    strip "—", bukan tebakan lokal. */}
                {feeLoading ? (
                  <Text variant="body" tone="secondary">
                    Menghitung…
                  </Text>
                ) : feeReady && displayTotal != null ? (
                  <Amount value={displayTotal} size="large" tone="primary" animated={false} />
                ) : (
                  <Text variant="body" tone="secondary">
                    —
                  </Text>
                )}
              </View>
              {/*
               * SEC-403 (penguat TRX-001): tombol mati selama estimasi server
               * belum BERHASIL — `canPay` mencakup `feeReady`, jadi kegagalan
               * estimasi (bukan hanya loading) ikut memblokir. Lihat handlePay
               * (guard ganda).
               */}
              {/*
               * T3-009 (audit UI/UX): tombol ini TIDAK membayar — ia membuat
               * kode pembayaran (VA/QRIS/retail). Label jujur + baris bawah
               * menegaskan user masih harus membayar manual sebelum
               * kedaluwarsa.
               */}
              <Button
                onPress={() => void handlePay()}
                loading={submitting}
                disabled={!canPay}
                haptic
              >
                Buat kode pembayaran
              </Button>
              <Text variant="caption" tone="secondary" className="pb-1 text-center">
                Setelah ini Anda membayar via aplikasi bank/e-wallet sebelum kode kedaluwarsa.
              </Text>
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
            contentContainerClassName="px-5 pt-6"
          >
            <FadeIn duration="fast">
              <View className="gap-4">
                {(() => {
                  // Status final (SUCCESS/FAILED/EXPIRED/CANCELLED) → struk
                  // tiket; instruksi pembayaran (PENDING) tetap di
                  // TopupStatusCard.
                  // Batch 139 E17: countdown lokal yang selesai membuat status
                  // efektif EXPIRED — CTA pembayaran dinonaktifkan diganti
                  // CTA regenerate.
                  const effectiveStatus = locallyExpired ? "EXPIRED" : result?.status
                  const finalStatus = mapValue(STATUS, effectiveStatus, undefined)
                  if (finalStatus) {
                    const ok = finalStatus === "SUCCESS"
                    // FE-IMP-4 item 25: QRIS/kode bayar kedaluwarsa ditonjolkan
                    // dengan CTA regenerate — bukan sekadar struk "gagal".
                    const expired = finalStatus === "EXPIRED"
                    const receiptStatus: ReceiptStatus = ok ? "SUCCESS" : "FAILED"
                    const methodLabel =
                      methods.find((m) => m.id === (result?.method ?? methodId))?.name ??
                      result?.method ??
                      ""
                    return (
                      <>
                        <ReceiptTicket
                          status={receiptStatus}
                          title={
                            ok
                              ? "Top-up berhasil"
                              : expired
                                ? "Kode pembayaran kedaluwarsa"
                                : "Top-up gagal"
                          }
                        amount={result?.grossAmount ?? result?.amount ?? amount}
                        // Dana masuk — hijau, konsisten dengan baris riwayat.
                        amountTone={ok ? "success" : "primary"}
                        rows={[
                          ...(methodLabel
                            ? [{ label: "Metode pembayaran", value: methodLabel }]
                            : []),
                          ...(result?.paymentCode
                            ? [{ label: "Kode pembayaran", value: result.paymentCode, mono: true }]
                            : []),
                          ...(result?.reference
                            ? [{ label: "Referensi", value: result.reference, mono: true }]
                            : []),
                        ]}
                        receiptId={result?.paymentTxId ?? makeReceiptId()}
                        qrDataUrl={topupQr}
                        ticketRef={topupTicketRef}
                        onShare={() => void shareReceipt(topupTicketRef.current)}
                        onCopyReceiptId={(id) => void copy(id)}
                      />
                        {expired ? (
                          <Button
                            variant="primary"
                            fullWidth
                            onPress={() => {
                              setResult(null)
                              setStep("method")
                            }}
                          >
                            Buat kode pembayaran baru
                          </Button>
                        ) : null}
                        {/*
                         * FE-043: struk sukses selalu punya CTA eksplisit.
                         * Dari sheet bayar order → "Kembali bayar RpX" (kembali
                         * ke order; sheet pembayaran masih terbuka). Dari
                         * dompet → "Selesai" (kembali ke dompet).
                         */}
                        {ok ? (
                          <Button
                            variant="primary"
                            fullWidth
                            onPress={() => {
                              if (fromOrderPay) {
                                // Sheet pembayaran masih terbuka di bawah layar
                                // ini — back cukup. Fallback: dorong detail order.
                                if (router.canGoBack()) router.back()
                                else if (typeof params.orderId === "string" && params.orderId)
                                  router.replace(ROUTES.orderDetail(params.orderId))
                                else router.replace(ROUTES.wallet)
                              } else router.replace(ROUTES.wallet)
                            }}
                          >
                            {fromOrderPay
                              ? returnPayAmount != null
                                ? `Kembali bayar ${formatRupiah(returnPayAmount)}`
                                : "Kembali bayar"
                              : "Selesai"}
                          </Button>
                        ) : null}
                      </>
                    )
                  }
                  return (
                    <TopupStatusCard
                      status={
                        mapValue(
                          STATUS,
                          result?.status,
                          result?.status === "PENDING" ? "PENDING" : "UNKNOWN",
                        )
                      }
                  // WF-008 (Batch 1-money): tampilkan total tagihan SEBENARNYA
                  // dari server (grossAmount = nominal + fee channel), bukan
                  // rekonstruksi client. Estimasi client hanya dipakai di
                  // langkah konfirmasi sebelum POST (berlabel "estimasi").
                  amount={result?.grossAmount ?? result?.amount ?? amount}
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
                  // Batch 139 E17: countdown selesai → tandai kedaluwarsa
                  // lokal (server-synced), CTA pembayaran dinonaktifkan.
                  onExpire={() => setLocallyExpired(true)}
                  onRefresh={() => result && void pollStatus(result.paymentTxId)}
                  onDone={() => router.replace(ROUTES.topupHistory)}
                  onRetry={() => {
                    setResult(null)
                    setStatusError(null)
                    setStep("method")
                  }}
                  // FE-108 PARKIR (2026-09-29): "Ubah nominal" saat PENDING
                  // DIHAPUS — backend tidak punya endpoint cancel top-up
                  // intent; membuang state lokal membuat intent ganda
                  // (kode lama tetap valid di server). User menunggu
                  // kedaluwarsa alami atau membayar kode aktif.
                  // Salin 1-ketuk nomor VA/kode bayar + toast "Tersalin" (§9.11).
                  onCopy={(value) => {
                    void copy(value).then((ok) => {
                      if (ok) toast.show({ title: "Tersalin", tone: "success" })
                    })
                  }}
                  copied={copied}
                    />
                  )
                })()}
                {pollStopped && !mapValue(STATUS, result?.status, undefined) ? (
                  <Alert tone="info" title="Pembaruan otomatis berhenti">
                    Pembayaran yang masuk tetap diproses — ketuk Cek status untuk pembaruan
                    manual.
                  </Alert>
                ) : null}
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

      {/* Pilih metode pembayaran — sheet di halaman nominal */}
      <BottomSheet
        visible={methodSheetOpen}
        onRequestClose={() => setMethodSheetOpen(false)}
        title="Pilih metode pembayaran"
        description="Biaya layanan (jika ada) ditampilkan di samping setiap metode."
        footer={
          // Wrapper footer BottomSheet sudah memberi px-5 pt-4; px-5 di sini
          // membuat tombol menjorok 40px, tidak sejajar judul sheet.
          <View
            style={{ paddingBottom: Math.max(tokens.space[4], insets.bottom) }}
          >
            <Button onPress={() => setMethodSheetOpen(false)} disabled={!isTopupMethod(methodId)}>
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
      </BottomSheet>
      </Screen>
    </ScreenCaptureGuard>
  )
}
