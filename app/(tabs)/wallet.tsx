import { useApiQuery } from "@/lib/use-api-query"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { PaginatedList } from "@/components/ui/paginated-list"
import { WalletTransactionRow } from "@/components/ui/wallet-transaction-row"
/**
 * Tab #3 — Dompet
 *
 * Menampilkan:
 *  - <WalletBalanceCard> — saldo tersedia + saldo tertahan escrow + aksi
 *    cepat (isi saldo / tarik / transfer) — komponen sistem, bukan markup
 *    custom: jumlah, format Mono, sembunyikan saldo, skeleton & a11y
 *    sudah ditangani di satu tempat.
 *  - Riwayat mutasi `GET /v1/wallet/transactions` (paginasi + load-more)
 *    dirender dengan <WalletTransactionListItem> — ikon, tanda +/−, status
 *    PENDING/FAILED, & referensi dari komponen sistem.
 *
 * Kontrak API:
 *  - GET /v1/wallet → saldo
 *  - GET /v1/wallet/transactions?page&limit&type&from&to → riwayat
 *    (spec menandai `type/from/to` required; helper lib/api/wallet.ts
 *    mengisi default yang terdokumentasi di sana)
 *
 * Pull-to-refresh memakai <PullToRefresh> logo Kahade (§9.13), bukan
 * RefreshControl: riwayat + saldo di-refresh bersamaan (Promise.all).
 */
import { useCallback, useState } from "react"
import { Platform, StyleSheet, View } from "react-native"
import { router, type Href } from "expo-router"
import {
  ArrowCircleDown,
  ArrowCircleUp,
  CalendarCheck,
  FileCsv,
  FilePdf,
  Wallet as WalletIcon,
} from "phosphor-react-native"
import { File, Paths } from "expo-file-system"

import { api, type WalletTransaction } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { shareContent } from "@/lib/share"
import { tokens } from "@/lib/tokens"

import { Chip } from "@/components/ui/chip"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { IconButton } from "@/components/ui/icon-button"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { WalletBalanceCard, type WalletQuickAction } from "@/components/ui/wallet-balance-card"
import { useToast } from "@/components/ui/toast"

// ------------------------------------------------------------------
// Konstanta layar
// ------------------------------------------------------------------

/** Spec GET /v1/wallet/transactions: page & limit required. */
const PAGE_SIZE = 20

/** Peta aksi cepat → route (semua screen sudah ada di lib/routes.ts). */
const ACTION_ROUTE: Record<WalletQuickAction["key"], Href> = {
  topup: ROUTES.topup,
  withdraw: ROUTES.withdraw,
  transfer: ROUTES.transfer,
}

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function WalletScreen() {
  const toast = useToast()

  const balance = useApiQuery("wallet-balance", () => api.wallet.getWallet())
  const history = usePaginatedQuery<WalletTransaction>("wallet-history", (page, signal) =>
    api.wallet.getWalletTransactions({ page, limit: PAGE_SIZE }, signal),
  )
  const wallet = balance.data
  const walletLoading = balance.loading
  const walletError = balance.error
  const fetchWallet = balance.reload
  const handleRefresh = useCallback(async () => {
    await Promise.all([balance.refresh(), history.refresh()])
  }, [balance.refresh, history.refresh])
  const handleAction = useCallback((key: WalletQuickAction["key"]) => {
    router.push(ACTION_ROUTE[key])
  }, [])

  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null)

  /** Unduh file hasil export (web via anchor; native ditulis + share sheet). */
  const handleExport = useCallback(
    async (kind: "csv" | "pdf") => {
      setExporting(kind)
      try {
        const blob =
          kind === "csv" ? await api.wallet.exportWalletCsv() : await api.wallet.exportWalletPdf()
        const filename = `kahade-wallet.${kind}`
        const mimeType = kind === "csv" ? "text/csv" : "application/pdf"
        if (Platform.OS === "web") {
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = filename
          a.click()
          URL.revokeObjectURL(url)
        } else {
          const file = new File(Paths.cache, filename)
          file.write(new Uint8Array(await blob.arrayBuffer()))
          await shareContent({ fileUri: file.uri, mimeType, dialogTitle: filename })
        }
        toast.show({ title: "Export dompet berhasil", tone: "success", duration: 3000 })
      } catch {
        toast.show({ title: "Gagal mengekspor riwayat", tone: "danger" })
      } finally {
        setExporting(null)
      }
    },
    [toast.show],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        showBack={false}
        title="Dompet"
        right={
          <>
            <IconButton
              icon={FileCsv}
              size="md"
              variant="ghost"
              accessibilityLabel="Export riwayat CSV"
              disabled={exporting !== null}
              onPress={() => void handleExport("csv")}
            />
            <IconButton
              icon={FilePdf}
              size="md"
              variant="ghost"
              accessibilityLabel="Export riwayat PDF"
              disabled={exporting !== null}
              onPress={() => void handleExport("pdf")}
            />
          </>
        }
      />

      <PaginatedList
        {...history}
        onRefresh={handleRefresh}
        refreshing={balance.refreshing || history.refreshing}
        onRetry={history.reload}
        onLoadMore={history.loadMore}
        renderItem={({ item }) => (
          <WalletTransactionRow
            transaction={item}
            onPress={() => router.push(ROUTES.walletTransaction(item.id))}
          />
        )}
        empty={
          <EmptyState
            icon={WalletIcon}
            title="Belum ada riwayat"
            description="Transaksi dompet Anda akan muncul di sini."
          />
        }
        header={
          <View>
            {walletError ? (
              <ErrorState
                compact
                title="Gagal memuat saldo"
                description={walletError}
                onRetry={() => void fetchWallet()}
              />
            ) : (
              <WalletBalanceCard
                available={wallet?.availableBalance}
                held={wallet?.holdBalance}
                loading={walletLoading}
                onTopUp={() => handleAction("topup")}
                onWithdraw={() => handleAction("withdraw")}
                onTransfer={() => handleAction("transfer")}
                style={styles.balanceCard}
              />
            )}

            {/* Riwayat per jenis + jadwal penarikan — chip navigasi, bukan filter lokal */}
            <View className="flex-row flex-wrap gap-2" style={styles.links}>
              <Chip icon={ArrowCircleDown} onPress={() => router.push(ROUTES.topupHistory)}>
                Riwayat Top-up
              </Chip>
              <Chip icon={ArrowCircleUp} onPress={() => router.push(ROUTES.withdrawHistory)}>
                Riwayat Penarikan
              </Chip>
              <Chip icon={CalendarCheck} onPress={() => router.push(ROUTES.withdrawalSchedules)}>
                Jadwal Penarikan
              </Chip>
            </View>

            <SectionHeader title="Riwayat" />
          </View>
        }
      />
    </Screen>
  )
}

// ------------------------------------------------------------------
// StyleSheet
// ------------------------------------------------------------------

const styles = StyleSheet.create({
  balanceCard: {
    marginTop: tokens.space[3],
    marginBottom: tokens.space[2],
  },
  links: {
    marginBottom: tokens.space[2],
  },
})
