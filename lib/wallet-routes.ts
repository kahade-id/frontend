/**
 * Kahade — klasifikasi route khusus-dompet (Mode Tanpa Wallet Internal,
 * BI-safe).
 *
 * Modul MURNI: tidak membaca flag — pemanggil (notification-routing,
 * deep-link handler) menggabungkan hasil klasifikasi dengan
 * `getWalletEnabled()` dari `@/lib/wallet-flag`.
 *
 * Daftar prefix diselaraskan dengan layar yang di-gate di Milestone B:
 * wallet, topup, transfer, receive, wallet-history, topup-history,
 * withdraw-history, wallet-transaction/[txId], withdrawal-schedules.
 * `/withdraw` SENGAJA dikecualikan — jalur satu arah penarikan saldo lama.
 */
import type { Href } from "expo-router"

/** Prefix path yang hanya hidup bila wallet aktif (lihat `lib/routes.ts`). */
const WALLET_ONLY_PREFIXES = [
  "/wallet",
  "/topup",
  "/transfer",
  "/receive",
  "/wallet-history",
  "/topup-history",
  "/withdraw-history",
  "/wallet-transaction",
  "/withdrawal-schedules",
] as const

/**
 * `/withdraw` adalah pengecualian legacy: tetap boleh dibuka saat flag mati
 * (mode "Tarik Saldo Lama"). Query (`?resume=`) ikut dihitung.
 */
export function isLegacyWithdrawalPath(pathname: string): boolean {
  const head = pathname.split("?", 1)[0]
  return head === "/withdraw"
}

/**
 * True bila path hanya bermakna saat wallet aktif — deep-link / tap push ke
 * sini saat flag mati harus di-fallback, bukan dibuka lalu diblokir layar.
 */
export function isWalletOnlyPath(pathname: string): boolean {
  const head = pathname.split("?", 1)[0]
  if (isLegacyWithdrawalPath(head)) return false
  return WALLET_ONLY_PREFIXES.some((p) => head === p || head.startsWith(`${p}/`))
}

/**
 * Pengganti saat wallet mati:
 * - riwayat & detail mutasi → `/transactions` (konteks terdekat yang hidup)
 * - dompet, topup, transfer, receive, jadwal → `/bank-accounts`
 */
export function walletRouteFallback(pathname: string): string {
  const head = pathname.split("?", 1)[0]
  if (
    head === "/wallet-history" ||
    head.startsWith("/wallet-history/") ||
    head === "/topup-history" ||
    head.startsWith("/topup-history/") ||
    head === "/withdraw-history" ||
    head.startsWith("/withdraw-history/") ||
    head === "/wallet-transaction" ||
    head.startsWith("/wallet-transaction/")
  ) {
    return "/transactions"
  }
  return "/bank-accounts"
}

/** Ambil pathname dari Href (string polos atau objek `{ pathname, params }`). */
export function hrefPathname(href: Href): string {
  if (typeof href === "string") return href.split("?", 1)[0] ?? ""
  const pathname = (href as { pathname?: unknown }).pathname
  if (typeof pathname !== "string") return ""
  return pathname.split("?", 1)[0] ?? ""
}
