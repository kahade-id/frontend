/**
 * Kahade — peta label/status mutasi wallet (SATU sumber untuk tab Dompet,
 * riwayat, detail mutasi, dan hasil pencarian).
 *
 * KONTRAK ENUM (bug produksi yang diperbaiki di sini):
 * `GET /v1/wallet/transactions` MEMVALIDASI parameter `type` terhadap enum
 * backend dan menolak nilai di luar daftar dengan
 * `Invalid transaction type: "TOPUP"`. Versi lama berkas ini memakai kunci
 * hasil tebakan (`TOPUP`, `WITHDRAWAL`, `TRANSFER_IN`, `TRANSFER_OUT`,
 * `ORDER_ESCROW`, `REFUND`, `FEE`, `CASHBACK`) karena spec mobile hanya
 * menandai `type` sebagai "string" tanpa enum. Akibatnya SETIAP chip filter
 * di layar Riwayat Wallet mengirim nilai yang ditolak → seluruh tab jenis
 * mutasi mati dengan pesan error, bukan daftar kosong.
 *
 * Daftar sah (identik dengan enum `type` pada `/v1/admin/finance/transactions`
 * di docs/api/openapi.json): lihat `WALLET_TXN_TYPES`.
 *
 * Dua peran sengaja DIPISAH:
 *   - `WALLET_TXN_TYPES`  → nilai yang BOLEH dikirim ke API (filter).
 *   - `WALLET_TXN_LABELS` → nilai yang harus bisa DITAMPILKAN, termasuk alias
 *     lama dan nilai asing. Menyatukan keduanya persis yang membuat chip
 *     filter ikut berisi nilai tak sah: layar menurunkan chip dari
 *     `Object.entries(WALLET_TXN_LABELS)`.
 */
import type { WalletTransaction } from "@/lib/api/wallet"
import type { WalletTxKind, WalletTxStatus } from "@/components/ui/wallet-transaction-list-item"
import { mapValue } from "@/lib/has-own"

/**
 * Enum `type` mutasi wallet yang diterima backend — PERSIS, tanpa alias.
 * Urutan mengikuti alur yang paling sering dicari pengguna di riwayat
 * (uang masuk → uang keluar → escrow → sistem), bukan abjad: chip filter
 * dibaca sekali lalu, dan "Isi Saldo" harus ketemu tanpa menggeser.
 */
export const WALLET_TXN_TYPES = [
  "TOP_UP",
  "TOPUP_BONUS",
  "WITHDRAW",
  "TRANSFER_RECEIVED",
  "TRANSFER_SENT",
  "ORDER_LOCK",
  "ORDER_RELEASE",
  "ORDER_REFUND",
  "DISPUTE_RELEASE",
  "FEE_DEDUCT",
  "REFERRAL_REWARD",
  "CAMPAIGN_CASHBACK",
  "SUBSCRIPTION_PAYMENT",
  "ADMIN_CREDIT",
  "ADMIN_DEBIT",
] as const

export type WalletTxnType = (typeof WALLET_TXN_TYPES)[number]

/** Label tampilan. Nilai asing dari backend tetap ditampilkan apa adanya. */
export const WALLET_TXN_LABELS: Record<string, string> = {
  // T3-008 (audit UI/UX): istilah baku user-facing = "Isi Saldo" —
  // "Topup"/"Top-up" hanya istilah teknis di kode/API.
  TOP_UP: "Isi Saldo",
  TOPUP_BONUS: "Bonus Isi Saldo",
  WITHDRAW: "Penarikan",
  TRANSFER_RECEIVED: "Transfer Masuk",
  TRANSFER_SENT: "Transfer Keluar",
  ORDER_LOCK: "Escrow Pesanan",
  ORDER_RELEASE: "Pencairan Order",
  ORDER_REFUND: "Refund Order",
  DISPUTE_RELEASE: "Pencairan Sengketa",
  FEE_DEDUCT: "Biaya Platform",
  REFERRAL_REWARD: "Reward Referral",
  CAMPAIGN_CASHBACK: "Cashback",
  SUBSCRIPTION_PAYMENT: "Langganan",
  ADMIN_CREDIT: "Penyesuaian Masuk",
  ADMIN_DEBIT: "Penyesuaian Keluar",
  /*
   * TRX-004 (drive-by, terverifikasi): MILESTONE_RELEASE ada di enum
   * WalletTransactionType backend (release dana per tahap milestone) tapi
   * belum dikenal klien — tanpa label ini mutasi milestone tampil sebagai
   * enum mentah. Hanya label/ikon/arah (display-only); chip filter tidak
   * ditambah (di luar scope temuan).
   */
  MILESTONE_RELEASE: "Pencairan Milestone",
  /*
   * Alias bentuk lama — HANYA untuk menampilkan data yang terlanjur tersimpan
   * di cache/riwayat lokal. Jangan pernah dipakai sebagai nilai filter: alias
   * inilah yang ditolak backend.
   */
  TOPUP: "Isi Saldo",
  WITHDRAWAL: "Penarikan",
  TRANSFER_IN: "Transfer Masuk",
  TRANSFER_OUT: "Transfer Keluar",
  ORDER_ESCROW: "Escrow Pesanan",
  REFUND: "Refund Order",
  FEE: "Biaya Platform",
  CASHBACK: "Cashback",
}

/**
 * R2 (audit ronde-2, butir #80): kamus label STATUS mutasi — pengguna tidak
 * boleh membaca enum mentah (PENDING_SETTLEMENT/RELEASED) di riwayat uang.
 */
export const WALLET_TXN_STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Selesai",
  SUCCESS: "Berhasil",
  SETTLED: "Terselesaikan",
  APPROVED: "Disetujui",
  REFUNDED: "Dikembalikan",
  RELEASED: "Dicairkan",
  PENDING: "Menunggu",
  WAITING: "Menunggu",
  PENDING_OTP: "Menunggu OTP",
  // TRX-004: dua status backend yang sebelumnya bocor sebagai enum mentah.
  PENDING_PROCESS: "Menunggu diproses",
  // T3-011 (audit UI/UX): "penyelesaian" adalah terjemahan harfiah istilah
  // backend (settlement) — user tidak tahu apa yang ditunggu. Bahasa user:
  // yang ditunggu adalah konfirmasi bank.
  PENDING_SETTLEMENT: "Menunggu konfirmasi bank",
  PROCESSING: "Diproses",
  REVIEW: "Ditinjau",
  FAILED: "Gagal",
  REJECTED: "Ditolak",
  EXPIRED: "Kedaluwarsa",
  CANCELLED: "Dibatalkan",
  REVERSED: "Dibalikkan",
}

/** Chip filter jenis mutasi — dibangun HANYA dari enum yang sah di API. */
export const WALLET_TXN_FILTERS: ReadonlyArray<{ label: string; value: WalletTxnType }> =
  WALLET_TXN_TYPES.map((value) => ({ value, label: WALLET_TXN_LABELS[value] ?? value }))

/** Peta type API → ikon komponen (kind). Nilai asing → "other". */
export const WALLET_TXN_KIND: Record<string, WalletTxKind> = {
  TOP_UP: "topup",
  TOPUP_BONUS: "bonus",
  WITHDRAW: "withdraw",
  TRANSFER_RECEIVED: "transfer_in",
  TRANSFER_SENT: "transfer_out",
  ORDER_LOCK: "escrow_hold",
  ORDER_RELEASE: "escrow_release",
  ORDER_REFUND: "refund",
  DISPUTE_RELEASE: "dispute",
  FEE_DEDUCT: "fee",
  REFERRAL_REWARD: "referral",
  CAMPAIGN_CASHBACK: "cashback",
  SUBSCRIPTION_PAYMENT: "subscription",
  ADMIN_CREDIT: "admin",
  ADMIN_DEBIT: "admin",
  // TRX-004 (drive-by): ikon untuk MILESTONE_RELEASE — escrow_release.
  MILESTONE_RELEASE: "escrow_release",

  // Alias lama (lihat catatan di WALLET_TXN_LABELS).
  TOPUP: "topup",
  WITHDRAWAL: "withdraw",
  TRANSFER_IN: "transfer_in",
  TRANSFER_OUT: "transfer_out",
  ORDER_ESCROW: "escrow_hold",
  REFUND: "refund",
  FEE: "fee",
  CASHBACK: "cashback",
}

/**
 * Peta status API → status komponen (SUCCESS = default, tidak dirender).
 *
 * TRX-004 (audit UI/UX 2026-09-28): peta ini WAJIB mencakup semua status sah
 * dari backend — diverifikasi dari enum Prisma (backend/prisma/schema.prisma):
 *   - WalletTransactionStatus: PENDING, SUCCESS, FAILED, CANCELLED, REVERSED
 *   - WithdrawStatus:          PENDING_OTP, PENDING_PROCESS, PROCESSING, SUCCESS, FAILED
 *   - PaymentStatus (top-up):  PENDING, SUCCESS, FAILED, EXPIRED, CANCELLED, REFUNDED
 *
 * Catatan jujur: APPROVED / RELEASED / SETTLED / REVIEW / PENDING_SETTLEMENT
 * TIDAK ADA di enum backend mana pun — label Indonesianya dipertahankan di
 * WALLET_TXN_STATUS_LABELS (tampil apa adanya bila suatu saat muncul), tapi
 * tidak ada di peta ini karena bukan status sah yang terverifikasi.
 *
 * Semantik pemetaan:
 *   - REFUNDED / REVERSED → SUCCESS: siklus transaksi selesai (dana kembali),
 *     bukan kegagalan — muncul di filter "Berhasil", bukan "Gagal".
 *   - CANCELLED / EXPIRED → CANCELLED: grup sendiri "Dibatalkan" (T3-007).
 *     Pembatalan oleh user (mis. penarikan menunggu OTP yang dibatalkan)
 *     BUKAN kegagalan — "gagal" untuk orang awam berarti ada yang rusak.
 *   - PENDING_* / PROCESSING → PENDING.
 */
export const WALLET_TXN_STATUS: Record<string, WalletTxStatus> = {
  COMPLETED: "SUCCESS",
  SUCCESS: "SUCCESS",
  SETTLED: "SUCCESS",
  REFUNDED: "SUCCESS",
  REVERSED: "SUCCESS",
  PENDING: "PENDING",
  PROCESSING: "PENDING",
  PENDING_OTP: "PENDING",
  PENDING_PROCESS: "PENDING",
  WAITING: "PENDING",
  FAILED: "FAILED",
  REJECTED: "FAILED",
  CANCELLED: "CANCELLED",
  EXPIRED: "CANCELLED",
}

/**
 * Arah dana per jenis.
 *
 * Backend tidak selalu mengirim `direction`, padahal arah adalah informasi
 * pertama yang dicari di riwayat uang: tanpa fallback ini mutasi jenis baru
 * (mis. `REFERRAL_REWARD`) tampil tanpa tanda +/- dan tanpa warna jumlah.
 * `TOPUP_BONUS` dan `CAMPAIGN_CASHBACK` adalah kredit; `SUBSCRIPTION_PAYMENT`
 * dan `FEE_DEDUCT` adalah debet; `ADMIN_CREDIT`/`ADMIN_DEBIT` sudah menyebut
 * arahnya di nama enum.
 */
const CREDIT_TYPES: ReadonlySet<string> = new Set([
  "TOP_UP",
  "TOPUP_BONUS",
  "ORDER_RELEASE",
  "ORDER_REFUND",
  "DISPUTE_RELEASE",
  "REFERRAL_REWARD",
  "CAMPAIGN_CASHBACK",
  "TRANSFER_RECEIVED",
  "ADMIN_CREDIT",
  // TRX-004 (drive-by): release dana milestone = dana MASUK ke penerima.
  "MILESTONE_RELEASE",
  // Alias lama.
  "TOPUP",
  "TRANSFER_IN",
  "REFUND",
  "CASHBACK",
])

const DEBIT_TYPES: ReadonlySet<string> = new Set([
  "WITHDRAW",
  "ORDER_LOCK",
  "FEE_DEDUCT",
  "SUBSCRIPTION_PAYMENT",
  "TRANSFER_SENT",
  "ADMIN_DEBIT",
  // Alias lama.
  "WITHDRAWAL",
  "TRANSFER_OUT",
  "ORDER_ESCROW",
  "FEE",
])

/** Arah dana: field `direction` bila ada, fallback kategori. */
export function isWalletCredit(txn: WalletTransaction): boolean {
  return walletTransactionType(txn) === "CREDIT"
}

export function walletTransactionStatus(status?: string | null): WalletTxStatus {
  return status ? mapValue(WALLET_TXN_STATUS, status, "UNKNOWN") : "UNKNOWN"
}

export function walletTransactionType(txn: WalletTransaction): "CREDIT" | "DEBIT" | "UNKNOWN" {
  if (txn.direction === "CREDIT" || txn.direction === "DEBIT") return txn.direction
  const type = typeof txn.type === "string" ? txn.type : ""
  if (CREDIT_TYPES.has(type)) return "CREDIT"
  if (DEBIT_TYPES.has(type)) return "DEBIT"
  return "UNKNOWN"
}
