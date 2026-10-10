/**
 * Literal kode error backend yang dipetakan klien (BFI-063/065/066).
 *
 * Sumber kanonis: `backend/src/common/constants/error-codes.ts`.
 * Kode yang perlu dibedakan FE didaftarkan di sini sebagai konstanta — bukan
 * string inline tersebar — supaya rename di backend muncul sebagai satu diff
 * dan tidak ada lagi "kode tak dikenal" yang hanya ditebak dari pesan.
 */

/** BFI-065: PIN dompet belum pernah diatur (dulu `NOT_FOUND` generik). */
export const WALLET_PIN_NOT_SET = "WALLET_PIN_NOT_SET" as const
/** BFI-066: `bankCode` wajib untuk pembayaran Virtual Account DANA. */
export const DANA_VA_BANK_REQUIRED = "DANA_VA_BANK_REQUIRED" as const
/**
 * BFI-063: pesan ditolak moderasi chat. Backend menjamin `message` respons
 * berisi penjelasan Bahasa Indonesia yang aman ditampilkan langsung ke user
 * (lihat komentar di `backend/src/common/constants/error-codes.ts`).
 */
export const CHAT_MESSAGE_BLOCKED = "CHAT_MESSAGE_BLOCKED" as const
/**
 * Audit Pesan 2026-10-10 (#9d): edit/hapus pesan ditolak selama order ruang
 * berstatus DISPUTED — isi chat adalah bukti sengketa (openapi: PATCH/DELETE
 * /v1/chat/rooms/{roomId}/messages/{messageId}).
 */
export const CHAT_MESSAGE_LOCKED_DISPUTE = "CHAT_MESSAGE_LOCKED_DISPUTE" as const
/** BFI-057: blocker penghapusan akun — pesanan aktif / penarikan berjalan / sengketa. */
export const ACTIVE_ORDERS_PRESENT = "ACTIVE_ORDERS_PRESENT" as const
/** BFI-057: blocker penghapusan akun — dana tertahan di escrow. */
export const ESCROW_BALANCE_PRESENT = "ESCROW_BALANCE_PRESENT" as const
/** BFI-057: blocker penghapusan akun — saldo dompet tersisa. */
export const WALLET_BALANCE_PRESENT = "WALLET_BALANCE_PRESENT" as const
/** BFI-058: order tidak ditemukan (getStatus pembayaran → HTTP 404). */
export const ORDER_NOT_FOUND = "ORDER_NOT_FOUND" as const
/** BFI-058: pemanggil bukan partisipan order (getStatus pembayaran → HTTP 403). */
export const NOT_ORDER_PARTICIPANT = "NOT_ORDER_PARTICIPANT" as const
/** BFI-064: kode validasi kanonis backend (selalu HTTP 422). */
export const VALIDATION_ERROR = "VALIDATION_ERROR" as const
/** BFE-075: verifikasi nama pemilik rekening ke bank gagal (400). */
export const BANK_ACCOUNT_VERIFICATION_FAILED = "BANK_ACCOUNT_VERIFICATION_FAILED" as const
/**
 * BFE-076: kegagalan re-auth keamanan (`src/common/constants/error-codes.ts`).
 * Dipakai jalur passkey/bank-accounts & koreksi ledger admin.
 */
export const REAUTH_PASSWORD_REQUIRED = "REAUTH_PASSWORD_REQUIRED" as const
export const REAUTH_INVALID_PASSWORD = "REAUTH_INVALID_PASSWORD" as const
export const REAUTH_TOO_MANY_ATTEMPTS = "REAUTH_TOO_MANY_ATTEMPTS" as const
export const REAUTH_UNAVAILABLE = "REAUTH_UNAVAILABLE" as const
/** BFE-080: polling status langganan dengan id basi (404). */
export const SUBSCRIPTION_NOT_FOUND = "SUBSCRIPTION_NOT_FOUND" as const

/**
 * Kode yang pesannya DIRANCANG backend untuk ditampilkan langsung ke user
 * (BFI-063, BFI-066).
 *
 * Kebijakan umum tetap fail-closed: `userMessage()` TIDAK meneruskan pesan
 * backend mentah (bahasa tidak terjamin). Kode di set ini adalah pengecualian
 * eksplisit karena backend mendokumentasikan pesannya sebagai copy Indonesia
 * yang aman tampil — BUKAN karena "pesannya terlihat Indonesia".
 */
export const DISPLAYABLE_BACKEND_MESSAGES: ReadonlySet<string> = new Set([
  CHAT_MESSAGE_BLOCKED,
  DANA_VA_BANK_REQUIRED,
])
