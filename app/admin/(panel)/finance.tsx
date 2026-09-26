/**
 * Admin — Keuangan: ringkasan, antrean penarikan, transaksi.
 *
 * - Kartu ringkasan: total escrow aktif, revenue hari ini/bulan ini, antrean
 *   penarikan pending.
 * - (a) Antrean penarikan pending: Setujui / Tolak lewat BottomSheet
 *   konfirmasi (tolak wajib alasan ≥ 5 karakter). Double-tap aman:
 *   backend idempoten (Idempotency-Key per request) + tombol dikunci
 *   selama request berjalan.
 * - (b) Transaksi terakhir: pencarian sederhana + filter tipe.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useIsFocused } from "@react-navigation/native"
import { CheckCircle, Receipt } from "phosphor-react-native"

import { translate } from "@/lib/i18n/translate"
import { formatDateTimeWIB, formatRupiah } from "@/lib/format"
import { userMessage } from "@/lib/api/errors"
import {
  approveWithdrawal,
  getEscrowSummary,
  getFinancialSummary,
  listPendingWithdrawals,
  listTransactions,
  rejectWithdrawal,
  type AdminTransactionItem,
  type EscrowSummary,
  type FinancialSummary,
  type PendingWithdrawal,
  type WalletTransactionType,
} from "@/lib/api/admin/finance"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { Section } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const TX_PAGE_SIZE = 20

type TxMeta = { label: string; sign: "+" | "−" | "" }

const TX_META: Record<string, TxMeta> = {
  TOP_UP: { label: "Top up", sign: "+" },
  WITHDRAW: { label: "Penarikan", sign: "−" },
  ORDER_LOCK: { label: "Escrow dikunci", sign: "−" },
  ORDER_RELEASE: { label: "Escrow cair", sign: "+" },
  ORDER_REFUND: { label: "Refund order", sign: "+" },
  FEE_DEDUCT: { label: "Fee platform", sign: "−" },
  REFERRAL_REWARD: { label: "Reward referral", sign: "+" },
  SUBSCRIPTION_PAYMENT: { label: "Langganan", sign: "−" },
  ADMIN_CREDIT: { label: "Kredit admin", sign: "+" },
  ADMIN_DEBIT: { label: "Debit admin", sign: "−" },
  DISPUTE_RELEASE: { label: "Cair sengketa", sign: "+" },
  TRANSFER_SENT: { label: "Transfer keluar", sign: "−" },
  TRANSFER_RECEIVED: { label: "Transfer masuk", sign: "+" },
  CAMPAIGN_CASHBACK: { label: "Cashback", sign: "+" },
  TOPUP_BONUS: { label: "Bonus top up", sign: "+" },
}

const WITHDRAW_STATUS_LABEL: Record<string, string> = {
  PENDING_OTP: "Menunggu OTP",
  PENDING_PROCESS: "Menunggu proses",
  PROCESSING: "Diproses",
}

const STATUS_TONE: Record<string, BadgeTone> = {
  SUCCESS: "success",
  PENDING: "warning",
  FAILED: "danger",
}

const TYPE_FILTERS: Array<{ value?: WalletTransactionType; label: string }> = [
  { label: "Semua" },
  { value: "TOP_UP", label: "Top up" },
  { value: "WITHDRAW", label: "Penarikan" },
  { value: "ORDER_LOCK", label: "Escrow" },
  { value: "FEE_DEDUCT", label: "Fee" },
]

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card className="flex-1" padded>
      <Text variant="caption" tone="secondary">
        {translate(label)}
      </Text>
      <Text variant="h3" className="mt-1">
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" tone="secondary" className="mt-1">
          {hint}
        </Text>
      ) : null}
    </Card>
  )
}

export default function AdminFinanceScreen() {
  const toast = useToast()
  const isFocused = useIsFocused()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [escrow, setEscrow] = useState<EscrowSummary | null>(null)
  const [pending, setPending] = useState<PendingWithdrawal[]>([])
  const [pendingTotal, setPendingTotal] = useState(0)
  const [txs, setTxs] = useState<AdminTransactionItem[]>([])
  const [txTotal, setTxTotal] = useState(0)
  const [txPage, setTxPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [typeFilter, setTypeFilter] = useState<WalletTransactionType | undefined>(
    undefined,
  )
  const [search, setSearch] = useState("")

  const [sheet, setSheet] = useState<{
    tx: PendingWithdrawal
    action: "approve" | "reject"
  } | null>(null)
  const [note, setNote] = useState("")
  const [noteError, setNoteError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const [sum, esc, pend, txPage1] = await Promise.all([
          getFinancialSummary(),
          getEscrowSummary(),
          listPendingWithdrawals({ page: 1, limit: 20 }),
          listTransactions({
            page: 1,
            limit: TX_PAGE_SIZE,
            type: typeFilter,
            q: search || undefined,
          }),
        ])
        setSummary(sum)
        setEscrow(esc)
        setPending(pend.data)
        setPendingTotal(pend.total ?? pend.data.length)
        setTxs(txPage1.data)
        setTxTotal(txPage1.total ?? txPage1.data.length)
        setTxPage(1)
      } catch (err) {
        setError(userMessage(err))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [typeFilter, search],
  )

  useEffect(() => {
    if (isFocused) void load("initial")
  }, [isFocused, load])

  const openSheet = useCallback(
    (tx: PendingWithdrawal, action: "approve" | "reject") => {
      setSheet({ tx, action })
      setNote("")
      setNoteError(null)
    },
    [],
  )

  const closeSheet = useCallback(() => {
    if (submitting) return
    setSheet(null)
  }, [submitting])

  const handleConfirmAction = useCallback(async () => {
    if (!sheet || submitting) return
    const trimmed = note.trim()
    if (sheet.action === "reject" && trimmed.length < 5) {
      setNoteError(translate("Alasan minimal 5 karakter."))
      return
    }
    setSubmitting(true)
    try {
      if (sheet.action === "approve") {
        await approveWithdrawal(sheet.tx.txId, trimmed || undefined)
        toast.show({
          title: translate("Penarikan disetujui"),
          description: formatRupiah(sheet.tx.amount),
          tone: "success",
        })
      } else {
        await rejectWithdrawal(sheet.tx.txId, trimmed)
        toast.show({
          title: translate("Penarikan ditolak, saldo dikembalikan"),
          tone: "success",
        })
      }
      setSheet(null)
      await load("refresh")
    } catch (err) {
      toast.show({
        title: translate("Gagal memproses penarikan"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [sheet, submitting, note, toast, load])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || txs.length >= txTotal) return
    setLoadingMore(true)
    try {
      const next = await listTransactions({
        page: txPage + 1,
        limit: TX_PAGE_SIZE,
        type: typeFilter,
        q: search || undefined,
      })
      setTxs((prev) => [...prev, ...next.data])
      setTxTotal(next.total ?? txTotal)
      setTxPage((p) => p + 1)
    } catch (err) {
      toast.show({
        title: translate("Gagal memuat transaksi"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, txs.length, txTotal, txPage, typeFilter, search, toast])

  const summaryCards = useMemo(() => {
    if (!summary || !escrow) return null
    return (
      <View>
        <View className="flex-row gap-3">
          <StatCard
            label="Total escrow aktif"
            value={formatRupiah(escrow.totalEscrowBalance)}
            hint={translate("{x} order aktif", {
              x: String(escrow.activeEscrowOrders),
            })}
          />
          <StatCard
            label="Revenue bulan ini"
            value={formatRupiah(summary.totalPlatformFeeThisMonth)}
            hint={translate("Fee platform")}
          />
        </View>
        <View className="flex-row gap-3 mt-3">
          <StatCard
            label="Revenue hari ini"
            value={formatRupiah(summary.totalPlatformFeeToday)}
            hint={translate("Fee platform")}
          />
          <StatCard
            label="Antrean penarikan"
            value={formatRupiah(summary.pendingWithdrawalsAmount)}
            hint={translate("{x} menunggu", {
              x: String(summary.pendingWithdrawals),
            })}
          />
        </View>
      </View>
    )
  }, [summary, escrow])

  const sheetTitle = sheet
    ? sheet.action === "approve"
      ? translate("Setujui penarikan")
      : translate("Tolak penarikan")
    : ""

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={translate("Keuangan")} />
      <PullToRefresh
        onRefresh={() => load("refresh")}
        refreshing={refreshing}
        contentContainerClassName="px-5"
      >
        {loading ? (
          <LoadingScreen message={translate("Memuat data keuangan…")} />
        ) : error ? (
          <ErrorState
            title={translate("Gagal memuat data keuangan")}
            description={error}
            onRetry={() => load("initial")}
          />
        ) : (
          <View className="gap-6 pb-8 pt-3">
            <Section title={translate("Ringkasan")}>{summaryCards}</Section>

            <Section
              title={translate("Antrean penarikan")}
              subtitle={
                pendingTotal > 0
                  ? translate("{x} menunggu persetujuan", {
                      x: String(pendingTotal),
                    })
                  : undefined
              }
            >
              {pending.length === 0 ? (
                <EmptyState
                  icon={CheckCircle}
                  title={translate("Tidak ada penarikan pending")}
                  description={translate(
                    "Semua permintaan penarikan sudah diproses.",
                  )}
                  compact
                />
              ) : (
                <View className="gap-3">
                  {pending.map((tx) => (
                    <Card key={tx.txId} padded>
                      <View className="flex-row items-start justify-between gap-2">
                        <View className="flex-1">
                          <Text variant="body" weight={600}>
                            {tx.wallet?.user?.fullName ??
                              tx.wallet?.user?.email ??
                              tx.wallet?.userId ??
                              "—"}
                          </Text>
                          <Text variant="caption" tone="secondary" className="mt-0.5">
                            {[
                              tx.bankAccount?.bankCode,
                              tx.bankAccount?.accountNumber,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                            {tx.bankAccount?.accountName
                              ? ` — ${tx.bankAccount.accountName}`
                              : ""}
                          </Text>
                          <Text variant="caption" tone="secondary" className="mt-0.5">
                            {formatDateTimeWIB(tx.createdAt)}
                          </Text>
                        </View>
                        <Badge
                          tone="warning"
                          accessibilityLabel={WITHDRAW_STATUS_LABEL[
                            String(tx.withdrawStatus)
                          ]}
                        >
                          {translate(
                            WITHDRAW_STATUS_LABEL[String(tx.withdrawStatus)] ??
                              String(tx.withdrawStatus),
                          )}
                        </Badge>
                      </View>
                      <Text variant="h3" className="mt-2">
                        {formatRupiah(tx.amount)}
                      </Text>
                      <View className="flex-row gap-2 mt-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          onPress={() => openSheet(tx, "reject")}
                          accessibilityLabel={translate("Tolak penarikan")}
                        >
                          {translate("Tolak")}
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onPress={() => openSheet(tx, "approve")}
                          accessibilityLabel={translate("Setujui penarikan")}
                        >
                          {translate("Setujui")}
                        </Button>
                      </View>
                    </Card>
                  ))}
                </View>
              )}
            </Section>

            <Section title={translate("Transaksi terakhir")}>
              <DebouncedSearchField
                placeholder={translate("Cari txId, nama, nominal…")}
                initialQuery={search}
                onQueryChange={setSearch}
                accessibilityLabel={translate("Cari transaksi")}
              />
              <View className="flex-row flex-wrap gap-2 mt-3">
                {TYPE_FILTERS.map((f) => (
                  <Chip
                    key={f.label}
                    selected={typeFilter === f.value}
                    onPress={() => setTypeFilter(f.value)}
                    accessibilityLabel={translate("Filter {x}", {
                      x: f.label,
                    })}
                  >
                    {translate(f.label)}
                  </Chip>
                ))}
              </View>
              {txs.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title={translate("Belum ada transaksi")}
                  description={translate(
                    "Tidak ada transaksi pada rentang & filter ini.",
                  )}
                  compact
                  className="mt-3"
                />
              ) : (
                <View className="gap-2 mt-3">
                  {txs.map((tx) => {
                    const meta = TX_META[String(tx.type)] ?? {
                      label: String(tx.type),
                      sign: "" as const,
                    }
                    return (
                      <Card key={tx.txId} padded={false} className="px-4 py-3">
                        <View className="flex-row items-center justify-between gap-2">
                          <View className="flex-1">
                            <Text variant="body" weight={600}>
                              {translate(meta.label)}
                            </Text>
                            <Text
                              variant="caption"
                              tone="secondary"
                              className="mt-0.5"
                              numberOfLines={1}
                            >
                              {tx.wallet?.user?.fullName ??
                                tx.wallet?.user?.email ??
                                "—"}{" "}
                              • {formatDateTimeWIB(tx.createdAt)}
                            </Text>
                          </View>
                          <View className="items-end gap-1">
                            <Text
                              variant="body"
                              weight={700}
                              tone={meta.sign === "+" ? "success" : undefined}
                            >
                              {meta.sign}
                              {formatRupiah(tx.amount)}
                            </Text>
                            <Badge tone={STATUS_TONE[String(tx.status)] ?? "neutral"}>
                              {translate(String(tx.status))}
                            </Badge>
                          </View>
                        </View>
                      </Card>
                    )
                  })}
                  {txs.length < txTotal ? (
                    <Button
                      variant="secondary"
                      loading={loadingMore}
                      onPress={() => void handleLoadMore()}
                      className="mt-1"
                    >
                      {translate("Muat lebih banyak")}
                    </Button>
                  ) : null}
                </View>
              )}
            </Section>
          </View>
        )}
      </PullToRefresh>

      <BottomSheet
        visible={sheet !== null}
        onRequestClose={closeSheet}
        title={sheetTitle}
        description={
          sheet
            ? `${sheet.tx.wallet?.user?.fullName ?? sheet.tx.wallet?.user?.email ?? ""} • ${formatRupiah(sheet.tx.amount)}`
            : undefined
        }
        avoidKeyboard
        footer={
          <View className="flex-row gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onPress={closeSheet}
              disabled={submitting}
            >
              {translate("Batal")}
            </Button>
            <Button
              variant={sheet?.action === "reject" ? "destructive" : "primary"}
              className="flex-1"
              loading={submitting}
              onPress={() => void handleConfirmAction()}
            >
              {sheet?.action === "reject"
                ? translate("Tolak penarikan")
                : translate("Setujui penarikan")}
            </Button>
          </View>
        }
      >
        {sheet?.action === "reject" ? (
          <Text variant="body" tone="secondary">
            {translate(
              "Penarikan yang ditolak akan mengembalikan saldo ke wallet user. Tulis alasan yang jelas.",
            )}
          </Text>
        ) : (
          <Text variant="body" tone="secondary">
            {translate(
              "Penarikan yang disetujui akan diproses ke rekening tujuan. Tindakan ini tidak bisa dibatalkan.",
            )}
          </Text>
        )}
        <Input
          label={
            sheet?.action === "reject"
              ? translate("Alasan penolakan")
              : translate("Catatan (opsional)")
          }
          required={sheet?.action === "reject"}
          multiline
          numberOfLines={3}
          value={note}
          onChangeText={(v) => {
            setNote(v)
            if (noteError) setNoteError(null)
          }}
          errorText={noteError ?? undefined}
          placeholder={
            sheet?.action === "reject"
              ? translate("Contoh: nama rekening tidak sesuai…")
              : translate("Contoh: disetujui setelah verifikasi…")
          }
          className="mt-3"
        />
      </BottomSheet>
    </Screen>
  )
}
