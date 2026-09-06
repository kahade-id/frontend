import { useApiQuery } from "@/lib/use-api-query"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { ErrorState } from "@/components/ui/error-state"
import { walletTransactionStatus } from "@/lib/wallet-labels"
import { AMOUNT_LIMITS, AMOUNT_PRESETS, isValidAmount } from "@/lib/financial"
/**
 * Screen — Transfer Dana.
 *
 * GET /v1/wallet/transfer/lookup?q= (debounce 300ms) → pilih penerima →
 * nominal (1.000 – 25.000.000) + catatan → PIN → POST /v1/wallet/transfer.
 *
 * Keputusan non-obvious:
 *   - Nominal diformat `formatRupiah` (lib/format), bukan `toLocaleString`
 *     (§13: manual, tanpa Intl).
 *   - Nomor transaksi TIDAK disalin otomatis ke clipboard: menimpa clipboard
 *     tanpa diminta mengejutkan pengguna. Ada <CopyableField> eksplisit di
 *     langkah selesai + tautan ke detail mutasi.
 *   - PIN salah ditampilkan sebagai `errorText` di PinInput (pengguna tetap
 *     di langkah PIN), bukan dilempar kembali ke form.
 */
import { useCallback, useRef, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, userMessage, type TransferDto } from "@/lib/api"
import { formatRupiah } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { AmountInput } from "@/components/ui/amount-input"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { CopyableField } from "@/components/ui/copyable-field"
import { Field } from "@/components/ui/field"
import { Header } from "@/components/ui/header"
import { PinInput } from "@/components/ui/pin-input"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import {
  TransferRecipientPicker,
  type TransferRecipient,
} from "@/components/ui/transfer-recipient-picker"
import { useToast } from "@/components/ui/toast"
import { useCopy } from "@/lib/clipboard"

const MIN_AMOUNT = AMOUNT_LIMITS.transfer.minimum
const MAX_AMOUNT = AMOUNT_LIMITS.transfer.maximum
const PRESETS = AMOUNT_PRESETS.transfer
const NOTE_MAX = 200

export default function TransferScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copied, copy } = useCopy()

  const [query, setQuery] = useState("")
  const [recent, setRecent] = useState<TransferRecipient[]>([])
  const [selected, setSelected] = useState<TransferRecipient | null>(null)
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState("")
  const [step, setStep] = useState<"form" | "pin" | "done">("form")
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
  const { refreshing, refresh: handleRefresh } = lookup
  const loading = lookup.loading || debounced !== query.trim()
  const handleQuery = useCallback((value: string) => {
    setQuery(value)
    setSelected(null)
  }, [])

  const handleSelect = useCallback((recipient: TransferRecipient) => {
    setSelected(recipient)
    setRecent((prev) =>
      prev.some((r) => r.id === recipient.id) ? prev : [recipient, ...prev].slice(0, 5),
    )
  }, [])

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
      } catch (error) {
        setPinError(`${userMessage(error)} Periksa riwayat sebelum mengirim ulang.`)
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [selected, amount, note, submitting, toast.show],
  )

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
        step === "form" ? (
          <View accessible={false}>
            <Button accessibilityHint="Ketuk untuk berinteraksi"
              fullWidth
              haptic
              disabled={!selected || !isValidAmount(amount, AMOUNT_LIMITS.transfer)}
              onPress={() => setStep("pin")}
            >
              Lanjut ke PIN
            </Button>
          </View>
        ) : undefined
      }
    >
      <Header title="Transfer Dana" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {step === "done" ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader
              title={
                walletTransactionStatus(transferStatus) === "SUCCESS"
                  ? "Transfer berhasil"
                  : walletTransactionStatus(transferStatus) === "FAILED"
                    ? "Transfer gagal"
                    : "Transfer diajukan"
              }
            />
            <Text variant="body">
              {formatRupiah(amount)} untuk @{selected?.username}. Periksa detail transaksi untuk
              status terakhir.
            </Text>
            {txId ? (
              <CopyableField
                label="Nomor transaksi"
                value={txId}
                mono
                copied={copied}
                onCopy={(v) => void copy(v)}
              />
            ) : null}
            {txId ? (
              <Button
                variant="secondary"
                onPress={() => router.replace(ROUTES.walletTransaction(txId))}
              >
                Lihat Detail Transaksi
              </Button>
            ) : null}
            <Button variant="ghost" fullWidth={false} onPress={() => router.replace(ROUTES.wallet)}>
              Kembali ke Dompet
            </Button>
          </View>
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Penerima" />
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
            <SectionHeader title="Nominal & catatan" />
            <AmountInput
              value={amount}
              onChange={setAmount}
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              presets={PRESETS}
              label="Nominal transfer"
            />
            <Field label="Catatan" helperText="Opsional">
              <TextArea
                value={note}
                onChangeText={setNote}
                placeholder="Catatan untuk penerima"
                maxLength={NOTE_MAX}
                multiline
                numberOfLines={3}
              />
            </Field>
          </View>
        )}
      </PullToRefresh>
      {/*
        SATU permukaan PIN saja (audit): sebelumnya ada DUA PinInput aktif untuk
        state `step === "pin"` — satu inline di konten, satu di BottomSheet —
        sehingga dua pad PIN terlihat bertumpuk dan keduanya bisa terpicu
        autofill sekaligus. BottomSheet dipertahankan karena membawa judul,
        deskripsi konteks nominal/penerima, dan avoidKeyboard; di belakangnya
        form tetap terlihat sehingga pengguna tidak kehilangan konteks.
      */}
      <BottomSheet
        visible={step === "pin"}
        onRequestClose={() => {
          if (!submitting) setStep("form")
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
