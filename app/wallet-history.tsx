/**
 * Screen — Riwayat Dompet (SEMUA mutasi dalam satu daftar).
 *
 * Endpoint: GET /v1/wallet/transactions?page&limit&type&from&to
 *           GET /v1/wallet/export/csv · /export/pdf (tombol di header)
 *
 * Kenapa layar ini ada: Tab Dompet dulu hanya menawarkan riwayat PER KATEGORI
 * (chip "Riwayat Top-up", "Riwayat Penarikan", "Jadwal Penarikan") sehingga
 * tidak ada satu tempat untuk melihat seluruh pergerakan dana berurutan.
 * Sekarang Tab Dompet menampilkan 10 mutasi terbaru + "Lihat semua" ke layar
 * ini, dan filter jenis menjadi chip di dalam SATU daftar (bukan layar
 * terpisah per kategori).
 *
 * Keputusan non-obvious:
 *   - Filter jenis memakai nilai enum API PERSIS (kunci `WALLET_TXN_LABELS`)
 *     dan dikirim sebagai query `type`; "Semua" TIDAK mengirim `type` sama
 *     sekali — helper lib/api/wallet.ts sudah menolak nilai "ALL" karena
 *     backend tidak mengenalnya.
 *   - Mengganti filter = key query baru (`wallet-history:${type}`) sehingga
 *     `usePaginatedQuery` meng-abort request filter lama dan memulai dari
 *     halaman 1. Tanpa itu, hasil filter lama bisa masuk setelah filter baru.
 *   - Rentang tanggal mengikuti default helper (≤ 90 hari, batas backend) dan
 *     dinyatakan ke pengguna lewat teks bantuan, bukan disembunyikan: tanpa
 *     keterangan itu mutasi lama terlihat "hilang".
 *   - Baris memakai `href` ke detail mutasi agar di web menjadi tautan nyata.
 */
import { useState } from "react"
import { View } from "react-native"
import { FileCsv, FilePdf, Wallet as WalletIcon } from "phosphor-react-native"

import { api, type WalletTransaction } from "@/lib/api"
import { formatRupiah } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { WALLET_TXN_LABELS, walletTransactionType } from "@/lib/wallet-labels"
import { useWalletExport } from "@/lib/use-wallet-export"

import { Chip } from "@/components/ui/chip"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { IconButton } from "@/components/ui/icon-button"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { ScrollRow } from "@/components/ui/scroll-row"
import { Text } from "@/components/ui/text"
import { WalletTransactionRow } from "@/components/ui/wallet-transaction-row"

const PAGE_SIZE = 20
const ALL = "ALL"

/** Chip filter: "Semua" + satu chip per jenis mutasi yang dikenal UI. */
const TYPE_FILTERS: Array<{ label: string; value: string }> = [
  { label: "Semua", value: ALL },
  ...Object.entries(WALLET_TXN_LABELS).map(([value, label]) => ({ label, value })),
]

export default function WalletHistoryScreen() {
  const [type, setType] = useState(ALL)
  const { exporting, exportWallet } = useWalletExport()

  const query = usePaginatedQuery<WalletTransaction>(`wallet-history:${type}`, (page, signal) =>
    api.wallet.getWalletTransactions({ page, limit: PAGE_SIZE, type }, signal),
  )
  const items = query.data

  /** Ringkasan halaman yang sudah dimuat — bukan total akun (lihat catatan file). */
  const loadedIn = items
    .filter((tx) => walletTransactionType(tx) === "CREDIT")
    .reduce((sum, tx) => sum + (tx.amount || 0), 0)
  const loadedOut = items
    .filter((tx) => walletTransactionType(tx) === "DEBIT")
    .reduce((sum, tx) => sum + (tx.amount || 0), 0)

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title="Riwayat Dompet"
        right={
          <>
            <IconButton
              icon={FileCsv}
              size="md"
              variant="ghost"
              accessibilityLabel="Unduh riwayat dompet CSV"
              disabled={exporting !== null}
              onPress={() => void exportWallet("csv")}
            />
            <IconButton
              icon={FilePdf}
              size="md"
              variant="ghost"
              accessibilityLabel="Unduh riwayat dompet untuk dicetak"
              disabled={exporting !== null}
              onPress={() => void exportWallet("pdf")}
            />
          </>
        }
      />

      <PaginatedList
        {...query}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        gap={0}
        header={
          <View className="gap-2 pb-3">
            <ScrollRow bleed gap={2} accessibilityLabel="Saring riwayat berdasarkan jenis">
              {TYPE_FILTERS.map((filter) => (
                <Chip
                  key={filter.value}
                  selected={type === filter.value}
                  accessibilityState={{ selected: type === filter.value }}
                  onPress={() => setType(filter.value)}
                >
                  {filter.label}
                </Chip>
              ))}
            </ScrollRow>

            {items.length > 0 ? (
              <View>
                <Text variant="caption" tone="secondary">
                  {`${items.length} mutasi dimuat · masuk ${formatRupiah(loadedIn)} · keluar ${formatRupiah(loadedOut)}`}
                </Text>
              </View>
            ) : null}
          </View>
        }
        footer={
          <View className="gap-2 pt-4">
            <Text variant="caption" tone="tertiary">
              Riwayat ditampilkan maksimal 90 hari terakhir. Unduh CSV untuk rentang lengkap yang
              disediakan server.
            </Text>
          </View>
        }
        empty={
          <EmptyState
            icon={WalletIcon}
            title={type === ALL ? "Belum ada riwayat" : "Tidak ada mutasi jenis ini"}
            description={
              type === ALL
                ? "Semua pergerakan dana Anda (top-up, penarikan, transfer, escrow) akan muncul di sini."
                : "Coba jenis lain atau hapus filter untuk melihat seluruh mutasi."
            }
          />
        }
        renderItem={({ item, index }) => (
          <WalletTransactionRow
            transaction={item}
            href={ROUTES.walletTransaction(item.id)}
            divider={index < items.length - 1}
          />
        )}
      />
    </Screen>
  )
}
