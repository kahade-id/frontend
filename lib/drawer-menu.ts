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
 * "Pesan" menaut ke tab Pesan (/chat) supaya badge unread chat juga terlihat
 * dari drawer — angkanya dari store yang SAMA dengan badge tab
 * (`lib/chat-unread-count`), bukan endpoint baru.
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
  { id: "reports", label: "Laporan & Analitik", href: ROUTES.reports(), accessibilityLabel: "Buka laporan dan analitik" },
  { id: "messages", label: "Pesan", href: ROUTES.chat, accessibilityLabel: "Buka pesan" },
]

/**
 * FE-098: isi sheet "Toko Saya" — 7 item yang sebelumnya menjadi grup
 * "Toko & Pesanan" di Pengaturan. Rute TIDAK berubah (semua layar
 * app/* tetap ada); hanya titik masuknya yang pindah.
 */
export const SHOP_MENU_META: readonly DrawerMenuMeta[] = [
  { id: "shop-products", label: "Katalog Produk", href: ROUTES.products, accessibilityLabel: "Buka katalog produk" },
  { id: "shop-returns", label: "Retur Saya", href: ROUTES.returns, accessibilityLabel: "Buka retur saya" },
  { id: "shop-seller-products", label: "Produk Saya", href: ROUTES.sellerProducts, accessibilityLabel: "Buka produk saya" },
  { id: "shop-seller-vouchers", label: "Voucher Toko", href: ROUTES.sellerVouchers, accessibilityLabel: "Buka voucher toko" },
  { id: "shop-jastip", label: "Jastip Saya", href: ROUTES.jastip, accessibilityLabel: "Buka jastip saya" },
  { id: "shop-patungan", label: "Patungan", href: ROUTES.patungan, accessibilityLabel: "Buka patungan" },
  { id: "shop-service-bookings", label: "Booking Jasa", href: ROUTES.serviceBookings, accessibilityLabel: "Buka booking jasa" },
]

/** Menu bawah — revisi 2026-09-28 (permintaan produk). */
export const BOTTOM_MENU_META: readonly DrawerMenuMeta[] = [
  { id: "feedback", label: "Umpan Balik", href: ROUTES.feedback, accessibilityLabel: "Buka umpan balik" },
  { id: "live-support", label: "Bantuan Langsung", href: ROUTES.liveSupport, accessibilityLabel: "Buka bantuan langsung" },
  { id: "support-tickets", label: "Tiket Bantuan", href: ROUTES.support, accessibilityLabel: "Buka tiket bantuan" },
]

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
