/**
 * Kahade — panel pembayaran DANA non-QRIS di sheet pembayaran order.
 *
 * Mode Tanpa Wallet Internal (BI-safe): buyer membayar langsung per transaksi
 * via metode DANA (QRIS / Virtual Account / DANA). Panel QRIS sudah ada
 * (`components/qris-payment-panel.tsx`); di sini:
 *
 * - <VaPaymentPanel>: nomor Virtual Account yang bisa disalin + countdown +
 *   status pemantauan + aksi "buat ulang"/"cek status".
 * - <DanaRedirectPanel>: tombol "Buka aplikasi DANA" (deep link/URL dari
 *   backend) + "Saya sudah membayar" → cek status.
 *
 * Batas yang dijaga (sama seperti QrisPaymentPanel): komponen ini murni
 * presentasi. Semua state (intent, status, submitting) dan mutasi (buat
 * intent, poll, refresh) tetap di layar/hook; panel hanya menerima nilai dan
 * memanggil balik. Panel tidak memutuskan status pembayaran.
 */
import { Linking, View } from "react-native"
import { Bank, Copy, Check } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { Countdown } from "@/components/ui/countdown"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { ScreenCaptureGuard } from "@/components/security/screen-capture-guard"
import { formatDateTimeWIB, formatRupiah } from "@/lib/format"
import { PAYMENT_COUNTDOWN_DANGER_SECONDS } from "@/lib/order-countdown"
import { translate } from "@/lib/i18n/translate"
import { toEpochMs } from "@/lib/pending-actions"

/**
 * Status intent yang sudah terminal — countdown tidak lagi relevan dan
 * pemantauan otomatis berhenti. "PAID" termasuk: setelah dibayar, yang tampil
 * adalah keberhasilan, bukan hitung mundur. "UNKNOWN" juga (M-17, issue #12).
 */
const TERMINAL_STATUS = new Set(["PAID", "EXPIRED", "FAILED", "CANCELLED", "UNKNOWN"])

type MonitorProps = {
  /** Status intent dari `GET /v1/orders/:orderId/payment-status` */
  status?: string | null
  /**
   * Error pemantauan terakhir. Sengaja ditampilkan, bukan ditelan: status yang
   * terlihat di panel bisa BASI, dan untuk pembayaran diam-diam salah lebih
   * berbahaya daripada mengeluh.
   */
  pollError?: string | null
  /** Pemantauan otomatis sudah dihentikan (batas 15 menit). */
  pollStopped?: boolean
  submitting?: boolean
  /** UI-T019: sync status sedang berjalan (umpan balik visual). */
  checking?: boolean
  /** Hitung mundur habis — layar yang memutuskan status lokal berikutnya. */
  onExpire: () => void
  /** "Buat ulang" setelah kedaluwarsa/gagal. */
  onRecreate: () => void
  /** "Cek status sekarang" — pembaruan manual selagi menunggu. */
  onCheckStatus: () => void
  /** "Bayar metode lain" — reset intent agar pemilih metode terbuka. */
  onUseOtherMethod?: () => void
}

function MonitorFooter({
  status,
  pollError,
  pollStopped = false,
  submitting = false,
  checking = false,
  onCheckStatus,
  onUseOtherMethod,
  onRecreate,
  recreateLabel,
  pendingHint,
}: MonitorProps & {
  recreateLabel: string
  pendingHint: string
}) {
  const failed = status === "EXPIRED" || status === "FAILED"
  const stuckWithoutCode = status === "UNKNOWN" || pollStopped
  return (
    <>
      {pollError ? (
        <Text variant="caption" tone="danger">
          Status belum diperbarui: {pollError}
        </Text>
      ) : null}
      <Text variant="caption" tone={failed ? "danger" : "secondary"}>
        {status === "EXPIRED"
          ? "Kode bayar kedaluwarsa — buat ulang untuk mencoba lagi."
          : status === "FAILED"
            ? "Pembayaran gagal — buat ulang untuk mencoba lagi."
            : status === "UNKNOWN"
              ? // M-17: status tak dikenal bukan "masih menunggu" — klaim palsu
                // selagi uang bisa sudah berpindah. Arahkan ke jalur nyata.
                "Status pembayaran belum pasti — cek status sekarang, atau bayar dengan metode lain."
              : pollStopped
                ? "Pemantauan otomatis dihentikan setelah 15 menit — gunakan Cek status sekarang."
                : pendingHint}
      </Text>
      {failed ? (
        <Button variant="secondary" loading={submitting} onPress={onRecreate}>
          {recreateLabel}
        </Button>
      ) : (
        <>
          <Button variant="ghost" loading={checking} onPress={onCheckStatus}>
            Cek status sekarang
          </Button>
          {onUseOtherMethod && stuckWithoutCode ? (
            <Button variant="secondary" disabled={submitting} onPress={onUseOtherMethod}>
              Bayar dengan metode lain
            </Button>
          ) : null}
        </>
      )}
    </>
  )
}

export type VaPaymentPanelProps = MonitorProps & {
  vaNumber: string
  vaBankName?: string
  accountName?: string
  amount: number
  expiresAt?: string | null
  copied?: boolean
  onCopy: (value: string) => void
  /** Langkah pembayaran dari backend (opsional). */
  instructions?: string[]
}

export function VaPaymentPanel({
  vaNumber,
  vaBankName,
  accountName,
  amount,
  expiresAt,
  copied = false,
  onCopy,
  instructions,
  ...monitor
}: VaPaymentPanelProps) {
  return (
    <ScreenCaptureGuard>
      <View className="gap-3">
        <View className="items-center gap-1 rounded-2xl border border-border bg-surface px-4 py-5">
          <Icon icon={Bank} size="lg" tone="default" />
          <Text variant="caption" tone="secondary">
            {vaBankName ?? "Virtual Account"}
          </Text>
          <Text variant="monoLarge">{vaNumber}</Text>
          {accountName ? (
            <Text variant="caption" tone="secondary">
              a.n. {accountName}
            </Text>
          ) : null}
          <Text variant="body" tone="primary">
            {formatRupiah(amount)}
          </Text>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={copied ? Check : Copy}
            onPress={() => onCopy(vaNumber)}
            accessibilityLabel="Salin nomor Virtual Account"
          >
            {copied ? "Tersalin" : "Salin nomor"}
          </Button>
        </View>
        {instructions && instructions.length > 0 ? (
          <View className="gap-1.5">
            {instructions.slice(0, 5).map((step, i) => (
              <Text key={i} variant="caption" tone="secondary">
                {i + 1}. {step}
              </Text>
            ))}
          </View>
        ) : null}
        {!TERMINAL_STATUS.has(monitor.status ?? "") ? (
          <Countdown
            until={(() => {
              const ms = toEpochMs(expiresAt)
              return ms != null ? new Date(ms) : undefined
            })()}
            prefix="Kedaluwarsa dalam"
            tone="primary"
            dangerUnderSeconds={PAYMENT_COUNTDOWN_DANGER_SECONDS}
            onComplete={monitor.onExpire}
          />
        ) : null}
        <MonitorFooter
          {...monitor}
          recreateLabel="Buat ulang kode VA"
          pendingHint={
            expiresAt
              ? translate("Berlaku sampai {x} — bayar sesuai nominal.", {
                  x: formatDateTimeWIB(expiresAt),
                })
              : "Bayar sesuai nominal — status diperbarui otomatis."
          }
        />
      </View>
    </ScreenCaptureGuard>
  )
}

export type DanaRedirectPanelProps = MonitorProps & {
  methodName: string
  amount: number
  redirectUrl?: string
  expiresAt?: string | null
}

export function DanaRedirectPanel({
  methodName,
  amount,
  redirectUrl,
  expiresAt,
  ...monitor
}: DanaRedirectPanelProps) {
  const canOpen = !!redirectUrl
  return (
    <ScreenCaptureGuard>
      <View className="gap-3">
        <Text variant="body" tone="secondary">
          {translate("Bayar {x} lewat {m} — selesaikan pembayaran di aplikasi, lalu kembali ke sini.", {
            x: formatRupiah(amount),
            m: methodName,
          })}
        </Text>
        {canOpen ? (
          <Button
            loading={monitor.submitting}
            onPress={() => {
              if (redirectUrl) void Linking.openURL(redirectUrl)
            }}
          >
            {translate("Buka {m}", { m: methodName })}
          </Button>
        ) : (
          <Text variant="caption" tone="danger">
            Tautan pembayaran tidak tersedia — coba buat ulang atau pilih metode lain.
          </Text>
        )}
        {!TERMINAL_STATUS.has(monitor.status ?? "") ? (
          <Countdown
            until={(() => {
              const ms = toEpochMs(expiresAt)
              return ms != null ? new Date(ms) : undefined
            })()}
            prefix="Kedaluwarsa dalam"
            tone="primary"
            dangerUnderSeconds={PAYMENT_COUNTDOWN_DANGER_SECONDS}
            onComplete={monitor.onExpire}
          />
        ) : null}
        <MonitorFooter
          {...monitor}
          recreateLabel="Buat ulang pembayaran"
          pendingHint="Setelah membayar di aplikasi, kembali ke sini — status diperbarui otomatis."
        />
      </View>
    </ScreenCaptureGuard>
  )
}

