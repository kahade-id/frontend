/**
 * Kahade — helper tampilan wallet/keuangan (UI-W001, UI-W008).
 *
 * Logika presentasi murni yang diekstrak dari layar agar bisa dikunci
 * regresi lewat unit test. TIDAK menyentuh nominal, fee, limit, atau
 * kontrak API — hanya label dan waktu yang ditampilkan.
 */
import { WALLET_TXN_STATUS_LABELS } from "./wallet-labels"

/**
 * Label status transaksi wallet untuk tampilan (UI-W001).
 *
 * Layar daftar dulu meneruskan enum mentah (`tx.status`) sebagai
 * `statusLabel`; status yang dikenal normalizer tetapi tidak ada di kamus
 * (mis. `PENDING_OTP`, `SUCCESS`) tampil sebagai enum Inggris mentah.
 * Fungsi ini menjamin status yang dikenal selalu berlabel Indonesia;
 * status yang benar-benar tak dikenal tetap jujur (enum asli), bukan
 * disamarkan.
 */
export function walletStatusLabel(status: string | null | undefined): string {
  if (!status) return "Status belum tersedia"
  return WALLET_TXN_STATUS_LABELS[status] ?? status
}

/**
 * True bila tenggat pembayaran QRIS sudah lewat (UI-W008).
 *
 * Diekstrak dari `QrisPaymentSheet` agar aturan kedaluwarsa bisa diuji
 * tanpa me-render sheet. `now` (ms epoch) hanya untuk test; produksi
 * memakai `Date.now()`. `expiredAt` yang tidak bisa diparse → false
 * (jangan klaim kedaluwarsa dari data rusak).
 */
export function isQrisExpired(
  expiredAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!expiredAt) return false
  const t = new Date(expiredAt).getTime()
  return Number.isFinite(t) && now > t
}
