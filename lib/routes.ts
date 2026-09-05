/**
 * Kahade — konstanta rute Expo Router untuk alur auth.
 *
 * Satu tempat untuk path yang dirujuk lintas screen (onboarding → register/
 * login, gate index → onboarding/login) supaya rename folder di `app/`
 * cukup diubah di sini.
 *
 * Kenapa bertipe `Href` dengan cast (non-obvious): `typedRoutes` aktif di
 * app.json, tetapi alur auth dibangun satu screen per giliran — target
 * seperti `/register` dan `/login` belum punya file route saat konstanta ini
 * ditulis. Tanpa cast, typecheck gagal di screen yang sudah jadi hanya karena
 * screen berikutnya belum ada. Saat semua route tersedia, cast bisa dihapus
 * dan TypeScript akan memvalidasi path ini lagi.
 *
 * Grup `(auth)` tidak muncul di URL — Expo Router mengabaikan segmen dalam
 * tanda kurung.
 */
import type { Href } from "expo-router"

import type { OtpMethod } from "@/lib/api/auth"

/**
 * Param yang dibawa Register -> OTP Verification. `phoneNumber` sudah E.164
 * ("+62812…") — bentuk yang sama dengan yang dikirim ke `request-otp`, agar
 * `verify-otp` memakai string identik (backend mencocokkan OTP per nomor).
 */
export type VerifyOtpParams = {
  phoneNumber: string
  method: OtpMethod
}

export const ROUTES = {
  onboarding: "/onboarding" as Href,
  /** Screen #2 — Register: nomor HP + metode OTP */
  register: "/register" as Href,
  /** Screen #3 — OTP Verification */
  verifyOtp: (params: VerifyOtpParams) => ({ pathname: "/verify-otp", params }) as unknown as Href,
  /** Screen #4 — Buat Keamanan: password + PIN */
  createSecurity: "/create-security" as Href,
  /** Screen #5 — Data Diri: nama, username, email, dll */
  profileData: "/profile-data" as Href,
  /** Screen #6 — Setup Profil: foto + bio (opsional, setelah akun jadi) */
  setupProfile: "/setup-profile" as Href,
  /**
   * Welcome Screen — landing page setelah auth (cek permissions).
   * `newUser` menentukan sapaan ("Selamat datang di Kahade" vs "kembali").
   * Dibawa lewat param, BUKAN dibaca dari registration state: state itu
   * sudah dibersihkan oleh Setup Profil sebelum pindah ke sini.
   */
  welcome: (opts: { newUser?: boolean } = {}) =>
    ({ pathname: "/welcome", params: opts.newUser ? { newUser: "1" } : {} }) as unknown as Href,
  /** Screen #7 — Login: email + password */
  login: "/login" as Href,
  /**
   * Screen #7b — Verifikasi 2FA saat login (POST /v1/auth/2fa/verify-login).
   * tempToken TIDAK dibawa lewat param (kredensial) — lihat lib/two-factor-login.ts.
   */
  verify2fa: "/verify-2fa" as Href,
  /**
   * Verifikasi email akun (POST /v1/auth/verify-email OTP, resend, correct-email).
   * `email` hanya untuk ditampilkan/prefill — bukan kredensial.
   */
  verifyEmail: (email: string) =>
    ({ pathname: "/verify-email", params: { email } }) as unknown as Href,
  /** Screen #8a — Forgot Password: kirim OTP reset */
  forgotPassword: "/forgot-password" as Href,
  /** Screen #8b — Reset Password: verifikasi OTP + password baru */
  resetPassword: (email: string) =>
    ({ pathname: "/reset-password", params: { email } }) as unknown as Href,

  // ── Kerangka navigasi: 5 tab root di app/(tabs)/ ─────────────────────
  // Tab Beranda memakai file `home.tsx` (URL `/home`), BUKAN `index.tsx`:
  // `app/index.tsx` sudah menjadi gate awal `/` dan dua route dengan path
  // sama akan bertabrakan di Expo Router.
  /** Tab #1 — Beranda (sapaan, saldo, order aktif, quick action) */
  home: "/home" as Href,
  /** Tab #2 — Transaksi (list order + filter status) */
  transactions: "/transactions" as Href,
  /** Tab #3 — Dompet (saldo, Topup/Withdraw/Transfer, riwayat ringkas) */
  wallet: "/wallet" as Href,
  /** Tab #4 — Notifikasi (list read/unread) */
  notifications: "/notifications" as Href,
  /** Tab #5 — Pengaturan/Profil milik sendiri */
  settings: "/settings" as Href,

  // ── Stack screen di luar tab ──────────────────────────────────────────
  /** Detail satu order (di-push dari Tab Transaksi & Beranda) */
  orderDetail: (orderId: string) =>
    ({ pathname: "/order/[id]", params: { id: orderId } }) as unknown as Href,
  /** Buat transaksi baru (di-push dari FAB Tab Transaksi & quick action Beranda) */
  createTransaction: "/create-transaction" as Href,
  /** Buat transaksi dengan lawan transaksi terisi (dari profil publik) */
  createTransactionWith: (username: string) =>
    ({ pathname: "/create-transaction", params: { counterpart: username } }) as unknown as Href,
  /**
   * Buat transaksi dengan voucher terpasang (dari halaman Voucher).
   * Audit: layar Voucher sebelumnya menulis `pathname: "/create-transaction"`
   * langsung — satu-satunya route literal yang tersisa di `app/`.
   */
  createTransactionWithVoucher: (voucherCode: string) =>
    ({ pathname: "/create-transaction", params: { voucherCode } }) as unknown as Href,

  // ── Dompet — aksi cepat kartu saldo ─────────────────────────────────────
  /** POST /v1/wallet/topup */
  topup: "/topup" as Href,
  /** POST /v1/wallet/withdraw */
  withdraw: "/withdraw" as Href,
  /** POST /v1/wallet/transfer */
  transfer: "/transfer" as Href,
  /** Riwayat topup (GET /v1/wallet/topup-history) */
  topupHistory: "/topup-history" as Href,
  /** Riwayat penarikan (GET /v1/wallet/withdraw-history) */
  withdrawHistory: "/withdraw-history" as Href,
  /** Rekening bank + jadwal penarikan otomatis */
  withdrawalSchedules: "/withdrawal-schedules" as Href,

  // ── Orders & transaksi ────────────────────────────────────────────────
  /** Daftar order-link saya (GET /v1/orders/links/my) */
  orderLinks: "/order-links" as Href,
  /** Invoice pesanan (GET /v1/orders/{id}/invoice) */
  invoice: (orderId: string) =>
    ({ pathname: "/invoice/[orderId]", params: { orderId } }) as unknown as Href,
  /** Resolusi deeplink order-link (GET /v1/deeplinks/order-link/{token}) */
  orderLink: (token: string) =>
    ({ pathname: "/order-link/[token]", params: { token } }) as unknown as Href,
  /** Form bukti pengiriman satu pesanan */
  deliveryProof: (orderId: string) =>
    ({ pathname: "/delivery-proof/[orderId]", params: { orderId } }) as unknown as Href,
  /** Perpanjangan tenggat satu pesanan */
  extension: (orderId: string) =>
    ({ pathname: "/extension/[orderId]", params: { orderId } }) as unknown as Href,

  // ── Pengaturan — semua sub-screen menu ──────────────────────────────────
  editProfile: "/edit-profile" as Href,
  bankAccounts: "/bank-accounts" as Href,
  accountType: "/account-type" as Href,
  changePassword: "/change-password" as Href,
  changePin: "/change-pin" as Href,
  biometricSettings: "/biometric-settings" as Href,
  notificationPreferences: "/notification-preferences" as Href,
  /**
   * Tampilan: mode terang/gelap/sistem.
   *
   * Audit: design system punya set token dark lengkap, <ThemeProvider>
   * mempersistenkan preferensi, dan <ThemeModeSelector> sudah ditulis —
   * tetapi tidak ada satu pun pintu masuk di app/, sehingga mode gelap tidak
   * pernah bisa dipilih pengguna. Route ini adalah pintu itu.
   */
  appearance: "/appearance" as Href,
  faq: "/faq" as Href,
  contact: "/contact" as Href,
  appVersion: "/app-version" as Href,
  privacyPolicy: "/privacy-policy" as Href,
  terms: "/terms" as Href,
  /** Dua faktor (2FA) + kode cadangan */
  twoFactor: "/two-factor" as Href,
  /** Perangkat aktif, log keamanan, log aktivitas */
  security: "/security" as Href,
  /** Pengguna diblokir (GET /v1/settings/blocked-users) */
  blockedUsers: "/blocked-users" as Href,
  /** Privasi profil (profileVisible/showOnlineStatus) */
  privacySettings: "/privacy-settings" as Href,
  /** Bahasa aplikasi (GET/PUT /v1/settings/language) */
  language: "/language" as Href,
  /** Hapus akun (POST /v1/users/me/delete-request) */
  deleteAccount: "/delete-account" as Href,

  // ── Fitur utama (quick action & menu) ───────────────────────────────────
  /** KYC: status + riwayat + submit */
  kyc: "/kyc" as Href,
  /** Daftar sengketa saya (GET /v1/disputes/my) */
  disputes: "/disputes" as Href,
  /** Detail satu sengketa */
  disputeDetail: (disputeId: string) =>
    ({ pathname: "/dispute/[id]", params: { id: disputeId } }) as unknown as Href,
  /** Daftar ruang chat (GET /v1/chat/rooms) */
  chat: "/chat" as Href,
  /** Satu ruang chat */
  chatRoom: (roomId: string) =>
    ({ pathname: "/chat/[roomId]", params: { roomId } }) as unknown as Href,
  /** Langganan premium */
  subscriptions: "/subscriptions" as Href,
  /** Referral */
  referral: "/referral" as Href,
  /** Ulasan saya (GET /v1/ratings/my) */
  ratings: "/ratings" as Href,
  /** Voucher (available + my-usage + redeem) */
  vouchers: "/vouchers" as Href,
  /** Badge (GET /v1/badges + /my) */
  badges: "/badges" as Href,
  /** Pencarian global (GET /v1/search) */
  search: "/search" as Href,
  /** Template transaksi (CRUD) */
  transactionTemplates: "/transaction-templates" as Href,
  /** Tiket dukungan (support) */
  support: "/support" as Href,
  /** Detail tiket dukungan */
  supportTicket: (ticketId: string) =>
    ({ pathname: "/support/[ticketId]", params: { ticketId } }) as unknown as Href,
  /** Artikel bantuan per slug */
  helpCategory: (slug: string) =>
    ({ pathname: "/help/[slug]", params: { slug } }) as unknown as Href,
  helpArticle: (article: string, category?: string, title?: string) =>
    ({
      pathname: "/help/[slug]",
      params: { slug: category ?? article, article, ...(category ? {} : { q: title ?? article }) },
    }) as unknown as Href,
  /** Profil publik user (GET /v1/users/{username}) */
  userProfile: (username: string) =>
    ({ pathname: "/user/[username]", params: { username } }) as unknown as Href,

  // ── Analitik & komunitas (users) ───────────────────────────────────────
  /** Statistik & analitik (GET /v1/users/me/stats + /analytics) */
  analytics: "/analytics" as Href,
  /** Skor kepercayaan (GET /v1/users/me/trust-score) */
  trustScore: "/trust-score" as Href,
  /** Discover user (GET /v1/users/discover) */
  discover: "/discover" as Href,
  /** Favorite user (GET /v1/users/favorites) */
  favorites: "/favorites" as Href,
  /** Followers/following user */
  followers: (username: string, tab: "followers" | "following" = "followers") =>
    ({ pathname: "/followers/[username]", params: { username, tab } }) as unknown as Href,
  /** Showcase milik sendiri (CRUD) */
  showcase: "/showcase" as Href,
  /** Questions milik sendiri (GET /v1/users/me/questions) */
  questions: "/questions" as Href,
  /** Showcase publik user (GET /v1/users/{username}/showcase) */
  userShowcase: (username: string) =>
    ({ pathname: "/user/[username]/showcase", params: { username } }) as unknown as Href,
  /** Tanya-jawab publik user (GET /v1/users/{username}/questions) */
  userQuestions: (username: string) =>
    ({ pathname: "/user/[username]/questions", params: { username } }) as unknown as Href,
  /** Ulasan publik user (GET /v1/users/{username}/ratings) */
  userRatings: (username: string) =>
    ({ pathname: "/user/[username]/ratings", params: { username } }) as unknown as Href,
  /** Laporan saya (GET /v1/settings/reports) + form lapor bila target diberikan */
  reports: (opts: { targetId?: string; targetName?: string } = {}) =>
    ({ pathname: "/reports", params: opts.targetId ? opts : {} }) as unknown as Href,
  /** Detail satu mutasi wallet (GET /v1/wallet/transactions/{txId}) */
  walletTransaction: (txId: string) =>
    ({ pathname: "/wallet-transaction/[txId]", params: { txId } }) as unknown as Href,
  /** Beri ulasan pesanan selesai (POST /v1/ratings) */
  rateOrder: (orderId: string) =>
    ({ pathname: "/rate/[orderId]", params: { orderId } }) as unknown as Href,
} as const

/**
 * Nama route (= nama file) di `app/(tabs)/`. Dipakai `Tabs.Screen name=…`
 * dan peta item tab bar; disatukan di sini agar rename file cukup satu tempat.
 */
export const TAB_ROUTE_NAMES = [
  "home",
  "transactions",
  "wallet",
  "notifications",
  "settings",
] as const
export type TabRouteName = (typeof TAB_ROUTE_NAMES)[number]
