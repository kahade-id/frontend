/**
 * Kahade — gelembung pesan sekali-lihat (batch 43 FE-CHAT, 2026-09-28).
 *
 * CATATAN KONTRAK (penting): backend menandai pesan `viewOnce` sebagai
 * dikonsumsi saat `GET /messages` — yaitu SEBELUM pengguna mengetuk.
 * Secara visual bubble tetap blur sampai diketuk, tetapi semantik "baru
 * dianggap dibaca setelah ketuk" BELUM didukung kontrak backend saat ini
 * (ada masa tenggang singkat + purge oleh worker). Jangan mengklaim
 * sebaliknya di copy UI.
 *
 *   - Masuk & belum dibuka: kartu blur "Foto/Pesan sekali lihat — ketuk
 *     untuk melihat". Ketuk → konten tampil lokal (sudah di memori).
 *   - Masuk & sudah dibuka (`viewOnceViewedAt` terisi): placeholder
 *     "Pesan sudah dibuka" (isi dihapus server).
 *   - Keluar: status "Terkirim" / "Sudah dibuka" dari `viewOnceViewedAt`.
 */
import { memo, useState } from "react"
import { Pressable, View } from "react-native"

import type { ChatMessage } from "@/lib/api/chat"
import { isViewOnceConsumed } from "@/lib/chat-ephemeral"

import { Text } from "@/components/ui/text"
import { Icon } from "@/components/ui/icon"
import { Eye, EyeSlash } from "phosphor-react-native"

export type ChatViewOnceProps = {
  message: ChatMessage
  /** Pesan milik sendiri (kanan). */
  outgoing?: boolean
  /** Isi yang ditampilkan setelah dibuka (teks/lampiran ringkas). */
  children?: React.ReactNode
}

export const ChatViewOnce = memo(function ChatViewOnce({
  message,
  outgoing = false,
  children,
}: ChatViewOnceProps) {
  const [revealed, setRevealed] = useState(false)
  const consumed = isViewOnceConsumed(message)

  if (outgoing) {
    return (
      <View className="flex-row items-center gap-1.5">
        <Icon icon={consumed ? Eye : EyeSlash} size={14} tone="inverse" />
        <Text variant="caption" weight={600} tone="inverse">
          {consumed ? "Pesan sekali lihat sudah dibuka" : "Pesan sekali lihat terkirim"}
        </Text>
      </View>
    )
  }

  if (consumed && !revealed) {
    return (
      <View className="flex-row items-center gap-1.5 opacity-70">
        <Icon icon={EyeSlash} size={14} tone={outgoing ? "inverse" : "default"} />
        <Text variant="caption" tone={outgoing ? "inverse" : "secondary"} italic>
          Pesan sekali lihat ini sudah dibuka dan dihapus.
        </Text>
      </View>
    )
  }

  if (!revealed) {
    return (
      <Pressable
        onPress={() => setRevealed(true)}
        accessibilityRole="button"
        accessibilityLabel="Buka pesan sekali lihat"
        accessibilityHint="Pesan akan hilang setelah dibuka"
        className={`flex-row items-center gap-2 rounded-sm px-3 py-2 ${
          // UX-COL-005: pola CHT-013 — bg-black/15 tak terlihat di bubble
          // hitam (light mode); pakai putih di light, hitam di dark.
          outgoing ? "bg-white/15 dark:bg-black/15" : "bg-background"
        }`}
      >
        <Icon icon={Eye} size={16} tone={outgoing ? "inverse" : "info"} />
        <Text variant="caption" weight={600} tone={outgoing ? "inverse" : "primary"}>
          Pesan sekali lihat — ketuk untuk membuka
        </Text>
      </Pressable>
    )
  }

  return <View>{children}</View>
})
