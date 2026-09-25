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
  /**
   * Lawan bicara ruang ini — foto & nama untuk gelembung MASUK (revisi
   * 2026-09-26). Opsional: ruang tanpa data pihak (mis. obrolan sistem)
   * tetap tampil seperti sebelumnya, tanpa kolom avatar.
   */
  counterpart?: { name?: string | null; avatarUrl?: string | null }
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
  counterpart,
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
        /*
         * Penanda arah (2026-09-26): geoembung MASUK membawa foto & nama
         * lawan bicara, pesan KELUAR tetap murni kanan + bg-primary. Nama
         * hanya muncul di pesan pertama kelompok (aturan ada di dalam
         * <ChatMessageBubble>), jadi percakapan panjang tidak berubah jadi
         * daftar nama.
         */
        senderName={message.fromUser ? undefined : (counterpart?.name ?? undefined)}
        avatarName={message.fromUser ? undefined : (counterpart?.name ?? undefined)}
        avatarUrl={message.fromUser ? undefined : counterpart?.avatarUrl}
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
