/**
 * Kunci cache query (F-03) — satu sumber kebenaran per ENDPOINT.
 *
 * Kenapa modul ini ada (non-obvious, C-02 audit): cache 5 detik di
 * `lib/use-api-query.ts` hanya mendedupe bila kunci untuk endpoint yang SAMA
 * benar-benar sama. Sebelumnya `GET /v1/wallet` dibaca di bawah empat kunci
 * berbeda (`home-wallet`, `wallet-balance`, `wallet-overview`,
 * `showcase-header-wallet`) dan `GET /v1/users/me` di bawah enam
 * (`home-profile`, `user-me`, `change-email-me`, `change-phone-me`,
 * `receive-profile`, `showcase-header-profile`) — komentar "disatukan agar
 * cache F-03 mendedupe lintas layar" bahkan sudah menyesatkan di
 * `app/transfer.tsx`. Akibatnya empat salinan saldo bisa hidup bersamaan dan
 * `invalidateQueryCache()` (C-01) tidak pernah bisa menjangkau semuanya.
 *
 * Aturan pemakaian:
 *   - Kunci mewakili ENDPOINT + PARAMETER, bukan layar.
 *   - Layar yang butuh BENTUK LAIN dari data yang sama memakai opsi `select`
 *     pada `useApiQuery` (lihat C-02), sehingga nilai yang di-cache tetap satu
 *     bentuk baku dan proyeksi tidak meracuni cache layar lain.
 *   - Kunci berparameter ditulis di sini sebagai fungsi, bukan dirangkai ad-hoc
 *     di layar, supaya dua layar tidak bisa "berbeda pendapat" soal formatnya.
 */
export const queryKeys = {
  /** `GET /v1/wallet` — saldo & ringkasan dompet. */
  wallet: () => "wallet",
  /** `GET /v1/wallet/limits` — batas nominal efektif dari server (FX-010). */
  walletLimits: () => "wallet-limits",
  /** `GET /v1/users/me` — profil akun yang sedang login. */
  me: () => "me",
  /** `GET /v1/bank-accounts` — daftar rekening bank milik pengguna. */
  bankAccounts: () => "bank-accounts",
  /**
   * `GET /v1/orders/{id}` — payload Order MENTAH (bukan bundle layar).
   * R2 (#98): layar yang hanya butuh Order apa adanya (mis. rate) memakai
   * kunci ini; bundle layar gabungan (order-detail/delivery-proof/extension)
   * tetap berkunci sendiri karena bentuk datanya berbeda (doktrin C-02).
   */
  order: (orderId: string) => `order:${orderId}`,
} as const

/**
 * Catatan C-02 (audit) — kapan kunci TIDAK boleh disatukan.
 *
 * Query GABUNGAN (beberapa endpoint dalam satu fetcher: `bank-accounts` =
 * rekening + katalog bank, `business-verification`, `security-hub`,
 * `subscriptions`, `questions-me`) menyimpan bentuk data yang berbeda dari
 * kunci endpoint tunggalnya, jadi menyatukannya justru meracuni cache: layar
 * berikutnya akan menerima objek gabungan padahal mengharapkan `UserProfile`
 * atau `BankAccount[]`. Yang wajib sama hanyalah kunci untuk ENDPOINT dan
 * PARAMETER yang identik — itulah yang membuat dedupe 5 detik
 * (`lib/query-cache.ts`) benar-benar bekerja, dan yang membuat
 * `invalidateQueryCache()` (C-01) menjangkau semua salinan.
 *
 * Sisi lain: `invalidateQueryCache()` tanpa argumen mengosongkan SELURUH cache,
 * jadi query gabungan ikut bersih setelah mutasi uang walau kuncinya berbeda.
 * Biaya memakai kunci terpisah hanyalah satu request tambahan, bukan data basi.
 */
