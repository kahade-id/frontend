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

import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { assertDtoConstraints } from "@/lib/financial"

import {
  pickBoolean,
  pickNumber,
  pickString,
  pickUserId,
  readList,
  readVerdict,
} from "@/lib/api/response"
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
  /** Saldo tertahan di escrow — nama field dari backend GET /v1/wallet */
  escrowBalance?: number
  /** Saldo yang bisa ditarik setelah dikurangi hold */
  availableBalance?: number
  /** Apakah user sudah punya PIN wallet (dari backend GET /v1/wallet) */
  hasPin?: boolean
  updatedAt?: string
}

/**
 * Enum `type` mutasi wallet yang diterima backend — sumber kebenaran untuk
 * filter `GET /v1/wallet/transactions`.
 *
 * Nilai di luar daftar ini DITOLAK backend dengan pesan
 * `Invalid transaction type: "TOPUP". Valid types are: TOP_UP, WITHDRAW, ...`
 * (dilaporkan pengguna: seluruh chip filter riwayat wallet mati). Spec mobile
 * hanya menandai `type` sebagai "string" tanpa enum, jadi daftar ini diambil
 * dari enum `type` pada `/v1/admin/finance/transactions` di
 * docs/api/openapi.json — kolom database yang sama.
 *
 * Label, ikon, dan arah dana per nilai ada di `lib/wallet-labels.ts`
 * (`WALLET_TXN_TYPES` mencerminkan daftar ini).
 */
export const WALLET_TXN_TYPE_ENUM = [
  "TOP_UP",
  "WITHDRAW",
  "ORDER_LOCK",
  "ORDER_RELEASE",
  "ORDER_REFUND",
  "FEE_DEDUCT",
  "REFERRAL_REWARD",
  "SUBSCRIPTION_PAYMENT",
  "ADMIN_CREDIT",
  "ADMIN_DEBIT",
  "DISPUTE_RELEASE",
  "TRANSFER_SENT",
  "TRANSFER_RECEIVED",
  "CAMPAIGN_CASHBACK",
  "TOPUP_BONUS",
] as const

export type WalletTxnTypeValue = (typeof WALLET_TXN_TYPE_ENUM)[number]

/** Satu entri riwayat transaksi wallet. */
export type WalletTransaction = {
  id: string
  /**
   * `(string & {})` dipertahankan: backend bisa menambah jenis baru tanpa
   * merilis ulang spec, dan UI sudah menampilkan nilai asing apa adanya
   * (lihat `WALLET_TXN_LABELS`) alih-alih crash.
   */
  type: WalletTxnTypeValue | (string & {})
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
export function getWallet(signal?: AbortSignal) {
  return http.get<unknown>("/v1/wallet", { auth: "required", retry: 1, signal }).then(normalizeWallet)
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
  /**
   * Filter tipe mutasi — HARUS salah satu `WALLET_TXN_TYPE_ENUM`. Kosong
   * berarti semua tipe; backend tidak menerima nilai "ALL" dan menolak nilai
   * di luar enum dengan 400 (bukan daftar kosong), jadi chip filter di layar
   * wajib dibangun dari enum, bukan dari kunci peta label.
   */
  type?: WalletTxnTypeValue | string
  /** Batas awal rentang tanggal (ISO). Default 2000-01-01 (asumsi). */
  from?: string
  /** Batas akhir rentang tanggal (ISO). Default sekarang (asumsi). */
  to?: string
}

/** Backend membatasi rentang transaksi maksimal 90 hari. Sisakan margin satu hari. */
function defaultHistoryFrom() {
  const from = new Date()
  from.setDate(from.getDate() - 89)
  return from.toISOString()
}

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
        ...(query.type && query.type !== "ALL" ? { type: query.type } : {}),
        from: query.from ?? defaultHistoryFrom(),
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

/**
 * Response GET /v1/wallet/payment-methods.
 *
 * Audit: sebelumnya `auth: "none"`, padahal spec menandai endpoint ini
 * `security: [{ access-token: [] }]` dan baris 11 file ini sendiri menetapkan
 * "Semua endpoint security: access-token → auth: required" — 18 endpoint lain
 * di file ini mematuhinya, hanya ini yang menyimpang.
 *
 * Akibatnya nyata: `auth: "none"` membuat client.ts menetapkan `token = null`
 * (baris 376) sehingga header Authorization TIDAK PERNAH dikirim, dan juga
 * melewati pemulihan 401 (baris 394). Keduanya pemanggilnya — app/topup.tsx
 * dan app/subscriptions.tsx — adalah layar yang hanya bisa dicapai setelah
 * login, jadi daftar metode pembayaran akan selalu 401 dan top-up tidak
 * pernah bisa dipilih metodenya.
 */
export function getPaymentMethods(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/wallet/payment-methods", { auth: "required", retry: 1, signal })
    .then((raw) => readList<Record<string, unknown>>(raw, ["methods", "paymentMethods"]))
    .then((methods) => methods.map((method) => ({
      ...method,
      id: String(method.id ?? method.code ?? ""),
      code: String(method.code ?? method.id ?? ""),
      name: String(method.name ?? method.nameKey ?? method.code ?? method.id ?? ""),
      enabled: method.enabled !== false,
      fee: typeof method.fee === "number" ? { fixed: method.fee } : method.fee,
    }) as WalletPaymentMethod))
}

/** GET /v1/wallet/transfer/lookup?q= — cari penerima transfer. */
export function lookupTransferRecipient(q: string, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/wallet/transfer/lookup", {
      query: { q },
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => {
      const value = raw as Record<string, unknown>
      const user = value.user
      const normalize = (item: unknown) => {
        const record = item as Record<string, unknown>
        return {
          ...record,
          // `pickUserId`, bukan `String(record.id ?? record.userId ?? "")`:
          // helper ini juga membaca `user_id`/`_id`/`uid` dan membuka objek
          // bersarang (`user`, `data`, `profile`, …), serta mengubah `id`
          // bertipe number menjadi string. Penerima transfer yang id-nya
          // kosong akan membuat POST /v1/wallet/transfer menembak penerima
          // yang salah, jadi alias seluas mungkin di sini memang perlu.
          id: pickUserId(record),
          kycVerified: record.kycVerified ?? record.isKycVerified,
        } as TransferRecipient
      }
      if (user && typeof user === "object" && !Array.isArray(user)) return [normalize(user)]
      return readList<unknown>(raw, ["users", "recipients"]).map(normalize)
    })
}

/** POST /v1/wallet/topup — mulai top-up (dapat paymentTxId untuk poll). */
export async function createTopup(dto: TopupDto, idempotencyKey?: string) {
  assertDtoConstraints(dto, API_CONSTRAINTS.TopupDto)
  assertValidAmount(dto.amount, AMOUNT_LIMITS.topup)
  const result = await http.post<TopupResult, TopupDto>("/v1/wallet/topup", dto, {
    auth: "required",
    // I-16 (audit end-to-end): satu kunci per formulir top-up — retry manual
    // setelah timeout tidak lagi berpeluang membuat dua transaksi topup.
    ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
  })
  return {
    ...result,
    paymentTxId: pickString(result, ["paymentTxId", "payment_tx_id"]) ?? result.paymentTxId,
    paymentCode: pickString(result, ["paymentCode", "payment_code"]) ?? result.paymentCode,
    qrString: pickString(result, ["qrString", "qr_string"]) ?? result.qrString,
    expiresAt: pickString(result, ["expiresAt", "expires_at"]) ?? result.expiresAt,
  }
}

/** GET /v1/wallet/topup-status/{paymentTxId} — poll status pembayaran. */
export async function getTopupStatus(paymentTxId: string) {
  const result = await http.get<TopupResult>(`/v1/wallet/topup-status/${seg(paymentTxId)}`, {
    auth: "required",
    retry: 1,
  })
  return {
    ...result,
    paymentTxId: pickString(result, ["paymentTxId", "payment_tx_id"]) ?? result.paymentTxId,
    paymentCode: pickString(result, ["paymentCode", "payment_code"]) ?? result.paymentCode,
    qrString: pickString(result, ["qrString", "qr_string"]) ?? result.qrString,
    expiresAt: pickString(result, ["expiresAt", "expires_at"]) ?? result.expiresAt,
  }
}

/** POST /v1/wallet/withdraw — tarik dana (bisa memerlukan OTP). */
export async function createWithdraw(dto: WithdrawDto, idempotencyKey?: string) {
  assertDtoConstraints(dto, API_CONSTRAINTS.WithdrawDto)
  assertValidAmount(dto.amount, AMOUNT_LIMITS.withdraw)
  const result = await http.post<WithdrawResult, WithdrawDto>("/v1/wallet/withdraw", dto, {
    auth: "required",
    // I-16: lihat createTopup — penarikan ganda = dua kali keluar dana.
    ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
  })
  return {
    ...result,
    txId: pickString(result, ["txId", "tx_id"]) ?? result.txId,
    bankAccountId: pickString(result, ["bankAccountId", "bank_account_id"]) ?? result.bankAccountId,
    requiresOtp: pickBoolean(result, ["requiresOtp", "requires_otp"]) ?? result.requiresOtp,
    expiresAt: pickString(result, ["expiresAt", "expires_at"]) ?? result.expiresAt,
  }
}

/** POST /v1/wallet/withdraw/confirm-otp — konfirmasi penarikan besar. */
export async function confirmWithdrawOtp(dto: ConfirmWithdrawOtpDto) {
  const result = await http.post<WithdrawResult, ConfirmWithdrawOtpDto>("/v1/wallet/withdraw/confirm-otp", dto, {
    auth: "required",
  })
  return {
    ...result,
    txId: pickString(result, ["txId", "tx_id"]) ?? result.txId,
    bankAccountId: pickString(result, ["bankAccountId", "bank_account_id"]) ?? result.bankAccountId,
    requiresOtp: pickBoolean(result, ["requiresOtp", "requires_otp"]) ?? result.requiresOtp,
    expiresAt: pickString(result, ["expiresAt", "expires_at"]) ?? result.expiresAt,
  }
}

/**
 * POST /v1/wallet/withdraw/resend-otp — kirim ulang OTP penarikan.
 *
 * Dinormalisasi: `app/withdraw.tsx` hanya meng-`await` lalu menampilkan "OTP
 * dikirim ulang". Bila backend menjawab HTTP 200 dengan `{ success: false }`
 * (mis. cooldown belum lewat), versi lama tetap mengklaim berhasil dan
 * pengguna menunggu OTP yang tidak pernah datang.
 */
export async function resendWithdrawOtp(dto: ResendWithdrawOtpDto) {
  const raw = await http.post<unknown, ResendWithdrawOtpDto>(
    "/v1/wallet/withdraw/resend-otp",
    dto,
    { auth: "required" },
  )
  const { value, record } = readVerdict(raw, ["success", "sent", "resent"], true)
  return {
    success: value,
    message: pickString(record, ["message", "detail"]),
    cooldownSeconds: numberOrUndefined(record, ["cooldownSeconds", "cooldown_seconds", "retryAfter"]),
  }
}

function numberOrUndefined(
  record: Record<string, unknown>,
  keys: readonly string[],
): number | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
  }
  return undefined
}

/** POST /v1/wallet/withdraw/cancel — batalkan penarikan PENDING_OTP. */
export function cancelWithdraw(dto: { txId: string }) {
  return http.post<MessageResult, { txId: string }>("/v1/wallet/withdraw/cancel", dto, {
    auth: "required",
  })
}

/** POST /v1/wallet/transfer — kirim dana ke user lain. */
export async function transferFunds(dto: TransferDto, idempotencyKey?: string) {
  assertDtoConstraints(dto, API_CONSTRAINTS.TransferDto)
  assertValidAmount(dto.amount, AMOUNT_LIMITS.transfer)
  const result = await http.post<TransferResult, TransferDto>("/v1/wallet/transfer", dto, {
    auth: "required",
    // I-16: lihat createTopup — transfer ganda = dua kali kirim dana.
    ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
  })
  return {
    ...result,
    txId: pickString(result, ["txId", "tx_id"]) ?? result.txId,
    recipientId: pickString(result, ["recipientId", "recipient_id"]) ?? result.recipientId,
    balanceAfter: pickNumber(result, ["balanceAfter", "balance_after"]) ?? result.balanceAfter,
  }
}

/** GET /v1/wallet/transactions/{txId} — detail satu mutasi. */
export function getWalletTransaction(txId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/wallet/transactions/${seg(txId)}`, {
      auth: "required",
      retry: 1,
      signal,
    })
    .then(normalizeWalletTransaction)
}

/**
 * POST /v1/wallet/verify-pin — verifikasi PIN wallet.
 *
 * Dinormalisasi: `app/change-pin.tsx` memutuskan "PIN salah" dari
 * `res.valid === false`. Bila backend menjawab `{ isValid: false }` dan respons
 * hanya di-cast, `res.valid` menjadi `undefined` — bukan `false` — sehingga PIN
 * yang SALAH lolos sebagai benar. `readVerdict` dengan fallback `false`
 * membalik risikonya: tanpa flag yang dikenal, PIN dianggap tidak terverifikasi.
 */
export function verifyWalletPin(dto: VerifyPinDto) {
  return http
    .post<unknown, VerifyPinDto>("/v1/wallet/verify-pin", dto, { auth: "required" })
    .then((raw) => ({ valid: readVerdict(raw, ["valid", "isValid", "is_valid", "verified"], false).value }))
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
  // C-05 (audit): `limit` selalu terkirim supaya paginasi tanpa metadata tidak
  // ditebak dari panjang data.
  const page = { page: 1, limit: 20, ...query }
  return http
    .get<unknown>("/v1/wallet/topup-history", {
      query: page,
      auth: "required",
      signal,
    })
    .then((raw) => normalizeWalletPage(raw, page))
}

/** GET /v1/wallet/withdraw-history — riwayat penarikan. */
export function getWithdrawHistory(
  query: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  // C-05 (audit): `limit` selalu terkirim (lihat getTopupHistory).
  const page = { page: 1, limit: 20, ...query }
  return http
    .get<unknown>("/v1/wallet/withdraw-history", {
      query: page,
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => normalizeWalletPage(raw, page))
}

/** GET /v1/wallet/export/csv — unduh mutasi CSV. */
export function exportWalletCsv() {
  return http
    .get<{ csv: string; filename: string }>("/v1/wallet/export/csv", {
      auth: "required",
      retry: 1,
      // L-07: endpoint ekspor data riwayat diberi batas waktu 60 detik (default 20s)
      timeoutMs: 60_000,
    })
    .then(({ csv }) => new Blob([csv], { type: "text/csv;charset=utf-8" }))
}

/** GET /v1/wallet/export/pdf — backend returns printable HTML, not a PDF binary. */
export function exportWalletPdf() {
  return http
    .get<{ html: string; filename: string }>("/v1/wallet/export/pdf", {
      auth: "required",
      retry: 1,
      // L-07: endpoint ekspor data riwayat diberi batas waktu 60 detik (default 20s)
      timeoutMs: 60_000,
    })
    .then(({ html }) => new Blob([html], { type: "text/html;charset=utf-8" }))
}

// ------------------------------------------------------------------
// Penerima favorit — GET/POST /v1/wallet/favorite-recipients,
// DELETE /v1/wallet/favorite-recipients/{id} (audit P2, cluster wallet).
// ------------------------------------------------------------------

/** Baris penerima favorit tersimpan (backend: wallet_favorite_recipients + join users). */
export type FavoriteRecipient = {
  /** id baris favorit (untuk hapus — BUKAN id penerima) */
  id: string
  label?: string | null
  createdAt?: string
  recipient: {
    /** id pengguna (CUID) */
    id: string
    userId?: string
    username: string | null
    fullName: string
    avatarUrl?: string | null
  }
}

function normalizeFavoriteRecipient(item: unknown): FavoriteRecipient {
  const record = (item ?? {}) as Record<string, unknown>
  const nested =
    typeof record.recipient === "object" && record.recipient !== null
      ? (record.recipient as Record<string, unknown>)
      : record
  const rid = pickUserId(nested) || pickUserId(record)
  const username =
    typeof nested.username === "string" ? nested.username : null
  const fullName =
    typeof nested.fullName === "string" && nested.fullName
      ? nested.fullName
      : (username ?? "Penerima")
  return {
    id: pickUserId(record),
    label: typeof record.label === "string" ? record.label : null,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : undefined,
    recipient: {
      id: rid,
      userId: typeof nested.userId === "string" ? nested.userId : undefined,
      username,
      fullName,
      avatarUrl: typeof nested.avatarUrl === "string" ? nested.avatarUrl : null,
    },
  }
}

/**
 * GET /v1/wallet/favorite-recipients — daftar favorit untuk seksi "Favorit"
 * di alur Transfer.
 */
export function getFavoriteRecipients(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/wallet/favorite-recipients", {
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) =>
      readList<unknown>(raw, ["recipients", "favorites"]).map(normalizeFavoriteRecipient),
    )
}

/**
 * POST /v1/wallet/favorite-recipients — simpan penerima.
 * `recipientId` bisa CUID, USR-XXXX, atau username (backend resolve ketiganya).
 * Body sengaja flat `{recipientId, label?}` mengikuti signature controller
 * (`@Body('recipientId')`) — bukan objek DTO.
 */
export async function addFavoriteRecipient(recipientId: string, label?: string) {
  return http.post<unknown, { recipientId: string; label?: string }>(
    "/v1/wallet/favorite-recipients",
    { recipientId, ...(label ? { label } : {}) },
    { auth: "required" },
  )
}

/**
 * DELETE /v1/wallet/favorite-recipients/{id} — hapus favorit.
 * `favoriteId` = id baris favorit (bukan id penerima) — dari `getFavoriteRecipients`.
 */
export async function removeFavoriteRecipient(favoriteId: string) {
  return http.delete<unknown>(`/v1/wallet/favorite-recipients/${seg(favoriteId)}`, {
    auth: "required",
  })
}
