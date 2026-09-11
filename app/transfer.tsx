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
import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, userMessage, type TransferDto } from "@/lib/api"
import { formatRupiah } from "@/lib/format"
import { dismissKeyboardOnDragProps } from "@/lib/keyboard"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { AMOUNT_LIMITS, AMOUNT_PRESETS, isValidAmount } from "@/lib/financial"
import { useApiQuery } from "@/lib/use-api-query"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { walletTransactionStatus } from "@/lib/wallet-labels"

import { PencilSimpleLine } from "phosphor-react-native"

import { AmountKeypad } from "@/components/ui/amount-keypad"
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
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { TransactionSummary } from "@/components/ui/transaction-summary"
import {
  TransferRecipientPicker,
  type TransferRecipient,
} from "@/components/ui/transfer-recipient-picker"
import { useToast } from "@/components/ui/toast"

const MIN_AMOUNT = AMOUNT_LIMITS.transfer.minimum
const MAX_AMOUNT = AMOUNT_LIMITS.transfer.maximum
const PRESETS = AMOUNT_PRESETS.transfer
const NOTE_MAX = 200
const TOTAL_STEPS = 3

type Step = "form" | "confirm" | "pin" | "done"

export default function TransferScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const params = useLocalSearchParams<{ to?: string }>()
  const presetUsername = typeof params.to === "string" ? params.to : undefined

  // Ambil saldo dompet untuk batas transfer & tampilkan di keypad
  const balanceQuery = useApiQuery<{ balance: number }>("wallet-overview-transfer", async (signal) => {
    try {
      const w = await api.wallet.getWallet(signal)
      return { balance: w.balance ?? 0 }
    } catch {
      return { balance: 0 }
    }
  })
  const balance = balanceQuery.data?.balance

  const [query, setQuery] = useState(presetUsername ?? "")
  const [recent, setRecent] = useState<TransferRecipient[]>([])
  const [selected, setSelected] = useState<TransferRecipient | null>(null)
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState("")
  const [noteDraft, setNoteDraft] = useState("")
  const [noteSheetOpen, setNoteSheetOpen] = useState(false)
  const [step, setStep] = useState<Step>("form")
  const [pinError, setPinError] = useState<string | undefined>()
  const [txId, setTxId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [transferStatus, setTransferStatus] = useState<string | undefined>()
  const submitLock = useRef(false)
  const debounced = useDebouncedValue(query.trim())
  const lookup = useApiQuery(
    `recipients:${debounced}`,
    (signal) => api.wallet.lookupTransferRecipient(debounced, signal),
    debounced.length >= 3 && query.trim() === debounced,
  )
  const results: TransferRecipient[] = (lookup.data ?? []).map((r) => ({
    id: r.id,
    name: r.fullName ?? r.username,
    username: r.username,
    avatarUrl: r.avatarUrl ?? undefined,
    kycVerified: r.kycVerified,
  }))
  const loading = lookup.loading || debounced !== query.trim()

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
    setRecent((prev) =>
      prev.some((r) => r.id === recipient.id) ? prev : [recipient, ...prev].slice(0, 5),
    )
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
      submitLock.current = true
      setSubmitting(true)
      setPinError(undefined)
      try {
        const dto: TransferDto = {
          recipientId: selected.id,
          amount,
          pin: pinValue,
          note: note.trim() || undefined,
        }
        const res = await api.wallet.transferFunds(dto)
        setTxId(res.txId ?? null)
        setTransferStatus(res.status)
        setStep("done")
        toast.show({
          title:
            walletTransactionStatus(res.status) === "SUCCESS"
              ? "Transfer berhasil"
              : "Status transfer diterima",
          tone: walletTransactionStatus(res.status) === "SUCCESS" ? "success" : "info",
        })
      } catch (err) {
        setPinError(`${userMessage(err)} Periksa riwayat sebelum mengirim ulang.`)
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [selected, amount, note, toast.show],
  )

  const maxAmount =
    balance && balance > 0 ? Math.min(MAX_AMOUNT, balance) : MAX_AMOUNT

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
              contentContainerClassName="px-6 pb-6 pt-6"
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
                    recent={recent}
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
              className="w-full border-t border-border bg-background px-6 pt-4"
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
            <ScrollView
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerClassName="px-6"
            >
              <FadeIn duration="fast">
                <View className="items-center gap-2 pt-6">
                  {selected?.avatarUrl ? null : (
                    <View className="mb-1" />
                  )}
                  <Heading level={1} className="text-center text-balance">
                    Kirim ke @{selected?.username}
                  </Heading>
                  <Text variant="body" tone="secondary" className="text-center text-pretty">
                    {selected?.name}
                    {selected?.kycVerified ? " · Terverifikasi" : ""}
                  </Text>
                </View>
              </FadeIn>
            </ScrollView>

            {/* Catatan ditulis DI SINI lewat BottomSheet (kartu di atas
                keypad), bukan di langkah konfirmasi. */}
            <View className="px-6 pb-2">
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

            <AmountKeypad
              value={amount}
              onChange={setAmount}
              min={MIN_AMOUNT}
              max={maxAmount}
              presets={PRESETS}
              balance={balance}
              helperText={
                balance == null
                  ? `Minimal ${formatRupiah(MIN_AMOUNT)}`
                  : undefined
              }
            />

            <View
              className="w-full border-t border-border bg-background px-6 pt-4"
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
              contentContainerClassName="px-6 pb-6 pt-6"
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
              className="w-full border-t border-border bg-background px-6 pt-4"
              style={{ paddingBottom: Math.max(tokens.space[4], insets.bottom) }}
            >
              <Button
                onPress={() => setStep("pin")}
                disabled={!canContinueForm}
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
            contentContainerClassName="px-6 pt-6"
          >
            <FadeIn duration="fast">
              <View className="gap-4">
                <TransactionSummary
                  label={
                    walletTransactionStatus(transferStatus) === "SUCCESS"
                      ? "Transfer berhasil"
                      : walletTransactionStatus(transferStatus) === "FAILED"
                        ? "Transfer gagal"
                        : "Transfer diajukan"
                  }
                  amount={amount}
                  amountTone={
                    walletTransactionStatus(transferStatus) === "SUCCESS"
                      ? "success"
                      : walletTransactionStatus(transferStatus) === "FAILED"
                        ? "danger"
                        : "primary"
                  }
                  subtitle={selected ? `Ke @${selected.username} · ${selected.name}` : undefined}
                >
                  {txId ? <KeyValue label="Nomor transaksi" value={txId} mono /> : null}
                  {note.trim() ? <KeyValue label="Catatan" value={note.trim()} /> : null}
                </TransactionSummary>

                <Text variant="body" tone="secondary" className="text-pretty">
                  {formatRupiah(amount)} telah dikirim ke @{selected?.username}.
                  Periksa detail transaksi untuk status terakhir.
                </Text>

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
          <View
            className="flex-row gap-3 px-6"
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

      {/* PIN verifikasi di BottomSheet */}
      <BottomSheet
        visible={step === "pin"}
        onRequestClose={() => {
          if (!submitting) setStep("confirm")
        }}
        title="Verifikasi PIN"
        description={`Transfer ${formatRupiah(amount)} ke @${selected?.username ?? ""} memerlukan PIN dompet Anda. PIN tidak akan terlihat.`}
        avoidKeyboard
      >
        <PinInput
          mode="enter"
          onComplete={(p) => void handlePin(p)}
          errorText={pinError}
          disabled={submitting}
        />
      </BottomSheet>
    </Screen>
  )
}
