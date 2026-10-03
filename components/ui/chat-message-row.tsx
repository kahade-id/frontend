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
 *   - Jam tampil di setiap bubble agar pengguna bisa mengetahui waktu tiap
 *     pesan tanpa menebak dari bubble lain dalam grup. Format dan zona waktu
 *     tetap mengikuti `formatTime`.
 *   - Ketukan bubble teks = NO-OP di luar mode pilih (revisi 2026-09-27);
 *     saat mode pilih aktif ketukan men-toggle pilihan. Aksi (menu/reaksi)
 *     HANYA lewat tekan lama — lihat `resolveBubblePressHandlers`.
 *   - Selama mode pilih, chip reaksi dimatikan (`onReact` tidak diteruskan):
 *     ketukan di tengah pilihan massal tidak boleh membuka menu emoji.
 *   - Sorotan pilihan dipasang lewat `className` bubble (bukan pembungkus)
 *     supaya mengikuti lebar bubble dan padding horizontalnya.
 */
import { memo, useCallback, useMemo } from "react"
import { View } from "react-native"

import { useTheme } from "@/components/theme-provider"
import { semantic } from "@/lib/tokens"

import type { ChatAttachmentDto } from "@/lib/api/types"
import {
  asOrderCard,
  asProductCard,
  nonTextMessageLabel,
  type ChatMessage,
  type ChatProductCardPayload,
} from "@/lib/api/chat"
import { formatTime } from "@/lib/format"
import { ephemeralCountdownLabel, isMessageExpired } from "@/lib/chat-ephemeral"
import { resolveBubblePressHandlers, type ChatBubbleAnchor } from "@/lib/chat-bubble"

import { ChatAttachmentItem } from "@/components/ui/chat-attachment-item"
import { ChatOrderCard, ChatProductCard } from "@/components/ui/chat-cards"
import { ChatDaySeparator, dayKey, dayLabel } from "@/components/ui/chat-day-separator"
import { ChatFormattedText } from "@/components/ui/chat-formatted-text"
import { ChatLocationCard } from "@/components/ui/chat-location-card"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { ChatPollCard } from "@/components/ui/chat-poll-card"
import { ChatViewOnce } from "@/components/ui/chat-view-once"
import { isImageMedia } from "@/components/ui/media-viewer"
import { isVideoMime } from "@/lib/mime"
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
 * CHT-011: label cadangan cuplikan kutipan balasan bila pesan yang dibalas
 * tidak punya teks. Memakai `nonTextMessageLabel` (lib/api/chat) agar
 * konsisten dengan pinned bar & daftar room — sebelumnya memakai
 * "Gambar"/"Video"/… sementara permukaan lain "(lampiran)".
 */
const quoteFallbackLabel = nonTextMessageLabel

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
  /**
   * FIX 2026-10-03: refresh signed URL lampiran yang kedaluwarsa.
   * Dipakai thumbnail di bubble saat `Picture` onError — thumbnail memakai
   * signed URL yang sama (TTL 5 mnt) dan ikut mati.
   */
  onRefreshAttachmentUrl?: (attachment: ChatAttachmentDto) => Promise<ChatAttachmentDto>
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
  /**
   * 2026-10-02: voting polling inline di thread (pesan POLL).
   */
  onVotePoll?: (pollId: string, optionIndexes: number[]) => void
  onClosePoll?: (pollId: string) => void
  votingPollId?: string | null
  closingPollId?: string | null
  /**
   * B10: pemisah hari dirender sebagai baris sticky FlatList (bukan di dalam
   * row) — `true` menonaktifkan pemisah internal row ini.
   */
  hideDaySeparator?: boolean
  /**
   * B09: sorot pesan asal balasan selama beberapa detik setelah pengguna
   * mengetuk kutipan balasan. Warna dari `semantic.warning[mode].bgSoft`
   * (inline style — bukan className bg-*).
   */
  highlighted?: boolean
  /**
   * B09: ketuk kutipan balasan → lompat ke pesan asal. Dipanggil dengan
   * `replyToId` pesan ini; `undefined` = kutipan tidak bisa diketuk.
   */
  onQuotePress?: (replyToId: string) => void
}

/** PERF-FIX (TIM1-P1): lampiran di-memo per item — onPress stabil via
 * useCallback, tidak ada closure inline per render baris. */
const RowAttachmentItem = memo(function RowAttachmentItem({
  attachment,
  onAttachmentPress,
  onRefreshAttachmentUrl,
}: {
  attachment: ChatAttachmentDto
  onAttachmentPress: (attachment: ChatAttachmentDto) => void
  onRefreshAttachmentUrl?: (attachment: ChatAttachmentDto) => Promise<ChatAttachmentDto>
}) {
  const handlePress = useCallback(() => onAttachmentPress(attachment), [onAttachmentPress, attachment])
  // FIX 2026-10-03: video juga tampil sebagai tile (bukan row) — konsisten
  // dengan gambar; ikon play di-overlay oleh ChatAttachmentItem.
  const layout = useMemo(
    () =>
      isImageMedia({ url: attachment.fileUrl, mimeType: attachment.mimeType }) || isVideoMime(attachment.mimeType)
        ? ("tile" as const)
        : ("row" as const),
    [attachment.fileUrl, attachment.mimeType],
  )
  return (
    <ChatAttachmentItem
      attachment={attachment}
      layout={layout}
      onPress={handlePress}
      onRefreshUrl={onRefreshAttachmentUrl}
    />
  )
})

export function ChatMessageRowBase({
  message,
  previous,
  selecting,
  selected,
  readByCounterpart,
  counterpart,
  onPress,
  onLongPress,
  onReact,
  onAttachmentPress,
  onRefreshAttachmentUrl,
  onRetry,
  showSenderIdentity = true,
  onSwipeReply,
  searchHighlight,
  translation,
  onBuyProductCard,
  onVotePoll,
  onClosePoll,
  votingPollId,
  closingPollId,
  hideDaySeparator = false,
  highlighted = false,
  onQuotePress,
}: ChatMessageRowProps) {
  // B09: warna sorot mode-aware — inline style (aturan: jangan className
  // bg-* untuk background yang digambar manual).
  const { mode } = useTheme()
  const showDay = !hideDaySeparator && (!previous || dayKey(previous.createdAt) !== dayKey(message.createdAt))
  const grouped =
    !!previous &&
    previous.fromUser === message.fromUser &&
    !showDay &&
    new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() <
      GROUP_WINDOW_MS
  /**
   * LR-001: aturan interaksi bubble distabilkan — objek `pressHandlers` baru
   * tiap render sebelumnya membuat `memo` di <ChatMessageBubble> tidak
   * pernah hit. Deps memakai referensi `message` (stabil via merge thread).
   */
  const pressHandlers = useMemo(
    () =>
      resolveBubblePressHandlers({
        selecting,
        isDeleted: message.isDeleted,
        onTap: () => onPress(message),
        onLongPress: (anchor) => onLongPress(message, anchor),
      }),
    [selecting, message, onPress, onLongPress],
  )
  /**
   * LR-001: prop turunan untuk bubble distabilkan (sebelumnya object literal
   * / arrow inline baru tiap render row → memo bubble jebol).
   */
  const bubbleQuote = useMemo(
    () =>
      message.replyTo
        ? {
            senderName: message.replyTo.senderName,
            preview: message.replyTo.isDeleted
              ? "Pesan ini telah dihapus"
              : message.replyTo.content?.trim() ||
                quoteFallbackLabel(message.replyTo.messageType),
          }
        : null,
    [message.replyTo],
  )
  const handleBubbleQuotePress = useCallback(() => {
    if (onQuotePress && message.replyToId) onQuotePress(message.replyToId as string)
  }, [onQuotePress, message.replyToId])
  const handleBubbleSwipeReply = useCallback(() => {
    onSwipeReply?.(message)
  }, [onSwipeReply, message])
  const handleBubbleReact = useCallback(
    (emoji: string) => {
      onReact?.(message, emoji)
    },
    [onReact, message],
  )
  const handleBubbleRetry = useCallback(() => {
    onRetry?.(message)
  }, [onRetry, message])
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
  // 2026-10-02: pesan POLL — render kartu polling inline di thread.
  const pollData =
    !message.isDeleted && message.messageType === "POLL" && message.poll
      ? message.poll
      : null
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
      // UPFV-03: refresh signed URL (TTL 5 mnt) bila pemutaran gagal —
      // pola sama seperti `Picture` onError pada thumbnail lampiran.
      onRefreshUrl={
        onRefreshAttachmentUrl
          ? () => onRefreshAttachmentUrl(voiceAttachment!).then((a) => a.fileUrl || null)
          : undefined
      }
    />
  ) : message.attachments?.length ? (
    <View className="gap-2">
      {message.attachments.map((a, j) => (
        <RowAttachmentItem
          key={`${message.id}-${j}`}
          attachment={a}
          onAttachmentPress={onAttachmentPress}
          onRefreshAttachmentUrl={onRefreshAttachmentUrl}
        />
      ))}
    </View>
  ) : undefined

  const hasSpecialContent =
    !!locationPayload || !!productCard || !!orderCard || !!mediaBlock || !!pollData

  const specialBlock = (
    <>
      {locationPayload ? (
        <ChatLocationCard location={locationPayload} outgoing={outgoing} />
      ) : null}
      {productCard ? (
        <ChatProductCard card={productCard} outgoing={outgoing} onBuy={onBuyProductCard} />
      ) : null}
      {orderCard ? <ChatOrderCard card={orderCard} outgoing={outgoing} /> : null}
      {pollData ? (
        <ChatPollCard
          poll={pollData}
          voting={votingPollId === pollData.id}
          onVote={(id, idx) => onVotePoll?.(id, idx)}
          onClose={onClosePoll ? (id) => onClosePoll(id) : undefined}
          // 2026-10-02: pembuat = pengirim pesan (fromUser).
          isCreator={message.fromUser}
          closing={closingPollId === pollData.id}
        />
      ) : null}
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
    : isViewOnceMessage || locationPayload || productCard || orderCard || pollData
      ? undefined
      : message.text

  return (
    <View
      className="gap-1"
      // B09: sorot pesan asal balasan — inline style mode-aware (aturan:
      // jangan className bg-* untuk background yang digambar manual).
      style={
        highlighted
          ? { backgroundColor: semantic.warning[mode].bgSoft, borderRadius: 12 }
          : undefined
      }
    >
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
        quote={bubbleQuote}
        time={formatTime(message.createdAt)}
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
        // B09: ketuk kutipan → lompat ke pesan asal + sorot. Hanya bila
        // replyToId ada (pesan asal bisa dicari di thread).
        onQuotePress={
          onQuotePress && message.replyToId ? handleBubbleQuotePress : undefined
        }
        // Swipe kanan = jalan pintas balas (2026-09-28). Tekan lama "Balas"
        // tetap ada; gesture dimatikan saat mode pilih / pesan terhapus /
        // pesan sistem (batch 43).
        onSwipeReply={
          !selecting && !message.isDeleted && !isSystemMessage && onSwipeReply
            ? handleBubbleSwipeReply
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
        onRetry={message.sendStatus === "failed" && onRetry ? handleBubbleRetry : undefined}
        reactions={message.reactions}
        onReact={selecting || !onReact ? undefined : handleBubbleReact}
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

/**
 * LR-001 (2026-09-29): pembanding kustom untuk `memo` baris chat.
 *
 * `message`/`previous` dibandingkan by REFERENSI — merge thread
 * (`mergeMessageLists`) mempertahankan identitas objek pesan yang tidak
 * berubah, jadi pesan lama tidak ikut re-render saat pesan baru masuk atau
 * saat layar me-render ulang (ketikan composer, dsb).
 *
 * Prop objek (`counterpart`, `translation`, `searchHighlight`) dibandingkan
 * per FIELD (bukan referensi) sebagai pertahanan lapis kedua bila pemanggil
 * lupa menstabilkan — isi sama = tidak re-render.
 */
function isSameCounterpart(
  a: ChatMessageRowProps["counterpart"],
  b: ChatMessageRowProps["counterpart"],
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    (a.name ?? null) === (b.name ?? null) &&
    (a.avatarUrl ?? null) === (b.avatarUrl ?? null) &&
    (a.sealTier ?? null) === (b.sealTier ?? null)
  )
}

function isSameTranslation(
  a: ChatMessageRowProps["translation"],
  b: ChatMessageRowProps["translation"],
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.text === b.text &&
    (a.sourceLang ?? null) === (b.sourceLang ?? null) &&
    a.targetLang === b.targetLang
  )
}

function isSameSearchHighlight(
  a: ChatMessageRowProps["searchHighlight"],
  b: ChatMessageRowProps["searchHighlight"],
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.query === b.query && a.focused === b.focused
}

function areRowPropsEqual(
  prev: ChatMessageRowProps,
  next: ChatMessageRowProps,
): boolean {
  return (
    prev.message === next.message &&
    prev.previous === next.previous &&
    prev.selecting === next.selecting &&
    prev.selected === next.selected &&
    prev.readByCounterpart === next.readByCounterpart &&
    prev.showSenderIdentity === next.showSenderIdentity &&
    prev.hideDaySeparator === next.hideDaySeparator &&
    prev.highlighted === next.highlighted &&
    prev.onPress === next.onPress &&
    prev.onLongPress === next.onLongPress &&
    prev.onReact === next.onReact &&
    prev.onAttachmentPress === next.onAttachmentPress &&
    prev.onRetry === next.onRetry &&
    prev.onSwipeReply === next.onSwipeReply &&
    prev.onBuyProductCard === next.onBuyProductCard &&
    prev.onQuotePress === next.onQuotePress &&
    isSameCounterpart(prev.counterpart, next.counterpart) &&
    isSameTranslation(prev.translation, next.translation) &&
    isSameSearchHighlight(prev.searchHighlight, next.searchHighlight)
  )
}

/**
 * LR-001: baris chat di-`memo` — mengetik di composer (atau perubahan state
 * layar lain) tidak lagi me-render ulang semua bubble. Syaratnya dipenuhi
 * di layar: `renderItem` via `useCallback` + semua handler/prop objek stabil.
 */
export const ChatMessageRow = memo(ChatMessageRowBase, areRowPropsEqual)
