/**
 * Screen — Detail Mutasi Wallet (GET /v1/wallet/transactions/{txId}).
 * Detail dirender sebagai struk tiket (<ReceiptTicket>): header status,
 * nominal besar, baris label-nilai, ID mutasi mono, QR verifikasi.
 */

import { Crossfade } from "@/components/ui/fade-in"
import { DetailLoading } from "@/components/ui/paginated-list"
import { useRef } from "react"
import { View } from "react-native"
import { router, useLocalSearchParams, type Href } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import type { WalletTransaction } from "@/lib/api/wallet"
import { ROUTES } from "@/lib/routes"
import { shortId } from "@/lib/short-id"
import { translate } from "@/lib/i18n/translate"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { useWalletGate } from "@/lib/use-wallet-enabled"
import {
  WALLET_TXN_LABELS,
  WALLET_TXN_STATUS_LABELS,
  walletTransactionStatus,
  walletTransactionType,
} from "@/lib/wallet-labels"
import { useCopy } from "@/lib/clipboard"
import { receiptDateRows, type ReceiptStatus } from "@/lib/receipt"

import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { TextLink } from "@/components/ui/text-link"
import { WalletDisabledScreen } from "@/components/ui/wallet-disabled"
import { Text } from "@/components/ui/text"
import { ReceiptTicket, type ReceiptRow } from "@/components/receipt/ReceiptTicket"
import { downloadReceipt, shareReceipt } from "@/components/receipt/shareReceipt"
import { useReceiptQrState } from "@/components/receipt/use-receipt-qr"
import { WithdrawalTimeline } from "@/components/wallet/withdrawal-timeline"
import { mapValue } from "@/lib/has-own"

function toReceiptStatus(status: string): ReceiptStatus {
  if (status === "SUCCESS") return "SUCCESS"
  if (status === "FAILED") return "FAILED"
  return "PENDING"
}

/**
 * TRX-005 (audit UI/UX 2026-09-28): `referenceId` HANYA punya tujuan
 * terverifikasi untuk sengketa & order. Mutasi TOP_UP / WITHDRAW /
 * TRANSFER / FEE / dsb tidak punya layar detail terverifikasi — tautan
 * disembunyikan (fail closed) daripada mengarah ke detail order yang salah.
 * (Backend `/v1/wallet/transactions*` bahkan tidak mengirim `referenceId`;
 * yang dikirim adalah objek `order` — nilai ini hanya muncul dari sumber
 * lain seperti hasil pencarian.)
 */
const ORDER_LINKED_TXN_TYPES: ReadonlySet<string> = new Set([
  "ORDER_LOCK",
  "ORDER_RELEASE",
  "ORDER_REFUND",
  "MILESTONE_RELEASE",
  // Alias lama (display-only, lihat lib/wallet-labels.ts).
  "ORDER_ESCROW",
  "REFUND",
])

function referenceTarget(txn: WalletTransaction): { href: Href; ref: string } | null {
  const ref = txn.referenceId?.trim()
  if (!ref) return null
  if (txn.type === "DISPUTE_RELEASE") return { href: ROUTES.disputeDetail(ref), ref }
  if (ORDER_LINKED_TXN_TYPES.has(txn.type)) return { href: ROUTES.orderDetail(ref), ref }
  return null
}

export default function WalletTransactionScreen() {
  // Mode Tanpa Wallet Internal (BI-safe): flag false = layar blokir
  // (deep link ikut tertutup).
  const walletGate = useWalletGate()
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
  // QR verifikasi struk — FE-IMP-4 item 29: state gagal dibedakan dari
  // loading agar bisa tampil tombol "Coba lagi".
  const receiptQr = useReceiptQrState("WALLET_TX", txn?.id)
  const ticketRef = useRef<View | null>(null)

  const status = walletTransactionStatus(txn?.status)
  const direction = txn ? walletTransactionType(txn) : "UNKNOWN"

  // Mode Tanpa Wallet Internal (BI-safe): flag false = layar blokir.
  if (walletGate === "off") {
    return <WalletDisabledScreen />
  }

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
                  // TRX-007: arah tak dikenal diberi label eksplisit — nominal
                  // netral (tanpa tanda) saja masih bisa dibaca sebagai positif.
                  ...(direction === "UNKNOWN"
                    ? [{ label: "Arah dana", value: "Tidak diketahui" }]
                    : []),
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
                    // TRX-007: DEBIT yang diketahui tetap minus; UNKNOWN tidak
                    // dipaksa positif — nilai absolut netral + label "Arah dana".
                    amount={direction === "DEBIT" ? -Math.abs(txn.amount) : Math.abs(txn.amount)}
                    amountTone={
                      status !== "SUCCESS"
                        ? "primary"
                        : direction === "CREDIT"
                          ? "success"
                          : direction === "DEBIT"
                            ? "danger"
                            : "primary"
                    }
                    rows={rows}
                    receiptId={txn.id}
                    qrDataUrl={receiptQr.dataUrl}
                    qrFailed={receiptQr.failed}
                    onRetryQr={receiptQr.retry}
                    ticketRef={ticketRef}
                    onShare={() => void shareReceipt(ticketRef.current)}
                    onDownload={() => void downloadReceipt(ticketRef.current)}
                    onCopyReceiptId={(id) => void copy(id)}
                  />
                )
              })()}
              {/* FE-IMP-4 item 8: timeline status khusus penarikan. */}
              {txn.status === "PENDING_SETTLEMENT" ? (
                // T3-011 (audit UI/UX): status tidak menjelaskan apa yang
                // ditunggu user — beri ekspektasi durasi + penegasan user
                // tidak perlu berbuat apa-apa.
                <Text variant="caption" tone="secondary" className="text-pretty">
                  Biasanya selesai dalam beberapa menit hingga 1 hari kerja. Anda tidak perlu
                  melakukan apa-apa.
                </Text>
              ) : null}
              {txn.type === "WITHDRAW" || txn.type === "WITHDRAWAL" ? (
                <WithdrawalTimeline status={txn.status} />
              ) : null}
              {(() => {
                const target = referenceTarget(txn)
                if (!target) return null
                // R2 (audit ronde-2, butir #81): referensi mutasi escrow adalah
                // TAUTAN ke entitas terkait, bukan jalan buntu salin-tempel.
                // TRX-005: hanya dirender bila tujuannya terverifikasi benar.
                return (
                  <TextLink
                    onPress={() => {
                      router.push(target.href)
                    }}
                    accessibilityLabel={translate("Buka referensi {x}", { x: target.ref })}
                  >
                    {translate("Buka referensi {x}", { x: shortId(target.ref) })}
                  </TextLink>
                )
              })()}
            </View>
          )}
        </Crossfade>
      </PullToRefresh>
    </Screen>
  )
}
