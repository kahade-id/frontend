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
 * Poin 1 (2026-10-04, keputusan produk): TIDAK ada seller flag / gate
 * "Buka Toko" — semua user inheren buyer+seller. Item "Toko Saya" DIHAPUS
 * sebagai konsep (bersama sheet submenu-nya); isinya didistribusikan ulang:
 * Produk & Stok + Voucher Toko → Kelola Etalase; Jastip/Patungan/Booking →
 * tab Transaksi; Retur → per-order dari detail transaksi; Katalog Publik
 * dihapus (penghapusan total model katalog = Poin 4, terpisah).
 *
 * Poin 2 (2026-10-04, keputusan produk): "Template Transaksi",
 * "Tautan Pesanan", "Sengketa Saya" PINDAH ke tab Transaksi (baris "Kelola"
 * di segmen Transaksi) — DIHAPUS dari drawer agar tidak tercecer sebagai
 * dunia tersendiri; semua urusan transaksi satu tempat. UX-NAV-002 (pintu
 * masuk tetap sengketa) dipertahankan lewat baris Kelola tersebut.
 *
 * Menu "Laporan & analitik" menuju dashboard analytics (/analytics), bukan
 * daftar laporan konten (/reports).
 */
export const MAIN_MENU_META: readonly DrawerMenuMeta[] = [
  { id: "profile", label: "Lihat Profil", accessibilityLabel: "Lihat profil saya" },
  { id: "wallet", label: "Dompet Saya", href: ROUTES.wallet, accessibilityLabel: "Buka dompet saya" },
  { id: "etalase", label: "Kelola Etalase", href: ROUTES.showcaseManagement, accessibilityLabel: "Kelola etalase saya" },
  // Menu laporan utama membuka dashboard analitik; daftar laporan konten
  // tetap tersedia melalui rute /reports yang memang khusus untuk laporan.
  { id: "reports", label: "Laporan & Analitik", href: ROUTES.analytics, accessibilityLabel: "Laporan & Analitik" },
]

/** Native drawer has one consolidated path to FAQ + support resources. */
export const HELP_MENU_META: readonly DrawerMenuMeta[] = [
  { id: "help-center", label: "Bantuan", href: ROUTES.faq, accessibilityLabel: "Buka pusat bantuan" },
]

/**
 * Legacy web-only drawer rows. The shipped web route redirects to the landing
 * site; keep this metadata solely for old web-shell compatibility/tests.
 * Native Android/iOS render HELP_MENU_META instead.
 *
 * Poin 5 (2026-10-04): "Bantuan Langsung" (chat palsu polling-tiket) dihapus —
 * entri web-legacy ini kini menunjuk shell jujur /support-chat ("Chat dengan
 * tim Kahade"; gelombang 2 = client websocket penuh).
 * @deprecated
 */
export const BOTTOM_MENU_META: readonly DrawerMenuMeta[] = [
  { id: "feedback", label: "Umpan Balik", href: ROUTES.feedback, accessibilityLabel: "Buka umpan balik" },
  { id: "live-support", label: "Chat dengan tim Kahade", href: ROUTES.supportChat, accessibilityLabel: "Buka chat dengan tim Kahade" },
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
