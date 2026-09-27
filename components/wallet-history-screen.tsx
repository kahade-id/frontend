import { useState } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"
import { ArrowCircleDown, ArrowCircleUp } from "phosphor-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { api, userMessage } from "@/lib/api"
import type { WalletTransaction } from "@/lib/api/wallet"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"
import { walletTransactionStatus } from "@/lib/wallet-labels"
import { useToast } from "@/components/ui/toast"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { Dialog } from "@/components/ui/modal"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { WalletTransactionRow } from "@/components/ui/wallet-transaction-row"

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

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={kind === "topup" ? "Riwayat Top-up" : "Riwayat Penarikan"} />
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
        renderItem={({ item }) => {
          const status = walletTransactionStatus(item.status)
          // FE-IMP-4 item 3: top-up PENDING → "Lanjutkan bayar" langsung ke
          // kartu status pembayaran.
          const canResume = kind === "topup" && status === "PENDING"
          const canCancel =
            kind === "withdraw" && String(item.status ?? "").toUpperCase() === "PENDING_OTP"
          return (
            <View>
              {/* Gaya "vivid" (permintaan produk 2026-09-27): ikon berwarna
                  mengikuti status (hijau sukses, kuning proses, merah gagal),
                  nominal tegas (hijau masuk / merah keluar), tanggal selalu WIB
                  (konsisten — lihat UI-W001 di wallet-transaction-row). */}
              <WalletTransactionRow
                transaction={item}
                vivid
                onPress={() => router.push(ROUTES.walletTransaction(item.id))}
              />
              {canResume || canCancel ? (
                <View className="-mt-1 flex-row gap-2 px-5 pb-3">
                  {canResume ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() =>
                        router.push(
                          `${ROUTES.topup}?resumePayment=${encodeURIComponent(item.id)}`,
                        )
                      }
                    >
                      Lanjutkan bayar
                    </Button>
                  ) : null}
                  {canCancel ? (
                    <Button size="sm" variant="secondary" onPress={() => setCancelTarget(item)}>
                      Batalkan
                    </Button>
                  ) : null}
                </View>
              ) : null}
            </View>
          )
        }}
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
