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
 * Aksi topup/withdraw/transfer memetakan POST /v1/wallet/topup|withdraw|
 * transfer — screen-nya belum dibuat, jadi handler menampilkan toast info
 * (bukan push ke route yang belum ada).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { FlatList, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Wallet as WalletIcon } from "phosphor-react-native"

import { api, type Wallet, type WalletTransaction } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { useComingSoon } from "@/lib/navigation"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadMore } from "@/components/ui/load-more"
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
const ON_END_THRESHOLD = 0.3

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

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function WalletScreen() {
  const insets = useSafeAreaInsets()
  const comingSoon = useComingSoon()

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

  const handleAction = useCallback(
    (key: WalletQuickAction["key"]) => {
      const label =
        key === "topup" ? "Isi Saldo" : key === "withdraw" ? "Tarik Dana" : "Transfer Dana"
      comingSoon(label)
    },
    [comingSoon],
  )

  const ListHeader = useMemo(
    () => (
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
      </View>
    ),
    [wallet, walletLoading, walletError, fetchWallet, handleAction],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Dompet" />

      <FlatList
        data={txns}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <WalletTransactionListItem
            title={TXN_LABELS[item.type] ?? item.type}
            type={isCredit(item) ? "CREDIT" : "DEBIT"}
            amount={item.amount}
            kind={TXN_KIND[item.type] ?? "other"}
            status={TXN_STATUS[item.status ?? "COMPLETED"] ?? "SUCCESS"}
            timestamp={formatDateTime(item.createdAt)}
            reference={item.referenceId ?? undefined}
            divider={index < txns.length - 1}
          />
        )}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[
          txns.length === 0 && styles.listEmpty,
          { paddingBottom: insets.bottom + tokens.space[4] },
        ]}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={() => {
          if (hasMore && !txnLoading) void fetchTxns(page + 1)
        }}
        onEndReachedThreshold={ON_END_THRESHOLD}
        ListFooterComponent={
          hasMore && txns.length > 0 ? (
            <LoadMore status={txnLoading ? "loading" : "idle"} onLoadMore={() => void fetchTxns(page + 1)} />
          ) : null
        }
        ListEmptyComponent={
          !txnLoading && txns.length === 0 ? (
            txnError ? (
              <ErrorState
                title="Gagal memuat riwayat"
                description={txnError}
                onRetry={() => void fetchTxns(1)}
              />
            ) : (
              <EmptyState
                icon={WalletIcon}
                title="Belum ada riwayat"
                description="Transaksi dompet kamu akan muncul di sini."
              />
            )
          ) : null
        }
        showsVerticalScrollIndicator={false}
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
  listEmpty: {
    flexGrow: 1,
  },
})
