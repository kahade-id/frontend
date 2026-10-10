/**
 * Kahade — pemisah "Belum dibaca" di thread chat (B02).
 *
 * Dipasang tepat di atas pesan pertama yang belum dibaca (jangkar dihitung
 * `firstUnreadMessageId` dari `unreadCount` daftar room SEBELUM room ditandai
 * terbaca). Gaya mengikuti <ChatDaySeparator>: chip tenang di tengah thread.
 *
 * B02 juga meminta "aksi untuk kembali ke titik itu": separator bisa diketuk
 * (`onPress`) — layar me-scroll kembali ke pesan jangkar. Berguna setelah
 * pengguna menggulir ke bawah membaca pesan yang lebih baru lalu ingin
 * kembali ke titik terakhir yang belum dibaca.
 */
import { Pressable, View } from "react-native"

import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n"

export type ChatUnreadSeparatorProps = {
  /** Jumlah pesan belum dibaca — ditampilkan bila > 0. */
  count?: number
  /**
   * B02: aksi "kembali ke titik itu". Bila diisi, chip menjadi tombol yang
   * bisa diketuk (a11y role button + hint).
   */
  onPress?: () => void
}

export function ChatUnreadSeparator({ count = 0, onPress }: ChatUnreadSeparatorProps) {
  const chip = (
    <View className="items-center py-2">
      <View className="rounded-full bg-info-soft px-3 py-1">
        <Text variant="caption" tone="info" weight={600}>
          {count > 0 ? translate("{x} pesan belum dibaca", { x: count }) : translate("Belum dibaca")}
        </Text>
      </View>
    </View>
  )
  if (!onPress) return chip
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? translate("{x} pesan belum dibaca", { x: count }) : translate("Belum dibaca")
      }
      accessibilityHint={translate("Kembali ke pesan pertama yang belum dibaca")}
    >
      {chip}
    </Pressable>
  )
}
