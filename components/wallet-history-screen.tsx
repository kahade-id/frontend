import { memo, useCallback, useState } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"
import { ArrowCircleDown, ArrowCircleUp } from "phosphor-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { api, userMessage } from "@/lib/api"
import type { WalletTransaction } from "@/lib/api/wallet"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"
import { useToast } from "@/components/ui/toast"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { Dialog } from "@/components/ui/modal"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { WalletTransactionRow } from "@/components/ui/wallet-transaction-row"

type WalletHistoryRowProps = {
  item: WalletTransaction
  kind: "topup" | "withdraw"
  /** Handler stabil per-id — bukan closure per baris (FE-009). */
  onOpen: (id: string) => void
  onRequestCancel: (item: WalletTransaction) => void
}

/**
 * FE-009 (audit 2026-09-29): baris riwayat wallet di-memo — `renderItem`
 * inline + `onPress` inline per baris menjebol `memo` WalletTransactionRow.
 * Handler navigasi stabil menerima id; komputasi canCancel murah.
 */
const WalletHistoryRow = memo(function WalletHistoryRow({
  item,
  kind,
  onOpen,
  onRequestCancel,
}: WalletHistoryRowProps) {
  const canCancel =
    kind === "withdraw" && String(item.status ?? "").toUpperCase() === "PENDING_OTP"
  const handleOpen = useCallback(() => onOpen(item.id), [onOpen, item.id])
  const handleCancel = useCallback(() => onRequestCancel(item), [onRequestCancel, item])
  return (
    <View>
      {/* Gaya "vivid" (permintaan produk 2026-09-27): ikon berwarna
          mengikuti status (hijau sukses, kuning proses, merah gagal),
          nominal tegas (hijau masuk / merah keluar), tanggal selalu WIB
          (konsisten — lihat UI-W001 di wallet-transaction-row). */}
      <WalletTransactionRow transaction={item} vivid onPress={handleOpen} />
      {canCancel ? (
        <View className="-mt-1 flex-row gap-2 px-5 pb-3">
          {/* FE-IMP-4 item 3 — DITAHAN (fail closed, 2026-09-28): CTA
              "Lanjutkan bayar" dari riwayat butuh `paymentTxId` yang tidak
              ada di topup-history — jangan menebak identifier. */}
          <Button size="sm" variant="secondary" onPress={handleCancel}>
            Batalkan
          </Button>
        </View>
      ) : null}
    </View>
  )
})

export function WalletHistoryScreen({ kind }: { kind: "topup" | "withdraw" }) {
  const router = useRouter()
  const toast = useToast()
  const insets = useSafeAreaInsets()
  const query = usePaginatedQuery(
    `wallet-history:${kind}`,
    (page, signal) =>
      kind === "topup"
        ? api.wallet.getTopupHistory({ page, limit: 20 }, signal)
        : api.wallet.getWithdrawHistory({ page, limit: 20 }, signal),
    // F-01 (audit): paritas dengan wallet-history.tsx — riwayat uang basi
    // adalah bug kebenaran; refresh diam saat layar kembali fokus.
    // C-08 (audit): urutan kronologis mengikuti server.
    {
      refreshOnFocus: true,
      compare: byTimestampDesc<WalletTransaction>((tx) => tx.createdAt),
    },
  )

  // FE-IMP-4 item 9: pembatalan hanya untuk PENDING_OTP (satu-satunya status
  // yang didukung backend — lihat POST /v1/wallet/withdraw/cancel). Item lain
  // yang sudah diproses bank TIDAK ditawarkan tombol batal.
  const [cancelTarget, setCancelTarget] = useState<WalletTransaction | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const handleCancelWithdraw = async () => {
    if (!cancelTarget || cancelling) return
    setCancelling(true)
    try {
      await api.wallet.cancelWithdraw({ txId: cancelTarget.id })
      toast.show({
        title: "Penarikan dibatalkan",
        description: "Dana kembali ke saldo dompet Anda.",
        tone: "success",
      })
      setCancelTarget(null)
      await query.refresh()
    } catch (err) {
      toast.show({
        title: "Gagal membatalkan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setCancelling(false)
    }
  }

  // FE-009: handler stabil — navigasi menerima id, bukan closure per baris.
  const openTransaction = useCallback(
    (id: string) => router.push(ROUTES.walletTransaction(id)),
    [router],
  )
  const requestCancel = useCallback((item: WalletTransaction) => {
    setCancelTarget(item)
  }, [])
  const renderHistoryItem = useCallback(
    ({ item }: { item: WalletTransaction }) => (
      <WalletHistoryRow
        item={item}
        kind={kind}
        onOpen={openTransaction}
        onRequestCancel={requestCancel}
      />
    ),
    [kind, openTransaction, requestCancel],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={kind === "topup" ? "Riwayat Isi Saldo" : "Riwayat Penarikan"} />
      <PaginatedList
        {...query}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        gap={0}
        bottomPadding={insets.bottom + tokens.space[8]}
        empty={
          <EmptyState
            icon={kind === "topup" ? ArrowCircleDown : ArrowCircleUp}
            title={kind === "topup" ? "Belum ada top-up" : "Belum ada penarikan"}
            description="Riwayat transaksi akan muncul di sini."
            // UI-W013: empty state tanpa jalan keluar — tambahkan CTA aksi.
            action={
              <Button
                fullWidth={false}
                onPress={() => router.push(kind === "topup" ? ROUTES.topup : ROUTES.withdraw)}
              >
                {kind === "topup" ? "Isi saldo" : "Tarik dana"}
              </Button>
            }
          />
        }
        renderItem={renderHistoryItem}
      />
      <Dialog
        visible={cancelTarget != null}
        onRequestClose={() => (cancelling ? undefined : setCancelTarget(null))}
        title="Batalkan penarikan?"
        description="Penarikan ini belum diproses bank — dana akan kembali ke saldo dompet Anda."
        confirmLabel="Ya, batalkan"
        cancelLabel="Kembali"
        destructive
        loading={cancelling}
        onConfirm={() => void handleCancelWithdraw()}
      />
    </Screen>
  )
}
