/**
 * Kahade — <DmSafetyDialog> (2026-10-08, menggantikan <DmEscrowWarning>).
 *
 * Banner "chat ini belum dilindungi…" dulu TAMPIL PERMANEN di atas ruang DM
 * yang belum punya transaksi. Produk memutuskan: peringatan tetap ada, tapi
 * tampil SEKALI per lawan bicara sebagai popup, lalu tidak pernah muncul lagi
 * untuk orang yang sama (penanda lokal di lib/chat-dm-notice-seen.ts).
 *
 * Keputusan non-obvious:
 *   - Dialog center (bukan BottomSheet): §10 menempatkan Modal/Dialog untuk
 *     "alert wajib" — ini peringatan keselamatan uang yang harus dibaca
 *     sebelum pengguna mengetik, bukan form atau daftar pilihan.
 *   - Dua aksi: "Buat transaksi" (utama — jalur yang sama dengan menu ⋮,
 *     bukan jalur baru) dan "Mengerti" (menutup). Tidak ada tombol tutup
 *     silang: pilihan biner lebih jelas, dan backdrop/back tetap bisa menutup.
 *   - Tanpa kata "escrow/rekber/ditahan": pengguna tidak perlu tahu nama
 *     mekanisme internal — yang penting "dana aman sampai barang diterima".
 *   - Komponen ini MURNI tampilan: tidak ada logika bayar/fee/refund.
 */
import { memo } from "react"
import { ShieldCheck } from "phosphor-react-native"

import { Dialog } from "@/components/ui/modal"
import { translate } from "@/lib/i18n"

export type DmSafetyDialogProps = {
  visible: boolean
  /** Buka sheet "Buat transaksi" — jalur yang sama dengan menu ⋮. */
  onCreateOrder: () => void
  /** Popup ditutup (tombol "Mengerti", backdrop, back, escape). */
  onDismiss: () => void
}

function DmSafetyDialogBase({ visible, onCreateOrder, onDismiss }: DmSafetyDialogProps) {
  return (
    <Dialog
      visible={visible}
      onRequestClose={onDismiss}
      // Peringatan keselamatan: aman ditutup dari backdrop/back — popup ini
      // bukan konfirmasi destruktif, dan "Mengerti" tetap tersedia.
      dismissOnBackdrop
      icon={ShieldCheck}
      tone="warning"
      title={translate("Pastikan transaksi lewat Kahade")}
      description={translate(
        "Kirim uang hanya lewat transaksi di aplikasi. Dana Anda baru diteruskan ke penjual setelah barang atau jasa benar-benar Anda terima.",
      )}
      confirmLabel={translate("Buat transaksi")}
      cancelLabel={translate("Mengerti")}
      onConfirm={onCreateOrder}
      onCancel={onDismiss}
    />
  )
}

export const DmSafetyDialog = memo(DmSafetyDialogBase)
