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
import { useCallback, useEffect, useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router, type Href } from "expo-router"
import { Wallet as WalletIcon } from "phosphor-react-native"

import { api, type Wallet, type WalletTransaction } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadMore } from "@/components/ui/load-more"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import {
  WalletBalanceCard,
  type WalletQuickAction,
} from "@/components/ui/wallet-balance-card"
import {
  WalletTransactionListItem,
  type WalletTxKind,
  type WalletTxStatus,
} from "@/components/ui/wallet-transaction-list-item"

// ------------------------------------------------------------------
// Konstanta layar
// ------------------------------------------------------------------

/** Spec GET /v1/wallet/transactions: page & limit required. */
const PAGE_SIZE = 20

/** Label mutasi — satu tempat; nilai asing dari backend ditampilkan apa adanya. */
const TXN_LABELS: Record<string, string> = {
  TOPUP: "Topup",
  WITHDRAWAL: "Penarikan",
  TRANSFER_IN: "Transfer Masuk",
  TRANSFER_OUT: "Transfer Keluar",
  ORDER_ESCROW: "Escrow Order",
  ORDER_RELEASE: "Pencairan Order",
  REFUND: "Refund",
  FEE: "Biaya Platform",
  CASHBACK: "Cashback",
}

/** Peta type API → ikon komponen (kind). Nilai asing → "other". */
const TXN_KIND: Record<string, WalletTxKind> = {
  TOPUP: "topup",
  WITHDRAWAL: "withdraw",
  TRANSFER_IN: "transfer_in",
  TRANSFER_OUT: "transfer_out",
  ORDER_ESCROW: "escrow_hold",
  ORDER_RELEASE: "escrow_release",
  REFUND: "refund",
  FEE: "fee",
  CASHBACK: "cashback",
}

/** Peta status API → status komponen (SUCCESS = default, tidak dirender). */
const TXN_STATUS: Record<string, WalletTxStatus> = {
  COMPLETED: "SUCCESS",
  SUCCESS: "SUCCESS",
  PENDING: "PENDING",
  FAILED: "FAILED",
}

/** Arah dana: field `direction` bila ada, fallback kategori. */
function isCredit(txn: WalletTransaction): boolean {
  if (txn.direction) return txn.direction === "CREDIT"
  return ["TOPUP", "TRANSFER_IN", "ORDER_RELEASE", "REFUND", "CASHBACK"].includes(txn.type)
}

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

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Dompet" />

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
                title={TXN_LABELS[item.type] ?? item.type}
                type={isCredit(item) ? "CREDIT" : "DEBIT"}
                amount={item.amount}
                kind={TXN_KIND[item.type] ?? "other"}
                status={TXN_STATUS[item.status ?? "COMPLETED"] ?? "SUCCESS"}
                timestamp={formatDateTime(item.createdAt)}
                reference={item.referenceId ?? undefined}
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
