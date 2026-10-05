/**
 * Kahade — <DrawerMenuButton> (T5-002, audit UI/UX intuitif 2026-09-29).
 *
 * Tombol buka-drawer untuk header tab Transaksi, Pesan, dan Notifikasi.
 * Ikon Equal (=) — SAMA dengan tombol menu di header tab Etalase
 * (`components/ui/showcase-header.tsx`) — supaya bahasa visualnya konsisten
 * di keempat tab. Perilaku drawer sendiri tidak diubah: hanya memanggil
 * `openDrawer()`.
 */
import { Equals } from "phosphor-react-native"

import { openDrawer } from "@/lib/drawer"
import { translate } from "@/lib/i18n/translate"

import { HeaderCircleButton } from "@/components/ui/header"

export function DrawerMenuButton() {
  return (
    <HeaderCircleButton
      icon={Equals}
      accessibilityLabel={translate("Menu")}
      accessibilityHint={translate("Buka menu navigasi")}
      onPress={openDrawer}
    />
  )
}
