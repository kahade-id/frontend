/**
 * Model 3-dimensi Sistem Transaksi Unified V2 (2026-10-06).
 *
 * Menggantikan enum flat `OrderKind` (DIRECT/JASTIP/PATUNGAN/SERVICE_BOOKING).
 * Tiga dimensi independen:
 * - category: jenis barang/jasa (FISIK/DIGITAL/JASA)
 * - fulfillment: kapan dipenuhi (BIASA/Langsung atau PREORDER)
 * - participantMode: berapa pihak (SINGLE 1-by-1 atau GROUP 1-by-N patungan)
 *
 * Pemetaan dari model lama:
 * - DIRECT → SINGLE + BIASA
 * - JASTIP → PREORDER (+ kategori, biasanya FISIK; trip = batch preorder)
 * - PATUNGAN → GROUP (kategori apapun)
 * - SERVICE_BOOKING → JASA (+ tanggal jadwal, bukan label preorder)
 */

/** Kategori transaksi — menentukan field detail yang wajib diisi. */
export const ORDER_CATEGORIES = ["FISIK", "DIGITAL", "JASA"] as const
export type OrderCategory = (typeof ORDER_CATEGORIES)[number]

/** Sistem pemenuhan — kapan barang/jasa dipenuhi. */
export const FULFILLMENT_TYPES = ["BIASA", "PREORDER"] as const
export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number]

/** Mode peserta — sendiri atau patungan. */
export const PARTICIPANT_MODES = ["SINGLE", "GROUP"] as const
export type ParticipantMode = (typeof PARTICIPANT_MODES)[number]

/** Label Indonesia untuk kategori. */
export const ORDER_CATEGORY_LABELS: Record<OrderCategory, string> = {
  FISIK: "Fisik",
  DIGITAL: "Digital",
  JASA: "Jasa",
}

/** Label Indonesia untuk sistem pemenuhan. */
export const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  BIASA: "Langsung",
  PREORDER: "Preorder",
}

/** Label Indonesia untuk mode peserta. */
export const PARTICIPANT_MODE_LABELS: Record<ParticipantMode, string> = {
  SINGLE: "Sendiri",
  GROUP: "Patungan",
}

/** Deskripsi singkat per kategori (untuk langkah pilih kategori). */
export const ORDER_CATEGORY_DESCRIPTIONS: Record<OrderCategory, string> = {
  FISIK: "Barang fisik yang dikirim via ekspedisi",
  DIGITAL: "File, lisensi, kode, atau akun digital",
  JASA: "Layanan dengan jadwal tertentu",
}

/**
 * Detail patungan (GROUP). Dibuat saat user pilih mode Patungan di
 * langkah 3 alur Buat Transaksi.
 */
export interface PatunganDetails {
  /** Total biaya yang dibagi. */
  totalAmountIdr: number
  /** Target peserta (2-100). */
  targetParticipants: number
  /** Deadline dalam ISO string. */
  deadline: string
  /** Biaya per orang (dihitung otomatis = total / target). */
  amountPerPersonIdr: number
  /** Cara undang: "link" atau "username". */
  inviteMethod: "link" | "username"
  /** Username yang diundang (jika inviteMethod = "username"). */
  invitedUsernames?: string[]
}

/**
 * Detail preorder (fulfillment = PREORDER).
 */
export interface PreorderDetails {
  /** Estimasi tanggal ready (ISO string). */
  estimatedDate: string
}

/**
 * Detail kategori Fisik (field wajib v1).
 */
export interface FisikDetails {
  /** Alamat penerima lengkap. */
  shippingAddress: string
  /** Ekspedisi pilihan. */
  courier?: string
  /** Kondisi barang. */
  condition: "baru" | "bekas"
  /** Deskripsi kondisi (wajib jika bekas). */
  conditionDescription?: string
  /** Siapa bayar ongkir: "buyer" | "seller" | "split". */
  shippingPaidBy: "buyer" | "seller" | "split"
  /** URL foto bukti kondisi (diisi seller sebelum kirim). */
  conditionPhotoUrls?: string[]
}

/**
 * Detail kategori Digital (field wajib v1).
 */
export interface DigitalDetails {
  /** Metode serah-terima. */
  deliveryMethod: "file" | "kode" | "akun" | "lainnya"
  /** Masa garansi dalam hari. */
  warrantyDays: number
  /** Catatan tambahan (misal: batas device, region). */
  notes?: string
}

/**
 * Detail kategori Jasa (field wajib v1).
 */
export interface JasaDetails {
  /** Tanggal/jadwal layanan (ISO string). */
  scheduledDate: string
  /** Lokasi layanan. */
  location: string
  /** Deliverable eksplisit (output apa). */
  deliverables: string
  /** Jumlah revisi yang termasuk. */
  revisionCount: number
  /** Kebijakan pembatalan ringkas. */
  cancellationPolicy: string
}

/** Gabungan semua detail untuk payload create order. */
export interface UnifiedTransactionInput {
  category: OrderCategory
  fulfillment: FulfillmentType
  /** Untuk JASA: tanggal jadwal (bukan preorder). */
  scheduledDate?: string
  participantMode: ParticipantMode
  patungan?: PatunganDetails
  preorder?: PreorderDetails
  fisik?: FisikDetails
  digital?: DigitalDetails
  jasa?: JasaDetails
  /** Judul transaksi. */
  title: string
  /** Deskripsi. */
  description?: string
  /** Harga dasar (sebelum fee). */
  amountIdr: number
}

/** Fee transaksi 2,5% (sesuai whitepaper). */
export const TRANSACTION_FEE_RATE = 0.025
export const TRANSACTION_FEE_MIN_IDR = 2500
export const TRANSACTION_FEE_MAX_IDR = 250000

/**
 * Hitung fee 2,5% dengan min/max sesuai whitepaper.
 */
export function calculateTransactionFee(amountIdr: number): number {
  const fee = Math.round(amountIdr * TRANSACTION_FEE_RATE)
  return Math.min(Math.max(fee, TRANSACTION_FEE_MIN_IDR), TRANSACTION_FEE_MAX_IDR)
}

/**
 * Hitung biaya per orang untuk patungan.
 *
 * P2-7: TIDAK lagi pakai Math.ceil untuk semua orang (itu over-collect
 * sistematis: 100000/3 → 33334×3=100002). Fungsi ini kini mengembalikan
 * biaya dasar per orang (floor); sisa pembulatan harus dialokasikan
 * eksplisit oleh pemanggil bila dibutuhkan. Saat ini mode GROUP diblokir
 * di UI, jadi fungsi ini tidak dipakai — dipertahankan untuk kompatibilitas.
 */
export function calculatePatunganPerPerson(totalIdr: number, target: number): number {
  if (target < 2) return totalIdr
  return Math.floor(totalIdr / target)
}
