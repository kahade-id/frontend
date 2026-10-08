/**
 * Kahade — pemisah hari untuk thread percakapan.
 *
 * Kenapa ada: sebelumnya setiap bubble mencetak `formatDateTime` (tanggal +
 * jam). Di thread panjang itu mengulang tanggal puluhan kali — bubble melebar,
 * angka bersaing dengan isi pesan, dan pembaca kehilangan penanda "kapan"
 * percakapan berpindah hari. Sekarang tanggal disebut SEKALI sebagai pemisah
 * dan bubble cukup jam (`formatTime`).
 *
 * Konvensi labelnya mengikuti pengelompokan riwayat dompet
 * (app/wallet-history.tsx) — "Hari ini" / "Kemarin" / "12 Sep 2026" — supaya
 * satu app tidak punya dua bahasa untuk tanggal yang sama.
 */
import { View } from "react-native"

import { dayKey, dayLabel } from "@/lib/chat-day-label"

import { Text } from "@/components/ui/text"

// Audit chat G18: logika kunci/label pindah ke lib/chat-day-label (teruji,
// `now` bisa disuntikkan, label dihitung ulang saat hari berganti). Diekspor
// ulang di sini agar pemakai lama (<ChatMessageRow>, layar room) tidak berubah.
export { dayKey, dayLabel }

export type ChatDaySeparatorProps = {
  /** Label hari (hasil `dayLabel`). */
  label: string
}

/** Chip caption tenang di tengah thread — bukan garis penuh yang memutus alur. */
export function ChatDaySeparator({ label }: ChatDaySeparatorProps) {
  return (
    <View className="items-center py-2">
      <View className="rounded-full bg-surface px-3 py-1">
        {/* role header: pembaca layar bisa melompat antar hari di thread
            panjang, bukan menggulir fragmen demi fragmen. */}
        <Text variant="caption" tone="secondary" weight={500} accessibilityRole="header">
          {label}
        </Text>
      </View>
    </View>
  )
}
