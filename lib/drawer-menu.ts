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
  { id: "templates", label: "Template Transaksi", href: ROUTES.transactionTemplates, accessibilityLabel: "Buka template transaksi" },
  { id: "order-links", label: "Order Link", href: ROUTES.orderLinks, accessibilityLabel: "Buka order link" },
  { id: "reports", label: "Laporan & Analitik", href: ROUTES.reports(), accessibilityLabel: "Buka laporan dan analitik" },
  { id: "messages", label: "Pesan", href: ROUTES.chat, accessibilityLabel: "Buka pesan" },
]

/** Menu bawah — revisi 2026-09-28 (permintaan produk). */
export const BOTTOM_MENU_META: readonly DrawerMenuMeta[] = [
  { id: "feedback", label: "Umpan Balik", href: ROUTES.feedback, accessibilityLabel: "Buka umpan balik" },
  { id: "live-support", label: "Bantuan Langsung", href: ROUTES.liveSupport, accessibilityLabel: "Buka bantuan langsung" },
  { id: "support-tickets", label: "Tiket Bantuan", href: ROUTES.support, accessibilityLabel: "Buka tiket bantuan" },
]
