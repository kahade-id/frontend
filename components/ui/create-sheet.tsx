/**
 * Kahade — <CreateSheet>: sheet global "Buat baru" yang reusable.
 *
 * Dibuka dari tombol (+) di header Etalase dan pensil di utility bar
 * drawer (2026-09-28): satu pintu pembuatan untuk seluruh app.
 * Di-mount sekali di root layout; pemanggil cukup `openCreateSheet()`.
 *
 * Isi: tiga aksi "membuat sesuatu" yang paling sering dipakai. Dikelompokkan
 * di satu sheet karena ketiganya bukan TEMPAT (tab) melainkan aksi sesekali.
 */
import { router } from "expo-router"
import { CardsThree, Lightning, Wallet } from "phosphor-react-native"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import {
  closeCreateSheet,
  useCreateSheetOpen,
} from "@/lib/create-sheet"
import { useLanguage, translate } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"

/**
 * Item sheet "Buat baru". Dipindah dari bottom-tab-bar (2026-09-28) agar
 * reusable dari header Etalase & drawer — bottom-tab-bar me-re-export
 * `CENTER_ACTION_ITEMS` untuk kompatibilitas.
 */
export const CREATE_SHEET_ITEMS: readonly ActionSheetItem[] = [
  {
    key: "create-showcase",
    label: "Buat Karya",
    description: "Unggah karya atau produk baru ke etalase Anda",
    icon: CardsThree,
    onPress: () => router.push(ROUTES.showcaseCreate),
  },
  {
    key: "create-transaction",
    label: "Buat transaksi",
    description: "Jual atau beli dengan dana dijaga escrow",
    icon: Lightning,
    onPress: () => router.push(ROUTES.createTransaction),
  },
  {
    key: "topup",
    label: "Isi saldo dompet",
    description: "Top up lewat bank, QRIS, atau gerai ritel",
    icon: Wallet,
    onPress: () => router.push(ROUTES.topup),
  },
]

/** Kompat: nama lama yang dipakai shell-tab-bar/bottom-tab-bar. */
export const CENTER_ACTION_ITEMS = CREATE_SHEET_ITEMS

export function CreateSheet() {
  useLanguage()
  const open = useCreateSheetOpen()
  return (
    <ActionSheet
      visible={open}
      onRequestClose={closeCreateSheet}
      title={translate("Buat baru")}
      description={translate("Pilih yang mau Anda kerjakan.")}
      actions={CREATE_SHEET_ITEMS}
    />
  )
}
