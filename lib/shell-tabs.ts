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
 *   (keputusan produk 2026-09-27, revisi 2026-09-28). Tombol (+) bersifat
 *   kontekstual: Etalase membuka form karya, Transaksi membuka form transaksi;
 *   sheet global "Buat baru" tetap tersedia dari utility bar drawer.
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
  const segments = base
    .split("/")
    .filter(Boolean)
    .filter((segment) => !(/^\([^/]+\)$/).test(segment))
  return `/${segments.join("/")}`.toLowerCase()
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

// The tab bar uses navigate() instead of building a browser-like stack. Keep a
// small in-memory visit history so native Back returns to the previous tab,
// then lets the OS exit normally when the history is exhausted.
let activeShellTab: ShellTabKey | null = null
let shellTabHistory: ShellTabKey[] = []

export function rememberShellTabVisit(pathname: string): void {
  const next = shellTabForPath(pathname)?.key
  if (!next || next === activeShellTab) return
  if (activeShellTab) {
    shellTabHistory.push(activeShellTab)
    if (shellTabHistory.length > 32) shellTabHistory = shellTabHistory.slice(-32)
  }
  activeShellTab = next
}

/** Pop one prior tab; returns undefined so the platform can handle/exit. */
export function popPreviousShellTab(pathname: string): ShellTabDef | undefined {
  const current = shellTabForPath(pathname)?.key
  if (!current) return undefined
  while (shellTabHistory.length > 0) {
    const previous = shellTabHistory.pop()
    if (!previous || previous === current) continue
    activeShellTab = previous
    return SHELL_TABS.find((tab) => tab.key === previous)
  }
  return undefined
}

/** Clear history when an account signs out (and between isolated tests). */
export function resetShellTabHistory(): void {
  activeShellTab = null
  shellTabHistory = []
}
