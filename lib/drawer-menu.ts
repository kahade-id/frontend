/**
 * Kahade — metadata menu drawer (modul MURNI, bisa di-unit-test di vitest
 * node env).
 *
 * Kenapa dipisah dari `components/ui/app-drawer.tsx` (non-obvious):
 * app-drawer menarik graf native (phosphor-react-native, reanimated,
 * gesture-handler) yang tidak bisa diimpor di vitest — padahal label menu
 * adalah kontrak produk yang perlu dikunci test. Modul ini hanya membawa
 * data (id, label, accessibilityLabel, href); app-drawer menggabungkannya
 * dengan ikon Phosphor saat render.
 */
import type { Href } from "expo-router"

import { ROUTES } from "@/lib/routes"

export type DrawerMenuMeta = {
  id: string
  label: string
  accessibilityLabel: string
  /** Salah satu: href statis, atau absen = aksi khusus (mis. profil yang sadar tamu). */
  href?: Href
}

/**
 * Menu utama sidebar — susunan & urutan PERSIS sesuai spesifikasi produk
 * 2026-10-05 (bahasa Indonesia):
 *
 *   Lihat Profil
 *   Kelola Etalase (tab "Tersimpan" di dalamnya — isi /saved pindah ke sini)
 *   Kelola Transaksi (deep-link section Kelola di tab Transaksi)
 *   Dompet Saya / Rekening Bank (kill-switch — lihat getMainMenuMeta)
 *   Buku Alamat
 *   Laporan & Analitik (→ /analytics)
 *
 * UX-NAV-007: item "Pesan" DIHAPUS dari drawer — tab bawah "Pesan" (/chat)
 * sudah mencakupnya (badge unread tetap di tab). Drawer bukan tempat
 * duplikat tab.
 *
 * Poin 1 (2026-10-04): TIDAK ada seller flag — "Toko Saya" dihapus sebagai
 * konsep; isinya didistribusikan ulang (Kelola Etalase, tab Transaksi,
 * detail order).
 *
 * Poin 2 (2026-10-04): "Template Transaksi", "Tautan Pesanan", "Sengketa
 * Saya" PINDAH ke tab Transaksi (section Kelola) — DIHAPUS dari drawer agar
 * semua urusan transaksi satu tempat. UX-NAV-002 (pintu masuk tetap
 * sengketa) dipertahankan lewat "Kelola Transaksi" di bawah.
 */
export const MAIN_MENU_META: readonly DrawerMenuMeta[] = [
  { id: "profile", label: "Lihat Profil", accessibilityLabel: "Lihat profil saya" },
  { id: "etalase", label: "Kelola Etalase", href: ROUTES.showcaseManagement, accessibilityLabel: "Kelola etalase saya" },
  { id: "trx-manage", label: "Kelola Transaksi", href: ROUTES.transactionsManage, accessibilityLabel: "Kelola transaksi saya" },
  { id: "wallet", label: "Dompet Saya", href: ROUTES.wallet, accessibilityLabel: "Buka dompet saya" },
  { id: "addresses", label: "Buku Alamat", href: ROUTES.addresses, accessibilityLabel: "Buka buku alamat" },
  // Menu laporan utama membuka dashboard analitik; daftar laporan konten
  // tetap tersedia melalui rute /reports yang memang khusus untuk laporan.
  { id: "reports", label: "Laporan & Analitik", href: ROUTES.analytics, accessibilityLabel: "Laporan & Analitik" },
]

/**
 * Menu sekunder sidebar — di bawah garis pemisah (spesifikasi 2026-10-05):
 *
 *   Keamanan (→ /security; row "Keluar" + section Notifikasi di dalamnya)
 *   Pusat Bantuan (→ /faq; Syarat & Privasi di bagian bawah layar itu)
 *   Bisnis (→ /business-verification)
 *
 * /settings DIHAPUS TOTAL — "Keamanan" menggantikannya sebagai hub akun;
 * tidak ada lagi item gear/Pengaturan di drawer.
 */
export const SECONDARY_MENU_META: readonly DrawerMenuMeta[] = [
  { id: "security", label: "Keamanan", href: ROUTES.security, accessibilityLabel: "Buka keamanan" },
  { id: "help-center", label: "Pusat Bantuan", href: ROUTES.faq, accessibilityLabel: "Buka pusat bantuan" },
  { id: "business", label: "Bisnis", href: ROUTES.businessVerification, accessibilityLabel: "Buka verifikasi bisnis" },
]

/**
 * Mode Tanpa Wallet Internal (BI-safe): menu utama yang sadar kill-switch.
 *
 * - Flag true  → MAIN_MENU_META apa adanya ("Dompet Saya").
 * - Flag false → item "Dompet Saya" DIGANTI "Rekening Bank" (dana transaksi
 *   kini mengalir ke bank; seller wajib punya rekening terdaftar). Tidak
 *   ada rute dompet yang tersisa di drawer.
 *
 * Fungsi murni (boolean in, array out) supaya tetap bisa di-unit-test di
 * vitest node env — pemanggil (AppDrawer) memakai `useWalletEnabled()`.
 */
export function getMainMenuMeta(walletEnabled: boolean): readonly DrawerMenuMeta[] {
  if (walletEnabled) return MAIN_MENU_META
  return MAIN_MENU_META.map((item) =>
    item.id === "wallet"
      ? {
          id: "bank-accounts",
          label: "Rekening Bank",
          href: ROUTES.bankAccounts,
          accessibilityLabel: "Kelola rekening bank",
        }
      : item,
  )
}
