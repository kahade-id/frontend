/**
 * Kahade — struktur navigasi utama baru (2026-09-27, redesign navigasi mobile).
 *
 * Bottom navbar kini TETAP dan tidak lagi mengikuti mode aplikasi:
 *
 *   Etalase | Transaksi | (QR) | Pesan | Notifikasi
 *
 * - Tab lama Wallet / Promo / History / Lainnya dihapus dari bar; layar-layar
 *   itu tetap ada sebagai rute stack dan dijangkau lewat drawer/sidebar.
 * - Notifikasi naik menjadi tab sejati dengan badge unread.
 * - Tombol tengah kini ikon QR — ketuk langsung membuka pemindai /scan
 *   (keputusan produk 2026-09-27, revisi 2026-09-28). Sheet "Buat baru"
 *   pindah ke tombol (+) di header Etalase dan pensil di drawer
 *   (reusable <CreateSheet>).
 *
 * File ini satu-satunya sumber struktur tab; `shell-tab-bar.tsx` merendernya,
 * root layout memakai `isShellTabPath` untuk visibilitas bar.
 */
import { BellSimple, CardsThree, ChatCenteredText, ShoppingBag } from "phosphor-react-native"

import type { IconComponent } from "@/components/ui/icon"
import type { TabRouteName } from "@/lib/routes"

export type ShellTabKey = TabRouteName

export type ShellTabDef = {
  /** Kunci tab = nama rute di grup `(tabs)`. */
  key: ShellTabKey
  label: string
  accessibilityLabel: string
  href: string
  icon: IconComponent
}

/** Urutan tab di bottom navbar: kiri → kanan (slot tengah diisi tombol pindai QR). */
export const SHELL_TABS: readonly ShellTabDef[] = [
  {
    key: "showcase",
    label: "Etalase",
    accessibilityLabel: "Tab Etalase",
    href: "/showcase",
    icon: CardsThree,
  },
  {
    key: "transactions",
    label: "Transaksi",
    accessibilityLabel: "Tab Transaksi",
    href: "/transactions",
    icon: ShoppingBag,
  },
  {
    key: "chat",
    label: "Pesan",
    accessibilityLabel: "Tab Pesan",
    href: "/chat",
    icon: ChatCenteredText,
  },
  {
    key: "notifications",
    label: "Notifikasi",
    accessibilityLabel: "Tab Notifikasi",
    href: "/notifications",
    icon: BellSimple,
  },
]

export const SHELL_TAB_PATHS: readonly string[] = SHELL_TABS.map((t) => t.href)

function normalizePath(path: string): string {
  const base = path.split("?")[0]?.split("#")[0] ?? "/"
  const trimmed = base.length > 1 && base.endsWith("/") ? base.slice(0, -1) : base
  return trimmed.toLowerCase()
}

/**
 * Halaman tab persis (bukan sub-path): satu-satunya tempat bottom navbar
 * ditampilkan. Sub-path seperti /chat/room atau /notifications/settings
 * TIDAK menampilkan bar (konsisten dengan perilaku lama `activeShellSlot`).
 */
export function isShellTabPath(pathname: string): boolean {
  const path = normalizePath(pathname)
  return SHELL_TAB_PATHS.some((p) => p === path)
}

/** Def tab untuk pathname persis, atau undefined bila bukan halaman tab. */
export function shellTabForPath(pathname: string): ShellTabDef | undefined {
  const path = normalizePath(pathname)
  return SHELL_TABS.find((t) => t.href === path)
}
