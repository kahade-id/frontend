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
import { useCallback, useEffect, useState } from "react"
import { Platform, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router, type Href } from "expo-router"
import { FileCsv, FilePdf, Wallet as WalletIcon } from "phosphor-react-native"
import { File, Paths } from "expo-file-system"

import { api, type Wallet, type WalletTransaction } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { shareContent } from "@/lib/share"
import { tokens } from "@/lib/tokens"
import {
  WALLET_TXN_KIND,
  WALLET_TXN_LABELS,
  WALLET_TXN_STATUS,
  isWalletCredit,
} from "@/lib/wallet-labels"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { IconButton } from "@/components/ui/icon-button"
import { LoadMore } from "@/components/ui/load-more"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import {
  WalletBalanceCard,
  type WalletQuickAction,
} from "@/components/ui/wallet-balance-card"
import { WalletTransactionListItem } from "@/components/ui/wallet-transaction-list-item"
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
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const [walletError, setWalletError] = useState<string | null>(null)

  const [txns, setTxns] = useState<WalletTransaction[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [txnLoading, setTxnLoading] = useState(false)
  const [txnError, setTxnError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchWallet = useCallback(async () => {
    try {
      setWalletLoading(true)
      setWalletError(null)
      const data = await api.wallet.getWallet()
      setWallet(data)
    } catch {
      setWalletError("Gagal memuat saldo. Coba lagi.")
    } finally {
      setWalletLoading(false)
    }
  }, [])

  const fetchTxns = useCallback(async (nextPage: number, isRefresh = false) => {
    try {
      setTxnLoading(true)
      setTxnError(null)
      // type/from/to diisi default oleh helper (spec menandai required).
      const res = await api.wallet.getWalletTransactions({ page: nextPage, limit: PAGE_SIZE })
      const incoming = res.data ?? []
      setTxns((prev) => (isRefresh || nextPage === 1 ? incoming : [...prev, ...incoming]))
      setPage(nextPage)
      setHasMore(nextPage < (res.meta?.totalPages ?? 1))
    } catch {
      // Halaman pertama gagal → tampilkan error; load-more gagal → list tetap.
      if (nextPage === 1) setTxnError("Gagal memuat riwayat. Coba lagi.")
    } finally {
      setTxnLoading(false)
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([fetchWallet(), fetchTxns(1, true)])
    setRefreshing(false)
  }, [fetchWallet, fetchTxns])

  useEffect(() => {
    void fetchWallet()
    void fetchTxns(1)
  }, [fetchWallet, fetchTxns])

  const handleAction = useCallback((key: WalletQuickAction["key"]) => {
    router.push(ACTION_ROUTE[key])
  }, [])

  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null)

  /** Unduh file hasil export (web via anchor; native ditulis + share sheet). */
  const handleExport = useCallback(
    async (kind: "csv" | "pdf") => {
      setExporting(kind)
      try {
        const blob = kind === "csv" ? await api.wallet.exportWalletCsv() : await api.wallet.exportWalletPdf()
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

      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[4] } }}
      >
        {walletError ? (
          <ErrorState
            compact
            title="Gagal memuat saldo"
            description={walletError}
            onRetry={() => void fetchWallet()}
          />
        ) : (
          <WalletBalanceCard
            available={wallet?.availableBalance ?? wallet?.balance ?? 0}
            held={wallet?.holdBalance ?? 0}
            loading={walletLoading}
            onTopUp={() => handleAction("topup")}
            onWithdraw={() => handleAction("withdraw")}
            onTransfer={() => handleAction("transfer")}
            style={styles.balanceCard}
          />
        )}

        <SectionHeader title="Riwayat" inset />

        {txnError ? (
          <ErrorState
            title="Gagal memuat riwayat"
            description={txnError}
            onRetry={() => void fetchTxns(1)}
          />
        ) : txns.length === 0 ? (
          txnLoading ? null : (
            <EmptyState
              icon={WalletIcon}
              title="Belum ada riwayat"
              description="Transaksi dompet kamu akan muncul di sini."
            />
          )
        ) : (
          <View className="gap-1">
            {txns.map((item, index) => (
              <WalletTransactionListItem
                key={item.id}
                title={WALLET_TXN_LABELS[item.type] ?? item.type}
                type={isWalletCredit(item) ? "CREDIT" : "DEBIT"}
                amount={item.amount}
                kind={WALLET_TXN_KIND[item.type] ?? "other"}
                status={WALLET_TXN_STATUS[item.status ?? "COMPLETED"] ?? "SUCCESS"}
                timestamp={formatDateTime(item.createdAt)}
                reference={item.referenceId ?? undefined}
                onPress={() => router.push(ROUTES.walletTransaction(item.id))}
                divider={index < txns.length - 1}
              />
            ))}
            {hasMore ? (
              <LoadMore status={txnLoading ? "loading" : "idle"} onLoadMore={() => void fetchTxns(page + 1)} />
            ) : null}
          </View>
        )}
      </PullToRefresh>
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
})
