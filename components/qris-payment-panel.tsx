/**
 * Kahade — <QrisPaymentPanel> isi panel QRIS di sheet pembayaran order.
 *
 * Diekstrak dari `app/order/[id].tsx` (S9/G-11: layar detail order adalah god
 * component yang hanya boleh menyusut — seksi diekstrak, bukan dipadatkan).
 * Yang pindah adalah SATU unit kohesif: kode QR + tenggat yang berjalan +
 * status pemantauan + aksi "buat ulang"/"cek status".
 *
 * Batas yang dijaga: komponen ini murni presentasi. Semua state (status intent,
 * error poll, submitting) dan semua mutasi (buat intent, poll, refresh) tetap
 * di layar; panel hanya menerima nilai dan memanggil balik. Logika escrow tidak
 * boleh tersebar ke dua tempat — kalau panel ikut memutuskan status, layar dan
 * panel bisa tidak sepakat tentang apakah QR masih hidup.
 */
import { Button } from "@/components/ui/button"
import { Countdown } from "@/components/ui/countdown"
import { QRCodeDisplay } from "@/components/ui/qr-code-display"
import { Text } from "@/components/ui/text"
import { formatDateTimeWIB, formatRupiah } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"

/**
 * Status intent yang sudah terminal — countdown tidak lagi relevan dan
 * pemantauan otomatis berhenti. "PAID" termasuk: setelah dibayar, yang tampil
 * adalah keberhasilan, bukan hitung mundur.
 */
const TERMINAL_STATUS = new Set(["PAID", "EXPIRED", "FAILED", "CANCELLED"])

export type QrisPaymentPanelProps = {
  qrString: string
  amount: number
  expiresAt?: string | null
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
  copied?: boolean
  onCopy: (value: string) => void
  /** Hitung mundur QR habis — layar yang memutuskan status lokal berikutnya. */
  onExpire: () => void
  /** "Buat ulang QRIS" setelah kedaluwarsa/gagal. */
  onRecreate: () => void
  /** "Cek status sekarang" — pembaruan manual selagi menunggu. */
  onCheckStatus: () => void
}

export function QrisPaymentPanel({
  qrString,
  amount,
  expiresAt,
  status,
  pollError,
  pollStopped = false,
  submitting = false,
  copied = false,
  onCopy,
  onExpire,
  onRecreate,
  onCheckStatus,
}: QrisPaymentPanelProps) {
  const failed = status === "EXPIRED" || status === "FAILED"
  return (
    <>
      {pollError ? (
        <Text variant="caption" tone="danger">
          Status belum diperbarui: {pollError}
        </Text>
      ) : null}
      <QRCodeDisplay
        value={qrString}
        title="Pindai dengan aplikasi pembayaran"
        caption={translate("Berlaku sampai {x} · {y}", {
          x: formatDateTimeWIB(expiresAt ?? ""),
          y: formatRupiah(amount),
        })}
        onCopy={onCopy}
        copied={copied}
      />
      {/* A-11 (audit): countdown HIDUP menuju kedaluwarsa QR — pengguna melihat
          tenggat berjalan (server-time corrected, F-13), bukan hanya timestamp
          statis. Saat habis, layar yang mengubah status lokal. */}
      {/** `status` null = intent baru dibuat, belum sempat di-poll: hitung mundur
       * tetap jalan karena tenggat QR sudah berlaku sejak dibuat. */}
      {!TERMINAL_STATUS.has(status ?? "") ? (
        <Countdown
          until={expiresAt ? new Date(expiresAt) : undefined}
          prefix="Kedaluwarsa dalam"
          tone="primary"
          onComplete={onExpire}
        />
      ) : null}
      <Text variant="caption" tone={failed ? "danger" : "secondary"}>
        {status === "EXPIRED"
          ? "QRIS kedaluwarsa — buat ulang untuk mencoba lagi."
          : status === "FAILED"
            ? "Pembayaran gagal — buat ulang untuk mencoba lagi."
            : pollStopped
              ? "Pemantauan otomatis dihentikan setelah 15 menit — gunakan Cek status sekarang."
              : "Menunggu pembayaran… status diperbarui otomatis."}
      </Text>
      {failed ? (
        <Button variant="secondary" loading={submitting} onPress={onRecreate}>
          Buat ulang QRIS
        </Button>
      ) : (
        <Button variant="ghost" onPress={onCheckStatus}>
          Cek status sekarang
        </Button>
      )}
    </>
  )
}
