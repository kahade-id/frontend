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
import { http } from "@/lib/api/client"

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
  return http.get<Wallet>("/v1/wallet", { auth: "required", retry: 1 })
}

/**
 * GET /v1/wallet/transactions — riwayat transaksi wallet (paginasi).
 * Dipakai Dompet overview (item #4); disediakan sekarang agar tidak
 * ada file wallet baru saat item #4 dibangun.
 */
export function getWalletTransactions(query: { page?: number; limit?: number } = {}) {
  return http.get<WalletPaginated>("/v1/wallet/transactions", {
    query,
    auth: "required",
    retry: 1,
  })
}
