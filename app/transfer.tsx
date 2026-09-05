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
import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, type TransferDto } from "@/lib/api"
import { formatRupiah } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { AmountInput } from "@/components/ui/amount-input"
import { Button } from "@/components/ui/button"
import { CopyableField } from "@/components/ui/copyable-field"
import { Header } from "@/components/ui/header"
import { PinInput } from "@/components/ui/pin-input"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { TransferRecipientPicker, type TransferRecipient } from "@/components/ui/transfer-recipient-picker"
import { useToast } from "@/components/ui/toast"
import { useCopy } from "@/lib/clipboard"

const MIN_AMOUNT = 1_000
const MAX_AMOUNT = 25_000_000
const PRESETS = [25_000, 50_000, 100_000, 500_000, 1_000_000]
const LOOKUP_DEBOUNCE = 300
const NOTE_MAX = 200

export default function TransferScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copied, copy } = useCopy()

  const [query, setQuery] = useState("")
  const [results, setResults] = useState<TransferRecipient[]>([])
  const [recent, setRecent] = useState<TransferRecipient[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<TransferRecipient | null>(null)
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState("")
  const [step, setStep] = useState<"form" | "pin" | "done">("form")
  const [pinError, setPinError] = useState<string | undefined>()
  const [txId, setTxId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doLookup = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const res = await api.wallet.lookupTransferRecipient(q.trim())
      setResults((res ?? []).map((r) => ({
        id: r.id,
        name: r.fullName ?? r.username,
        username: r.username,
        avatarUrl: r.avatarUrl ?? undefined,
        kycVerified: !!r.kycVerified,
      })))
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleQuery = useCallback(
    (q: string) => {
      setQuery(q)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => void doLookup(q), LOOKUP_DEBOUNCE)
    },
    [doLookup],
  )

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    if (query.trim()) await doLookup(query)
    setRefreshing(false)
  }, [doLookup, query])

  const handleSelect = useCallback(
    (recipient: TransferRecipient) => {
      setSelected(recipient)
      setRecent((prev) =>
        prev.some((r) => r.id === recipient.id) ? prev : [recipient, ...prev].slice(0, 5),
      )
    },
    [],
  )

  const handlePin = useCallback(
    async (pinValue: string) => {
      if (!selected || !amount) return
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
        setStep("done")
        toast.show({ title: "Transfer berhasil", tone: "success" })
      } catch {
        setPinError("PIN salah atau saldo tidak mencukupi. Coba lagi.")
      } finally {
        setSubmitting(false)
      }
    },
    [selected, amount, note, toast.show],
  )

  return (
    <Screen
      edges={["top"]}
      padded={false}
      footer={
        step === "form" ? (
          <View className="px-6 pb-4">
            <Button
              fullWidth
              disabled={!selected || !amount || amount < MIN_AMOUNT}
              onPress={() => setStep("pin")}
            >
              Lanjut
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
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {step === "pin" ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Verifikasi PIN" />
            <Text variant="body" tone="secondary">
              Transfer {formatRupiah(amount)} ke{" "}
              <Text variant="monoBody" tone="primary">
                @{selected?.username}
              </Text>{" "}
              memerlukan PIN dompet Anda.
            </Text>
            <PinInput mode="enter" onComplete={(p) => void handlePin(p)} errorText={pinError} disabled={submitting} />
            <Button variant="ghost" fullWidth={false} onPress={() => setStep("form")} disabled={submitting}>
              Batal
            </Button>
          </View>
        ) : step === "done" ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Transfer berhasil" />
            <Text variant="body">
              {formatRupiah(amount)} telah dikirim ke @{selected?.username}.
            </Text>
            {txId ? (
              <CopyableField label="Nomor transaksi" value={txId} mono copied={copied} onCopy={(v) => void copy(v)} />
            ) : null}
            {txId ? (
              <Button variant="secondary" onPress={() => router.replace(ROUTES.walletTransaction(txId))}>
                Lihat Detail Transaksi
              </Button>
            ) : null}
            <Button variant="ghost" fullWidth={false} onPress={() => router.back()}>
              Kembali ke Dompet
            </Button>
          </View>
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Penerima" inset />
            <TransferRecipientPicker
              query={query}
              onQueryChange={handleQuery}
              results={results}
              recent={recent}
              loading={loading}
              value={selected?.id}
              onSelect={handleSelect}
            />

            <SectionHeader title="Nominal & catatan" inset />
            <AmountInput
              value={amount}
              onChange={setAmount}
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              presets={PRESETS}
              label="Nominal transfer"
            />
            <TextArea
              value={note}
              onChangeText={setNote}
              placeholder="Catatan (opsional)"
              maxLength={NOTE_MAX}
              multiline
              numberOfLines={3}
            />
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
