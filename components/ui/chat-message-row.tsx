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
import {
  asOrderCard,
  asProductCard,
  type ChatMessage,
  type ChatProductCardPayload,
} from "@/lib/api/chat"
import { formatTime } from "@/lib/format"
import { ephemeralCountdownLabel, isMessageExpired } from "@/lib/chat-ephemeral"
import {
  isLastInMinuteGroup,
  resolveBubblePressHandlers,
  type ChatBubbleAnchor,
} from "@/lib/chat-bubble"

import { ChatAttachmentItem } from "@/components/ui/chat-attachment-item"
import { ChatOrderCard, ChatProductCard } from "@/components/ui/chat-cards"
import { ChatDaySeparator, dayKey, dayLabel } from "@/components/ui/chat-day-separator"
import { ChatFormattedText } from "@/components/ui/chat-formatted-text"
import { ChatLocationCard } from "@/components/ui/chat-location-card"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { ChatViewOnce } from "@/components/ui/chat-view-once"
import { isImageMedia } from "@/components/ui/media-viewer"
import { VoiceNotePlayer } from "@/components/ui/voice-note-player"
import { isAudioMime } from "@/lib/voice-note"
import { type SealTier } from "@/components/ui/verified-seal"

/**
 * Jendela pengelompokan bubble (ms): pesan berurutan dari pengirim yang sama
 * dalam 5 menit dianggap satu kelompok (satu nama pengirim + spasi rapat),
 * seperti WhatsApp/Telegram. Di luar jendela itu bubble berdiri sendiri.
 */
const GROUP_WINDOW_MS = 5 * 60 * 1000

/**
 * Label cadangan cuplikan kutipan balasan bila pesan yang dibalas tidak
 * punya teks (mis. hanya gambar/berkas). Dipakai <ChatMessageRow> untuk
 * prop `quote` bubble.
 */
function quoteFallbackLabel(messageType?: string): string {
  switch ((messageType ?? "").toUpperCase()) {
    case "IMAGE":
      return "Gambar"
    case "VIDEO":
      return "Video"
    case "VOICE":
      return "Pesan suara"
    case "FILE":
      return "Berkas"
    // Batch 43: tipe pesan baru.
    case "LOCATION":
      return "Lokasi"
    case "PRODUCT_CARD":
      return "Kartu produk"
    case "ORDER_CARD":
      return "Kartu order"
    default:
      return "Pesan"
  }
}

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
  /**
   * DM 1:1 (2026-09-28, permintaan produk): `false` menyembunyikan foto +
   * nama lawan bicara di gelembung masuk — ala WhatsApp, hanya bubble.
   * Di ruang transaksi/grup (admin bisa masuk) identitas pengirim tetap
   * tampil. Default `true` (perilaku lama).
   */
  showSenderIdentity?: boolean
  /**
   * Swipe kanan pada bubble → balas pesan ini (jalan pintas). Tekan lama
   * "Balas" di mode pilih TETAP ADA — ini hanya jalur tambahan.
   * Dinonaktifkan saat mode pilih aktif atau pesan terhapus.
   */
  onSwipeReply?: (message: ChatMessage) => void
  /**
   * Pencarian inline dalam thread (2026-09-28): diteruskan ke bubble untuk
   * meng-highlight kemunculan kata kunci. `undefined` = tidak mencari.
   */
  searchHighlight?: { query: string; focused: boolean }
  /**
   * Batch 43 (2026-09-28): terjemahan yang diterapkan user untuk pesan ini
   * — dirender sebagai blok di bawah teks asli.
   */
  translation?: { text: string; sourceLang: string | null; targetLang: string } | null
  /**
   * Batch 43: tombol "Beli" pada kartu produk → layar membuka sheet buat
   * transaksi escrow untuk etalase tersebut.
   */
  onBuyProductCard?: (card: ChatProductCardPayload) => void
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
  showSenderIdentity = true,
  onSwipeReply,
  searchHighlight,
  translation,
  onBuyProductCard,
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
  /**
   * Voice note (2026-09-28): pesan VOICE dengan lampiran audio dirender
   * sebagai <VoiceNotePlayer> (putar/jeda, 1x/2x, waveform dekoratif) —
   * bukan baris ikon generik yang tidak bisa diputar.
   */
  const voiceAttachment = message.isDeleted
    ? undefined
    : message.attachments?.find((a) => isAudioMime(a.mimeType))
  const isVoiceMessage = message.messageType === "VOICE" && !!voiceAttachment?.fileUrl

  // ── Batch 43 (2026-09-28): konten khusus ──────────────────────────
  const isSystemMessage = message.messageType === "SYSTEM"
  const outgoing = message.fromUser && !isSystemMessage
  const locationPayload =
    !message.isDeleted && message.messageType === "LOCATION" && message.location
      ? message.location
      : null
  const productCard = !message.isDeleted ? asProductCard(message.card) : null
  const orderCard = !message.isDeleted ? asOrderCard(message.card) : null
  const isViewOnceMessage = !message.isDeleted && message.viewOnce === true
  /** Chip hitung mundur pesan sementara — null bila bukan ephemeral/kedaluwarsa. */
  const ephemeralChip =
    !message.isDeleted && !isMessageExpired(message)
      ? ephemeralCountdownLabel(message.expiresAt)
      : null

  const mediaBlock = isVoiceMessage ? (
    <VoiceNotePlayer
      uri={voiceAttachment!.fileUrl}
      messageId={message.id}
      direction={message.fromUser ? "outgoing" : "incoming"}
    />
  ) : message.attachments?.length ? (
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
  ) : undefined

  const hasSpecialContent =
    !!locationPayload || !!productCard || !!orderCard || !!mediaBlock

  const specialBlock = (
    <>
      {locationPayload ? (
        <ChatLocationCard location={locationPayload} outgoing={outgoing} />
      ) : null}
      {productCard ? (
        <ChatProductCard card={productCard} outgoing={outgoing} onBuy={onBuyProductCard} />
      ) : null}
      {orderCard ? <ChatOrderCard card={orderCard} outgoing={outgoing} /> : null}
      {mediaBlock}
    </>
  )

  // Sekali-lihat: teks + media dibungkus (blur sampai diketuk). Kartu
  // lokasi/produk/order tidak dikombinasikan dengan viewOnce oleh backend.
  const bubbleChildren = isViewOnceMessage ? (
    <ChatViewOnce message={message} outgoing={outgoing}>
      {message.text ? (
        <ChatFormattedText text={message.text} outgoing={outgoing} selectable={false} />
      ) : null}
      {hasSpecialContent ? specialBlock : null}
    </ChatViewOnce>
  ) : hasSpecialContent ? (
    specialBlock
  ) : undefined

  // Kartu sudah membawa label/judulnya sendiri — teks pesan disembunyikan
  // agar tidak duplikat.
  const bubbleText = message.isDeleted
    ? "Pesan ini telah dihapus"
    : isViewOnceMessage || locationPayload || productCard || orderCard
      ? undefined
      : message.text

  return (
    <View className="gap-1">
      {showDay ? <ChatDaySeparator label={dayLabel(message.createdAt)} /> : null}
      <ChatMessageBubble
        direction={isSystemMessage ? "system" : message.fromUser ? "outgoing" : "incoming"}
        // CN-003: pesan terhapus — placeholder, bukan gelembung kosong.
        text={bubbleText}
        // Batch 43: blok terjemahan + chip ephemeral + penanda bintang.
        translation={translation}
        ephemeralChip={ephemeralChip}
        starred={message.isStarred === true}
        // Kutipan balasan: backend mengirim `replyTo` (id, content,
        // messageType, isDeleted, senderName) bila pesan ini membalas pesan lain.
        quote={
          message.replyTo
            ? {
                senderName: message.replyTo.senderName,
                preview: message.replyTo.isDeleted
                  ? "Pesan ini telah dihapus"
                  : (message.replyTo.content?.trim() || quoteFallbackLabel(message.replyTo.messageType)),
              }
            : null
        }
        time={showTime ? formatTime(message.createdAt) : undefined}
        grouped={grouped}
        /*
         * Penanda arah (2026-09-26): gelembung MASUK membawa foto & nama
         * lawan bicara, pesan KELUAR tetap murni kanan + bg-primary. Nama
         * hanya muncul di pesan pertama kelompok (aturan ada di dalam
         * <ChatMessageBubble>), jadi percakapan panjang tidak berubah jadi
         * daftar nama.
         *
         * Revisi 2026-09-28 (produk): di DM 1:1 (`showSenderIdentity=false`)
         * foto + nama disembunyikan total — ala WhatsApp, hanya bubble.
         */
        senderName={!showSenderIdentity || message.fromUser ? undefined : (counterpart?.name ?? undefined)}
        avatarName={!showSenderIdentity || message.fromUser ? undefined : (counterpart?.name ?? undefined)}
        avatarUrl={!showSenderIdentity || message.fromUser ? undefined : counterpart?.avatarUrl}
        // Revisi 2026-09-27 (UI polish): seal verifikasi di samping nama
        // pengirim — avatar bubble TIDAK pernah menerima `verified`.
        senderSealTier={!showSenderIdentity || message.fromUser ? undefined : (counterpart?.sealTier ?? null)}
        // DM 1:1: nama pengirim di blok kutipan balasan juga disembunyikan
        // (ala WhatsApp — kutipan hanya menampilkan cuplikan pesan).
        hideQuoteSenderName={!showSenderIdentity}
        // Swipe kanan = jalan pintas balas (2026-09-28). Tekan lama "Balas"
        // tetap ada; gesture dimatikan saat mode pilih / pesan terhapus /
        // pesan sistem (batch 43).
        onSwipeReply={
          !selecting && !message.isDeleted && !isSystemMessage && onSwipeReply
            ? () => onSwipeReply(message)
            : undefined
        }
        // Pencarian inline: sorot kata kunci di teks pesan ini.
        searchHighlight={searchHighlight}
        // Status baca pesan saya: read-receipt dari lawan bicara
        // (GET /read-receipts) naik ke ikon centang ganda "read".
        // CN-015: pesan optimistis pakai sendStatus lokal (sending/failed).
        // Batch 43: pesan sistem tidak punya status kirim.
        status={
          !isSystemMessage && message.fromUser
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
        {bubbleChildren}
      </ChatMessageBubble>
    </View>
  )
}
