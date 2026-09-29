/**
 * Kahade — <CreateSheet>: sheet global "Buat baru" yang reusable.
 *
 * Dibuka dari tombol (+) di header Etalase dan pensil di utility bar
 * drawer (2026-09-28): satu pintu pembuatan untuk seluruh app.
 * Di-mount sekali di root layout; pemanggil cukup `openCreateSheet()`.
 *
 * Isi: tiga aksi "membuat sesuatu" yang paling sering dipakai. Dikelompokkan
 * di satu sheet karena ketiganya bukan TEMPAT (tab) melainkan aksi sesekali.
 *
 * Data aksi (label/deskripsi/href) hidup di `lib/create-sheet-items.ts`
 * (modul murni, bisa di-unit-test); komponen ini hanya memetakan ikon
 * Phosphor + handler navigasi.
 */
import { router } from "expo-router"
import { CardsThree, Lightning, Wallet } from "phosphor-react-native"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import {
  closeCreateSheet,
  useCreateSheetOpen,
} from "@/lib/create-sheet"
import { useLanguage, translate } from "@/lib/i18n"
import {
  CREATE_SHEET_ITEMS_META,
  getCreateSheetItemsMeta,
  type CreateSheetItemMeta,
} from "@/lib/create-sheet-items"
import { useWalletEnabled } from "@/lib/use-wallet-enabled"
import type { IconComponent } from "@/components/ui/icon"

const CREATE_SHEET_ICONS: Record<CreateSheetItemMeta["icon"], IconComponent> = {
  showcase: CardsThree,
  transaction: Lightning,
  topup: Wallet,
}

/**
 * Item sheet "Buat baru". Dipindah dari bottom-tab-bar (2026-09-28) agar
 * reusable dari header Etalase & drawer — bottom-tab-bar me-re-export
 * `CENTER_ACTION_ITEMS` untuk kompatibilitas.
 *
 * Kompat: snapshot statis (flag dompet NYALA). Pemakaian baru: rakit dari
 * `getCreateSheetItemsMeta(walletEnabled)` + `toActionSheetItem`.
 */
export const CREATE_SHEET_ITEMS: readonly ActionSheetItem[] = CREATE_SHEET_ITEMS_META.map(
  toActionSheetItem,
)

function toActionSheetItem(meta: CreateSheetItemMeta): ActionSheetItem {
  return {
    key: meta.key,
    label: meta.label,
    description: meta.description,
    icon: CREATE_SHEET_ICONS[meta.icon],
    onPress: () => router.push(meta.href),
  }
}

/**
 * Mode Tanpa Wallet Internal (BI-safe): item sheet yang sadar kill-switch —
 * flag false = aksi "Isi saldo dompet" disembunyikan (top-up tidak ada
 * dalam mode ini; bayar langsung per transaksi via DANA).
 */
export function getCreateSheetItems(walletEnabled: boolean): readonly ActionSheetItem[] {
  return getCreateSheetItemsMeta(walletEnabled).map(toActionSheetItem)
}

/** Kompat: nama lama yang dipakai shell-tab-bar/bottom-tab-bar. */
export const CENTER_ACTION_ITEMS = CREATE_SHEET_ITEMS

export function CreateSheet() {
  useLanguage()
  const open = useCreateSheetOpen()
  const walletEnabled = useWalletEnabled()
  return (
    <ActionSheet
      visible={open}
      onRequestClose={closeCreateSheet}
      title={translate("Buat baru")}
      actions={getCreateSheetItems(walletEnabled)}
    />
  )
}
