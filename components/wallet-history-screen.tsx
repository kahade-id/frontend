import { useRouter } from "expo-router"
import { ArrowCircleDown, ArrowCircleUp } from "phosphor-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { api } from "@/lib/api"
import type { WalletTransaction } from "@/lib/api/wallet"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { WalletTransactionRow } from "@/components/ui/wallet-transaction-row"

export function WalletHistoryScreen({ kind }: { kind: "topup" | "withdraw" }) {
  const router = useRouter()
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
        renderItem={({ item }) => (
          // Gaya "vivid" (permintaan produk 2026-09-27): ikon berwarna
          // mengikuti status (hijau sukses, kuning proses, merah gagal),
          // nominal tegas (hijau masuk / merah keluar), tanggal selalu WIB
          // (konsisten — lihat UI-W001 di wallet-transaction-row).
          <WalletTransactionRow
            transaction={item}
            vivid
            onPress={() => router.push(ROUTES.walletTransaction(item.id))}
          />
        )}
      />
    </Screen>
  )
}
