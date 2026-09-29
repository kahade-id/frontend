/**
 * Kahade — Transfer Dana v2 — alur 3 langkah dengan separator progress,
 * keypad nominal terpusat, dan kartu konfirmasi eksklusif.
 *
 * Alur (3 langkah, tanpa "Langkah X/Y"):
 *   1. Penerima & nominal — cari/pilih penerima + AmountKeypad; catatan
 *      diisi lewat kartu di atas keypad yang membuka BottomSheet
 *   2. Konfirmasi        — ringkasan (catatan tampil di sini); PIN lewat BottomSheet
 *   3. Selesai           — ringkasan hasil + tautan detail
 *
 * API:
 *   GET  /v1/wallet/transfer/lookup?q=
 *   POST /v1/wallet/transfer               → { txId, status }
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { api, userMessage, type TransferDto } from "@/lib/api"
import { assertDeviceNotCompromised } from "@/lib/device-integrity"
import { createIdempotencyKey } from "@/lib/api/client"
import { formatRupiah } from "@/lib/format"
import { dismissKeyboardOnDragProps } from "@/lib/keyboard"
import { queryKeys } from "@/lib/query-keys"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { AMOUNT_LIMITS, AMOUNT_PRESETS, isValidAmount } from "@/lib/financial"
import { invalidateQueryCache, useApiQuery } from "@/lib/use-api-query"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { useResultTimer } from "@/lib/use-result-timer"
import { recordRecentRecipient, useRecentRecipients } from "@/lib/ui-prefs"
import { resolveRevalidatedRecipient } from "@/lib/wallet-batch139"
import { recordPendingAction, resolvePendingAction } from "@/lib/pending-actions"
import { serverNow } from "@/lib/server-time"
import { walletTransactionStatus } from "@/lib/wallet-labels"
import { PencilSimpleLine } from "phosphor-react-native"
import { Alert } from "@/components/ui/alert"
import { AmountKeypad } from "@/components/ui/amount-keypad"
import { Avatar } from "@/components/ui/avatar"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { FadeIn } from "@/components/ui/fade-in"
import { Field } from "@/components/ui/field"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeypadOptionCard } from "@/components/ui/keypad-option-card"
import { KeyValue } from "@/components/ui/key-value"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { PinInput } from "@/components/ui/pin-input"
import { ScreenCaptureGuard } from "@/components/security/screen-capture-guard"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { TransactionProgressOverlay } from "@/components/ui/transaction-progress-overlay"
import { TransactionSummary } from "@/components/ui/transaction-summary"
import { ReceiptTicket } from "@/components/receipt/ReceiptTicket"
import { shareReceipt } from "@/components/receipt/shareReceipt"
import { useReceiptQr } from "@/components/receipt/use-receipt-qr"
import { makeReceiptId, type ReceiptStatus } from "@/lib/receipt"
import {
  TransferRecipientPicker,
  type TransferRecipient,
} from "@/components/ui/transfer-recipient-picker"
import { useToast } from "@/components/ui/toast"
import { isApiError, isPinNotSetError } from "@/lib/api"
import { translate } from "@/lib/i18n/translate"
const MIN_AMOUNT = AMOUNT_LIMITS.transfer.minimum
const MAX_AMOUNT = AMOUNT_LIMITS.transfer.maximum
const PRESETS = AMOUNT_PRESETS.transfer
/**
 * Batas catatan transfer. A-17 (audit): nilai ini TIDAK ada di kontrak yang
 * di-generate (`TransferDto` hanya memuat aturan `amount`) — 200 adalah
 * keputusan klien sampai backend menambahkan aturan `note` ke DTO.
 * Dependensi & kriteria terimanya: docs/audit/BACKEND-DEPENDENCIES.md §A-17.
 */
const NOTE_MAX = 200
const TOTAL_STEPS = 3
type Step = "form" | "confirm" | "pin" | "done"
/** State overlay progres setelah PIN disubmit (processing → sukses/gagal). */
type ProgressState = "PROCESSING" | "SUCCESS" | "FAILURE"
export default function TransferScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const params = useLocalSearchParams<{ to?: string; amount?: string }>()
  const presetUsername = typeof params.to === "string" ? params.to : undefined
  // FE-IMP-4 item 27: QR "minta transfer" boleh membawa nominal
  // (`transfer?to=&amount=`) — di-prefill tapi tetap bisa diubah user dan
  // tetap divalidasi ulang oleh batas keypad + server.
  // TRX-015: clamp diam-diam dilarang — bila QR meminta di atas maksimum,
  // pembayar diberi tahu bahwa angka diminta berbeda dari yang terisi.
  const presetAmountRaw =
    typeof params.amount === "string" && /^\d+$/.test(params.amount)
      ? Number(params.amount)
      : undefined
  const presetClamped =
    presetAmountRaw != null && presetAmountRaw > AMOUNT_LIMITS.transfer.maximum
  const presetAmount =
    presetAmountRaw != null
      ? Math.min(presetAmountRaw, AMOUNT_LIMITS.transfer.maximum)
      : undefined
  // Ambil saldo dompet untuk batas transfer & tampilkan di keypad.
  // A-09 (audit): error TIDAK lagi disamarkan menjadi `{ balance: 0 }` —
  // saldo gagal dimuat ditampilkan apa adanya + retry, karena "Rp0" adalah
  // angka yang salah di layar uang.
  //
  // C-02 (audit): kunci kini `queryKeys.wallet()` — kunci yang SAMA dengan
  // Beranda/Dompet, sehingga GET /v1/wallet benar-benar ter-dedupe dan
  // invalidasi cache menjangkau semua layar. Proyeksi `{ balance }` dihitung
  // lewat `select` dari respons baku, jadi bentuk proyeksi tidak pernah masuk
  // cache dan tidak bisa dibaca layar yang mengharapkan `WalletData` penuh.
  const balanceQuery = useApiQuery(
    queryKeys.wallet(),
    (signal) => api.wallet.getWallet(signal),
    true,
    {
      retry: 1,
      /*
       * TRX-003 (audit UI/UX 2026-09-28): "Saldo tersedia" HARUS saldo yang
       * benar-benar bisa dipakai = availableBalance (saldo minus dana escrow
       * tertahan), BUKAN saldo bruto `balance`. GET /v1/wallet selalu
       * mengirim ketiganya (availableBalance/escrowBalance/totalBalance —
       * terverifikasi di wallet.service.ts). Bila server tidak mengirim
       * availableBalance, perlakukan sebagai tidak diketahui (keypad
       * menampilkan helperText) — jangan tampilkan angka bruto yang
       * menyesatkan (pola A-13).
       */
      select: (w) => ({
        balance: typeof w.availableBalance === "number" ? w.availableBalance : undefined,
        // T3-004 (audit UI/UX): sinyal "belum punya PIN" untuk jalan
        // "Buat PIN" di dalam sheet PIN — GET /v1/wallet selalu mengirimnya.
        hasPin: w.hasPin ?? undefined,
      }),
    },
  )
  const balance = balanceQuery.data?.balance
  const balanceError = balanceQuery.error
  // T3-004: `false` = user terkonfirmasi belum punya PIN dompet —
  // sheet PIN menawarkan jalan "Buat PIN", bukan error "PIN salah".
  const hasPin = balanceQuery.data?.hasPin
  const [query, setQuery] = useState(presetUsername ?? "")
  // J-06 (audit): penerima terakhir PERSISTEN antar-sesi (lib/ui-prefs),
  // bukan state lokal yang hilang tiap masuk layar.
  const recent = useRecentRecipients()
  const [selected, setSelected] = useState<TransferRecipient | null>(null)
  const [amount, setAmount] = useState(presetAmount ?? 0)
  const [note, setNote] = useState("")
  const [noteDraft, setNoteDraft] = useState("")
  const [noteSheetOpen, setNoteSheetOpen] = useState(false)
  const [step, setStep] = useState<Step>("form")
  const [pinError, setPinError] = useState<string | undefined>()
  // T3-004: true bila server menolak karena PIN belum pernah diatur
  // (isPinNotSetError) — melengkapi sinyal `hasPin === false`.
  const [pinNotSet, setPinNotSet] = useState(false)
  const [txId, setTxId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [transferStatus, setTransferStatus] = useState<string | undefined>()
  /**
   * D04 (batch 139): validasi ulang penerima TEPAT sebelum konfirmasi.
   * Nama/identifier bisa basi setelah jeda panjang (penerima ganti nama,
   * akun dihapus, dsb). Saat masuk langkah konfirmasi, identifier
   * di-lookup ulang ke server:
   *  - tidak resolve ke id yang sama → fail-closed: pilihan dibuang,
   *    kembali ke langkah pilih penerima;
   *  - nama berubah → nama tampilan diperbarui (bukan diam-diam);
   *  - lookup gagal (jaringan) → konfirmasi DIKUNCI sampai validasi
   *    berhasil — jangan kirim uang ke penerima yang belum tervalidasi.
   */
  const [revalidating, setRevalidating] = useState(false)
  const [revalidateError, setRevalidateError] = useState<string | null>(null)
  const [revalidateNonce, setRevalidateNonce] = useState(0)
  const selectedId = selected?.id
  const selectedUsername = selected?.username
  useEffect(() => {
    if (step !== "confirm" || !selectedId || !selectedUsername) return
    let cancelled = false
    setRevalidating(true)
    setRevalidateError(null)
    api.wallet
      .lookupTransferRecipient(selectedUsername)
      .then((results) => {
        if (cancelled) return
        const outcome = resolveRevalidatedRecipient(results, {
          id: selectedId,
          name: selected?.name ?? selectedUsername,
        })
        if (!outcome.valid) {
          setSelected(null)
          setFormSubStep("recipient")
          setStep("form")
          toast.show({
            title: "Penerima tidak lagi valid — silakan pilih ulang",
            tone: "danger",
          })
          return
        }
        setSelected((prev) => (prev && outcome.name !== prev.name ? { ...prev, name: outcome.name } : prev))
      })
      .catch(() => {
        if (!cancelled)
          setRevalidateError(
            "Tidak dapat memvalidasi ulang penerima. Periksa koneksi, lalu coba lagi.",
          )
      })
      .finally(() => {
        if (!cancelled) setRevalidating(false)
      })
    return () => {
      cancelled = true
    }
  }, [step, selectedId, selectedUsername, revalidateNonce, toast])
  // Overlay progres: muncul begitu PIN disubmit, hasil mengganti kontennya.
  const [progressState, setProgressState] = useState<ProgressState | null>(null)
  const [progressError, setProgressError] = useState<string | undefined>()
  const submitLock = useRef(false)
  /** M-08 (issue #5): satu `Idempotency-Key` per siklus transfer (lihat order/[id]). */
  const transferKeyRef = useRef<string | null>(null)
  const scheduleResult = useResultTimer()
  // A-01 (audit): tombol biometrik DIHAPUS dari sheet PIN transfer.
  // `TransferDto` mewajibkan `pin` mentah dan backend tidak punya jalur
  // "biometrik → tiket konfirmasi", sehingga prompt biometrik yang "sukses"
  // tidak punya efek apa pun (placebo). Biometrik kini dipakai untuk kunci
  // aplikasi (app/biometric-settings.tsx + components/app-lock-gate.tsx);
  // konfirmasi transaksi kembali ke PIN sampai backend menyediakan tiket.
  const debounced = useDebouncedValue(query.trim())
  const lookup = useApiQuery(
    `recipients:${debounced}`,
    (signal) => api.wallet.lookupTransferRecipient(debounced, signal),
    debounced.length >= 3 && query.trim() === debounced,
  )
  // F-08 (audit): di-memo — sebelumnya array baru per render membuat efek
  // auto-select deep-link berjalan setiap render.
  const results: TransferRecipient[] = useMemo(
    () =>
      (lookup.data ?? []).map((r) => ({
        id: r.id,
        name: r.fullName ?? r.username,
        username: r.username,
        avatarUrl: r.avatarUrl ?? undefined,
        kycVerified: r.kycVerified,
      })),
    [lookup.data],
  )
  const loading = lookup.loading || debounced !== query.trim()
  // Penerima favorit (audit P2 cluster wallet) — `GET /v1/wallet/favorite-recipients`.
  // Tampil sebagai seksi "Favorit" saat query kosong; ikon hati di baris
  // memanggil add/remove endpoint lalu me-refresh daftar ini.
  const favoritesQuery = useApiQuery<import("@/lib/api").FavoriteRecipient[]>(
    "wallet-favorites",
    (signal) => api.wallet.getFavoriteRecipients(signal),
  )
  const favorites: TransferRecipient[] = (favoritesQuery.data ?? []).map((f) => ({
    id: f.recipient.id,
    // `label` (alias opsional, maks 50 kar) menggantikan nama di baris.
    name: f.label && f.label.trim() ? f.label : f.recipient.fullName,
    username: f.recipient.username ?? "",
    avatarUrl: f.recipient.avatarUrl ?? undefined,
  }))
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<string | null>(null)
  const handleToggleFavorite = useCallback(
    async (recipient: TransferRecipient, nextFavorite: boolean) => {
      if (togglingFavoriteId) return
      const favoriteRow = favoritesQuery.data?.find((f) => f.recipient.id === recipient.id)
      setTogglingFavoriteId(recipient.id)
      try {
        const handle = recipient.username || recipient.name
        if (nextFavorite) {
          await api.wallet.addFavoriteRecipient(recipient.id)
          toast.show({
            title: translate("@{x} disimpan ke favorit", { x: handle }),
            tone: "success",
            duration: 3000,
          })
        } else if (favoriteRow) {
          // Hapus memakai id BARIS favorit (bukan id penerima).
          await api.wallet.removeFavoriteRecipient(favoriteRow.id)
          toast.show({
            title: translate("@{x} dihapus dari favorit", { x: handle }),
            duration: 3000,
          })
        }
        void favoritesQuery.refresh()
      } catch (err) {
        toast.show({ title: userMessage(err), tone: "danger" })
      } finally {
        setTogglingFavoriteId(null)
      }
    },
    [togglingFavoriteId, favoritesQuery.data, favoritesQuery.refresh, toast],
  )
  // QR verifikasi struk transfer — defensif: null = tiket tanpa QR (lib/receipt).
  const ticketRef = useRef<View | null>(null)
  const transferQr = useReceiptQr("TRANSFER", txId)
  const transferReceiptStatus: ReceiptStatus =
    walletTransactionStatus(transferStatus) === "SUCCESS"
      ? "SUCCESS"
      : walletTransactionStatus(transferStatus) === "FAILED"
        ? "FAILED"
        : "PENDING"
  const transferReceiptTitle =
    walletTransactionStatus(transferStatus) === "SUCCESS"
      ? "Transfer berhasil"
      : walletTransactionStatus(transferStatus) === "FAILED"
        ? "Transfer gagal"
        : "Transfer diajukan"
  // Sub-langkah di dalam langkah "form": penerima dulu, baru nominal.
  const [formSubStep, setFormSubStep] = useState<"recipient" | "amount">("recipient")
  const stepIndex: Record<Step, number> = { form: 1, confirm: 2, pin: 2, done: 3 }
  const progress = stepIndex[step] / TOTAL_STEPS
  const handleQuery = useCallback((value: string) => {
    setQuery(value)
    setSelected(null)
  }, [])
  const handleSelect = useCallback((recipient: TransferRecipient) => {
    setSelected(recipient)
    recordRecentRecipient(recipient)
    // Jika penerima datang dari deep-link QR (preset), langsung loncat ke nominal.
    if (presetUsername && recipient.username?.toLowerCase() === presetUsername.toLowerCase()) {
      setFormSubStep("amount")
    }
  }, [presetUsername])
  // Bila deep-link `?to=<username>` dan lookup mengembalikan satu hasil yang
  // cocok dengan username itu, pilih otomatis.
  useEffect(() => {
    if (!presetUsername) return
    if (selected) return
    const match = results.find(
      (r) => r.username?.toLowerCase() === presetUsername.toLowerCase(),
    )
    if (match) {
      handleSelect(match)
    }
  }, [presetUsername, results, selected, handleSelect])
  const canContinueForm = !!selected && isValidAmount(amount, AMOUNT_LIMITS.transfer)
  const handleBack = useCallback(() => {
    if (step === "confirm") {
      setStep("form")
      return
    }
    if (step === "pin") {
      setStep("confirm")
      return
    }
    if (router.canGoBack()) router.back()
    else router.replace(ROUTES.wallet)
  }, [step])
  const handlePin = useCallback(
    async (pinValue: string) => {
      if (submitLock.current || !selected || !isValidAmount(amount, AMOUNT_LIMITS.transfer)) return
      // M-1 (audit ronde-2): blokir transfer di perangkat rooted/jailbroken.
      if (!(await assertDeviceNotCompromised())) return
      submitLock.current = true
      setSubmitting(true)
      setPinError(undefined)
      setPinNotSet(false)
      setProgressError(undefined)
      setProgressState("PROCESSING")
      try {
        const dto: TransferDto = {
          recipientId: selected.id,
          amount,
          pin: pinValue,
          note: note.trim() || undefined,
        }
        const idemKey =
          transferKeyRef.current ?? (transferKeyRef.current = createIdempotencyKey())
        /*
         * D07 (batch 139): status idempotensi DAPAT DIPULIHKAN — catat transfer
         * yang sedang diproses (kunci idempotensi + tujuan + nominal). Bila
         * app mati di tengah, banner menawarkan pemulihan via riwayat.
         * Di-resolve saat hasil final diketahui (sukses / gagal pasti).
         */
        recordPendingAction({
          kind: "transfer-uncertain",
          idempotencyKey: idemKey,
          recipientId: selected.id,
          recipientName: selected.name,
          amount,
          createdAt: serverNow(),
        })
        const res = await api.wallet.transferFunds(dto, idemKey)
        transferKeyRef.current = null
        resolvePendingAction("transfer-uncertain", idemKey)
        setTxId(res.txId ?? null)
        setTransferStatus(res.status)
        /*
         * A-17/C-01 (audit 2026-09-22): mutasi uang tanpa invalidasi cache
         * membuat layar berikutnya (dalam TTL 5 detik) membaca saldo SEBELUM
         * transfer. `invalidateQueryCache` dulu tidak pernah dipanggil sama
         * sekali di seluruh app.
         */
        invalidateQueryCache()
        setProgressState("SUCCESS")
        // Overlay sukses tampil sejenak, lalu lanjut ke layar hasil.
        // A-14: timer dibersihkan saat unmount (useResultTimer) — back dalam
        // jendela 1,4 d tidak lagi memaksa navigasi dari layar lain.
        scheduleResult(() => {
          setProgressState(null)
          setStep("done")
        })
      } catch (err) {
        // Gagal TIDAK berarti dana hilang: kalau request sempat terkirim
        // (bukan gagal jaringan murni sebelum terkirim), status akhir harus
        // diverifikasi di riwayat sebelum mengirim ulang.
        const uncertain =
          !isApiError(err) || err.isTransient || err.code === "ABORTED" || err.code === "PARSE"
        // M-08: gagal pasti = transfer baru boleh dicoba (kunci baru);
        // tak pasti menahan kunci yang sama (retry = transfer yang sama).
        // D07: gagal PASTI → resolve catatan (hasil final diketahui);
        // gagal TAK PASTI → catatan DIPERTAHANKAN agar bisa dipulihkan
        // setelah app mati (banner → riwayat).
        if (!uncertain) {
          if (transferKeyRef.current) resolvePendingAction("transfer-uncertain", transferKeyRef.current)
          transferKeyRef.current = null
        }
        const base = userMessage(err)
        const msg = uncertain
          ? `${base} Status transfer mungkin sudah diproses — periksa riwayat sebelum mengirim ulang.`
          : base
        setProgressError(msg)
        setProgressState("FAILURE")
        // T3-004: penolakan "PIN belum diatur" BUKAN PIN salah — jangan
        // biarkan user menebak-nebak; sheet PIN beralih ke ajakan buat PIN.
        setPinNotSet(isPinNotSetError(err))
        /*
         * A-15 (audit 2026-09-22): pada kegagalan tak pasti klien tidak tahu
         * apakah debit sudah terjadi — teks saja tidak cukup. Saldo disegarkan
         * dan cache dibuang supaya layar Dompet/riwayat yang dibuka sesudahnya
         * menampilkan keadaan SEBENARNYA (bukan angka pra-transfer), tanpa
         * memaksa pengguna menutup app.
         */
        if (uncertain) {
          invalidateQueryCache()
          void balanceQuery.refresh()
        }
        // Setelah pesan gagal terbaca, sheet PIN terbuka lagi (PIN dikosongkan
        // otomatis oleh PinInput) — user bisa memilih mencoba atau membatalkan.
        scheduleResult(() => {
          setProgressState(null)
          setPinError(msg)
        })
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [selected, amount, note, scheduleResult, balanceQuery],
  )
  /*
   * A-05 (audit 2026-09-22): `balance && balance > 0` membuat saldo Rp0
   * (dompet kosong) DIANGGAP "saldo tidak diketahui" sehingga batasnya
   * dilonggarkan ke MAX_AMOUNT penuh — pengguna mengetik, menekan CTA, baru
   * ditolak server. Nol dan tidak-diketahui sekarang dibedakan.
   */
  const maxAmount =
    balance == null ? MAX_AMOUNT : Math.min(MAX_AMOUNT, Math.max(0, balance))
  // Sub-step: pemilihan penerima + nominal di langkah "form". Kita bagi
  // layar dua: atas (pencarian penerima) yang di-scroll, bawah (keypad)
  // statis. Tapi karena penerima hanya butuh area kecil, dan keypad besar,
  // kita susun: header kecil di atas keypad, lalu tombol "Lanjut" yang
  // aktif saat penerima sudah dipilih.
  //
  // Namun, pengalaman yang lebih baik: bagi "form" dalam dua sub-langkah
  // (pilih penerima dulu, baru nominal+catatan). Agar progress bar tetap
  // 3 langkah (form dihitung 1), kita transisikan di dalam langkah "form".
  // Penerima dipilih: tombol "Lanjut" muncul di area CTA; user bisa
  // mengganti pilihan sebelum masuk ke langkah nominal. Kita TIDAK auto-advance
  // supaya user tetap merasa memegang kendali (§12).
  return (
    // SEC-404: proteksi screen-capture iOS di layar transfer (PIN + nominal).
    <ScreenCaptureGuard>
      <Screen edges={["top"]} padded={false}>
      <Header
        title="Transfer Dana"
        progress={progress}
        onBack={
          step === "confirm"
            ? handleBack
            : step === "pin"
              ? () => setStep("confirm")
              : step === "form" && formSubStep === "amount"
                ? () => {
                    setFormSubStep("recipient")
                    setAmount(0)
                  }
                : undefined
        }
        showBack={
          step === "confirm" ||
          step === "pin" ||
          (step === "form" && formSubStep === "amount")
        }
        safeArea={false}
      />
      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        {step === "form" && formSubStep === "recipient" ? (
          // 1a. Pilih penerima
          <View className="flex-1">
            <ScrollView
              className="flex-1"
              contentContainerClassName="px-5 pb-6 pt-6"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              {...dismissKeyboardOnDragProps}
              contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] + 80 }}
            >
              <FadeIn duration="fast">
                <View className="gap-4">
                  <View className="gap-2">
                    <Heading level={1} className="text-balance">
                      Cari penerima
                    </Heading>
                    <Text variant="body" tone="secondary" className="text-pretty">
                      Cari nama pengguna atau nomor HP yang ingin Anda kirimi saldo.
                    </Text>
                  </View>
                  <TransferRecipientPicker
                    query={query}
                    onQueryChange={handleQuery}
                    results={results}
                    recent={[...recent]}
                    favorites={favorites}
                    favoriteIds={favorites.map((f) => f.id)}
                    onToggleFavorite={handleToggleFavorite}
                    loading={loading}
                    value={selected?.id}
                    onSelect={handleSelect}
                  />
                  {lookup.error ? (
                    <ErrorState
                      compact
                      title="Gagal mencari penerima"
                      description={lookup.error}
                      onRetry={() => void lookup.reload()}
                    />
                  ) : null}
                </View>
              </FadeIn>
            </ScrollView>
            <View
              className="w-full border-t border-border bg-background px-5 pt-4"
              style={{ paddingBottom: Math.max(tokens.space[4], insets.bottom) }}
            >
              <Button
                onPress={() => setFormSubStep("amount")}
                disabled={!selected}
                haptic
              >
                Lanjutkan
              </Button>
            </View>
          </View>
        ) : null}
        {step === "form" && formSubStep === "amount" ? (
          // 1b. Nominal + catatan (keypad terpusat)
          <View className="flex-1">
            {/* Judul + peringatan saldo adalah SATU-SATUNYA bagian yang
                menggulir (`shrink`); keypad terpin di bawahnya sehingga baris
                "0 / hapus" tidak pernah tertutup (bug lama: keypad ikut
                tergulir bersama judul dan kartu catatan). Kartu catatan kini
                masuk `slot` keypad — selalu TEPAT di atas keypad, di bawah
                nominal (permintaan produk 2026-09-21). */}
            <ScrollView
              className="shrink"
              contentContainerClassName="gap-2 px-5 pt-6 pb-2"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <FadeIn duration="fast">
                <View className="items-center gap-2">
                  <Heading level={1} className="text-center text-balance">
                    Kirim ke @{selected?.username}
                  </Heading>
                  <Text variant="body" tone="secondary" className="text-center text-pretty">
                    {selected?.name}
                    {selected?.kycVerified ? " · Terverifikasi" : ""}
                  </Text>
                </View>
              </FadeIn>
              {/* A-09 (audit): gagal memuat saldo tidak lagi disamarkan
                  menjadi "Rp0" — tampilkan peringatan + jalur retry. */}
              {balanceError ? (
                <View>
                  <Alert tone="warning" title="Saldo tidak dapat dimuat">
                    Batas maksimal kembali ke limit transfer; server tetap memvalidasi saldo Anda.
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
              {/* TRX-015: nominal QR di atas batas transfer dipotong — beri
                  tahu pembayar, jangan diam-diam. */}
              {presetClamped ? (
                <Alert tone="warning" title="Nominal dari QR disesuaikan">
                  QR meminta {formatRupiah(presetAmountRaw ?? 0)} — melebihi batas transfer, jadi
                  kolom diisi {formatRupiah(presetAmount ?? 0)} (maksimum). Sesuaikan manual bila perlu.
                </Alert>
              ) : null}
            </ScrollView>
            {/* Catatan ditulis DI SINI lewat BottomSheet, bukan di langkah
                konfirmasi. */}
            <AmountKeypad
              value={amount}
              onChange={setAmount}
              min={MIN_AMOUNT}
              max={maxAmount}
              presets={PRESETS}
              balance={balance}
              helperText={
                balance == null
                  ? translate("Minimal {x}", { x: formatRupiah(MIN_AMOUNT) })
                  : undefined
              }
              slot={
                <View className="px-5">
                  <KeypadOptionCard
                    label="Catatan (opsional)"
                    value={note.trim() || undefined}
                    placeholder="Tambah catatan untuk penerima"
                    icon={PencilSimpleLine}
                    onPress={() => {
                      setNoteDraft(note)
                      setNoteSheetOpen(true)
                    }}
                  />
                </View>
              }
            />
            <View
              className="w-full border-t border-border bg-background px-5 pt-4"
              style={{ paddingBottom: Math.max(tokens.space[4], insets.bottom) }}
            >
              <Button
                onPress={() => setStep("confirm")}
                disabled={!canContinueForm}
                haptic
              >
                Lanjutkan
              </Button>
            </View>
          </View>
        ) : null}
        {step === "confirm" ? (
          // 2. Konfirmasi — tampilkan ringkasan, catatan, CTA bayar
          <View className="flex-1">
            <ScrollView
              className="flex-1"
              contentContainerClassName="px-5 pb-6 pt-6"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              {...dismissKeyboardOnDragProps}
            >
              <FadeIn duration="fast">
                <View className="gap-4">
                  <View className="gap-2">
                    <Heading level={1} className="text-balance">
                      Konfirmasi transfer
                    </Heading>
                    <Text variant="body" tone="secondary" className="text-pretty">
                      Periksa kembali detail di bawah sebelum melanjutkan.
                    </Text>
                  </View>
                  <TransactionSummary
                    label="Jumlah transfer"
                    amount={amount}
                    amountTone="primary"
                    subtitle={selected ? `Ke @${selected.username} · ${selected.name}` : undefined}
                  >
                    {/* D04 (batch 139): status validasi ulang penerima. */}
                    {revalidating ? (
                      <Text variant="caption" tone="secondary">
                        Memvalidasi ulang penerima…
                      </Text>
                    ) : null}
                    {revalidateError ? (
                      <View className="gap-2">
                        <Alert tone="danger" title="Validasi penerima gagal">
                          {revalidateError}
                        </Alert>
                        <Button
                          variant="secondary"
                          size="sm"
                          fullWidth={false}
                          onPress={() => setRevalidateNonce((n) => n + 1)}
                        >
                          Coba validasi lagi
                        </Button>
                      </View>
                    ) : null}
                    {selected ? (
                      // FE-IMP-4 item 10: kartu penerima besar di konfirmasi —
                      // avatar + nama + username menonjol agar salah kirim
                      // lebih sulit terjadi.
                      <View className="flex-row items-center gap-3 rounded-md bg-surface px-4 py-3">
                        <Avatar
                          source={selected.avatarUrl ? { uri: selected.avatarUrl } : undefined}
                          name={selected.name}
                          size="lg"
                          verified={selected.kycVerified === true}
                        />
                        <View className="flex-1 gap-0.5">
                          <Text variant="body" weight={700} numberOfLines={1}>
                            {selected.name}
                          </Text>
                          <Text variant="caption" tone="secondary" numberOfLines={1}>
                            @{selected.username}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                    {selected &&
                    !favorites.some((f) => f.id === selected.id) ? (
                      // FE-IMP-4 item 10: peringatan bila penerima bukan favorit.
                      <Alert tone="warning" title="Bukan penerima favorit">
                        Penerima ini tidak ada di daftar favorit Anda. Periksa
                        kembali username sebelum mengirim — transfer yang sudah
                        terkirim tidak bisa ditarik kembali.
                      </Alert>
                    ) : null}
                    {selected ? (
                      <KeyValue label="Penerima" value={`${selected.name} · @${selected.username}`} />
                    ) : null}
                    {note.trim() ? <KeyValue label="Catatan" value={note.trim()} /> : null}
                  </TransactionSummary>
                  <Text variant="caption" tone="secondary" className="text-pretty">
                    Masukkan PIN dompet Anda untuk menyetujui transfer. PIN digunakan untuk
                    melindungi setiap transaksi keluar dari dompet.
                  </Text>
                </View>
              </FadeIn>
            </ScrollView>
            <View
              className="w-full border-t border-border bg-background px-5 pt-4"
              style={{ paddingBottom: Math.max(tokens.space[4], insets.bottom) }}
            >
              {/*
               * D06 (batch 139): ringkasan total TETAP di area pin di atas CTA
               * (bukan di dalam ScrollView) — saat konten di-scroll atau
               * keyboard terbuka, total yang akan dibayar tetap terbaca tepat
               * sebelum tombol konfirmasi.
               */}
              <Text variant="caption" tone="secondary" className="pb-3 text-center">
                Total transfer {formatRupiah(amount)}
                {selected ? ` ke @${selected.username}` : ""}
              </Text>
              <Button
                // FE-IMP-4 item 11: kunci ganda — tombol konfirmasi ikut
                // disabled saat submit/progres berjalan (selain submitLock di
                // handlePin). Overlay progres non-dismissible (backdrop/back
                // Android tidak menutup saat progressState aktif).
                // D04 (batch 139): konfirmasi dikunci sampai penerima
                // tervalidasi ulang (revalidating / revalidateError).
                onPress={() => setStep("pin")}
                disabled={
                  !canContinueForm ||
                  submitting ||
                  progressState != null ||
                  revalidating ||
                  revalidateError != null
                }
                haptic
              >
                Konfirmasi & masukkan PIN
              </Button>
              <Button variant="ghost" onPress={handleBack} disabled={submitting}>
                Kembali
              </Button>
            </View>
          </View>
        ) : null}
        {step === "done" ? (
          // 3. Selesai
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="px-5 pt-6"
          >
            <FadeIn duration="fast">
              <View className="gap-4">
                <ReceiptTicket
                  status={transferReceiptStatus}
                  title={transferReceiptTitle}
                  amount={amount}
                  // Uang keluar — merah, konsisten dengan baris riwayat.
                  amountTone="danger"
                  // Kartu penerima premium di bawah nominal (bukan sekadar
                  // baris label-nilai) — nilai tetap dari `selected`.
                  recipient={
                    selected
                      ? {
                          name: selected.name,
                          detail: `@${selected.username}`,
                        }
                      : null
                  }
                  rows={[
                    ...(note.trim() ? [{ label: "Catatan", value: note.trim() }] : []),
                  ]}
                  receiptId={txId ?? makeReceiptId()}
                  qrDataUrl={transferQr}
                  ticketRef={ticketRef}
                  onShare={() => void shareReceipt(ticketRef.current)}
                />
                {txId ? (
                  <Button
                    variant="secondary"
                    onPress={() => router.replace(ROUTES.walletTransaction(txId))}
                  >
                    Lihat detail transaksi
                  </Button>
                ) : null}
                <Button variant="ghost" fullWidth={false} onPress={() => router.replace(ROUTES.wallet)}>
                  Kembali ke dompet
                </Button>
              </View>
            </FadeIn>
          </ScrollView>
        ) : null}
      </KeyboardAvoiding>
      {/* Editor catatan di BottomSheet — dibuka dari kartu di atas keypad */}
      <BottomSheet
        visible={noteSheetOpen}
        onRequestClose={() => setNoteSheetOpen(false)}
        title="Catatan"
        description="Opsional. Catatan ini diterima penerima bersama transfernya."
        avoidKeyboard
        footer={
          // Wrapper footer BottomSheet sudah px-5 pt-4 -> tanpa px-5 lagi.
          <View
            className="flex-row gap-3"
            style={{ paddingBottom: Math.max(tokens.space[4], insets.bottom) }}
          >
            {note.trim() ? (
              <Button
                variant="ghost"
                fullWidth={false}
                onPress={() => {
                  setNote("")
                  setNoteDraft("")
                  setNoteSheetOpen(false)
                }}
              >
                Hapus
              </Button>
            ) : null}
            <Button
              onPress={() => {
                setNote(noteDraft.slice(0, NOTE_MAX))
                setNoteSheetOpen(false)
              }}
              // UI-W006: di flex-row, w-full (default) mendorong tombol "Hapus"
              // keluar layar — pakai containerClassName seperti pola baku.
              containerClassName="flex-1"
            >
              Simpan catatan
            </Button>
          </View>
        }
      >
        <Field label="Catatan untuk penerima" helperText={`${noteDraft.length}/${NOTE_MAX}`}>
          <TextArea
            value={noteDraft}
            onChangeText={(value) => setNoteDraft(value.slice(0, NOTE_MAX))}
            placeholder="Contoh: buat bayar pesanan #123"
            multiline
            numberOfLines={4}
            autoFocus
          />
        </Field>
      </BottomSheet>
      {/* Progres transaksi full-screen setelah PIN disubmit (§8 signature) */}
      <TransactionProgressOverlay
        visible={progressState !== null}
        state={progressState ?? "PROCESSING"}
        processingMessage={translate("Mengirim {x} ke @{y}…", {
          x: formatRupiah(amount),
          y: selected?.username ?? "",
        })}
        successMessage="Transfer berhasil"
        failureMessage={progressError ?? "Transfer gagal. Coba lagi."}
      />
      {/* PIN verifikasi di BottomSheet */}
      <BottomSheet
        visible={step === "pin"}
        onRequestClose={() => {
          if (submitting) return
          // A-16 (audit 2026-09-22): pesan gagal percobaan sebelumnya tidak
          // boleh sempat dirender basi di overlay percobaan berikutnya.
          setProgressError(undefined)
          setPinError(undefined)
          setPinNotSet(false)
          setStep("confirm")
        }}
        title="Verifikasi PIN"
        description={translate(
          "Transfer {x} ke @{y} memerlukan PIN dompet Anda. PIN tidak akan terlihat.",
          { x: formatRupiah(amount), y: selected?.username ?? "" },
        )}
        avoidKeyboard
      >
        {hasPin === false || pinNotSet ? (
          // T3-004 (audit UI/UX): user belum punya PIN — satu-satunya jalan
          // yang benar adalah membuatnya, bukan menebak 6 digit sampai kena
          // rate-limit. Tombol mengarah ke layar Buat PIN; kembali ke sini
          // user bisa langsung memasukkan PIN barunya.
          <View className="gap-3">
            <Text variant="body" tone="secondary">
              Anda belum punya PIN dompet. Buat PIN dulu untuk mengirim uang.
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
      </BottomSheet>
      </Screen>
    </ScreenCaptureGuard>
  )
}
