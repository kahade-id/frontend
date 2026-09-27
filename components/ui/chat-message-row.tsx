/**
 * Kahade — satu baris thread chat: (opsional) pemisah hari + gelembung pesan.
 *
 * Kenapa dipisah dari layar ruang chat (G-11: layar itu hanya boleh menyusut):
 * baris ini membawa seluruh aturan visual thread — grouping, pemisah hari,
 * sorotan mode pilih — yang tidak perlu diketahui layar. Layar hanya
 * menyerahkan pesan, pesan sebelumnya/berikutnya, dan keadaan pilihan.
 *
 * Keputusan non-obvious:
 *   - Grup = pengirim sama DAN jarak < 5 menit DAN tidak menyeberang hari.
 *     Sebelumnya hanya "pengirim sama", jadi dua pesan berjarak enam jam
 *     menempel tanpa nama pengirim dan pemisah harinya hilang.
 *   - Jam tampil HANYA di bubble TERAKHIR tiap grup menit (revisi 2026-09-27,
 *     ala WhatsApp): pesan berurutan dari pengirim yang sama dalam MENIT yang
 *     sama (tanggal + jam + menit identik) menampilkan jam sekali — di bubble
 *     terakhir. Beda menit atau beda pengirim → jam tampil lagi. Dihitung di
 *     sini via `isLastInMinuteGroup(message, next)` — `next` adalah pesan
 *     tepat DI BAWAHNYA (daftar diurut menaik). Format/zona jam TIDAK berubah
 *     (`formatTime` seperti sebelumnya), hanya frekuensi tampilnya.
 *   - Ketukan bubble teks = NO-OP di luar mode pilih (revisi 2026-09-27);
 *     saat mode pilih aktif ketukan men-toggle pilihan. Aksi (menu/reaksi)
 *     HANYA lewat tekan lama — lihat `resolveBubblePressHandlers`.
 *   - Selama mode pilih, chip reaksi dimatikan (`onReact` tidak diteruskan):
 *     ketukan di tengah pilihan massal tidak boleh membuka menu emoji.
 *   - Sorotan pilihan dipasang lewat `className` bubble (bukan pembungkus)
 *     supaya mengikuti lebar bubble dan padding horizontalnya.
 */
import { View } from "react-native"

import type { ChatAttachmentDto } from "@/lib/api/types"
import type { ChatMessage } from "@/lib/api/chat"
import { formatTime } from "@/lib/format"
import {
  isLastInMinuteGroup,
  resolveBubblePressHandlers,
  type ChatBubbleAnchor,
} from "@/lib/chat-bubble"

import { ChatAttachmentItem } from "@/components/ui/chat-attachment-item"
import { ChatDaySeparator, dayKey, dayLabel } from "@/components/ui/chat-day-separator"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { isImageMedia } from "@/components/ui/media-viewer"
import { type SealTier } from "@/components/ui/verified-seal"

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
  /**
   * Pesan tepat di bawahnya — penentu "bubble terakhir grup menit"
   * (`isLastInMinuteGroup`): hanya bubble terakhir tiap grup menit yang
   * menampilkan jam.
   */
  next?: ChatMessage
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
   *
   * Revisi 2026-09-27 (UI polish): `sealTier` diteruskan ke bubble agar seal
   * verifikasi tampil di SAMPING nama pengirim — tidak pernah di-overlay di
   * foto profil.
   */
  counterpart?: { name?: string | null; avatarUrl?: string | null; sealTier?: SealTier | null }
  /**
   * Ketuk bubble — revisi 2026-09-27: di luar mode pilih ini NO-OP (tidak
   * membuka apa pun); saat mode pilih aktif, men-toggle pilihan pesan.
   */
  onPress: (message: ChatMessage) => void
  /**
   * Tekan lama bubble — SATU-SATUNYA jalan membuka aksi (masuk mode pilih +
   * popover reaksi mengambang di dekat bubble). `anchor` = posisi bubble di
   * window untuk penempatan popover.
   */
  onLongPress: (message: ChatMessage, anchor: ChatBubbleAnchor) => void
  /** Reaksi emoji dari badge di sudut bubble (bubar saat mode pilih). */
  onReact?: (message: ChatMessage, emoji: string) => void
  /** Lampiran dibuka (gambar → MediaViewer, berkas → eksternal). */
  onAttachmentPress: (attachment: ChatAttachmentDto) => void
  /** CN-015: kirim ulang pesan yang gagal. */
  onRetry?: (message: ChatMessage) => void
}

export function ChatMessageRow({
  message,
  previous,
  next,
  selecting,
  selected,
  readByCounterpart,
  counterpart,
  onPress,
  onLongPress,
  onReact,
  onAttachmentPress,
  onRetry,
}: ChatMessageRowProps) {
  const showDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt)
  const grouped =
    !!previous &&
    previous.fromUser === message.fromUser &&
    !showDay &&
    new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() <
      GROUP_WINDOW_MS
  /**
   * Jam hanya di bubble TERAKHIR tiap grup menit (pengirim sama + menit
   * sama). Bukan jam yang disamakan — melainkan menit (tanggal+jam+menit).
   */
  const showTime = isLastInMinuteGroup(message, next)
  /**
   * Aturan interaksi bubble: ketuk = no-op di luar mode pilih (toggle saat
   * mode pilih aktif); tekan lama = buka aksi + popover reaksi.
   */
  const pressHandlers = resolveBubblePressHandlers({
    selecting,
    isDeleted: message.isDeleted,
    onTap: () => onPress(message),
    onLongPress: (anchor) => onLongPress(message, anchor),
  })

  return (
    <View className="gap-1">
      {showDay ? <ChatDaySeparator label={dayLabel(message.createdAt)} /> : null}
      <ChatMessageBubble
        direction={message.fromUser ? "outgoing" : "incoming"}
        // CN-003: pesan terhapus — placeholder, bukan gelembung kosong.
        text={message.isDeleted ? "Pesan ini telah dihapus" : message.text}
        time={showTime ? formatTime(message.createdAt) : undefined}
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
        // Revisi 2026-09-27 (UI polish): seal verifikasi di samping nama
        // pengirim — avatar bubble TIDAK pernah menerima `verified`.
        senderSealTier={message.fromUser ? undefined : (counterpart?.sealTier ?? null)}
        // Status baca pesan saya: read-receipt dari lawan bicara
        // (GET /read-receipts) naik ke ikon centang ganda "read".
        // CN-015: pesan optimistis pakai sendStatus lokal (sending/failed).
        status={
          message.fromUser
            ? (message.sendStatus === "failed"
                ? "failed"
                : message.sendStatus === "sending"
                  ? "sending"
                  : readByCounterpart
                    ? "read"
                    : "sent")
            : undefined
        }
        onRetry={message.sendStatus === "failed" && onRetry ? () => onRetry(message) : undefined}
        reactions={message.reactions}
        onReact={selecting || !onReact ? undefined : (emoji) => onReact(message, emoji)}
        isPinned={message.isPinned}
        isEdited={message.isEdited}
        isDeleted={message.isDeleted}
        onPress={pressHandlers.onPress}
        onLongPressAt={pressHandlers.onLongPressAt}
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
