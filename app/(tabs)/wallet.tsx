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
 * Fix audit:
 *  - K1: `as any` → `as Href` di 3 router.push ActionButton
 *  - K4: hardcode 16/4 spacing → tokens.space[4/1]
 *  - P3: ListHeaderComponent terima ReactElement langsung, bukan arrow function
 *        yang membungkus ReactNode (FlatList hanya perlu re-check referensi, bukan
 *        re-invoke function component palsu setiap render)
 *  - M4: isCredit pakai direction sebagai sumber utama; fallback array type
 *        hanya dipakai bila direction undefined (bukan dua kondisi OR berjalan)
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { FlatList, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router, type Href } from "expo-router"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowsLeftRight,
} from "phosphor-react-native"

import { getWallet, getWalletTransactions } from "@/lib/api/wallet"
import type { Wallet, WalletTransaction } from "@/lib/api/wallet"
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

  // P3: ListHeader adalah ReactElement (bukan function) — diteruskan langsung
  // ke ListHeaderComponent tanpa pembungkus arrow function.
  const ListHeader = useMemo(
    () => (
      <View>
        {/* Kartu saldo */}
        <Card className="mt-3 mb-2 p-5 gap-1">
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
                <Text variant="caption" tone="warning" className="mt-1">
                  Rp {wallet!.holdBalance!.toLocaleString("id-ID")} sedang ditahan
                </Text>
              )}
            </>
          )}
        </Card>

        {/* Quick action — K1: as Href menggantikan as any */}
        <View className="flex-row justify-around py-2">
          <ActionButton
            icon={ArrowDownToLine}
            label="Topup"
            onPress={() => router.push("/topup" as Href)}
          />
          <ActionButton
            icon={ArrowUpFromLine}
            label="Tarik"
            onPress={() => router.push("/withdraw" as Href)}
          />
          <ActionButton
            icon={ArrowsLeftRight}
            label="Transfer"
            onPress={() => router.push("/transfer" as Href)}
          />
        </View>

        <Divider className="my-3" />

        <Text variant="label" className="mb-2">
          Riwayat
        </Text>
      </View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallet, walletLoading, walletError, fetchWallet],
  )

  return (
    <Screen edges={["top"]}>
      <Header title="Dompet" />

      {/* P3: ListHeaderComponent={ListHeader} langsung ReactElement */}
      <FlatList
        data={txns}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TxnRow txn={item} />}
        ListHeaderComponent={ListHeader}
        // K4: hardcode 16/4 → tokens.space[4/1]
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
  icon: IconComponent
  label: string
  onPress: () => void
}) {
  return (
    <Button
      variant="ghost"
      onPress={onPress}
      className="flex-1 items-center"
    >
      <VStack gap={1} align="center">
        <View className="w-12 h-12 rounded-full items-center justify-center bg-black/[0.06] dark:bg-white/[0.08]">
          <Icon icon={icon} size="md" />
        </View>
        <Text variant="caption" className="text-center">
          {label}
        </Text>
      </VStack>
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

// M4: isCredit pakai direction sebagai sumber utama kebenaran.
// Fallback ke type array HANYA bila direction undefined (misal: data lama).
// Ini menghindari divergensi antara direction dan type bila salah satunya
// tidak sinkron dengan backend.
const CREDIT_TYPES = new Set(["TOPUP", "TRANSFER_IN", "ORDER_RELEASE", "REFUND"])

function TxnRow({ txn }: { txn: WalletTransaction }) {
  const isCredit =
    txn.direction !== undefined
      ? txn.direction === "CREDIT"
      : CREDIT_TYPES.has(txn.type)
  const sign = isCredit ? "+" : "-"
  const tone = isCredit ? "success" : "danger"

  return (
    <View className="flex-row items-center justify-between py-2.5">
      <View className="flex-1 mr-3">
        <Text variant="body">{TXN_LABELS[txn.type] ?? txn.type}</Text>
        {txn.description ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {txn.description}
          </Text>
        ) : null}
      </View>
      <Text variant="body" tone={tone}>
        {sign} Rp {txn.amount.toLocaleString("id-ID")}
      </Text>
    </View>
  )
}
