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
 * Menu utama — urutan sesuai spesifikasi user. Label Bahasa Indonesia
 * (revisi 2026-09-28, permintaan produk).
 *
 * UX-NAV-007: item "Pesan" DIHAPUS dari drawer — tab bawah "Pesan" (/chat)
 * sudah mencakupnya (badge unread tetap di tab). Drawer bukan tempat
 * duplikat tab.
 *
 * UX-NAV-002: "Sengketa Saya" (/disputes) — daftar sengketa sebelumnya
 * hanya bisa dibuka dari CTA di detail order; kini ada pintu masuk tetap
 * di navigasi utama.
 *
 * Menu "Laporan & analitik" menuju dashboard analytics (/analytics), bukan
 * daftar laporan konten (/reports).
 */
export const MAIN_MENU_META: readonly DrawerMenuMeta[] = [
  { id: "profile", label: "Lihat Profil", accessibilityLabel: "Lihat profil saya" },
  { id: "wallet", label: "Dompet Saya", href: ROUTES.wallet, accessibilityLabel: "Buka dompet saya" },
  { id: "etalase", label: "Kelola Etalase", href: ROUTES.showcaseManagement, accessibilityLabel: "Kelola etalase saya" },
  // FE-098 (§9 minimalisme): grup "Toko & Pesanan" dipindah keluar dari
  // Pengaturan — dibuka sebagai sheet "Toko Saya" dari drawer (tanpa href =
  // aksi khusus, pola sama seperti "profile").
  { id: "shop", label: "Toko Saya", accessibilityLabel: "Buka menu toko saya" },
  { id: "templates", label: "Template Transaksi", href: ROUTES.transactionTemplates, accessibilityLabel: "Buka template transaksi" },
  { id: "order-links", label: "Tautan Pesanan", href: ROUTES.orderLinks, accessibilityLabel: "Buka tautan pesanan" },
  // UX-NAV-002: pintu masuk tetap ke daftar sengketa.
  { id: "disputes", label: "Sengketa Saya", href: ROUTES.disputes, accessibilityLabel: "Buka sengketa saya" },
  // Menu laporan utama membuka dashboard analitik; daftar laporan konten
  // tetap tersedia melalui rute /reports yang memang khusus untuk laporan.
  { id: "reports", label: "Laporan & Analitik", href: ROUTES.analytics, accessibilityLabel: "Laporan & Analitik" },
]

/**
 * FE-098: isi sheet "Toko Saya" — 7 item yang sebelumnya menjadi grup
 * "Toko & Pesanan" di Pengaturan. Rute TIDAK berubah (semua layar
 * app/* tetap ada); hanya titik masuknya yang pindah.
 */
export const SHOP_MENU_META: readonly DrawerMenuMeta[] = [
  // UX-NAV-005: "Katalog Publik" (jelajah katalog, GET /v1/products) dibedakan
  // tegas dari "Produk & Stok Saya" (produk milik sendiri + stok,
  // GET /v1/products/seller/mine). Keduanya bukan "Kelola Etalase" (menu utama
  // → etalase sosial).
  { id: "shop-products", label: "Katalog Publik", href: ROUTES.products, accessibilityLabel: "Jelajahi katalog produk publik" },
  { id: "shop-returns", label: "Retur Saya", href: ROUTES.returns, accessibilityLabel: "Buka retur saya" },
  { id: "shop-seller-products", label: "Produk & Stok Saya", href: ROUTES.sellerProducts, accessibilityLabel: "Kelola produk dan stok saya" },
  { id: "shop-seller-vouchers", label: "Voucher Toko", href: ROUTES.sellerVouchers, accessibilityLabel: "Buka voucher toko" },
  { id: "shop-jastip", label: "Jastip Saya", href: ROUTES.jastip, accessibilityLabel: "Buka jastip saya" },
  { id: "shop-patungan", label: "Patungan", href: ROUTES.patungan, accessibilityLabel: "Buka patungan" },
  { id: "shop-service-bookings", label: "Booking Jasa", href: ROUTES.serviceBookings, accessibilityLabel: "Buka booking jasa" },
]

/** Native drawer has one consolidated path to FAQ + support resources. */
export const HELP_MENU_META: readonly DrawerMenuMeta[] = [
  { id: "help-center", label: "Bantuan", href: ROUTES.faq, accessibilityLabel: "Buka pusat bantuan" },
]

/**
 * Legacy web-only drawer rows. The shipped web route redirects to the landing
 * site; keep this metadata solely for old web-shell compatibility/tests.
 * Native Android/iOS render HELP_MENU_META instead.
 * @deprecated
 */
export const BOTTOM_MENU_META: readonly DrawerMenuMeta[] = [
  { id: "feedback", label: "Umpan Balik", href: ROUTES.feedback, accessibilityLabel: "Buka umpan balik" },
  { id: "live-support", label: "Bantuan Langsung", href: ROUTES.liveSupport, accessibilityLabel: "Buka bantuan langsung" },
  { id: "support-tickets", label: "Tiket Bantuan", href: ROUTES.support, accessibilityLabel: "Buka tiket bantuan" },
]

/** Product menu by platform; native consolidates support links under FAQ. */
export function getDrawerFooterMenuMeta(platform: string): readonly DrawerMenuMeta[] {
  return platform === "web" ? BOTTOM_MENU_META : HELP_MENU_META
}

/**
 * Mode Tanpa Wallet Internal (BI-safe): menu utama yang sadar kill-switch.
 *
 * - Flag true  → MAIN_MENU_META apa adanya ("Dompet Saya").
 * - Flag false → item "Dompet Saya" DIGANTI "Rekening Bank" (dana escrow
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
