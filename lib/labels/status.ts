/**
 * Kahade — SATU tempat untuk label STATUS lintas fitur (I-07 audit 2026-09-22).
 *
 * Sebelumnya setiap badge/kartu mendefinisikan petanya sendiri di dalam
 * `components/ui/*` (`ORDER_STATUS_LABELS`, `DISPUTE_STATUS_LABELS`,
 * `KYC_STATUS_LABELS`, `TICKET_STATUS_LABELS`, `SUBSCRIPTION_STATUS_LABELS`)
 * sehingga:
 *   - layar yang butuh label tanpa badge harus mengimpor dari komponen UI
 *     (arah ketergantungan terbalik: `app/` → `components/ui/` → `lib/`),
 *   - pesan/tone untuk status yang sama bisa berbeda antar layar tanpa ada
 *     tempat yang memperlihatkan perbedaannya.
 *
 * Aturan: teks status hidup DI SINI; komponen menyumbang tone ikon/warna lewat
 * `statusMeta()` supaya satu status tetap bisa tampil beda secara visual tanpa
 * menggandakan kalimatnya.
 */
import type { OrderStatus } from "@/lib/api/orders"

/**
 * Tipe status UI yang dulu hidup di dalam komponen badge masing-masing
 * (`kyc-status-card`, `dispute-status-badge`, `support-ticket-card`,
 * `subscription-status-card`). Setelah peta label pindah ke sini, tipenya ikut
 * supaya `Record<Status, string>` tetap EXHAUSTIVE — status baru tanpa label
 * gagal `tsc`, bukan tampil mentah di layar.
 */
export type KycStatus = "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED" | "REVOKED"
export type DisputeStatus =
  | "OPEN"
  | "AWAITING_RESPONSE"
  | "UNDER_REVIEW"
  | "MUTUAL_RESOLUTION"
  | "RESOLVED_BUYER"
  | "RESOLVED_SELLER"
  | "RESOLVED_MUTUAL"
  | "CLOSED"
  | "ESCALATED"
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_USER" | "RESOLVED" | "CLOSED"
export type SubscriptionStatus = "NONE" | "ACTIVE" | "EXPIRING" | "EXPIRED" | "CANCELLED"

export type StatusKind = "order" | "dispute" | "kyc" | "ticket" | "subscription" | "report"

/** Label status pesanan. Kunci = enum backend (lihat lib/api/orders). */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  WAITING_CONFIRMATION: "Menunggu konfirmasi",
  WAITING_PAYMENT: "Menunggu pembayaran",
  PROCESSING: "Diproses penjual",
  IN_DELIVERY: "Dalam pengiriman",
  COMPLETED: "Selesai",
  DISPUTED: "Sengketa",
  CANCELLED: "Dibatalkan",
  PENDING_PAYMENT: "Menunggu pembayaran",
  PAID: "Dana di escrow",
  SHIPPED: "Dalam pengiriman",
  DELIVERED: "Menunggu konfirmasi",
  REFUNDED: "Dana dikembalikan",
  EXPIRED: "Kedaluwarsa",
}

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: "Terbuka",
  AWAITING_RESPONSE: "Menunggu tanggapan",
  UNDER_REVIEW: "Ditinjau mediator",
  MUTUAL_RESOLUTION: "Musyawarah",
  RESOLVED_BUYER: "Selesai · dana ke pembeli",
  RESOLVED_SELLER: "Selesai · dana ke penjual",
  RESOLVED_MUTUAL: "Sepakat",
  CLOSED: "Ditutup",
  ESCALATED: "Dieskalasi",
}

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  NOT_SUBMITTED: "Belum diverifikasi",
  PENDING: "Sedang ditinjau",
  APPROVED: "Terverifikasi",
  REJECTED: "Ditolak",
  REVOKED: "Dicabut",
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Terbuka",
  IN_PROGRESS: "Ditangani",
  WAITING_USER: "Menunggu balasan Anda",
  RESOLVED: "Selesai",
  CLOSED: "Ditutup",
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  NONE: "Belum berlangganan",
  ACTIVE: "Aktif",
  EXPIRING: "Segera berakhir",
  EXPIRED: "Berakhir",
  CANCELLED: "Dihentikan",
}

export type ReportStatus = "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED" | (string & {})

/** Label status laporan (dipakai `app/reports.tsx` — dulu peta lokal di layar, I-08). */
export const REPORT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Menunggu tinjauan",
  REVIEWING: "Ditinjau",
  RESOLVED: "Selesai",
  REJECTED: "Ditolak",
}

/** Tone ikon/badge untuk status laporan (dipakai layar yang sama). */
export const REPORT_STATUS_TONE: Record<string, "warning" | "success" | "neutral"> = {
  PENDING: "warning",
  REVIEWING: "warning",
  RESOLVED: "success",
  REJECTED: "neutral",
}

/**
 * Label status untuk kategori apa pun + fallback ke nilai mentah server.
 * Pemanggil tetap bisa menimpa sebagian label (komponen badge menerima
 * `labels`), karena itu `labels` ada di parameter kedua.
 */
export function statusLabel(
  kind: StatusKind,
  status: string,
  labels?: Partial<Record<string, string>>,
): string {
  const table = STATUS_TABLES[kind]
  return labels?.[status] ?? table[status] ?? status
}

/** Apakah `status` dikenal tabel kategori itu (dipakai untuk memilih tone). */
export function isKnownStatus(kind: StatusKind, status: string): boolean {
  return Object.prototype.hasOwnProperty.call(STATUS_TABLES[kind], status)
}

const STATUS_TABLES: Record<StatusKind, Record<string, string>> = {
  order: ORDER_STATUS_LABELS,
  dispute: DISPUTE_STATUS_LABELS,
  kyc: KYC_STATUS_LABELS,
  ticket: TICKET_STATUS_LABELS,
  subscription: SUBSCRIPTION_STATUS_LABELS,
  report: REPORT_STATUS_LABELS,
}
