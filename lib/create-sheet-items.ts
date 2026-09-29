/**
 * Kahade — data aksi sheet global "Buat baru" (modul MURNI, bisa di-unit-test
 * di vitest node env).
 *
 * Dipisah dari `components/ui/create-sheet.tsx` dengan alasan yang sama
 * seperti `lib/drawer-menu.ts`: lapisan UI menarik graf native
 * (phosphor-react-native, expo-router) yang tidak bisa diimpor di vitest —
 * padahal daftar aksi adalah kontrak produk yang perlu dikunci test.
 *
 * Mode Tanpa Wallet Internal (BI-safe): `getCreateSheetItems(false)`
 * menyembunyikan aksi "Isi saldo dompet" — top-up tidak ada dalam mode ini;
 * buyer membayar langsung per transaksi via DANA.
 */
import type { Href } from "expo-router"

import { ROUTES } from "@/lib/routes"

export type CreateSheetItemMeta = {
  key: string
  label: string
  description: string
  /** Nama ikon Phosphor — dipetakan ke komponen di lapisan UI. */
  icon: "showcase" | "transaction" | "topup"
  href: Href
}

export const CREATE_SHEET_ITEMS_META: readonly CreateSheetItemMeta[] = [
  {
    key: "create-showcase",
    label: "Buat Karya",
    description: "Unggah karya atau produk baru ke etalase Anda",
    icon: "showcase",
    href: ROUTES.showcaseCreate,
  },
  {
    key: "create-transaction",
    label: "Buat transaksi",
    description: "Jual atau beli dengan dana dijaga escrow",
    icon: "transaction",
    href: ROUTES.createTransaction,
  },
  {
    key: "topup",
    label: "Isi saldo dompet",
    description: "Top up lewat bank, QRIS, atau gerai ritel",
    icon: "topup",
    href: ROUTES.topup,
  },
]

/**
 * Aksi sheet yang sadar kill-switch dompet. Fungsi murni (boolean in,
 * array out); komponen memakai `useWalletEnabled()`.
 */
export function getCreateSheetItemsMeta(
  walletEnabled: boolean,
): readonly CreateSheetItemMeta[] {
  if (walletEnabled) return CREATE_SHEET_ITEMS_META
  return CREATE_SHEET_ITEMS_META.filter((item) => item.key !== "topup")
}
