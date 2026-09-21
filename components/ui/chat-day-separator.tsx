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

import { formatDate } from "@/lib/format"

import { Text } from "@/components/ui/text"

/**
 * Kunci hari lokal (tanpa jam) — pembanding untuk memutuskan apakah sebuah
 * pesan membuka hari baru. Bukan `toISOString().slice(0,10)`: itu UTC, jadi
 * percakapan pukul 06.00 WIB akan dianggap "kemarin".
 */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** Label manusia untuk satu hari: "Hari ini" / "Kemarin" / "12 Sep 2026". */
export function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return formatDate(iso)
  const now = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000)
  if (diffDays === 0) return "Hari ini"
  if (diffDays === 1) return "Kemarin"
  return formatDate(d)
}

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
