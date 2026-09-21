/**
 * Kahade — satu baris thread chat: (opsional) pemisah hari + gelembung pesan.
 *
 * Kenapa dipisah dari layar ruang chat (G-11: layar itu hanya boleh menyusut):
 * baris ini membawa seluruh aturan visual thread — grouping, pemisah hari,
 * sorotan mode pilih — yang tidak perlu diketahui layar. Layar hanya
 * menyerahkan pesan, pesan sebelumnya, dan keadaan pilihan.
 *
 * Keputusan non-obvious:
 *   - Grup = pengirim sama DAN jarak < 5 menit DAN tidak menyeberang hari.
 *     Sebelumnya hanya "pengirim sama", jadi dua pesan berjarak enam jam
 *     menempel tanpa nama pengirim dan pemisah harinya hilang.
 *   - Waktu bubble cukup JAM: tanggal sudah disebut pemisah hari.
 *   - Selama mode pilih, chip reaksi dimatikan (`onReact` tidak diteruskan):
 *     ketukan di tengah pilihan massal tidak boleh membuka menu emoji.
 *   - Sorotan pilihan dipasang lewat `className` bubble (bukan pembungkus)
 *     supaya mengikuti lebar bubble dan padding horizontalnya.
 */
import { View } from "react-native"

import type { ChatAttachmentDto } from "@/lib/api/types"
import type { ChatMessage } from "@/lib/api/chat"
import { formatTime } from "@/lib/format"

import { ChatAttachmentItem } from "@/components/ui/chat-attachment-item"
import { ChatDaySeparator, dayKey, dayLabel } from "@/components/ui/chat-day-separator"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { isImageMedia } from "@/components/ui/media-viewer"

/**
 * Jendela pengelompokan bubble (ms): pesan berurutan dari pengirim yang sama
 * dalam 5 menit dianggap satu kelompok (satu nama pengirim + spasi rapat),
 * seperti WhatsApp/Telegram. Di luar jendela itu bubble berdiri sendiri.
 */
const GROUP_WINDOW_MS = 5 * 60 * 1000

export type ChatMessageRowProps = {
  message: ChatMessage
  /** Pesan tepat di atasnya — penentu pemisah hari + grouping. */
  previous?: ChatMessage
  /** Mode pilih sedang aktif (mematikan chip reaksi). */
  selecting: boolean
  /** Pesan ini termasuk yang dipilih (diberi sorotan). */
  selected: boolean
  /** Read receipt: pesan saya sudah dibaca lawan bicara. */
  readByCounterpart: boolean
  /** Ketuk / tekan lama: layar memutuskan memilih atau men-toggle. */
  onPress: (message: ChatMessage) => void
  /** Reaksi emoji dari chip di bawah bubble (bubar saat mode pilih). */
  onReact?: (message: ChatMessage, emoji: string) => void
  /** Lampiran dibuka (gambar → MediaViewer, berkas → eksternal). */
  onAttachmentPress: (attachment: ChatAttachmentDto) => void
}

export function ChatMessageRow({
  message,
  previous,
  selecting,
  selected,
  readByCounterpart,
  onPress,
  onReact,
  onAttachmentPress,
}: ChatMessageRowProps) {
  const showDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt)
  const grouped =
    !!previous &&
    previous.fromUser === message.fromUser &&
    !showDay &&
    new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() <
      GROUP_WINDOW_MS

  return (
    <View className="gap-1">
      {showDay ? <ChatDaySeparator label={dayLabel(message.createdAt)} /> : null}
      <ChatMessageBubble
        direction={message.fromUser ? "outgoing" : "incoming"}
        text={message.text}
        time={formatTime(message.createdAt)}
        grouped={grouped}
        // Status baca pesan saya: read-receipt dari lawan bicara
        // (GET /read-receipts) naik ke ikon centang ganda "read".
        status={message.fromUser ? (readByCounterpart ? "read" : "sent") : undefined}
        reactions={message.reactions}
        onReact={selecting || !onReact ? undefined : (emoji) => onReact(message, emoji)}
        isPinned={message.isPinned}
        isEdited={message.isEdited}
        onPress={() => onPress(message)}
        onLongPress={() => onPress(message)}
        className={selected ? "rounded-md bg-surface" : undefined}
      >
        {message.attachments?.length ? (
          <View className="gap-2">
            {message.attachments.map((a, j) => (
              <ChatAttachmentItem
                key={`${message.id}-${j}`}
                attachment={a}
                layout={isImageMedia({ url: a.fileUrl, mimeType: a.mimeType }) ? "tile" : "row"}
                onPress={() => onAttachmentPress(a)}
              />
            ))}
          </View>
        ) : undefined}
      </ChatMessageBubble>
    </View>
  )
}
