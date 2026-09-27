/**
 * Kahade — label countdown kontekstual + eskalasi tone (mega-batch FE-IMP-5).
 *
 * Item 35: label countdown kontekstual per status order — "Batas bayar" /
 * "Batas kirim" / "Batas konfirmasi" — menggantikan label generik "Batas
 * waktu". Murni presentasi: tidak mengubah cara tenggat dihitung.
 *
 * Item 36: countdown di bawah 24 jam naik ke tone warning/danger. Ambang
 * satu-satunya: 24 jam (86400 detik). Renderer yang memakai: box auto-release
 * & batas kirim di detail order, countdown kartu di daftar transaksi.
 */
import { translate } from "@/lib/i18n/translate"

/** Ambang eskalasi: di bawah 24 jam countdown dianggap mendesak. */
export const COUNTDOWN_URGENT_SECONDS = 24 * 60 * 60

/**
 * Label kontekstual untuk countdown tenggat sesuai status order.
 * - WAITING_CONFIRMATION        → "Batas konfirmasi" (penjual mengonfirmasi)
 * - WAITING_PAYMENT/PENDING_PAYMENT → "Batas bayar"
 * - PROCESSING                  → "Batas kirim"
 * - IN_DELIVERY/SHIPPED/DELIVERED → "Batas konfirmasi" (pembeli mengonfirmasi)
 * - lainnya                     → "Batas waktu" (generik, aman)
 */
export function countdownDeadlineLabel(status: string): string {
  switch (status) {
    case "WAITING_PAYMENT":
    case "PENDING_PAYMENT":
      return translate("Batas bayar")
    case "WAITING_CONFIRMATION":
    case "IN_DELIVERY":
    case "SHIPPED":
    case "DELIVERED":
      return translate("Batas konfirmasi")
    case "PROCESSING":
      return translate("Batas kirim")
    default:
      return translate("Batas waktu")
  }
}

/** True bila sisa waktu di bawah ambang 24 jam → naik ke tone warning/danger. */
export function isCountdownUrgent(secondsLeft: number): boolean {
  return Number.isFinite(secondsLeft) && secondsLeft < COUNTDOWN_URGENT_SECONDS
}
