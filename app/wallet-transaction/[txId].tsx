import { LoadingScreen } from "@/components/ui/loading-screen"
/**
 * Screen — Detail Mutasi Wallet (GET /v1/wallet/transactions/{txId}).
 * KeyValue rows sistem + Amount; PullToRefresh.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Wallet as WalletIcon } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { WalletTransaction } from "@/lib/api/wallet"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import {
  WALLET_TXN_LABELS,
  walletTransactionStatus,
  walletTransactionType,
  isWalletCredit,
} from "@/lib/wallet-labels"

import { Amount } from "@/components/ui/amount"
import { Card } from "@/components/ui/card"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { IconBox } from "@/components/ui/icon-box"
import { KeyValue } from "@/components/ui/key-value"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { Text } from "@/components/ui/text"

export default function WalletTransactionScreen() {
  const { txId } = useLocalSearchParams<{ txId: string }>()
  const insets = useSafeAreaInsets()

  const [txn, setTxn] = useState<WalletTransaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTxn = useCallback(async () => {
    if (!txId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.wallet.getWalletTransaction(txId)
      setTxn(res)
    } catch {
      setError("Mutasi tidak ditemukan.")
    } finally {
      setLoading(false)
    }
  }, [txId])

  useEffect(() => {
    void fetchTxn()
  }, [fetchTxn])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchTxn()
    setRefreshing(false)
  }, [fetchTxn])

  const status = walletTransactionStatus(txn?.status)
  const direction = txn ? walletTransactionType(txn) : "UNKNOWN"

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Detail Mutasi" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <LoadingScreen message="Memuat mutasi…" />
        ) : error || !txn ? (
          <ErrorState
            title="Gagal memuat"
            description={error ?? "Mutasi tidak ditemukan."}
            onRetry={() => void fetchTxn()}
          />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <Card padded className="items-center gap-3">
              <IconBox
                icon={WalletIcon}
                size="lg"
                variant={status === "FAILED" ? "danger" : "surface"}
              />
              <Amount
                value={direction === "DEBIT" ? -Math.abs(txn.amount) : Math.abs(txn.amount)}
                size="large"
                sign={
                  direction === "UNKNOWN" ? "never" : direction === "CREDIT" ? "always" : "auto"
                }
                tone={
                  status !== "SUCCESS" ? "secondary" : isWalletCredit(txn) ? "success" : "primary"
                }
              />
              {status === "PENDING" ? (
                <StatusIndicator label="Menunggu" tone="warning" size="sm" />
              ) : status === "FAILED" ? (
                <StatusIndicator label="Gagal" tone="danger" size="sm" />
              ) : null}
            </Card>

            <Card padded className="gap-3">
              <KeyValue label="Jenis" value={WALLET_TXN_LABELS[txn.type] ?? txn.type} />
              <KeyValue label="Status" value={txn.status ?? "Status belum tersedia"} />
              <KeyValue label="Waktu" value={formatDateTime(txn.createdAt)} />
              {txn.referenceId ? <KeyValue label="Referensi" value={txn.referenceId} mono /> : null}
              {txn.description ? <KeyValue label="Deskripsi" value={txn.description} /> : null}
            </Card>

            <Text variant="caption" tone="tertiary" className="text-center">
              ID mutasi: <Text variant="monoBody">{txn.id}</Text>
            </Text>
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
