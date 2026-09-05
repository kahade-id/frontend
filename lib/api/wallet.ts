import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { assertDtoConstraints } from "@/lib/financial"
/**
 * Kahade — domain `wallet` (tag "wallet" di kahade-api-mobile.json).
 *
 * Hanya endpoint yang dipakai Beranda + Dompet overview yang
 * diimplementasikan di sini. Endpoint aksi (topup, withdraw, transfer,
 * PIN, bank account, jadwal otomatis) ditambahkan saat screen terkait
 * dibangun.
 *
 * Semua endpoint `security: access-token` → `auth: "required"`.
 *
 * Tipe response: UNVERIFIED — spec tidak menyertakan response schema untuk
 * wallet. Field diturunkan dari pola umum fintech dan DTO request yang ada
 * (TopupDto, WithdrawDto, TransferDto di types.ts).
 *
 * Keputusan non-obvious:
 *   - `holdBalance` dan `availableBalance` dipisah karena dua angka ini
 *     penting untuk Beranda ("Rp50.000 ditahan escrow") dan tidak sama
 *     dengan `balance` total.
 *   - `getWalletTransactions` hanya dipakai di Dompet overview (item #4);
 *     ditaruh di sini agar satu domain, tidak diimplementasikan duplikat.
 *   - `retry: 1` pada GET: jaringan seluler flaky; GET wallet/transaksi
 *     idempoten sehingga aman di-retry sekali.
 */
import { readList } from "@/lib/api/response"
import {
  normalizeWallet,
  normalizeWalletPage,
  normalizeWalletTransaction,
} from "@/lib/api/wallet-contract"
import { AMOUNT_LIMITS, assertValidAmount } from "@/lib/financial"
import { http, seg } from "@/lib/api/client"
import type {
  ConfirmWithdrawOtpDto,
  ResendWithdrawOtpDto,
  SetPinDto,
  TopupDto,
  TransferDto,
  VerifyPinDto,
  WithdrawDto,
} from "@/lib/api/types"

/** Bentuk minimum response pesan (spec tanpa schema). */
export type MessageResult = { message: string }

// ------------------------------------------------------------------
// Tipe response — UNVERIFIED
// ------------------------------------------------------------------

/** Wallet user — subset yang dipakai UI saldo + status. */
export type Wallet = {
  id: string
  balance: number
  currency?: string
  status?: "ACTIVE" | "SUSPENDED" | "FROZEN" | (string & {})
  /** Saldo tertahan (escrow order aktif) */
  holdBalance?: number
  /** Saldo yang bisa ditarik setelah dikurangi hold */
  availableBalance?: number
  updatedAt?: string
}

/** Satu entri riwayat transaksi wallet. */
export type WalletTransaction = {
  id: string
  type:
    | "TOPUP"
    | "WITHDRAWAL"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "ORDER_ESCROW"
    | "ORDER_RELEASE"
    | "REFUND"
    | (string & {})
  amount: number
  direction?: "CREDIT" | "DEBIT"
  description?: string | null
  referenceId?: string | null
  status?: "COMPLETED" | "PENDING" | "FAILED" | (string & {})
  createdAt: string
}

export type WalletPaginated = {
  data: WalletTransaction[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

// ------------------------------------------------------------------
// Endpoint
// ------------------------------------------------------------------

/** GET /v1/wallet — saldo + status wallet user yang sedang login. */
export function getWallet() {
  return http.get<unknown>("/v1/wallet", { auth: "required", retry: 1 }).then(normalizeWallet)
}

/**
 * Query `GET /v1/wallet/transactions`.
 * Spec menandai `page`, `limit`, `type`, `from`, `to` sebagai REQUIRED
 * (tanpa enum/deskripsi tambahan). Karena tidak ada dokumentasi nilai yang
 * diterima, helper ini mengisi default yang masuk akal untuk layar riwayat
 * (semua tipe + rentang waktu lebar) — SATU tempat, mudah dikoreksi bila
 * kontrak backend terbukti berbeda.
 */
export type WalletTransactionsQuery = {
  page: number
  limit: number
  /** Filter tipe mutasi. Default "ALL" (asumsi; backend menerima string bebas). */
  type?: string
  /** Batas awal rentang tanggal (ISO). Default 2000-01-01 (asumsi). */
  from?: string
  /** Batas akhir rentang tanggal (ISO). Default sekarang (asumsi). */
  to?: string
}

/** Rentang default history — dihitung sekali per proses (deterministik). */
const HISTORY_FROM = "2000-01-01T00:00:00.000Z"

/**
 * GET /v1/wallet/transactions — riwayat transaksi wallet (paginasi).
 * Dipakai Dompet overview & tab riwayat; disediakan di satu domain.
 */
export function getWalletTransactions(query: WalletTransactionsQuery, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/wallet/transactions", {
      query: {
        page: query.page,
        limit: query.limit,
        type: query.type ?? "ALL",
        from: query.from ?? HISTORY_FROM,
        to: query.to ?? new Date().toISOString(),
      },
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => normalizeWalletPage(raw, query))
}

// ------------------------------------------------------------------
// Metode pembayaran & aksi dompet
// ------------------------------------------------------------------

/** Satu metode pembayaran dari GET /v1/wallet/payment-methods — UNVERIFIED. */
export type WalletPaymentMethod = {
  id: string
  /** Kode metode, mis. "VIRTUAL_ACCOUNT_BCA", "QRIS", "KAHADE_WALLET" */
  code: string
  name: string
  /** Kelompok tampilan: va | qris | retail | redirect | wallet */
  category?: string
  /** Ikon/logo — URL gambar berwarna resmi (pengecualian §7) */
  logoUrl?: string | null
  fee?: PaymentMethodFee
  minAmount?: number
  maxAmount?: number
  enabled: boolean
  recommended?: boolean
}

export type PaymentMethodFee = {
  fixed?: number
  percent?: number
  minFee?: number
  maxFee?: number
  freeLimit?: number
}

/** Hasil lookup penerima transfer (GET /v1/wallet/transfer/lookup?q=). */
export type TransferRecipient = {
  id: string
  username: string
  fullName?: string
  avatarUrl?: string | null
  kycVerified?: boolean
}

/** Hasil POST /v1/wallet/topup — UNVERIFIED. */
export type TopupResult = {
  paymentTxId: string
  amount: number
  method: string
  status: string
  paymentCode?: string | null
  qrString?: string | null
  expiresAt?: string | null
  reference?: string | null
}

/** Hasil POST /v1/wallet/withdraw — UNVERIFIED. */
export type WithdrawResult = {
  txId: string
  amount: number
  status: "PENDING_OTP" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | string
  bankAccountId?: string
  requiresOtp?: boolean
  expiresAt?: string | null
}

/** Hasil POST /v1/wallet/transfer — UNVERIFIED. */
export type TransferResult = {
  txId: string
  amount: number
  recipientId?: string
  status: string
  balanceAfter?: number
}

/** Response GET /v1/wallet/payment-methods. */
export function getPaymentMethods() {
  return http
    .get<unknown>("/v1/wallet/payment-methods", { auth: "required", retry: 1 })
    .then((raw) => readList<WalletPaymentMethod>(raw, ["methods", "paymentMethods"]))
}

/** GET /v1/wallet/transfer/lookup?q= — cari penerima transfer. */
export function lookupTransferRecipient(q: string, signal?: AbortSignal) {
  return http
    .get<TransferRecipient[]>("/v1/wallet/transfer/lookup", {
      query: { q },
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => readList<TransferRecipient>(raw, ["users", "recipients"]))
}

/** POST /v1/wallet/topup — mulai top-up (dapat paymentTxId untuk poll). */
export function createTopup(dto: TopupDto) {
  assertDtoConstraints(dto, API_CONSTRAINTS.TopupDto)
  assertValidAmount(dto.amount, AMOUNT_LIMITS.topup)
  return http.post<TopupResult, TopupDto>("/v1/wallet/topup", dto, { auth: "required" })
}

/** GET /v1/wallet/topup-status/{paymentTxId} — poll status pembayaran. */
export function getTopupStatus(paymentTxId: string) {
  return http.get<TopupResult>(`/v1/wallet/topup-status/${seg(paymentTxId)}`, {
    auth: "required",
    retry: 1,
  })
}

/** POST /v1/wallet/withdraw — tarik dana (bisa memerlukan OTP). */
export function createWithdraw(dto: WithdrawDto) {
  assertDtoConstraints(dto, API_CONSTRAINTS.WithdrawDto)
  assertValidAmount(dto.amount, AMOUNT_LIMITS.withdraw)
  return http.post<WithdrawResult, WithdrawDto>("/v1/wallet/withdraw", dto, { auth: "required" })
}

/** POST /v1/wallet/withdraw/confirm-otp — konfirmasi penarikan besar. */
export function confirmWithdrawOtp(dto: ConfirmWithdrawOtpDto) {
  return http.post<WithdrawResult, ConfirmWithdrawOtpDto>("/v1/wallet/withdraw/confirm-otp", dto, {
    auth: "required",
  })
}

/** POST /v1/wallet/withdraw/resend-otp — kirim ulang OTP penarikan. */
export function resendWithdrawOtp(dto: ResendWithdrawOtpDto) {
  return http.post<{ success: boolean } | { message: string }, ResendWithdrawOtpDto>(
    "/v1/wallet/withdraw/resend-otp",
    dto,
    { auth: "required" },
  )
}

/** POST /v1/wallet/withdraw/cancel — batalkan penarikan PENDING_OTP. */
export function cancelWithdraw(dto: { txId: string }) {
  return http.post<MessageResult, { txId: string }>("/v1/wallet/withdraw/cancel", dto, {
    auth: "required",
  })
}

/** POST /v1/wallet/transfer — kirim dana ke user lain. */
export function transferFunds(dto: TransferDto) {
  assertDtoConstraints(dto, API_CONSTRAINTS.TransferDto)
  assertValidAmount(dto.amount, AMOUNT_LIMITS.transfer)
  return http.post<TransferResult, TransferDto>("/v1/wallet/transfer", dto, { auth: "required" })
}

/** GET /v1/wallet/transactions/{txId} — detail satu mutasi. */
export function getWalletTransaction(txId: string) {
  return http
    .get<unknown>(`/v1/wallet/transactions/${seg(txId)}`, {
      auth: "required",
      retry: 1,
    })
    .then(normalizeWalletTransaction)
}

/** POST /v1/wallet/verify-pin — verifikasi PIN wallet. */
export function verifyWalletPin(dto: VerifyPinDto) {
  return http.post<{ valid: boolean }, VerifyPinDto>("/v1/wallet/verify-pin", dto, {
    auth: "required",
  })
}

/** POST /v1/wallet/set-pin — set/ubah PIN wallet. */
export function setWalletPin(dto: SetPinDto) {
  return http.post<MessageResult, SetPinDto>("/v1/wallet/set-pin", dto, { auth: "required" })
}

/** GET /v1/wallet/topup-history — riwayat topup (bentuk paginated sama). */
export function getTopupHistory(
  query: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  return http
    .get<unknown>("/v1/wallet/topup-history", {
      query,
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => normalizeWalletPage(raw, query))
}

/** GET /v1/wallet/withdraw-history — riwayat penarikan. */
export function getWithdrawHistory(
  query: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  return http
    .get<unknown>("/v1/wallet/withdraw-history", {
      query,
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => normalizeWalletPage(raw, query))
}

/** GET /v1/wallet/export/csv — unduh mutasi CSV. */
export function exportWalletCsv() {
  return http.get<Blob>("/v1/wallet/export/csv", {
    auth: "required",
    responseType: "blob",
    retry: 1,
  })
}

/** GET /v1/wallet/export/pdf — unduh mutasi PDF. */
export function exportWalletPdf() {
  return http.get<Blob>("/v1/wallet/export/pdf", {
    auth: "required",
    responseType: "blob",
    retry: 1,
  })
}
