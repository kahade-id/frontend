/**
 * Kahade — <DmSafetyBanner> (audit Pesan 2026-10-10, #8).
 *
 * Keputusan produk: banner anti-tipu TAMPIL SELALU di setiap DM tanpa
 * transaksi (orderId), kecuali lawan bicara terverifikasi. Menggantikan popup
 * "sekali per lawan bicara" (2026-10-08) yang bisa ditutup satu ketukan lalu
 * tidak pernah muncul lagi — padahal penipuan "transfer langsung" justru
 * terjadi beberapa pesan KEMUDIAN, setelah peringatan itu lewat.
 *
 * Keputusan non-obvious:
 *   - Tanpa tombol tutup & tanpa penanda lokal: tidak ada yang perlu
 *     disimpan, tidak ada state yang bisa salah (lib/chat-dm-notice-seen.ts
 *     dihapus). Banner hilang sendiri begitu ruang punya orderId.
 *   - Ringkas (judul + satu kalimat + satu CTA): ini pengingat, bukan artikel.
 *     Bantuan panjang ada di Pusat Bantuan, bukan tersebar di ruang chat.
 *   - CTA "Buat transaksi" membuka sheet yang SAMA dengan menu ⋮ — bukan
 *     jalur baru. Komponen ini murni tampilan: tidak ada logika bayar/fee.
 *   - Tanpa istilah internal (escrow/rekber/ditahan): yang penting bagi
 *     pengguna adalah "dana diteruskan setelah barang diterima".
 */
import { memo } from "react"
import { ShieldCheck } from "phosphor-react-native"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { translate } from "@/lib/i18n"

export type DmSafetyBannerProps = {
  /** Buka sheet "Buat transaksi" — jalur yang sama dengan menu ⋮. */
  onCreateOrder: () => void
}

function DmSafetyBannerBase({ onCreateOrder }: DmSafetyBannerProps) {
  return (
    <Alert
      testID="dm-safety-banner"
      tone="warning"
      banner
      icon={ShieldCheck}
      title={translate("Pastikan transaksi lewat Kahade")}
      action={
        <Button size="sm" variant="secondary" onPress={onCreateOrder}>
          {translate("Buat transaksi")}
        </Button>
      }
    >
      {translate(
        "Kirim uang hanya lewat transaksi di aplikasi. Dana Anda baru diteruskan ke penjual setelah barang atau jasa benar-benar Anda terima.",
      )}
    </Alert>
  )
}

export const DmSafetyBanner = memo(DmSafetyBannerBase)
