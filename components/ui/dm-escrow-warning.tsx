/**
 * Kahade — <DmEscrowWarning> (U5-008, audit UX-deep 2026-09-29).
 *
 * Banner anti-tipu PERSISTEN di DM tanpa orderId: chat dengan seller yang
 * tampil identik dengan chat transaksi harus memperingatkan bahwa belum ada
 * perlindungan escrow di percakapan ini.
 *
 * Pemakaian di `app/chat/[roomId].tsx`: tampil HANYA bila
 *   - ruang adalah DM 1:1 (`isOneToOneChatRoom`) dan TANPA `orderId`,
 *   - bukan self-chat, dan
 *   - lawan bicara TIDAK terverifikasi (counterpart.sealTier == null —
 *     seller ber-badge abu-abu/biru/emas bebas dari banner).
 *
 * CTA "Buat transaksi" membuka sheet yang SAMA dengan menu ⋮ (bukan jalur
 * baru): dana tetap lewat escrow, PIN tetap wajib — komponen ini murni
 * tampilan, tidak mengubah logika bayar/refund apa pun.
 */
import { memo } from "react"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n"

export type DmEscrowWarningProps = {
  /** Buka sheet "Buat transaksi" (jalur escrow yang sama dengan menu ⋮). */
  onCreateOrder: () => void
}

function DmEscrowWarningBase({ onCreateOrder }: DmEscrowWarningProps) {
  return (
    <Alert
      tone="warning"
      variant="outline"
      banner
      title={translate("Chat ini belum dilindungi escrow")}
      action={
        <Button size="sm" variant="secondary" onPress={onCreateOrder}>
          {translate("Buat transaksi")}
        </Button>
      }
    >
      <Text variant="body" tone="secondary">
        {translate(
          "Jangan kirim uang langsung ke siapa pun. Buat transaksi agar dana Anda dilindungi escrow Kahade.",
        )}
      </Text>
    </Alert>
  )
}

export const DmEscrowWarning = memo(DmEscrowWarningBase)
