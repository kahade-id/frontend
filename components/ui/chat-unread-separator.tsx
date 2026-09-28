/**
 * Kahade — pemisah "Belum dibaca" di thread chat (B02).
 *
 * Dipasang tepat di atas pesan pertama yang belum dibaca (jangkar dihitung
 * `firstUnreadMessageId` dari `unreadCount` daftar room SEBELUM room ditandai
 * terbaca). Gaya mengikuti <ChatDaySeparator>: chip tenang di tengah thread.
 */
import { View } from "react-native"

import { Text } from "@/components/ui/text"

export type ChatUnreadSeparatorProps = {
  /** Jumlah pesan belum dibaca — ditampilkan bila > 0. */
  count?: number
}

export function ChatUnreadSeparator({ count = 0 }: ChatUnreadSeparatorProps) {
  return (
    <View className="items-center py-2" accessibilityRole="header">
      <View className="rounded-full bg-info-soft px-3 py-1">
        <Text variant="caption" tone="info" weight={600}>
          {count > 0 ? `Belum dibaca · ${count} pesan` : "Belum dibaca"}
        </Text>
      </View>
    </View>
  )
}
