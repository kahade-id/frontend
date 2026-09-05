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

  // ── Dompet — aksi cepat kartu saldo ─────────────────────────────────────
  /** POST /v1/wallet/topup */
  topup: "/topup" as Href,
  /** POST /v1/wallet/withdraw */
  withdraw: "/withdraw" as Href,
  /** POST /v1/wallet/transfer */
  transfer: "/transfer" as Href,

  // ── Pengaturan — semua sub-screen menu ──────────────────────────────────
  editProfile: "/edit-profile" as Href,
  bankAccounts: "/bank-accounts" as Href,
  accountType: "/account-type" as Href,
  changePassword: "/change-password" as Href,
  changePin: "/change-pin" as Href,
  biometricSettings: "/biometric-settings" as Href,
  notificationPreferences: "/notification-preferences" as Href,
  faq: "/faq" as Href,
  contact: "/contact" as Href,
  appVersion: "/app-version" as Href,
  privacyPolicy: "/privacy-policy" as Href,
  terms: "/terms" as Href,
} as const

/**
 * Nama route (= nama file) di `app/(tabs)/`. Dipakai `Tabs.Screen name=…`
 * dan peta item tab bar; disatukan di sini agar rename file cukup satu tempat.
 */
export const TAB_ROUTE_NAMES = ["home", "transactions", "wallet", "notifications", "settings"] as const
export type TabRouteName = (typeof TAB_ROUTE_NAMES)[number]
