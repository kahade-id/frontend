/**
 * Screen — Detail Mutasi Wallet (GET /v1/wallet/transactions/{txId}).
 * Detail dirender sebagai struk tiket (<ReceiptTicket>): header status,
 * nominal besar, baris label-nilai, ID mutasi mono, QR verifikasi.
 */

import { Crossfade } from "@/components/ui/fade-in"
import { DetailLoading } from "@/components/ui/paginated-list"
import { useRef } from "react"
import { View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import type { WalletTransaction } from "@/lib/api/wallet"
import { ROUTES } from "@/lib/routes"
import { shortId } from "@/lib/short-id"
import { translate } from "@/lib/i18n/translate"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import {
  WALLET_TXN_LABELS,
  WALLET_TXN_STATUS_LABELS,
  walletTransactionStatus,
  walletTransactionType,
  isWalletCredit,
} from "@/lib/wallet-labels"
import { useCopy } from "@/lib/clipboard"
import { receiptDateRows, type ReceiptStatus } from "@/lib/receipt"

import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { TextLink } from "@/components/ui/text-link"
import { ReceiptTicket, type ReceiptRow } from "@/components/receipt/ReceiptTicket"
import { shareReceipt } from "@/components/receipt/shareReceipt"
import { useReceiptQr } from "@/components/receipt/use-receipt-qr"
import { mapValue } from "@/lib/has-own"

function toReceiptStatus(status: string): ReceiptStatus {
  if (status === "SUCCESS") return "SUCCESS"
  if (status === "FAILED") return "FAILED"
  return "PENDING"
}

export default function WalletTransactionScreen() {
  const { txId } = useLocalSearchParams<{ txId: string }>()
  const insets = useSafeAreaInsets()
  const { copy } = useCopy()

  /**
   * `useApiQuery`, bukan rakitan useState/useEffect: request dibatalkan saat
   * layar di-unmount, `refreshing` terpisah dari `loading` (tarik-untuk-
   * menyegarkan tidak lagi mengganti detail dengan skeleton), dan error lewat
   * `userMessage(err)`. `enabled` menggantikan guard `if (!txId) return`.
   */
  const query = useApiQuery<WalletTransaction>(
    `wallet-txn:${txId}`,
    (signal) => api.wallet.getWalletTransaction(txId, signal),
    Boolean(txId),
  )
  const txn = query.data
  // QR verifikasi struk — defensif: null = tiket tanpa QR (lihat lib/receipt).
  const qrDataUrl = useReceiptQr("WALLET_TX", txn?.id)
  const ticketRef = useRef<View | null>(null)

  const status = walletTransactionStatus(txn?.status)
  const direction = txn ? walletTransactionType(txn) : "UNKNOWN"

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Detail Mutasi" />
      <PullToRefresh
        onRefresh={query.refresh}
        refreshing={query.refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <Crossfade loading={query.loading} skeleton={<DetailLoading />}>
          {query.error || !txn ? (
            <ErrorState
              title="Gagal memuat"
              description={query.error ?? "Mutasi tidak ditemukan."}
              onRetry={() => void query.reload()}
            />
          ) : (
            <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
              {(() => {
                const rows: ReceiptRow[] = [
                  { label: "Jenis", value: mapValue(WALLET_TXN_LABELS, txn.type, txn.type) },
                  {
                    label: "Status",
                    // R2 (audit ronde-2, butir #80): enum mentah tidak dipaparkan;
                    // nilai tak dikenal tetap lolos apa adanya (pola mapValue).
                    value: txn.status
                      ? mapValue(WALLET_TXN_STATUS_LABELS, txn.status, txn.status)
                      : "Status belum tersedia",
                  },
                  ...receiptDateRows(txn.createdAt),
                  ...(txn.referenceId
                    ? [{ label: "Referensi", value: shortId(txn.referenceId), mono: true }]
                    : []),
                  ...(txn.description ? [{ label: "Deskripsi", value: txn.description }] : []),
                ]
                return (
                  <ReceiptTicket
                    status={toReceiptStatus(status)}
                    title={mapValue(WALLET_TXN_LABELS, txn.type, txn.type)}
                    amount={direction === "DEBIT" ? -Math.abs(txn.amount) : Math.abs(txn.amount)}
                    amountTone={
                      status !== "SUCCESS"
                        ? "primary"
                        : isWalletCredit(txn)
                          ? "success"
                          : "danger"
                    }
                    rows={rows}
                    receiptId={txn.id}
                    qrDataUrl={qrDataUrl}
                    ticketRef={ticketRef}
                    onShare={() => void shareReceipt(ticketRef.current)}
                    onCopyReceiptId={(id) => void copy(id)}
                  />
                )
              })()}
              {txn.referenceId ? (
                // R2 (audit ronde-2, butir #81): referensi mutasi escrow adalah
                // TAUTAN ke entitas terkait, bukan jalan buntu salin-tempel.
                <TextLink
                  onPress={() => {
                    router.push(
                      txn.type === "DISPUTE_RELEASE"
                        ? ROUTES.disputeDetail(txn.referenceId!)
                        : ROUTES.orderDetail(txn.referenceId!),
                    )
                  }}
                  accessibilityLabel={translate("Buka referensi {x}", { x: txn.referenceId })}
                >
                  {translate("Buka referensi {x}", { x: shortId(txn.referenceId) })}
                </TextLink>
              ) : null}
            </View>
          )}
        </Crossfade>
      </PullToRefresh>
    </Screen>
  )
}
