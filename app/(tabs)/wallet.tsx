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
 *
 * Audit fix (round 2):
 *  W1/W7: toLocaleString("id-ID") hardcode locale → formatRupiah() dari lib/format
 *  W2:    route string literal "/topup" dll → WALLET_ROUTES konstanta lokal
 *  W3:    className w-12 h-12 icon container → StyleSheet + tokens.space[12]
 *  W4:    className py-2 action row → StyleSheet + tokens.space[2]
 *  W5:    className flex-1 mr-3 TxnRow → StyleSheet + tokens.space[3]
 *  W6:    className mt-1 holdBalance → style marginTop tokens.space[1]
 *  W8:    useMemo dep eslint-disable dihapus; dep array lengkap dan benar
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { FlatList, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router, type Href } from "expo-router"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowsLeftRight,
} from "phosphor-react-native"

import { getWallet, getWalletTransactions } from "@/lib/api/wallet"
import type { Wallet, WalletTransaction } from "@/lib/api/wallet"
import { formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { Amount } from "@/components/ui/amount"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Divider } from "@/components/ui/divider"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { LoadMore } from "@/components/ui/load-more"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { VStack } from "@/components/ui/stack"

const PAGE_SIZE = 20

/** Threshold scroll untuk load-more */
const ON_END_THRESHOLD = 0.3

// W2: route action wallet dalam konstanta lokal — mudah diubah satu tempat
const WALLET_ROUTES = {
  topup: "/topup" as Href,
  withdraw: "/withdraw" as Href,
  transfer: "/transfer" as Href,
} as const

// M4: isCredit pakai direction sebagai sumber utama kebenaran.
const CREDIT_TYPES = new Set(["TOPUP", "TRANSFER_IN", "ORDER_RELEASE", "REFUND"])

const TXN_LABELS: Record<string, string> = {
  TOPUP: "Topup",
  WITHDRAWAL: "Penarikan",
  TRANSFER_IN: "Transfer Masuk",
  TRANSFER_OUT: "Transfer Keluar",
  ORDER_ESCROW: "Escrow Order",
  ORDER_RELEASE: "Pencairan Order",
  REFUND: "Refund",
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets()

  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const [walletError, setWalletError] = useState<string | null>(null)

  const [txns, setTxns] = useState<WalletTransaction[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [txnLoading, setTxnLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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

  const fetchTxns = useCallback(async (nextPage: number, isRefresh = false) => {
    try {
      setTxnLoading(true)
      const res = await getWalletTransactions({ page: nextPage, limit: PAGE_SIZE })
      const incoming = res.data
      setTxns((prev) => (isRefresh ? incoming : [...prev, ...incoming]))
      setPage(nextPage)
      setHasMore(nextPage < res.meta.totalPages)
    } catch {
      // load-more gagal: biarkan list yang ada
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
    fetchWallet()
    fetchTxns(1)
  }, [fetchWallet, fetchTxns])

  // P3: ListHeader ReactElement langsung — W8: dep array lengkap tanpa eslint-disable
  const ListHeader = useMemo(
    () => (
      <View>
        <Card style={styles.balanceCard}>
          <Text variant="caption" tone="secondary">
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
                // W6: marginTop via tokens
                <Text variant="caption" tone="warning" style={{ marginTop: tokens.space[1] }}>
                  {/* W1: formatRupiah, bukan toLocaleString hardcode */}
                  {formatRupiah(wallet!.holdBalance!)} sedang ditahan
                </Text>
              )}
            </>
          )}
        </Card>

        {/* W2: WALLET_ROUTES konstanta; W4: paddingVertical via styles */}
        <View style={styles.actionRow}>
          <ActionButton
            icon={ArrowDownToLine}
            label="Topup"
            onPress={() => router.push(WALLET_ROUTES.topup)}
          />
          <ActionButton
            icon={ArrowUpFromLine}
            label="Tarik"
            onPress={() => router.push(WALLET_ROUTES.withdraw)}
          />
          <ActionButton
            icon={ArrowsLeftRight}
            label="Transfer"
            onPress={() => router.push(WALLET_ROUTES.transfer)}
          />
        </View>

        <Divider style={{ marginVertical: tokens.space[3] }} />

        <Text variant="label" style={{ marginBottom: tokens.space[2] }}>
          Riwayat
        </Text>
      </View>
    ),
    [wallet, walletLoading, walletError, fetchWallet],
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
          {
            paddingHorizontal: tokens.space[4],
            gap: tokens.space[1],
          },
          txns.length === 0 && { flexGrow: 1 },
          { paddingBottom: insets.bottom + tokens.space[4] },
        ]}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={() => {
          if (hasMore && !txnLoading) fetchTxns(page + 1)
        }}
        onEndReachedThreshold={ON_END_THRESHOLD}
        ListFooterComponent={hasMore ? <LoadMore loading={txnLoading} /> : null}
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
  icon: IconComponent
  label: string
  onPress: () => void
}) {
  return (
    <Button
      variant="ghost"
      onPress={onPress}
      style={styles.actionBtn}
    >
      <VStack gap={1} align="center">
        {/* W3: size via tokens.space[12] = 48px, bukan className w-12 h-12 */}
        <View style={styles.actionIconContainer}>
          <Icon icon={icon} size="md" />
        </View>
        <Text variant="caption" style={styles.actionLabel}>
          {label}
        </Text>
      </VStack>
    </Button>
  )
}

function TxnRow({ txn }: { txn: WalletTransaction }) {
  const isCredit =
    txn.direction !== undefined
      ? txn.direction === "CREDIT"
      : CREDIT_TYPES.has(txn.type)
  const sign = isCredit ? "+" : "-"
  const tone = isCredit ? "success" : "danger"

  return (
    // W5: flex-1 mr-3 via StyleSheet tokens
    <View style={styles.txnRow}>
      <View style={styles.txnLabel}>
        <Text variant="body">{TXN_LABELS[txn.type] ?? txn.type}</Text>
        {txn.description ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {txn.description}
          </Text>
        ) : null}
      </View>
      <Text variant="body" tone={tone}>
        {/* W1/W7: formatRupiah, bukan toLocaleString hardcode */}
        {sign} {formatRupiah(txn.amount)}
      </Text>
    </View>
  )
}

// ── StyleSheet ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  balanceCard: {
    marginTop: tokens.space[3],
    marginBottom: tokens.space[2],
    padding: tokens.space[5],
    gap: tokens.space[1],
  },
  // W4: paddingVertical via tokens
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: tokens.space[2],
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
  },
  // W3: width/height via tokens.space[12] = 48px
  actionIconContainer: {
    width: tokens.space[12],
    height: tokens.space[12],
    borderRadius: tokens.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.gray[100],
  },
  // W5: flex-1 mr-3 via tokens
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: tokens.space[2],
  },
  txnLabel: {
    flex: 1,
    marginRight: tokens.space[3],
  },
  actionLabel: {
    textAlign: "center",
  },
})
