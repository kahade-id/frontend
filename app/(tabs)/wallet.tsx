/**
 * Tab #3 — Dompet
 *
 * Menampilkan:
 *  - Kartu saldo (balance, availableBalance, holdBalance)
 *  - Quick action: Topup │ Tarik │ Transfer
 *  - Riwayat transaksi wallet (paginasi sederhana, load-more)
 *
 * Data:
 *  - getWallet()             → saldo
 *  - getWalletTransactions() → riwayat
 */
import { useCallback, useEffect, useState } from "react"
import { FlatList, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"

import { getWallet, getWalletTransactions } from "@/lib/api/wallet"
import type { Wallet, WalletTransaction } from "@/lib/api/wallet"

import { Amount } from "@/components/ui/amount"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Divider } from "@/components/ui/divider"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { LoadMore } from "@/components/ui/load-more"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

const PAGE_SIZE = 20

export default function WalletScreen() {
  const insets = useSafeAreaInsets()

  // ── Wallet state ─────────────────────────────────────────────
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const [walletError, setWalletError] = useState<string | null>(null)

  // ── Transaksi state ─────────────────────────────────────────
  const [txns, setTxns] = useState<WalletTransaction[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [txnLoading, setTxnLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // ── Fetch wallet ────────────────────────────────────────────
  const fetchWallet = useCallback(async () => {
    try {
      setWalletLoading(true)
      setWalletError(null)
      const data = await getWallet()
      setWallet(data)
    } catch {
      setWalletError("Gagal memuat saldo. Coba lagi.")
    } finally {
      setWalletLoading(false)
    }
  }, [])

  // ── Fetch transaksi ─────────────────────────────────────────
  const fetchTxns = useCallback(async (nextPage: number, isRefresh = false) => {
    try {
      setTxnLoading(true)
      const res = await getWalletTransactions({ page: nextPage, limit: PAGE_SIZE })
      const incoming = res.data
      setTxns((prev) => (isRefresh ? incoming : [...prev, ...incoming]))
      setPage(nextPage)
      setHasMore(nextPage < res.meta.totalPages)
    } catch {
      // gagal load-more: biarkan list yang ada tetap tampil
    } finally {
      setTxnLoading(false)
    }
  }, [])

  // ── Pull-to-refresh ─────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([fetchWallet(), fetchTxns(1, true)])
    setRefreshing(false)
  }, [fetchWallet, fetchTxns])

  useEffect(() => {
    fetchWallet()
    fetchTxns(1)
  }, [fetchWallet, fetchTxns])

  // ── Render header (sticky di atas FlatList) ─────────────────────
  const ListHeader = (
    <View>
      {/* Kartu saldo */}
      <Card style={styles.balanceCard}>
        <Text variant="caption" color="muted">
          Saldo tersedia
        </Text>

        {walletError ? (
          <ErrorState message={walletError} onRetry={fetchWallet} compact />
        ) : (
          <>
            <Amount
              value={wallet?.availableBalance ?? wallet?.balance ?? 0}
              currency={wallet?.currency ?? "IDR"}
              size="xl"
              loading={walletLoading}
            />

            {(wallet?.holdBalance ?? 0) > 0 && (
              <Text variant="caption" color="warning" style={styles.holdText}>
                Rp {wallet!.holdBalance!.toLocaleString("id-ID")} sedang ditahan
              </Text>
            )}
          </>
        )}
      </Card>

      {/* Quick action */}
      <View style={styles.actions}>
        <ActionButton
          icon="arrow-down-to-line"
          label="Topup"
          onPress={() => router.push("/topup" as any)}
        />
        <ActionButton
          icon="arrow-up-from-line"
          label="Tarik"
          onPress={() => router.push("/withdraw" as any)}
        />
        <ActionButton
          icon="arrow-right-arrow-left"
          label="Transfer"
          onPress={() => router.push("/transfer" as any)}
        />
      </View>

      <Divider style={styles.divider} />

      <Text variant="label" style={styles.historyTitle}>
        Riwayat
      </Text>
    </View>
  )

  return (
    <Screen edges={["top"]}>
      <Header title="Dompet" />

      <FlatList
        data={txns}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TxnRow txn={item} />}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[
          styles.list,
          txns.length === 0 && styles.listEmpty,
          { paddingBottom: insets.bottom + 16 },
        ]}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={() => {
          if (hasMore && !txnLoading) fetchTxns(page + 1)
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          hasMore ? (
            <LoadMore loading={txnLoading} />
          ) : null
        }
        ListEmptyComponent={
          !txnLoading ? (
            <EmptyState
              title="Belum ada riwayat"
              description="Transaksi dompet kamu akan muncul di sini."
            />
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  )
}

// ── Sub-komponen ─────────────────────────────────────────────────

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: string
  label: string
  onPress: () => void
}) {
  return (
    <Button
      variant="ghost"
      onPress={onPress}
      style={styles.actionBtn}
      contentStyle={styles.actionBtnContent}
    >
      <View style={styles.actionIconWrapper}>
        <Icon name={icon} size={20} />
      </View>
      <Text variant="caption" style={styles.actionLabel}>
        {label}
      </Text>
    </Button>
  )
}

const TXN_LABELS: Record<string, string> = {
  TOPUP: "Topup",
  WITHDRAWAL: "Penarikan",
  TRANSFER_IN: "Transfer Masuk",
  TRANSFER_OUT: "Transfer Keluar",
  ORDER_ESCROW: "Escrow Order",
  ORDER_RELEASE: "Pencairan Order",
  REFUND: "Refund",
}

function TxnRow({ txn }: { txn: WalletTransaction }) {
  const isCredit = txn.direction === "CREDIT" || ["TOPUP", "TRANSFER_IN", "ORDER_RELEASE", "REFUND"].includes(txn.type)
  const sign = isCredit ? "+" : "-"
  const color = isCredit ? "success" : "danger"

  return (
    <View style={styles.txnRow}>
      <View style={styles.txnLeft}>
        <Text variant="body">{TXN_LABELS[txn.type] ?? txn.type}</Text>
        {txn.description ? (
          <Text variant="caption" color="muted" numberOfLines={1}>
            {txn.description}
          </Text>
        ) : null}
      </View>
      <Text variant="body" color={color}>
        {sign} Rp {txn.amount.toLocaleString("id-ID")}
      </Text>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    gap: 4,
  },
  listEmpty: {
    flexGrow: 1,
  },
  balanceCard: {
    marginTop: 12,
    marginBottom: 8,
    padding: 20,
    gap: 4,
  },
  holdText: {
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
  },
  actionBtnContent: {
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  actionIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  actionLabel: {
    textAlign: "center",
  },
  divider: {
    marginVertical: 12,
  },
  historyTitle: {
    marginBottom: 8,
  },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  txnLeft: {
    flex: 1,
    marginRight: 12,
  },
})
