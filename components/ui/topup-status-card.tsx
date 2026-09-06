/**
 * Kahade — <TopupStatusCard> (§9.6 Card, §3.1 Mono nominal & kode bayar,
 * §2.3 semantic status, §8 countdown, §12 Voice & Tone).
 *
 * Layar "menunggu pembayaran" setelah `POST /v1/wallet/topup`, di-poll lewat
 * `GET /v1/wallet/topup-status/{paymentTxId}`. Juga dipakai untuk
 * `GET /v1/orders/{id}/payment-status` (bayar order via VA/QRIS) karena
 * kontrak datanya sama: nominal, metode, kode/VA/QR, tenggat, status.
 *
 * Anatomi: StatusIndicator (pulse saat PENDING) + Badge -> nominal
 * <Amount large> -> instruksi per metode:
 *   - VIRTUAL_ACCOUNT_*  : nomor VA <CopyableField mono> + nama bank
 *   - QRIS               : <QrCodeDisplay> dari `qrString`
 *   - ALFAMART/INDOMARET : kode bayar <CopyableField mono>
 *   - e-wallet/kartu     : tombol "Buka aplikasi" (`onOpenPayment`) — redirect
 * -> tenggat <Countdown> -> aksi ("Cek status", "Batalkan").
 *
 * Keputusan non-obvious:
 *   - Nominal pakai <Amount size="large"> — ini SATU angka yang harus
 *     ditransfer persis (VA sering menolak nominal berbeda). Ini pengecualian
 *     dari aturan "large hanya di header detail" karena kartu ini ADALAH
 *     layar utama.
 *   - Status SUCCESS mengganti seluruh area instruksi dengan pesan singkat +
 *     tombol "Selesai": setelah bayar, VA/QR tidak lagi relevan dan
 *     menampilkannya membuat user ragu apakah harus bayar lagi.
 *   - EXPIRED/FAILED: tone danger di Badge saja, instruksi disembunyikan,
 *     tombol "Coba lagi" (`onRetry`). Tidak ada shake/animasi (§8).
 *   - Polling adalah urusan pemanggil (SWR/interval); komponen hanya
 *     menerima `status` dan menyediakan `onRefresh` untuk cek manual —
 *     pengguna perlu rasa kontrol saat menunggu uang.
 *   - Logo bank/e-wallet berwarna DIIZINKAN di sini (§7 pengecualian metode
 *     pembayaran) — lewat slot `methodLogo` dari pemanggil, bukan di-bundle.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardSummary } from "@/components/ui/card"
import { CopyableField } from "@/components/ui/copyable-field"
import { Countdown } from "@/components/ui/countdown"
import { Divider } from "@/components/ui/divider"
import { KeyValue } from "@/components/ui/key-value"
import { QRCodeDisplay } from "@/components/ui/qr-code-display"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { groupAccountNumber } from "@/lib/format"

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED" | "CANCELLED" | "UNKNOWN"

export type PaymentMethodCode =
  | "VIRTUAL_ACCOUNT_BCA"
  | "VIRTUAL_ACCOUNT_BNI"
  | "VIRTUAL_ACCOUNT_BRI"
  | "VIRTUAL_ACCOUNT_MANDIRI"
  | "VIRTUAL_ACCOUNT_CIMB"
  | "VIRTUAL_ACCOUNT_PERMATA"
  | "VIRTUAL_ACCOUNT_OTHER"
  | "QRIS"
  | "GOPAY"
  | "SHOPEEPAY"
  | "OVO"
  | "DANA"
  | "LINKAJA"
  | "CREDIT_CARD"
  | "ALFAMART"
  | "INDOMARET"
  | "AKULAKU"
  | "KREDIVO"
  | "KAHADE_WALLET"

export function paymentMethodKind(
  method: PaymentMethodCode | string | null | undefined,
): "va" | "qris" | "retail" | "redirect" | "wallet" {
  // `GET /v1/wallet/topup-status/{id}` dan `POST /v1/wallet/topup` dikembalikan
  // apa adanya sebagai `TopupResult` (`http.get<TopupResult>` tanpa
  // normalizer), padahal tipenya mendeklarasikan `method: string`. Bila
  // backend mengirim `method: null`, menghilangkannya, atau mengirim angka,
  // `method.startsWith(...)` melempar TypeError — bukan sekadar label
  // kosong, melainkan seluruh layar topup yang jatuh ke error boundary
  // tepat di langkah paling sensitif (pengguna sedang menunggu pembayaran).
  // Jalur "redirect" adalah cabang default yang sudah ada, jadi aman
  // sebagai fallback: ia juga mensyaratkan `onOpenPayment` untuk render.
  if (typeof method !== "string") return "redirect"
  if (method.startsWith("VIRTUAL_ACCOUNT")) return "va"
  if (method === "QRIS") return "qris"
  if (method === "ALFAMART" || method === "INDOMARET") return "retail"
  if (method === "KAHADE_WALLET") return "wallet"
  return "redirect"
}

const STATUS_TONE: Record<PaymentStatus, BadgeTone> = {
  UNKNOWN: "neutral",
  PENDING: "warning",
  SUCCESS: "success",
  FAILED: "danger",
  EXPIRED: "danger",
  CANCELLED: "neutral",
}

export type TopupStatusCardLabels = {
  status: Record<PaymentStatus, string>
  amount: string
  method: string
  vaNumber: string
  paymentCode: string
  qrHint: string
  payBefore: string
  openApp: string
  refresh: string
  cancel: string
  retry: string
  done: string
  successMessage: string
  reference: string
}

const DEFAULT_LABELS: TopupStatusCardLabels = {
  status: {
    UNKNOWN: "Status pembayaran belum terkonfirmasi",
    PENDING: "Menunggu pembayaran",
    SUCCESS: "Pembayaran diterima",
    FAILED: "Pembayaran gagal",
    EXPIRED: "Kedaluwarsa",
    CANCELLED: "Dibatalkan",
  },
  amount: "Jumlah yang harus dibayar",
  method: "Metode",
  vaNumber: "Nomor Virtual Account",
  paymentCode: "Kode pembayaran",
  qrHint: "Pindai dengan aplikasi bank atau e-wallet yang mendukung QRIS.",
  payBefore: "Bayar dalam",
  openApp: "Buka aplikasi pembayaran",
  refresh: "Cek status",
  cancel: "Batalkan",
  retry: "Coba lagi",
  done: "Selesai",
  successMessage: "Saldo akan segera bertambah. Anda bisa menutup halaman ini.",
  reference: "Referensi",
}

export type TopupStatusCardProps = Omit<ViewProps, "children"> & {
  status: PaymentStatus
  amount: number
  method: PaymentMethodCode | string
  /** Nama tampilan metode, mis. "BCA Virtual Account" */
  methodLabel: string
  /** Logo berwarna resmi (pengecualian §7) — slot dari pemanggil */
  methodLogo?: ReactNode
  /** Nomor VA / kode bayar retail */
  paymentCode?: string
  /** Payload QRIS */
  qrString?: string
  /** ID transaksi pembayaran (Mono) */
  reference?: string
  expiresAt?: Date | number
  onExpire?: () => void
  onOpenPayment?: () => void
  onRefresh?: () => void
  refreshing?: boolean
  onCancel?: () => void
  onRetry?: () => void
  onDone?: () => void
  onCopy?: (value: string) => void
  copied?: boolean
  labels?: Partial<Omit<TopupStatusCardLabels, "status">> & {
    status?: Partial<TopupStatusCardLabels["status"]>
  }
  className?: string
}

export function TopupStatusCard({
  status,
  amount,
  method,
  methodLabel,
  methodLogo,
  paymentCode,
  qrString,
  reference,
  expiresAt,
  onExpire,
  onOpenPayment,
  onRefresh,
  refreshing = false,
  onCancel,
  onRetry,
  onDone,
  onCopy,
  copied,
  labels,
  className,
  ...rest
}: TopupStatusCardProps) {
  const t: TopupStatusCardLabels = {
    ...DEFAULT_LABELS,
    ...labels,
    status: { ...DEFAULT_LABELS.status, ...labels?.status },
  }
  const kind = paymentMethodKind(method)
  const pending = status === "PENDING"
  const success = status === "SUCCESS"
  const failed = status === "FAILED" || status === "EXPIRED"

  return (
    // Root tanpa `accessible`: kartu berisi CopyableField, QR, <Countdown> live,
    // dan Button aksi — semuanya harus tetap terjangkau SR. Hanya blok
    // status + nominal yang dikelompokkan (audit #4).
    <Card variant="elevated" padded className={cn("gap-5", className)} {...rest}>
      <CardSummary
        className="gap-5"
        label={summarize([t.status[status], `${t.amount} ${amount} rupiah`, methodLabel])}
      >
        <View className="flex-row items-center justify-between gap-3">
          <StatusIndicator
            label={t.status[status]}
            tone={pending ? "warning" : success ? "success" : failed ? "danger" : "neutral"}
            pulse={pending}
          />
          <Badge tone={STATUS_TONE[status]} variant="outline">
            {methodLabel}
          </Badge>
        </View>

        <View className="gap-1">
          <Text variant="caption" tone="secondary">
            {t.amount}
          </Text>
          <Amount value={amount} size="large" tone="primary" />
        </View>
      </CardSummary>

      {pending ? (
        <>
          <Divider />
          {kind === "va" && paymentCode ? (
            <View className="gap-3">
              {methodLogo ? (
                <View className="flex-row items-center gap-2">{methodLogo}</View>
              ) : null}
              <CopyableField
                label={t.vaNumber}
                value={groupAccountNumber(paymentCode)}
                copyValue={paymentCode}
                mono
                onCopy={onCopy}
                copied={copied}
              />
            </View>
          ) : null}

          {kind === "retail" && paymentCode ? (
            <CopyableField
              label={t.paymentCode}
              value={paymentCode}
              mono
              onCopy={onCopy}
              copied={copied}
            />
          ) : null}

          {kind === "qris" && qrString ? (
            <View className="items-center gap-3">
              <QRCodeDisplay value={qrString} />
              <Text variant="caption" tone="secondary" className="text-center">
                {t.qrHint}
              </Text>
            </View>
          ) : null}

          {kind === "redirect" && onOpenPayment ? (
            <Button variant="primary" onPress={onOpenPayment}>
              {t.openApp}
            </Button>
          ) : null}

          {expiresAt != null ? (
            <View className="flex-row items-center justify-between">
              <Text variant="caption" tone="secondary">
                {t.payBefore}
              </Text>
              <Countdown until={expiresAt} tone="primary" onComplete={onExpire} />
            </View>
          ) : null}
        </>
      ) : null}

      {success ? (
        <Text variant="body" tone="secondary">
          {t.successMessage}
        </Text>
      ) : null}

      {reference ? <KeyValue label={t.reference} value={reference} mono /> : null}

      {(pending || status === "UNKNOWN") && (onRefresh || onCancel) ? (
        <View className="flex-row gap-3">
          {onCancel ? (
            <View className="flex-1">
              <Button variant="ghost" onPress={onCancel} disabled={refreshing}>
                {t.cancel}
              </Button>
            </View>
          ) : null}
          {onRefresh ? (
            <View className="flex-1">
              <Button variant="secondary" onPress={onRefresh} loading={refreshing}>
                {t.refresh}
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}

      {success && onDone ? (
        <Button variant="primary" onPress={onDone}>
          {t.done}
        </Button>
      ) : null}

      {failed && onRetry ? (
        <Button variant="primary" onPress={onRetry}>
          {t.retry}
        </Button>
      ) : null}
    </Card>
  )
}
