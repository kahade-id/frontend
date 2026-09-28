/**
 * Screen — Ruang Chat Detail.
 * GET  /v1/chat/rooms/{roomId}/messages   (kursor: cursor/limit/excludeIds)
 * POST /v1/chat/rooms/{roomId}/messages   (TEXT/IMAGE/FILE + attachments)
 * POST /v1/chat/rooms/{roomId}/upload     (multipart → ChatAttachmentDto)
 * POST /v1/chat/rooms/{roomId}/read
 * DELETE /v1/chat/rooms/{roomId}/messages/{messageId}
 *
 * Keputusan non-obvious:
 *   - Lampiran: tombol + di ChatComposer → <ChatAttachmentSheet> (Gambar /
 *     Video / File / Voice Note) → unggah ke endpoint upload ruang (bukan
 *     presigned umum, supaya file tercatat di ruang dan muncul di
 *     GET /attachments). Sambil diunggah status "uploading";
 *     gagal → "error" + coba lagi. Saat kirim, `messageType` = IMAGE bila
 *     semua lampiran gambar, VOICE bila semua audio (voice note), FILE bila
 *     ada non-gambar/non-audio, TEXT bila tanpa lampiran.
 *   - Pesan lama dimuat ke ATAS lewat <LoadMore> (dan otomatis saat scroll
 *     mencapai puncak list) dengan kursor (`nextCursor` dari server, fallback
 *     id pesan tertua) + `excludeIds` TERBATAS (EXCLUDE_IDS_MAX id terbaru;
 *     C-02) — dedupe final tetap dihitung di dalam updater terhadap state
 *     terkini (C-03). Akhir = halaman kosong / lebih kecil dari
 *     CHAT_PAGE_SIZE.
 *   - Thread dirender <FlatList> (virtualisasi, F-06) — bubble tidak lagi
 *     ter-mount penuh untuk thread panjang.
 *   - Poll pesan adaptif (F-07): 8 detik saat aktif, naik ke 20 detik
 *     setelah 10 poll kosong beruntun; kembali cepat saat ada pesan baru,
 *     mengetik, atau mengirim. Respons poll di-guard terhadap pergantian
 *     ruang (C-05) dan sekaligus menyegarkan reaksi/pin/edit pesan yang
 *     sudah ada (C-07).
 *   - Hapus pesan: long-press gelembung milik sendiri → ActionSheet
 *     (Salin / Hapus). Hapus memakai Dialog destruktif.
 *   - Lampiran gambar dibuka di <MediaViewer>; berkas lain → buka eksternal.
 *   - Nama lawan bicara diambil dari daftar ruang (GET /rooms tidak punya
 *     endpoint detail); fallback param navigasi `title` (C-06), lalu
 *     "Percakapan".
 *   - Cari pesan dalam ruang (J-07): sheet + GET /rooms/{id}/search; hasil
 *     yang termuat di thread dilompati via scrollToIndex.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AppState,
  FlatList,
  Keyboard,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { useLocalSearchParams, router } from "expo-router"

import {
  ArrowBendUpLeft,
  Chats,
  Copy,
  MagnifyingGlass,
  PaperPlaneRight,
  PencilSimple,
  PushPin,
  Trash,
  // Batch 43 FE-CHAT: ikon aksi baru (terjemah, bintang, lokasi,
  // kartu produk). Ekspor/buat-transaksi dipakai menu ruang.
  ChartBar,
  MapPin,
  Star,
  Storefront,
  Translate,
} from "phosphor-react-native"

import { api, isApiError, userMessage } from "@/lib/api"
import { validateChatAttachment } from "@/lib/chat-attachment-limits"
import { getOrder, type Order } from "@/lib/api/orders"
import { refreshUnreadCount } from "@/lib/unread-count"
import { refreshChatUnreadCount } from "@/lib/chat-unread-count"
import { usePolling } from "@/lib/use-polling"
import {
  CHAT_PAGE_SIZE,
  QUICK_REACTIONS,
  addReaction,
  getPinnedMessages,
  getReadReceipts,
  getRoomPresence,
  isOneToOneChatRoom,
  normalizeChatMessage,
  pinChatMessage,
  removeReaction,
  sendChatTyping,
  unpinChatMessage,
  type ChatMessage,
  type ChatPresence,
  type ChatReaction,
  type ChatRoom,
} from "@/lib/api/chat"
import {
  applyDeletedTombstone,
  applyReactionSummary,
} from "@/lib/realtime/chat-events"
import { findOptimisticMatch, mergeChatMessages } from "@/lib/chat-dedupe"
import { useChatRoomRealtime } from "@/lib/realtime/use-chat-room"
import type { ChatAttachmentDto, SendMessageDto } from "@/lib/api/types"
import { useCopy } from "@/lib/clipboard"
import { formatChatListTime, formatTime, truncateMiddle } from "@/lib/format"
import { ChatSearchSnippet } from "@/components/ui/chat-search-snippet"
import { haptic } from "@/lib/haptics"
import { logWarn } from "@/lib/telemetry"
import { pickImage, pickedImageToFormData, type PickedImage } from "@/lib/image-picker"
import * as DocumentPicker from "expo-document-picker"
import { ChatAttachmentSheet } from "@/components/ui/chat-attachment-sheet"
import { VoiceNoteRecorder, type VoiceNoteFile } from "@/components/ui/voice-note-recorder"
import { isAudioMime, validateVoiceNoteFile, voiceNoteValidationMessage } from "@/lib/voice-note"
import { translate } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ChatEditSheet } from "@/components/ui/chat-edit-sheet"
import { ChatForwardSheet } from "@/components/ui/chat-forward-sheet"
import { IconButton } from "@/components/ui/icon-button"
import { ChatMessageRow } from "@/components/ui/chat-message-row"
import { ChatPinnedBar } from "@/components/ui/chat-pinned-bar"
import { ChatReactionPopover } from "@/components/ui/chat-reaction-popover"
import { ChatRoomHeader } from "@/components/ui/chat-room-header"
import { ChatRoomMenu } from "@/components/ui/chat-room-menu"
import { ChatSearchSheet } from "@/components/ui/chat-search-sheet"
import { ChatInlineSearchBar } from "@/components/ui/chat-inline-search"
import { findMessageMatches } from "@/lib/chat-search"
import { ChatDaySeparator, dayKey, dayLabel } from "@/components/ui/chat-day-separator"
import { ChatUnreadSeparator } from "@/components/ui/chat-unread-separator"
import { presenceLabel } from "@/lib/chat-presence-label"
import { firstUnreadMessageId } from "@/lib/chat-unread-anchor"
import {
  loadChatFailedMessages,
  peekChatFailedMessages,
  removeChatFailedMessage,
  saveChatFailedMessage,
  type FailedChatMessage,
} from "@/lib/chat-failed-queue"
import { hideMessageLocally, loadHiddenMessageIds } from "@/lib/chat-hidden-messages"
import { type ChatComposerPayload, type ComposerAttachment, type ComposerReplyTarget } from "@/components/ui/chat-composer"
import { clearChatDraft, loadChatDraft, saveChatDraft } from "@/lib/chat-drafts"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { LoadMore, type LoadMoreStatus } from "@/components/ui/load-more"
import { MediaViewer, isImageMedia, type MediaViewerItem } from "@/components/ui/media-viewer"
import { ImageViewer, type ImageViewerItem } from "@/components/ui/image-viewer"
import { ListLoading } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { ChatRoomFooter } from "@/components/ui/chat-room-footer"
import { SelectionBar, type SelectionAction } from "@/components/ui/selection-bar"
import { ChatTranslateSheet } from "@/components/ui/chat-translate-sheet"
import { ChatStarredSheet } from "@/components/ui/chat-starred-sheet"
import { ChatPollsSheet } from "@/components/ui/chat-polls-sheet"
import { ChatLocationSheet } from "@/components/ui/chat-location-sheet"
import { ChatEphemeralSheet } from "@/components/ui/chat-ephemeral-sheet"
import { ChatReportSheet, ChatBlockDialog } from "@/components/ui/chat-report-sheet"
import { ChatCreateOrderSheet } from "@/components/ui/chat-create-order-sheet"
import { ChatShowcasePickerSheet } from "@/components/ui/chat-showcase-picker-sheet"
import { exportAndSaveChatRoom } from "@/lib/chat-export"
import {
  listStarredMessages,
  starChatMessage,
  unstarChatMessage,
  type ChatProductCardPayload,
  type ChatTranslation,
} from "@/lib/api/chat"
import type { ShowcaseItem } from "@/lib/api/users"
import { useToast } from "@/components/ui/toast"
import { ephemeralDurationLabel } from "@/lib/chat-ephemeral"
import { isImageMime } from "@/lib/mime"
import type { ChatBubbleAnchor } from "@/lib/chat-bubble"


/** Lampiran composer + berkas lokal untuk unggah ulang bila gagal. */
type LocalAttachment = ComposerAttachment & { picked?: PickedImage }

/**
 * Baris thread untuk FlatList (B02/B10):
 * - "day": pemisah hari — STICKY di atas list saat digulir (B10).
 * - "unread": pemisah "Belum dibaca" tepat di atas pesan jangkar (B02).
 * - "msg": satu bubble; `index` = posisi di `visibleMessages` (untuk
 *   previous/next grouping — bukan indeks baris).
 */
type ThreadRow =
  | { kind: "day"; key: string; label: string }
  | { kind: "unread"; key: string; anchorId: string; count: number }
  | { kind: "msg"; key: string; message: ChatMessage; index: number }

/**
 * B07: konversi FailedChatMessage (antrean persisten) → ChatMessage untuk
 * di-merge ke thread. Status "failed" membuat bubble menampilkan tombol
 * "Coba lagi" seperti pesan optimistis yang gagal (CN-015).
 */
function failedToChatMessage(f: FailedChatMessage): ChatMessage {
  return {
    id: f.id,
    text: f.text,
    messageType: f.messageType,
    fromUser: f.fromUser,
    attachments: f.attachments?.map((a) => ({ ...a })),
    replyToId: f.replyToId ?? null,
    replyTo: f.replyTo
      ? {
          id: f.replyTo.id,
          content: f.replyTo.content,
          messageType: f.replyTo.messageType,
          isDeleted: f.replyTo.isDeleted,
          senderName: f.replyTo.senderName,
        }
      : null,
    createdAt: f.createdAt,
    sendStatus: "failed",
    ephemeralTtlSeconds: f.ephemeralTtlSeconds ?? null,
    viewOnce: f.viewOnce,
  }
}

/** B07: konversi balik — menyimpan pesan yang gagal ke antrean persisten. */
function toFailedChatMessage(m: ChatMessage): FailedChatMessage {
  return {
    id: m.id,
    text: m.text,
    messageType: m.messageType,
    fromUser: m.fromUser,
    attachments: m.attachments?.map((a) => ({
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      thumbnailUrl: a.thumbnailUrl,
    })),
    replyToId: m.replyToId ?? null,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          content: m.replyTo.content ?? null,
          messageType: m.replyTo.messageType,
          isDeleted: m.replyTo.isDeleted,
          senderName: m.replyTo.senderName ?? null,
        }
      : null,
    createdAt: m.createdAt,
    ephemeralTtlSeconds: m.ephemeralTtlSeconds ?? undefined,
    viewOnce: m.viewOnce,
  }
}

/** Jarak poll pesan baru saat ruang AKTIF. Push tetap pemicu utama. */
const CHAT_POLL_MS = 8000
/**
 * GAP-B2 (implementasi 2026-09-26): chat memakai WebSocket realtime
 * (`useChatRoomRealtime`) DENGAN polling REST sebagai fallback.
 *
 * Prasyarat CN-013 sudah terpenuhi: backend kini memakai serialisasi
 * per-penerima untuk `chat.new_message` (CN-004) dan `chat.reaction_updated`
 * (CN-005) — `chat.service.ts` mengirim `senderView` ke pengirim dan
 * `recipientView` ke penerima. Event socket juga bertanda tangan HMAC per
 * sesi (`session_hmac_token`); klien memverifikasi sebelum normalisasi
 * (`lib/realtime/hmac.ts`). Saat socket sehat, poll pesan melambat ke
 * interval idle dan poll presence dimatikan; saat socket mati, polling
 * penuh kembali mengambil alih otomatis.
 */
/**
 * F-07 (audit): setelah IDLE_AFTER_EMPTY_POLLS poll beruntun tanpa pesan
 * baru, interval naik ke sini (idle backoff). Kembali cepat begitu ada pesan
 * masuk, pengguna mengetik, atau mengirim — baterai & server load turun tanpa
 * mengorbankan responsivitas saat percakapan hidup.
 */
const CHAT_POLL_IDLE_MS = 20000
const IDLE_AFTER_EMPTY_POLLS = 10
/** Jarak poll status online lawan bicara (REST; WS realtime belum ada di app). */
const PRESENCE_POLL_MS = 30000
/**
 * C-02 (audit): batas id yang dikirim sebagai `excludeIds`. Thread panjang
 * (ratusan pesan) pernah mengirim SEMUA id di query string — risiko 414 dan
 * biaya parse backend. Duplikat hanya mungkin di sekitar batas halaman
 * (kursor sudah dikirim), dan merge dedupe tetap menyaring apa pun.
 */
const EXCLUDE_IDS_MAX = 50
/** C-07: refresh read-receipt & pin tiap N poll pesan (murah, ~32 d sekali). */
const RECEIPTS_REFRESH_EVERY_POLLS = 4
/**
 * Toleransi (px) untuk menganggap pembaca masih di dasar thread. Satu bubble
 * pendek ±44px; 48 membuat tombol "ke pesan terbaru" tidak berkedip saat
 * tinggi konten berubah sedikit (gambar selesai diukur, reaksi muncul).
 */
const NEAR_BOTTOM_PX = 48
/** Interval event scroll (ms) — cukup untuk tombol "ke pesan terbaru". */
const SCROLL_EVENT_THROTTLE = 64

function messageTypeFor(
  attachments: ChatAttachmentDto[],
): NonNullable<SendMessageDto["messageType"]> {
  if (attachments.length === 0) return "TEXT"
  // `mimeType` datang dari respons unggah dan TIDAK divalidasi: bila backend
  // tidak mengembalikannya, `undefined.startsWith("image/")` melempar
  // TypeError tepat saat tombol kirim ditekan — pesan tak pernah terkirim dan
  // layar jatuh ke error boundary. Lampiran tanpa MIME dianggap bukan gambar.
  const isImage = (a: ChatAttachmentDto) => isImageMime(a.mimeType)
  if (attachments.every(isImage)) return "IMAGE"
  // Voice note: semua lampiran audio → VOICE (sudah ada di kontrak
  // SendMessageDto; bubble menampilkan label "Pesan suara").
  const isAudio = (a: ChatAttachmentDto) => isAudioMime(a.mimeType)
  if (attachments.every(isAudio)) return "VOICE"
  return "FILE"
}

function sortByTime(items: ChatMessage[]): ChatMessage[] {
  return [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

export default function ChatRoomScreen() {
  const insets = useSafeAreaInsets()
  // C-06 (audit): `title` opsional dikirim saat navigasi dari daftar chat —
  // GET /rooms tidak punya endpoint detail dan pencarian ruang hanya memuat
  // 30 pertama, sehingga ruang ke-31+ kehilangan nama lawan bicara di header.
  const { roomId, title, self } = useLocalSearchParams<{ roomId: string; title?: string; self?: string }>()
  const titleParam = typeof title === "string" && title.trim() ? title.trim() : undefined
  /**
   * Self-chat ("Pesan untuk diri sendiri") — blokir/lapor & buat transaksi
   * disembunyikan; penanda dari daftar chat (ROUTES.chatRoom self=1).
   */
  const isSelfChat = self === "1"
  const toast = useToast()
  const { copy } = useCopy()

  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  /**
   * B08: id pesan yang disembunyikan lokal ("hapus untuk saya") — dimuat
   * sekali saat room dibuka (lib/chat-hidden-messages), thread memfilter.
   * Yang disimpan hanya id (non-sensitif).
   */
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  /**
   * B02: unreadCount room yang ditangkap SEBELUM `markChatRoomRead` pertama.
   * Dipakai menghitung jangkar "pesan pertama yang belum dibaca" — layar
   * menandai terbaca segera setelah dibuka, jadi angka ini harus diabadikan
   * dulu (lihat lib/chat-unread-anchor).
   */
  const initialUnreadRef = useRef<number | null>(null)
  /** B02: id jangkar pesan pertama yang belum dibaca (null = tidak ada). */
  const [unreadAnchorId, setUnreadAnchorId] = useState<string | null>(null)
  /**
   * B09: pesan yang sedang disorot setelah pengguna mengetuk kutipan
   * balasan — dibersihkan otomatis setelah ~2,5 detik.
   */
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [olderStatus, setOlderStatus] = useState<LoadMoreStatus>("idle")
  const [draft, setDraft] = useState("")
  /**
   * Draft ketikan per-room (lib/chat-drafts): teks ditulis ke store sinkron
   * tiap ketikan (persist di-debounce ke SecureStore), dimuat sekali saat
   * room dibuka, dan dihapus saat pesan terkirim. Menutup room lalu kembali
   * — atau restart app — tidak lagi menghilangkan ketikan.
   */
  const handleDraftChange = useCallback(
    (text: string) => {
      setDraft(text)
      if (roomId) saveChatDraft(roomId, text)
    },
    [roomId],
  )
  useEffect(() => {
    if (!roomId) return
    let cancelled = false
    void loadChatDraft(roomId).then((stored) => {
      if (cancelled || !stored) return
      // Jangan timpa ketikan yang sudah ada (mis. restore cepat + ketik).
      setDraft((prev) => (prev ? prev : stored))
    })
    return () => {
      cancelled = true
    }
  }, [roomId])
  const [attachments, setAttachments] = useState<LocalAttachment[]>([])
  /**
   * B04: AbortController per file yang sedang diunggah. Chip "Batal" dan X
   * (hapus saat uploading) membatalkan request XHR yang berjalan — bukan
   * sekadar menghapus chip.
   */
  const uploadControllersRef = useRef(new Map<string, AbortController>())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Room dihapus/dinonaktifkan (404) — tampilkan EmptyState khusus, bukan error generik. */
  const [roomGone, setRoomGone] = useState(false)
  const [sending, setSending] = useState(false)
  /** Sheet lampiran (+) composer: Gambar / Video / File / Voice Note. */
  const [attachSheetOpen, setAttachSheetOpen] = useState(false)
  /** Sheet perekam voice note. */
  const [voiceSheetOpen, setVoiceSheetOpen] = useState(false)
  // ── Sheets batch 43 FE-CHAT ─────────────────────────────────────────
  /** Terjemah: target pesan (null = sheet tertutup). */
  const [translateTarget, setTranslateTarget] = useState<ChatMessage | null>(null)
  /** Sheet pesan berbintang. */
  const [starredOpen, setStarredOpen] = useState(false)
  /** Sheet polling. */
  const [pollsOpen, setPollsOpen] = useState(false)
  /** Sheet kirim lokasi. */
  const [locationSheetOpen, setLocationSheetOpen] = useState(false)
  /** Sheet pesan sementara + sekali-lihat. */
  const [ephemeralSheetOpen, setEphemeralSheetOpen] = useState(false)
  /** Sheet laporkan + blokir. */
  const [reportSheetOpen, setReportSheetOpen] = useState(false)
  /** Dialog konfirmasi blokir lawan bicara. */
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  /** Sheet buat transaksi dari chat. */
  const [createOrderSheetOpen, setCreateOrderSheetOpen] = useState(false)
  /** Kartu produk sumber tombol "Beli" (null = buat dari menu tanpa etalase). */
  const [createOrderProduct, setCreateOrderProduct] = useState<ChatProductCardPayload | null>(null)
  /** Sheet pilih etalase → kartu produk. */
  const [showcasePickerOpen, setShowcasePickerOpen] = useState(false)
  /** Hasil terjemahan per id pesan — dirender di bawah teks asli. */
  const [translations, setTranslations] = useState<Record<string, ChatTranslation>>({})
  /** Pesan sementara aktif (TTL detik, null = mati) — berlaku untuk pesan berikutnya. */
  const [ttlSeconds, setTtlSeconds] = useState<number | null>(null)
  /** Mode sekali-lihat — one-shot: reset setelah satu pesan terkirim. */
  const [viewOnceOn, setViewOnceOn] = useState(false)

  const [viewerItem, setViewerItem] = useState<MediaViewerItem | null>(null)
  /**
   * Viewer gambar layar penuh (pinch-zoom + swipe): gambar dibuka di sini,
   * berkas non-gambar tetap lewat <MediaViewer> (tombol "Buka eksternal").
   */
  const [imageViewer, setImageViewer] = useState<{ images: ImageViewerItem[]; index: number } | null>(null)
  /**
   * Mode pilih pesan (v3 2026-09-21). Tekan lama / ketuk satu pesan
   * mengaktifkannya; header ruang digantikan <SelectionBar> berisi reaksi
   * cepat + aksi (pin, salin, teruskan, edit, hapus) sebagai ikon berlabel.
   * ActionSheet per pesan dihapus: dulu butuh dua langkah (buka sheet →
   * pilih aksi) dan menutupi setengah layar.
   */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  /** Menu ⋮ di header ruang (lihat pesanan, cari, bisukan, arsip, profil). */
  const [roomMenuOpen, setRoomMenuOpen] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)

  useEffect(() => {
    if (!room?.orderId) {
      setOrder(null)
      return
    }
    let cancelled = false
    getOrder(room.orderId)
      .then((ord) => {
        if (!cancelled) setOrder(ord)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [room?.orderId])

  const isOrderClosed =
    order != null && ["COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"].includes(order.status)

  const isChatCompleted =
    isOrderClosed ||
    (room as { isClosed?: boolean; status?: string; orderStatus?: string } | null)?.isClosed === true ||
    ["CLOSED", "COMPLETED"].includes((room as { status?: string } | null)?.status ?? "") ||
    (room as { orderStatus?: string } | null)?.orderStatus === "COMPLETED"

  const closedNoticeText =
    order?.status === "CANCELLED"
      ? translate("Percakapan ini telah ditutup karena transaksi dibatalkan.")
      : order?.status === "REFUNDED"
      ? translate("Percakapan ini telah ditutup karena dana transaksi telah dikembalikan.")
      : order?.status === "EXPIRED"
      ? translate("Percakapan ini telah ditutup karena transaksi telah kedaluwarsa.")
      : translate("Percakapan ini telah ditutup karena transaksi telah selesai.")

  // ── Fitur lanjutan: reaksi, pin, edit, forward, read receipt, presence ──
  const [forwardTarget, setForwardTarget] = useState<ChatMessage[] | null>(null)
  const [editTarget, setEditTarget] = useState<ChatMessage | null>(null)
  /** Pesan yang sedang dibalas — strip preview di atas composer (permintaan produk 2026-09-28). */
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null)

  // C-06 (audit): ruang di luar 30 pertama tidak ditemukan di GET /rooms —
  // nama lawan bicara jatuh ke param navigasi `title` sebelum "Percakapan".
  // Dideklarasikan awal karena dipakai handleSend (pesan optimistis) juga.
  const counterpartName =
    room?.counterpart?.fullName ??
    (room?.counterpart?.username ? `@${room.counterpart.username}` : undefined) ??
    titleParam

  /**
   * Workstream C (2026-09-28, produk): di DM 1:1 bubble lawan TIDAK
   * menampilkan foto + nama (ala WhatsApp — hanya bubble). Di ruang
   * transaksi/grup (admin bisa masuk) identitas pengirim tetap tampil.
   * `room` null (daftar ruang belum termuat) → perilaku lama (tampil).
   */
  const showPeerIdentity = !isOneToOneChatRoom(room)

  /**
   * Target balasan → strip preview di atas composer ("Membalas {nama} ·
   * cuplikan" + X). Nama pengirim pesan sendiri = "Anda".
   */
  const composerReplyTo: ComposerReplyTarget | undefined = replyTarget
    ? {
        id: replyTarget.id,
        senderName: replyTarget.fromUser ? "Anda" : (counterpartName ?? "Pesan"),
        preview: (
          replyTarget.isDeleted
            ? "Pesan ini telah dihapus"
            : replyTarget.text?.trim() ||
              (replyTarget.attachments?.length ? "Lampiran" : "Pesan")
        ).slice(0, 80),
      }
    : undefined
  const [pinned, setPinned] = useState<ChatMessage[]>([])
  const [presence, setPresence] = useState<ChatPresence | null>(null)
  /**
   * B11: kapan respons presence terakhir diterima klien — `presenceLabel`
   * memakai ini untuk ambang kedaluwarsa supaya label tidak menyesatkan
   * saat datanya basi.
   */
  const [presenceFetchedAt, setPresenceFetchedAt] = useState<number | null>(null)
  /**
   * GAP-B2 (G110): indikator "mengetik…" lawan bicara dari event socket
   * `chat.typing` (bukan dari poll). `createTypingTracker` di hook memberi
   * expiry otomatis bila sinyal berhenti tak pernah tiba.
   */
  const [counterpartTyping, setCounterpartTyping] = useState(false)
  /** id pesan milik sendiri yang sudah dibaca lawan bicara (read receipt). */
  const [readByCounterpart, setReadByCounterpart] = useState<Set<string>>(new Set())
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingActive = useRef(false)
  const initialRequest = useRef<AbortController | null>(null)
  /**
   * C-05 (audit): roomId TERKINI untuk guard respons terbang — param ruang
   * bisa berganti tanpa unmount (expo-router me-reuse instance), dan respons
   * poll ruang lama tidak boleh masuk ke ruang baru / setState pasca-unmount.
   */
  const roomIdRef = useRef(roomId)
  roomIdRef.current = roomId

  // F-07: interval poll adaptif (aktif vs idle).
  const [pollInterval, setPollInterval] = useState(CHAT_POLL_MS)
  const emptyPolls = useRef(0)
  const pollTick = useRef(0)

  // J-07 (audit): pencarian pesan dalam ruang — adapter searchRoomMessages
  // sudah ada sejak API-GAP 2026-09-15, UI-nya yang belum. Kata kunci,
  // debounce, dan hasilnya hidup di <ChatSearchSheet>; layar hanya membuka.
  const [searchOpen, setSearchOpen] = useState(false)

  /**
   * Pencarian inline client-side (2026-09-28, batch UI/UX): pelengkap sheet
   * di atas — mencari HANYA di pesan yang sudah dimuat (tanpa endpoint),
   * hasil di-highlight di thread dan dilompati via next/prev ala Ctrl+F.
   * Dipicu ikon kaca pembesar di header (slot `extra` <ChatRoomHeader>).
   */
  const [inlineSearchOpen, setInlineSearchOpen] = useState(false)
  const [inlineQuery, setInlineQuery] = useState("")
  /** Id hasil yang sedang aktif — index diturunkan dari `inlineMatches`. */
  const [inlineActiveId, setInlineActiveId] = useState<string | undefined>(undefined)
  const inlineMatches = useMemo(
    () => (inlineSearchOpen ? findMessageMatches(messages, inlineQuery) : []),
    [inlineSearchOpen, messages, inlineQuery],
  )
  const inlineMatchIds = useMemo(() => new Set(inlineMatches), [inlineMatches])
  const inlineIndex = inlineActiveId ? inlineMatches.indexOf(inlineActiveId) : -1
  /** B12: pesan hasil aktif — untuk pratinjau cuplikan konteks keyword. */
  const inlineActiveMessage = useMemo(
    () => (inlineActiveId ? (messages.find((m) => m.id === inlineActiveId) ?? null) : null),
    [messages, inlineActiveId],
  )
  const closeInlineSearch = useCallback(() => {
    setInlineSearchOpen(false)
    setInlineQuery("")
    setInlineActiveId(undefined)
  }, [])

  const jumpToInlineMatch = useCallback(
    (messageId: string) => {
      const index = messages.findIndex((m) => m.id === messageId)
      if (index < 0) return
      try {
        scrollRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 })
      } catch {
        // Item belum terukur (riwayat baru dimuat) — abaikan, user bisa
        // menekan next/prev lagi setelah layout stabil.
      }
    },
    [messages],
  )

  // Hasil berubah (ketikan/pesan baru dari poll): pertahankan hasil aktif
  // bila masih ada; bila tidak, kembali ke hasil pertama + lompat.
  useEffect(() => {
    if (!inlineSearchOpen) return
    if (inlineMatches.length === 0) {
      setInlineActiveId(undefined)
      return
    }
    setInlineActiveId((prev) => {
      const next = prev && inlineMatches.includes(prev) ? prev : inlineMatches[0]
      if (next !== prev) jumpToInlineMatch(next)
      return next
    })
  }, [inlineSearchOpen, inlineMatches, jumpToInlineMatch])

  const stepInlineMatch = useCallback(
    (dir: 1 | -1) => {
      if (inlineMatches.length === 0) return
      const cur = inlineActiveId ? inlineMatches.indexOf(inlineActiveId) : -1
      const next = inlineMatches[(cur + dir + inlineMatches.length) % inlineMatches.length]
      setInlineActiveId(next)
      jumpToInlineMatch(next)
    },
    [inlineMatches, inlineActiveId, jumpToInlineMatch],
  )

  const fetchMessages = useCallback(async () => {
    if (!roomId) return
    initialRequest.current?.abort()
    const controller = new AbortController()
    initialRequest.current = controller
    setLoading(true)
    setError(null)
    setRoomGone(false)
    try {
      const [page, rooms, failed] = await Promise.all([
        api.chat.getChatMessages(roomId, { limit: CHAT_PAGE_SIZE }, controller.signal),
        api.chat.listChatRooms({ page: 1, limit: CHAT_PAGE_SIZE }, controller.signal).catch((err) => {
          logWarn("chat:rooms-lookup", err)
          return {
            data: [] as ChatRoom[],
            meta: { page: 1, limit: CHAT_PAGE_SIZE, totalPages: 1 },
          }
        }),
        // B07: antrean pesan gagal yang persisten — selamat dari refresh.
        loadChatFailedMessages(roomId),
      ])
      if (controller.signal.aborted) return
      const items = sortByTime(page.items)
      // B07: rekonsiliasi — pesan gagal yang ternyata SUDAH ada di server
      // (POST sukses tapi respons hilang) tidak di-merge ulang; antreannya
      // dibersihkan supaya tidak duplikat.
      const failedSending = failed.map((f) => ({
        ...failedToChatMessage(f),
        sendStatus: "sending" as const,
      }))
      const confirmedIds = new Set<string>()
      for (const s of items) {
        const match = findOptimisticMatch(failedSending, s)
        if (match) confirmedIds.add(match.id)
      }
      const stillFailed = failed.filter((f) => {
        if (confirmedIds.has(f.id)) {
          removeChatFailedMessage(roomId, f.id)
          return false
        }
        return true
      })
      setMessages(
        stillFailed.length > 0
          ? mergeChatMessages(items, stillFailed.map(failedToChatMessage)).next
          : items,
      )
      setNextCursor(
        page.nextCursor ?? (page.items.length >= CHAT_PAGE_SIZE ? (items[0]?.id ?? null) : null),
      )
      setOlderStatus(page.items.length < CHAT_PAGE_SIZE ? "end" : "idle")
      const roomRow = rooms.data.find((r) => r.id === roomId) ?? null
      setRoom(roomRow)
      // B02: abadikan unreadCount SEBELUM `markChatRoomRead` di bawah —
      // setelah itu angka server sudah 0 dan jangkar tak bisa dihitung.
      if (initialUnreadRef.current === null) {
        initialUnreadRef.current = roomRow?.unreadCount ?? 0
      }
      // B08: muat id pesan "hapus untuk saya".
      void loadHiddenMessageIds(roomId).then((ids) => {
        if (!controller.signal.aborted) setHiddenIds(ids)
      })
      await api.chat.markChatRoomRead(roomId).catch((err) => logWarn("chat:mark-read-open", err))
      // Ruang sudah dibuka dan ditandai terbaca → segarkan badge tab agar
      // angka unread turun segera, bukan menunggu poll 60 detik.
      void refreshUnreadCount()
      void refreshChatUnreadCount()
    } catch (err) {
      if (controller.signal.aborted) return
      // 404 = room dihapus/dinonaktifkan — retry tidak akan pernah berhasil.
      if (isApiError(err) && err.status === 404) {
        setRoomGone(true)
      } else {
        setError(userMessage(err))
      }
    } finally {
      if (initialRequest.current === controller && !controller.signal.aborted) setLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    void fetchMessages()
    return () => initialRequest.current?.abort()
  }, [fetchMessages])

  // ── Read receipt: pesan saya yang sudah dibaca lawan bicara ──
  const refreshReadReceipts = useCallback(async () => {
    if (!roomId) return
    try {
      const { receipts } = await getReadReceipts(roomId)
      // `receipts` berisi status baca seluruh pesan room (dari semua pihak);
      // untuk ikon status cukup flag isRead per messageId milik saya.
      setReadByCounterpart(
        new Set(receipts.filter((r) => r.isRead).map((r) => r.messageId)),
      )
    } catch (err) {
      // Read receipt bersifat kosmetik — kegagalan tidak boleh mengganggu ruang.
      logWarn("chat:read-receipts", err)
    }
  }, [roomId])

  // ── Daftar pesan terpin (baris pin di atas thread) ──
  const refreshPinned = useCallback(async () => {
    if (!roomId) return
    try {
      setPinned(await getPinnedMessages(roomId))
    } catch (err) {
      logWarn("chat:pinned", err)
      setPinned([])
    }
  }, [roomId])

  // ── Presence lawan bicara (REST poll; WS realtime belum ada di app) ──
  // C-04 (audit): setInterval mentah diganti usePolling — presence tidak
  // lagi terus dipoll saat app di background / layar tidak fokus, dan satu
  // mekanisme polling untuk semua loop di layar ini.
  const refreshPresence = useCallback(async (signal?: AbortSignal) => {
    if (!roomId) return
    try {
      setPresence(await getRoomPresence(roomId, signal))
      setPresenceFetchedAt(Date.now())
    } catch (err) {
      if (signal?.aborted) return
      logWarn("chat:presence", err)
      setPresence(null)
      setPresenceFetchedAt(null)
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    void refreshReadReceipts()
    void refreshPinned()
    void refreshPresence()
  }, [roomId, refreshPresence, refreshPinned, refreshReadReceipts])

  // ── Poll pesan baru ────────────────────────────────────────────────────
  // Tanpa ini, balasan lawan bicara TIDAK PERNAH muncul selama ruang
  // dibuka: layar hanya menambah pesan hasil kiriman sendiri, dan push
  // notification hanya membantu bila ditap. Poll 8 detik mengambil halaman
  // TERBARU (tanpa cursor) lalu menggabungkan id yang belum dikenal ke
  // thread — pesan lama yang sedang dibaca tidak pernah digeser.
  const mergeIncoming = useCallback(
    (incoming: ChatMessage[], sourceRoom?: string) => {
      // C-05 (audit): respons terbang dari ruang lama (param berganti tanpa
      // unmount) tidak boleh menyentuh state ruang baru.
      if (sourceRoom !== undefined && sourceRoom !== roomIdRef.current) return 0
      let added = 0
      let freshFromOther = false
      setMessages((prev) => {
        const result = mergeChatMessages(prev, incoming)
        added = result.added
        freshFromOther = result.hasFreshFromOther
        if (!result.changed) return prev
        // Pesan masuk dari lawan bicara → badge tab Notifikasi harus turun
        // segera (ruang terbuka = terbaca), bukan menunggu poll 60 detik.
        // Namun HANYA bila user sedang di dasar thread: yang sedang scroll
        // ke atas membaca riwayat belum melihat pesan baru — menandainya
        // "dibaca" akan menampilkan centang ganda palsu ke lawan bicara.
        if (
          result.added > 0 &&
          result.hasFreshFromOther &&
          roomIdRef.current &&
          atBottomRef.current
        ) {
          void api.chat
            .markChatRoomRead(roomIdRef.current)
            .catch((err) => logWarn("chat:mark-read", err))
          void refreshUnreadCount()
          void refreshChatUnreadCount()
        }
        return result.next
      })
      // B03: pesan baru masuk saat pembaca menelusuri riwayat (tidak di
      // dasar thread) → hitung untuk badge tombol "kembali ke pesan terbaru".
      if (added > 0 && freshFromOther && !atBottomRef.current) {
        setNewWhileAway((c) => c + added)
      }
      return added
    },
    [],
  )

  const pollNewMessages = useCallback(
    async (signal?: AbortSignal) => {
      if (!roomId) return
      const targetRoom = roomId
      const page = await api.chat.getChatMessages(roomId, { limit: CHAT_PAGE_SIZE }, signal)
      const added = mergeIncoming(sortByTime(page.items), targetRoom)
      // F-07: adaptive interval — poll kosong beruntun menaikkan interval;
      // satu pesan baru saja sudah cukup untuk kembali ke interval cepat.
      emptyPolls.current = added > 0 ? 0 : emptyPolls.current + 1
      const nextInterval =
        emptyPolls.current >= IDLE_AFTER_EMPTY_POLLS ? CHAT_POLL_IDLE_MS : CHAT_POLL_MS
      setPollInterval((prev) => (prev === nextInterval ? prev : nextInterval))
      // C-07: read-receipt & daftar pin disegarkan periodik (murah) selagi
      // ruang terbuka, tidak hanya di mount dan setelah aksi sendiri.
      pollTick.current += 1
      if (pollTick.current % RECEIPTS_REFRESH_EVERY_POLLS === 0) {
        void refreshReadReceipts()
        void refreshPinned()
      }
    },
    [roomId, mergeIncoming, refreshReadReceipts, refreshPinned],
  )


  // ── Realtime socket (GAP-B2, G101–G125) ────────────────────────────────
  // Backend kini memakai serialisasi per-penerima untuk `chat.new_message`
  // (CN-004) dan `chat.reaction_updated` (CN-005) — payload yang diterima
  // hook ini sudah benar untuk viewer ini. Event melewati verifikasi
  // envelope HMAC di dalam hook; REST polling di bawah tetap jalan sebagai
  // fallback (G119) dan melambat saat socket sehat (G120).
  const { healthy: realtimeHealthy, sendTyping: sendTypingRealtime } = useChatRoomRealtime(roomId, {
    onMessage: (raw) => {
      try {
        const msg = normalizeChatMessage(raw as Record<string, unknown>)
        // Dedup vs pesan optimistis & hasil poll: mergeIncoming menyaring
        // berdasarkan id (G108).
        mergeIncoming([msg], roomIdRef.current)
      } catch (err) {
        logWarn("chat:realtime-message", err)
      }
    },
    onMessageUpdated: (raw) => {
      try {
        const msg = normalizeChatMessage(raw as Record<string, unknown>)
        // mergeIncoming ikut me-refresh pesan yang sudah ada (teks/edit/
        // reaksi/pin) dari data terbaru — sama seperti respons poll (C-07).
        mergeIncoming([msg], roomIdRef.current)
      } catch (err) {
        logWarn("chat:realtime-updated", err)
      }
    },
    onMessageDeleted: (messageId) => {
      setMessages((prev) => applyDeletedTombstone(prev, messageId))
    },
    onReaction: (messageId, reactions) => {
      setMessages((prev) => applyReactionSummary(prev, messageId, reactions))
    },
    onPin: (messageId, isPinned) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned } : m)),
      )
      void refreshPinned()
    },
    onRead: (messageId) => {
      // Gema mark-as-read milik sendiri sudah difilter di hook; yang tiba
      // di sini adalah bacaan lawan bicara.
      if (messageId) {
        setReadByCounterpart((prev) => new Set(prev).add(messageId))
      } else {
        void refreshReadReceipts()
      }
    },
    onTyping: (isTyping) => setCounterpartTyping(isTyping),
    onPresence: (isOnline) =>
      setPresence((prev) => (prev ? { ...prev, isOnline } : prev)),
    // G109: setelah reconnect + join ulang, pesan yang terlewat diambil
    // via REST (kursor = halaman terbaru; mergeIncoming mendup).
    onReconnect: () => {
      void pollNewMessages()
      // B16: rekonsiliasi unread eksplisit — badge tab & header bisa basi
      // selama socket putus (polling store bisa tertunda).
      void refreshUnreadCount()
      void refreshChatUnreadCount()
    },
  })

  // G119/G120: polling REST tetap sebagai fallback — tidak pernah
  // dimatikan total karena socket bisa putus diam-diam tanpa event
  // disconnect. Saat socket sehat, poll pesan melambat ke interval idle
  // dan poll presence dimatikan (presence datang via socket).
  const messagePollInterval = realtimeHealthy ? CHAT_POLL_IDLE_MS : pollInterval
  usePolling(pollNewMessages, messagePollInterval, Boolean(roomId) && !error && !loading)
  usePolling(refreshPresence, PRESENCE_POLL_MS, Boolean(roomId) && !realtimeHealthy)

  /**
   * B16: rekonsiliasi unread saat aplikasi kembali aktif — badge tab &
   * header bisa basi selama aplikasi di background (push mungkin tidak
   * sinkron dengan state store).
   */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshUnreadCount()
        void refreshChatUnreadCount()
      }
    })
    return () => sub.remove()
  }, [])

  // ── Auto-scroll ke pesan terbaru ───────────────────────────────────────
  // Thread tumbuh ke bawah, tetapi ScrollView mulai di ATAS: membuka ruang
  // menampilkan pesan TERLAMA dari halaman terakhir dan pengguna harus
  // menggulir manual. Gulir ke ujung bawah hanya ketika id pesan TERAKHIR
  // berubah (muat awal, kirim, pesan masuk) — memuat pesan lama di atas
  // (LoadMore) tidak mengubah id terakhir sehingga posisi baca tidak lompat.
  // F-06 (audit): thread dirender <FlatList> (virtualisasi) — sebelumnya
  // ScrollView + messages.map menahan 200+ bubble ter-mount penuh dengan
  // gambar; memori & FPS jatuh di Android low-end.
  const scrollRef = useRef<FlatList<ThreadRow>>(null)
  const lastSeenEndId = useRef<string | undefined>(undefined)
  const lastMessageId = messages[messages.length - 1]?.id
  const handleContentSizeChange = useCallback(() => {
    if (lastMessageId && lastSeenEndId.current !== lastMessageId) {
      lastSeenEndId.current = lastMessageId
      scrollRef.current?.scrollToEnd({ animated: false })
    }
  }, [lastMessageId])

  /**
   * Posisi baca terkini. Dua kegunaannya:
   *   1. Tombol "ke pesan terbaru" muncul hanya saat pembaca meninggalkan
   *      dasar thread (sebelumnya tidak ada jalan kembali selain menggulir
   *      manual — di thread ratusan pesan itu tidak terpakai).
   *   2. Jangkar saat baris pesan terpin muncul/hilang di ATAS list.
   */
  const atBottomRef = useRef(true)
  const [atBottom, setAtBottom] = useState(true)
  /**
   * B03: jumlah pesan baru yang masuk saat pembaca TIDAK di dasar thread.
   * Ditampilkan sebagai badge di tombol mengambang "kembali ke pesan
   * terbaru"; direset saat pengguna kembali ke dasar.
   */
  const [newWhileAway, setNewWhileAway] = useState(0)
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
      const bottom =
        contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_BOTTOM_PX
      if (atBottomRef.current !== bottom) {
        atBottomRef.current = bottom
        setAtBottom(bottom)
        // B03: kembali ke dasar = pesan baru terlihat → badge di-reset.
        if (bottom) setNewWhileAway(0)
        // Kembali ke dasar thread = pesan baru kini terlihat → tandai dibaca.
        // (mergeIncoming menahan mark-as-read selama user menelusuri riwayat.)
        if (bottom && roomIdRef.current) {
          void api.chat
            .markChatRoomRead(roomIdRef.current)
            .catch((err) => logWarn("chat:mark-read-scroll", err))
          void refreshUnreadCount()
          void refreshChatUnreadCount()
          // B02: pengguna sudah melewati titik "Belum dibaca" → separator
          // tidak lagi relevan; hapus agar tidak menumpuk.
          setUnreadAnchorId((prev) => (prev ? null : prev))
        }
      }
    },
    [],
  )

  /**
   * B08: thread yang terlihat = pesan minus yang disembunyikan lokal.
   * Semua logika berbasis indeks (previous/next, lompat) memakai array ini.
   */
  const visibleMessages = useMemo(
    () => messages.filter((m) => !hiddenIds.has(m.id)),
    [messages, hiddenIds],
  )

  /**
   * B02: hitung jangkar "pesan pertama yang belum dibaca" dari unreadCount
   * yang diabadikan saat room dibuka. Dihitung ulang sampai ketemu (pesan
   * jangkar bisa berada di halaman riwayat yang belum dimuat).
   */
  useEffect(() => {
    if (unreadAnchorId) return
    const total = initialUnreadRef.current
    if (total == null || total <= 0 || visibleMessages.length === 0) return
    const anchor = firstUnreadMessageId(
      visibleMessages.map((m) => ({
        id: m.id,
        fromUser: m.fromUser,
        messageType: m.messageType,
      })),
      total,
    )
    if (anchor) setUnreadAnchorId(anchor)
  }, [visibleMessages, unreadAnchorId])

  /**
   * B10: baris thread untuk FlatList — pemisah hari (sticky), pemisah
   * "Belum dibaca" (B02), dan bubble. Pemisah hari TIDAK lagi dirender di
   * dalam <ChatMessageRow> (hideDaySeparator) supaya bisa sticky.
   */
  const threadRows = useMemo<ThreadRow[]>(() => {
    const rows: ThreadRow[] = []
    let lastDay = ""
    visibleMessages.forEach((m, index) => {
      const day = dayKey(m.createdAt)
      if (day !== lastDay) {
        lastDay = day
        rows.push({ kind: "day", key: `day-${day}`, label: dayLabel(m.createdAt) })
      }
      if (unreadAnchorId && m.id === unreadAnchorId) {
        rows.push({
          kind: "unread",
          key: "unread-separator",
          anchorId: m.id,
          count: initialUnreadRef.current ?? 0,
        })
      }
      rows.push({ kind: "msg", key: m.id, message: m, index })
    })
    return rows
  }, [visibleMessages, unreadAnchorId])

  /** B10: indeks baris "day" — FlatList menempelkannya di atas saat digulir. */
  const stickyDayIndices = useMemo(() => {
    const indices: number[] = []
    threadRows.forEach((row, i) => {
      if (row.kind === "day") indices.push(i)
    })
    return indices
  }, [threadRows])

  /**
   * B09: sorot pesan asal balasan selama ~2,5 detik setelah kutipan diketuk.
   */
  const flashHighlight = useCallback((messageId: string) => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    setHighlightedId(messageId)
    highlightTimer.current = setTimeout(() => {
      setHighlightedId((prev) => (prev === messageId ? null : prev))
      highlightTimer.current = null
    }, 2500)
  }, [])

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current)
    },
    [],
  )

  /**
   * BUG YANG DIPERBAIKI (laporan 2026-09-21: "saat pesan di pin chatnya malah
   * ke bawah"): baris pesan terpin dirender DI ATAS FlatList. Begitu ia muncul,
   * tinggi viewport list menyusut setinggi baris itu sementara offset scroll
   * tidak berubah — pesan terakhir terdorong keluar layar dan thread terasa
   * "melompat ke bawah". Kompensasinya: selama pembaca berada di dasar thread,
   * setiap perubahan tinggi baris pin diikuti `scrollToEnd` tanpa animasi
   * (dijalankan di frame berikutnya agar ukuran konten sudah diperbarui).
   * Pembaca yang sedang menelusuri riwayat TIDAK dipaksa turun.
   */
  const [pinnedBarHeight, setPinnedBarHeight] = useState(0)
  useEffect(() => {
    if (!atBottomRef.current) return
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: false })
    })
    return () => cancelAnimationFrame(frame)
  }, [pinnedBarHeight])

  /**
   * J-07: lompat ke pesan hasil pencarian — hanya mungkin bila pesannya
   * sudah termuat di thread (virtualisasi mengandalkan data di state).
   */
  const jumpToMessage = useCallback(
    (messageId: string) => {
      // B10: thread kini berisi baris campuran (hari/pemisah/pesan) — cari
      // indeks BARIS pesan, bukan indeks pesan.
      const index = threadRows.findIndex((r) => r.kind === "msg" && r.message.id === messageId)
      setSearchOpen(false)
      if (index >= 0) {
        scrollRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 })
      } else {
        toast.show({
          title: "Pesan belum termuat di thread",
          description: "Muat pesan sebelumnya untuk menjangkau riwayat yang lebih lama.",
          tone: "info",
        })
      }
    },
    [threadRows, toast.show],
  )

  /**
   * B09: ketuk kutipan balasan → scroll ke pesan asal + sorot ~2,5 detik.
   * Bila pesan asal belum termuat, jumpToMessage menampilkan panduan
   * "muat pesan sebelumnya" (tidak ada toast ganda di sini).
   */
  const handleQuotePress = useCallback(
    (replyToId: string) => {
      jumpToMessage(replyToId)
      // Sorot hanya bila pesannya memang ada di thread saat ini.
      if (threadRows.some((r) => r.kind === "msg" && r.message.id === replyToId)) {
        flashHighlight(replyToId)
      }
    },
    [jumpToMessage, threadRows, flashHighlight],
  )

  const loadOlder = useCallback(async () => {
    if (!roomId || olderStatus === "loading" || olderStatus === "end") return
    setOlderStatus("loading")
    const targetRoom = roomId
    try {
      const page = await api.chat.getChatMessages(
        roomId,
        {
          cursor: nextCursor ?? messages[0]?.id,
          limit: CHAT_PAGE_SIZE,
          // C-02: dibatasi N id terbaru (bukan seluruh thread) — kursor tetap
          // sumber utama; merge di bawah tetap menyaring duplikat apa pun.
          excludeIds: messages.slice(-EXCLUDE_IDS_MAX).map((m) => m.id),
        },
      )
      if (targetRoom !== roomIdRef.current) return
      // C-03 (audit): dedupe dihitung DI DALAM updater terhadap `prev`
      // terkini — sebelumnya set `known` diambil dari closure, sehingga poll
      // yang menyisipkan pesan di tengah request menghasilkan duplikat.
      let freshCount = 0
      let oldestId: string | undefined
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id))
        const fresh = sortByTime(page.items.filter((m) => !known.has(m.id)))
        freshCount = fresh.length
        oldestId = fresh[0]?.id
        if (!freshCount) return prev
        return sortByTime([...fresh, ...prev])
      })
      setNextCursor(page.nextCursor ?? oldestId ?? null)
      setOlderStatus(freshCount === 0 || page.items.length < CHAT_PAGE_SIZE ? "end" : "idle")
    } catch (err) {
      if (targetRoom !== roomIdRef.current) return
      logWarn("chat:load-older", err)
      setOlderStatus("error")
    }
  }, [roomId, olderStatus, nextCursor, messages])

  /**
   * Unggah satu lampiran dengan LAPORAN PROGRESS (B04).
   *
   * `uploadChatAttachmentProgress` memakai XHR (fetch tidak bisa melaporkan
   * progress upload). `signal` dibatalkan lewat chip "Batal"/X di composer —
   * dibatalkan user → status "cancelled", gagal → status "error".
   */
  const uploadAttachment = useCallback(
    async (localId: string, picked: PickedImage) => {
      if (!roomId) return
      const controller = new AbortController()
      uploadControllersRef.current.set(localId, controller)
      setAttachments((prev) =>
        prev.map((a) =>
          a.localId === localId ? { ...a, status: "uploading", progress: 0 } : a,
        ),
      )
      try {
        const form = await pickedImageToFormData(picked)
        const dto = await api.chat.uploadChatAttachmentProgress(roomId, form, {
          signal: controller.signal,
          onProgress: (fraction) =>
            setAttachments((prev) =>
              prev.map((a) => (a.localId === localId ? { ...a, progress: fraction } : a)),
            ),
        })
        setAttachments((prev) =>
          prev.map((a) =>
            a.localId === localId
              ? { ...a, ...dto, fileSize: dto.fileSize || picked.size, status: "idle", progress: 1 }
              : a,
          ),
        )
      } catch (err) {
        const cancelledByUser = isApiError(err) && err.code === "ABORTED"
        setAttachments((prev) =>
          prev.map((a) =>
            a.localId === localId
              ? { ...a, status: cancelledByUser ? "cancelled" : "error", progress: undefined }
              : a,
          ),
        )
      } finally {
        uploadControllersRef.current.delete(localId)
      }
    },
    [roomId],
  )

  /** B04: batalkan unggahan yang sedang berjalan (chip "Batal"). */
  const handleCancelAttachment = useCallback((localId: string) => {
    uploadControllersRef.current.get(localId)?.abort()
  }, [])

  /**
   * Antrekan satu berkas ke composer lalu unggah ke endpoint upload ruang.
   * Bentuk `PickedImage` dipakai ulang untuk semua jenis berkas (gambar,
   * video, dokumen, voice note) — `pickedImageToFormData` hanya butuh
   * { uri, name, mimeType }.
   */
  const enqueueAndUpload = useCallback(
    async (picked: PickedImage) => {
      // B06: validasi ukuran + tipe memakai batas SERVER (50 MB) — bukan
      // hardcode 10 MB lama. `size` 0 = platform tidak melaporkan; lewatkan
      // (server tetap gate).
      const validation = validateChatAttachment({ size: picked.size, mimeType: picked.mimeType })
      if (!validation.ok) {
        toast.show({
          title: "File tidak dapat dilampirkan",
          description: validation.message,
          tone: "danger",
        })
        return
      }
      const localId = `${Date.now()}-${picked.name}`
      setAttachments((prev) => [
        ...prev,
        {
          localId,
          fileName: picked.name,
          fileUrl: picked.uri,
          mimeType: picked.mimeType,
          fileSize: picked.size,
          status: "uploading",
          picked,
        },
      ])
      await uploadAttachment(localId, picked)
    },
    [toast.show, uploadAttachment],
  )

  /**
   * B05: dua kualitas foto. "standard" = terkompresi (default picker 0.7),
   * "file" = kualitas asli tanpa kompresi (quality 1).
   */
  const handlePickImage = useCallback(
    async (quality: "standard" | "file" = "standard") => {
      setAttachSheetOpen(false)
      const picked = await pickImage({ quality: quality === "file" ? 1 : 0.7 })
      if (picked.status === "denied") {
        toast.show({ title: "Akses galeri ditolak", tone: "danger" })
        return
      }
      if (picked.status !== "picked") return
      await enqueueAndUpload(picked.asset)
    },
    [toast.show, enqueueAndUpload],
  )

  const handlePickVideo = useCallback(async () => {
    setAttachSheetOpen(false)
    const picked = await pickImage({ videoOnly: true })
    if (picked.status === "denied") {
      toast.show({ title: "Akses galeri ditolak", tone: "danger" })
      return
    }
    if (picked.status !== "picked") return
    await enqueueAndUpload(picked.asset)
  }, [toast.show, enqueueAndUpload])

  const handlePickFile = useCallback(async () => {
    setAttachSheetOpen(false)
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
      multiple: false,
    })
    const asset = result.canceled ? null : result.assets[0]
    if (!asset) return
    await enqueueAndUpload({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? "application/octet-stream",
      size: asset.size ?? 0,
    })
  }, [enqueueAndUpload])

  const handleVoiceRecorded = useCallback(
    async (file: VoiceNoteFile) => {
      setVoiceSheetOpen(false)
      const validation = validateVoiceNoteFile({ size: file.size, durationMs: file.durationMs })
      if (!validation.ok) {
        toast.show({ title: "Voice note tidak valid", description: voiceNoteValidationMessage(validation.reason), tone: "danger" })
        return
      }
      await enqueueAndUpload({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
      })
    },
    [toast.show, enqueueAndUpload],
  )

  const handleSend = useCallback(
    async (payload: ChatComposerPayload) => {
      if (!roomId || isChatCompleted) return
      const content = payload.content.trim()
      const ready = attachments.filter((a) => a.status !== "uploading" && a.status !== "error")
      if (!content && ready.length === 0) return
      if (attachments.some((a) => a.status === "uploading")) {
        toast.show({ title: "Lampiran masih diunggah", tone: "info" })
        return
      }
      // Optimistic message: tampilkan langsung agar tidak ada jeda kosong.
      // CN-015: sendStatus "sending" — bila gagal jadi "failed" + bisa retry.
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const optimisticMsg: ChatMessage = {
        id: tempId,
        text: content || undefined,
        messageType: messageTypeFor(
          ready.map(({ fileName, fileUrl, mimeType, fileSize, thumbnailUrl }) => ({
            fileName,
            fileUrl,
            mimeType,
            fileSize,
            thumbnailUrl,
          })),
        ),
        fromUser: true,
        attachments: ready.map(({ fileName, fileUrl, mimeType, fileSize, thumbnailUrl }) => ({
          fileName,
          fileUrl,
          mimeType,
          fileSize,
          thumbnailUrl,
        })),
        replyToId: payload.replyToId ?? null,
        // Kutipan langsung tampil di pesan optimistis (diganti objek asli
        // dari server setelah terkirim).
        replyTo:
          payload.replyToId && replyTarget && replyTarget.id === payload.replyToId
            ? {
                id: replyTarget.id,
                content: replyTarget.text ?? null,
                messageType: replyTarget.messageType,
                isDeleted: replyTarget.isDeleted ?? false,
                senderName: composerReplyTo?.senderName ?? null,
              }
            : null,
        createdAt: new Date().toISOString(),
        sendStatus: "sending",
        // Batch 43: chip ephemeral/view-once tampil di pesan optimistis.
        ephemeralTtlSeconds: ttlSeconds ?? undefined,
        viewOnce: viewOnceOn || undefined,
      }
      setMessages((prev) => [...prev, optimisticMsg])
      setSending(true)
      try {
        const dtoAttachments: ChatAttachmentDto[] = ready.map(
          ({ fileName, fileUrl, mimeType, fileSize, thumbnailUrl }) => ({
            fileName,
            fileUrl,
            mimeType,
            fileSize,
            thumbnailUrl,
          }),
        )
        const msg = await api.chat.sendChatMessage(roomId, {
          messageType: messageTypeFor(dtoAttachments),
          content: content || undefined,
          attachments: dtoAttachments.length ? dtoAttachments : undefined,
          replyToId: payload.replyToId,
          // Batch 43: mode pesan sementara + sekali-lihat untuk pesan
          // berikutnya. viewOnce one-shot — direset setelah kirim.
          ephemeralTtlSeconds: ttlSeconds ?? undefined,
          viewOnce: viewOnceOn || undefined,
        })
        // Ganti optimistic dengan pesan asli dari server. Cocokkan juga
        // berdasar id server: bila gema realtime tiba lebih dulu, entri
        // optimistis sudah diganti gema (fix duplikat 2026-09-28) — tanpa
        // ini pesan server akan ter-append dua kali.
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId || m.id === msg.id ? msg : m)),
        )
        mergeIncoming([msg], roomId)
        // Pengguna aktif → poll kembali cepat bila sedang idle.
        emptyPolls.current = 0
        setPollInterval(CHAT_POLL_MS)
        setDraft("")
        clearChatDraft(roomId)
        setAttachments([])
        setReplyTarget(null)
        // Hentikan indikator mengetik setelah pesan terkirim.
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingActive.current = false
        sendTypingRealtime(false)
        // Batch 43: sekali-lihat = one-shot, selalu direset setelah kirim.
        if (viewOnceOn) setViewOnceOn(false)
        void refreshReadReceipts()
      } catch (err) {
        // CN-015: JANGAN hapus pesan — tandai gagal agar pengguna bisa retry.
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, sendStatus: "failed" as const } : m)),
        )
        // B07: simpan ke antrean persisten — status gagal selamat dari
        // refresh/restart, bisa kirim ulang atau hapus lokal.
        if (roomId) saveChatFailedMessage(roomId, toFailedChatMessage(optimisticMsg))
        toast.show({
          title: "Gagal mengirim pesan",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        setSending(false)
      }
    },
    [roomId, attachments, toast.show, mergeIncoming, replyTarget, composerReplyTo, ttlSeconds, viewOnceOn],
  )

  // Batch 43: kirim pesan khusus (lokasi, kartu produk) ────────────
  /**
   * Kirim pesan LOCATION — pola optimistic sama dengan handleSend:
   * pesan langsung tampil, gagal → status failed + bisa retry.
   */
  const sendLocation = useCallback(
    async (payload: { latitude: number; longitude: number; label?: string }) => {
      if (!roomId || isChatCompleted) return
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const optimisticMsg: ChatMessage = {
        id: tempId,
        messageType: "LOCATION",
        fromUser: true,
        location: { lat: payload.latitude, lng: payload.longitude, label: payload.label },
        createdAt: new Date().toISOString(),
        sendStatus: "sending",
        ephemeralTtlSeconds: ttlSeconds ?? undefined,
        viewOnce: viewOnceOn || undefined,
      }
      setMessages((prev) => [...prev, optimisticMsg])
      try {
        const msg = await api.chat.sendChatMessage(roomId, {
          messageType: "LOCATION",
          location: { lat: payload.latitude, lng: payload.longitude, label: payload.label },
          ephemeralTtlSeconds: ttlSeconds ?? undefined,
          viewOnce: viewOnceOn || undefined,
        })
        setMessages((prev) => prev.map((m) => (m.id === tempId || m.id === msg.id ? msg : m)))
        mergeIncoming([msg], roomId)
        if (viewOnceOn) setViewOnceOn(false)
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, sendStatus: "failed" as const } : m)),
        )
        // B07: antrean persisten — selamat dari refresh/restart.
        if (roomId) saveChatFailedMessage(roomId, toFailedChatMessage(optimisticMsg))
        toast.show({
          title: "Gagal mengirim lokasi",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      }
    },
    [roomId, isChatCompleted, ttlSeconds, viewOnceOn, mergeIncoming, toast.show],
  )

  /** Kirim kartu produk (backend membekukan snapshot etalase). */
  const sendProductCard = useCallback(
    async (item: ShowcaseItem) => {
      if (!roomId || isChatCompleted) return
      try {
        const msg = await api.chat.sendChatMessage(roomId, {
          messageType: "PRODUCT_CARD",
          showcaseId: item.id,
          ephemeralTtlSeconds: ttlSeconds ?? undefined,
          viewOnce: viewOnceOn || undefined,
        })
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
        mergeIncoming([msg], roomId)
        if (viewOnceOn) setViewOnceOn(false)
      } catch (err) {
        toast.show({
          title: "Gagal mengirim kartu produk",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      }
    },
    [roomId, isChatCompleted, ttlSeconds, viewOnceOn, mergeIncoming, toast.show],
  )

  // ── Batch 43: pesan berbintang — tandai bubble dari GET /starred ────
  useEffect(() => {
    if (!roomId) return
    let alive = true
    listStarredMessages(roomId)
      .then((starred) => {
        if (!alive) return
        const ids = new Set(starred.map((s) => s.id))
        setMessages((prev) => prev.map((m) => ({ ...m, isStarred: ids.has(m.id) })))
      })
      .catch(() => undefined) // non-kritis: ikon bintang tetap bisa di-toggle manual
    return () => {
      alive = false
    }
  }, [roomId])

  /** Toggle star pesan-pesan yang dipilih (mode pilih). */
  // ── Batch 43: ekspor riwayat chat (TXT) ─────────────────────────────
  const handleExport = useCallback(async () => {
    if (!roomId) return
    try {
      const { filename } = await exportAndSaveChatRoom(roomId)
      toast.show({
        title: "Riwayat chat diekspor",
        description: filename,
        tone: "success",
        duration: 3000,
      })
    } catch (err) {
      toast.show({
        title: "Gagal mengekspor chat",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    }
  }, [roomId, toast.show])

  /**
   * CN-015: kirim ulang pesan yang gagal. Memakai konten & lampiran yang
   * tersimpan di pesan optimistis; ID temp diganti agar tidak bentrok.
   */
  const handleRetry = useCallback(
    async (failed: ChatMessage) => {
      if (!roomId || failed.sendStatus !== "failed") return
      const tempId = failed.id
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, sendStatus: "sending" as const } : m)),
      )
      try {
        // messageType ChatMessage bisa string bebas; DTO hanya terima union —
        // validasi defensif, fallback TEXT.
        const messageType = ["TEXT", "IMAGE", "FILE", "VIDEO", "VOICE"].includes(failed.messageType)
          ? (failed.messageType as "TEXT" | "IMAGE" | "FILE" | "VIDEO" | "VOICE")
          : "TEXT"
        const msg = await api.chat.sendChatMessage(roomId, {
          messageType,
          content: failed.text || undefined,
          attachments: failed.attachments?.length
            ? failed.attachments.map(({ fileName, fileUrl, mimeType, fileSize, thumbnailUrl }) => ({
                fileName,
                fileUrl,
                mimeType,
                fileSize,
                thumbnailUrl,
              }))
            : undefined,
          replyToId: failed.replyToId ?? undefined,
        })
        // Samakan dengan jalur kirim: cocokkan id temp ATAU id server
        // (gema bisa tiba sebelum POST resolve — fix duplikat 2026-09-28).
        setMessages((prev) => prev.map((m) => (m.id === tempId || m.id === msg.id ? msg : m)))
        // B07: retry sukses → keluar dari antrean persisten.
        removeChatFailedMessage(roomId, tempId)
        mergeIncoming([msg], roomId)
        emptyPolls.current = 0
        setPollInterval(CHAT_POLL_MS)
        void refreshReadReceipts()
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, sendStatus: "failed" as const } : m)),
        )
        toast.show({
          title: "Gagal mengirim pesan",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      }
    },
    [roomId, mergeIncoming, toast.show],
  )

  // ── Mode pilih: masuk / keluar / toggle ────────────────────────────────
  const selecting = selectedIds.size > 0
  /**
   * Popover reaksi MENGAMBANG (revisi 2026-09-27): dibuka oleh tekan lama
   * pada bubble (`onLongPressAt` → jangkar posisi), menggantikan baris emoji
   * penuh di header mode-pilih. Backdrop transparan — tidak menutupi layar.
   */
  const [reactionPopover, setReactionPopover] = useState<{
    message: ChatMessage
    anchor: ChatBubbleAnchor
  } | null>(null)
  const selectedMessages = useMemo(
    () => messages.filter((m) => selectedIds.has(m.id)),
    [messages, selectedIds],
  )
  /** Aksi per-pesan (reaksi, pin, edit) hanya sah untuk satu pilihan. */
  const singleSelected = selectedMessages.length === 1 ? (selectedMessages[0] ?? null) : null

  const exitSelect = useCallback(() => {
    setSelectedIds(new Set())
    // Popover reaksi selalu ikut tertutup saat mode pilih berakhir.
    setReactionPopover(null)
  }, [])

  /**
   * Batch 43: toggle star pesan-pesan yang dipilih (mode pilih).
   * Dideklarasikan setelah exitSelect/selectedMessages (aturan context).
   */
  const handleToggleStarSelected = useCallback(async () => {
    if (!roomId || selectedMessages.length === 0) return
    const anyUnstarred = selectedMessages.some((m) => !m.isStarred)
    const op = anyUnstarred ? starChatMessage : unstarChatMessage
    try {
      await Promise.all(selectedMessages.map((m) => op(roomId, m.id)))
      setMessages((prev) =>
        prev.map((m) =>
          selectedIds.has(m.id) ? { ...m, isStarred: anyUnstarred } : m,
        ),
      )
      toast.show({
        title: anyUnstarred ? "Pesan dibintangi" : "Bintang dihapus",
        tone: "success",
        duration: 2000,
      })
    } catch (err) {
      toast.show({
        title: anyUnstarred ? "Gagal membintangi" : "Gagal menghapus bintang",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      exitSelect()
    }
  }, [roomId, selectedMessages, selectedIds, toast.show, exitSelect])

  const enterSelect = useCallback((id: string) => {
    haptic("select")
    setSelectedIds(new Set([id]))
  }, [])

  const toggleSelect = useCallback((id: string) => {
    haptic("select")
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  /**
   * Hapus semua pesan terpilih milik sendiri. Backend hanya punya DELETE per
   * pesan, jadi dipakai `Promise.allSettled`: satu pesan yang gagal (mis.
   * sudah dihapus lawan bicara) tidak membatalkan sisanya, dan kegagalan
   * dilaporkan sekali — bukan satu toast per pesan.
   */
  const handleDeleteSelected = useCallback(async () => {
    if (!roomId) return
    const targets = selectedMessages.filter((m) => m.fromUser)
    if (targets.length === 0) {
      setDeleteOpen(false)
      exitSelect()
      return
    }
    setDeleting(true)
    const results = await Promise.allSettled(
      targets.map((m) => api.chat.deleteChatMessage(roomId, m.id)),
    )
    const removed = new Set<string>()
    let firstError: unknown
    results.forEach((res, i) => {
      const target = targets[i]
      if (!target) return
      if (res.status === "fulfilled") removed.add(target.id)
      else firstError ??= res.reason
    })
    if (removed.size > 0) {
      setMessages((prev) => prev.filter((m) => !removed.has(m.id)))
      haptic("success")
      toast.show({
        title: removed.size === 1 ? "Pesan dihapus" : `${removed.size} pesan dihapus`,
        tone: "success",
        duration: 2500,
      })
    }
    if (firstError) {
      toast.show({
        title: "Gagal menghapus pesan",
        description: isApiError(firstError) ? userMessage(firstError) : undefined,
        tone: "danger",
      })
    }
    setDeleting(false)
    setDeleteOpen(false)
    exitSelect()
  }, [exitSelect, roomId, selectedMessages, toast.show])

  /** Salin semua pesan terpilih yang punya teks (dipisah baris kosong). */
  const handleCopySelected = useCallback(() => {
    const text = selectedMessages
      .map((m) => m.text?.trim())
      .filter((t): t is string => !!t)
      .join("\n\n")
    if (text) void copy(text)
    exitSelect()
  }, [copy, exitSelect, selectedMessages])

  /** Ganti daftar reaksi satu pesan di state thread. */
  const patchMessage = useCallback((messageId: string, patch: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? patch(m) : m)))
  }, [])

  // ── Reaksi emoji: ketuk chip/aksi → tambah, ketuk lagi → tarik ──
  const handleReact = useCallback(
    async (message: ChatMessage, emoji: string) => {
      if (!roomId) return
      const mine = (message.reactions ?? []).find(
        (r) => r.emoji === emoji && r.reactedByMe,
      )
      const before = message.reactions ?? []
      const optimistic: ChatReaction[] = [...before]
      if (mine) {
        // C-09 (audit): melepas reaksi sendiri dengan count===1 harus
        // menghasilkan 0 agar filter di bawah membuang chip-nya — sebelumnya
        // Math.max(1, …) menahan chip "hantu" sampai respons tiba (flicker).
        const idx = optimistic.findIndex((r) => r.emoji === emoji)
        optimistic[idx] = { ...optimistic[idx], count: optimistic[idx].count - 1, reactedByMe: false }
      } else {
        const idx = optimistic.findIndex((r) => r.emoji === emoji)
        if (idx >= 0) optimistic[idx] = { ...optimistic[idx], count: optimistic[idx].count + 1, reactedByMe: true }
        else optimistic.push({ emoji, count: 1, reactedByMe: true })
      }
      patchMessage(message.id, (m) => ({ ...m, reactions: optimistic.filter((r) => r.count > 0) }))
      try {
        const payload = mine
          ? await removeReaction(roomId, message.id, emoji)
          : await addReaction(roomId, message.id, emoji)
        patchMessage(message.id, (m) => ({ ...m, reactions: payload.reactions }))
      } catch (err) {
        // Gagal → kembalikan state sebelum optimistik (poll tidak
        // memperbarui reaksi pesan yang sudah ada di thread).
        patchMessage(message.id, (m) => ({ ...m, reactions: before }))
        toast.show({
          title: "Gagal memperbarui reaksi",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      }
    },
    [roomId, patchMessage, toast.show],
  )

  // ── Pin / unpin ──
  const handleTogglePin = useCallback(
    async (message: ChatMessage) => {
      if (!roomId) return
      try {
        if (message.isPinned) {
          await unpinChatMessage(roomId, message.id)
          patchMessage(message.id, (m) => ({ ...m, isPinned: false }))
          toast.show({ title: "Pesan dilepas dari pin", tone: "success", duration: 2500 })
        } else {
          await pinChatMessage(roomId, message.id)
          patchMessage(message.id, (m) => ({ ...m, isPinned: true }))
          toast.show({ title: "Pesan dipin", tone: "success", duration: 2500 })
        }
        void refreshPinned()
      } catch (err) {
        toast.show({
          title: message.isPinned ? "Gagal melepas pin" : "Gagal mempin pesan",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      }
    },
    [roomId, patchMessage, refreshPinned, toast.show],
  )

  // ── Edit pesan teks milik sendiri (draft + simpan di <ChatEditSheet>) ──
  const handleEdited = useCallback(
    (messageId: string, text: string, editedAt: string) => {
      patchMessage(messageId, (m) => ({ ...m, text, isEdited: true, editedAt }))
    },
    [patchMessage],
  )

  // ── Forward: daftar ruang, paginasi, dan pengirimannya di
  // <ChatForwardSheet>. Layar hanya menyimpan pesan yang dipilih. ──
  const forwardOpen = forwardTarget != null

  const openForward = useCallback((targets: ChatMessage[]) => {
    if (!roomId || targets.length === 0) return
    setForwardTarget(targets)
  }, [roomId])

  const closeForward = useCallback(() => setForwardTarget(null), [])

  const openSearch = useCallback(() => setSearchOpen(true), [])

  // ── Typing indicator: kirim saat draft berubah, hentikan 3 dtk setelah diam ──
  const notifyTyping = useCallback(() => {
    if (!roomId) return
    if (!typingActive.current) {
      typingActive.current = true
      sendTypingRealtime(true)
    }
    // F-07: pengguna sedang mengetik → percakapan hidup, poll cepat.
    emptyPolls.current = 0
    setPollInterval(CHAT_POLL_MS)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      typingActive.current = false
      sendTypingRealtime(false)
    }, 3000)
  }, [roomId, sendTypingRealtime])

  useEffect(() => {
    if (draft.trim()) notifyTyping()
  }, [draft, notifyTyping])

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current)
      // C-08 (audit): keluar ruang tanpa menghentikan indikator mengetik
      // membuat lawan bicara melihat "sedang mengetik…" tersisa sampai TTL
      // server. Fire-and-forget di cleanup (ref: roomId bisa sudah berganti).
      if (typingActive.current && roomIdRef.current) {
        void sendChatTyping(roomIdRef.current, false).catch((err) => logWarn("chat:typing-unmount", err))
        typingActive.current = false
      }
    }
  }, [])

  const openAttachment = useCallback((a: ChatAttachmentDto) => {
    if (isImageMedia({ url: a.fileUrl, mimeType: a.mimeType })) {
      // Kumpulkan SEMUA gambar di pesan yang sama supaya bisa swipe antar
      // foto di viewer (bukan satu gambar saja).
      const owner = messages.find((m) =>
        m.attachments?.some((att) => att === a || att.fileUrl === a.fileUrl),
      )
      const candidates = owner?.attachments?.length ? owner.attachments : [a]
      const imgs = candidates.filter((att) =>
        isImageMedia({ url: att.fileUrl, mimeType: att.mimeType }),
      )
      const at = Math.max(0, imgs.findIndex((att) => att === a || att.fileUrl === a.fileUrl))
      setImageViewer({
        images: imgs.map((att) => ({ url: att.fileUrl, alt: att.fileName ?? undefined })),
        index: at,
      })
      return
    }
    setViewerItem({ url: a.fileUrl, mimeType: a.mimeType, title: a.fileName, fileName: a.fileName })
  }, [messages])

  const counterpartUsername = room?.counterpart?.username
  const composerAttachments = attachments

  // ── Header ruang: identitas + status + order id ────────────────────────
  /**
   * Baris status di bawah nama. "mengetik…" menang atas online (lawan bicara
   * yang sedang mengetik adalah informasi paling hidup).
   *
   * B11: label kehadiran tidak boleh menyesatkan — data basi (atau belum
   * ada) jatuh ke fallback netral (baris status dikosongkan), BUKAN
   * "Online"/"Offline"/waktu spesifik yang mengklaim kepastian. Ambang di
   * lib/chat-presence-label: online basi > 60 dtk, last-seen basi > 5 mnt.
   */
  const presenceStatus = presenceLabel(presence, presenceFetchedAt)
  const statusText = counterpartTyping
    ? "mengetik…"
    : presenceStatus.kind === "online"
      ? "Online"
      : presenceStatus.kind === "last-seen"
        ? // UI-C003: cap waktu ringkas ("Kemarin"), bukan datetime penuh yang
          // memadati baris status 2-baris di bawah nama.
          `Terakhir dilihat ${formatChatListTime(presenceStatus.at)}`
        : presenceStatus.kind === "offline"
          ? "Offline"
          : undefined

  // ── Aksi mode pilih pesan (ubin ikon+label di <SelectionBar>) ──────────
  const selectionActions: SelectionAction[] = useMemo(() => {
    const allMine = selectedMessages.length > 0 && selectedMessages.every((m) => m.fromUser)
    const anyText = selectedMessages.some((m) => !!m.text?.trim())
    const editable =
      singleSelected != null &&
      singleSelected.fromUser &&
      singleSelected.messageType === "TEXT" &&
      !!singleSelected.text
    const actions: SelectionAction[] = []
    if (singleSelected) {
      const target = singleSelected
      actions.push({
        key: "reply",
        label: "Balas",
        icon: ArrowBendUpLeft,
        accessibilityHint: "Membalas pesan yang dipilih",
        onPress: () => {
          exitSelect()
          setReplyTarget(target)
        },
      })
    }
    if (singleSelected) {
      const target = singleSelected
      actions.push({
        key: "pin",
        label: target.isPinned ? "Lepas pin" : "Pin",
        selected: target.isPinned, // H-12: keadaan diumumkan, bukan hanya aksinya
        icon: PushPin,
        onPress: () => {
          exitSelect()
          void handleTogglePin(target)
        },
      })
    }
    actions.push({
      key: "copy",
      label: "Salin",
      icon: Copy,
      disabled: !anyText,
      accessibilityHint: "Menyalin teks pesan yang dipilih",
      onPress: handleCopySelected,
    })
    // Batch 43: terjemahkan satu pesan teks (POST /translate per pesan).
    if (singleSelected && singleSelected.text?.trim()) {
      const target = singleSelected
      actions.push({
        key: "translate",
        label: "Terjemahkan",
        icon: Translate,
        accessibilityHint: "Menerjemahkan pesan yang dipilih",
        onPress: () => {
          exitSelect()
          setTranslateTarget(target)
        },
      })
    }
    // Batch 43: bintang / batal bintang (bisa multi).
    if (selectedMessages.length > 0) {
      const anyUnstarred = selectedMessages.some((m) => !m.isStarred)
      actions.push({
        key: "star",
        label: anyUnstarred ? "Bintangi" : "Batal bintang",
        icon: Star,
        accessibilityHint: anyUnstarred
          ? "Membintangi pesan yang dipilih"
          : "Menghapus bintang pesan yang dipilih",
        onPress: () => void handleToggleStarSelected(),
      })
    }
    actions.push({
      key: "forward",
      label: "Teruskan",
      icon: PaperPlaneRight,
      onPress: () => {
        const targets = selectedMessages
        exitSelect()
        openForward(targets)
      },
    })
    if (editable && singleSelected) {
      const target = singleSelected
      actions.push({
        key: "edit",
        label: "Edit",
        icon: PencilSimple,
        onPress: () => {
          exitSelect()
          setEditTarget(target)
        },
      })
    }
    if (allMine) {
      actions.push({
        key: "delete",
        label: "Hapus",
        icon: Trash,
        tone: "danger",
        onPress: () => setDeleteOpen(true),
      })
    }
    return actions
  }, [
    exitSelect,
    handleCopySelected,
    handleTogglePin,
    handleToggleStarSelected,
    openForward,
    selectedMessages,
    singleSelected,
  ])

  /** Jumlah pesan terpilih yang benar-benar bisa dihapus (milik sendiri). */
  const deletableCount = selectedMessages.filter((m) => m.fromUser).length

  const deleteCopy = {
    title: deletableCount === 1 ? "Hapus pesan ini?" : "Hapus pesan yang dipilih?",
    description:
      deletableCount === 1
        ? "Pesan akan dihapus untuk semua peserta ruang."
        : `${deletableCount} pesan akan dihapus untuk semua peserta ruang.`,
  }

  const jumpToLatest = useCallback(() => {
    atBottomRef.current = true
    setAtBottom(true)
    // B03: pesan baru kini terlihat → badge di-reset.
    setNewWhileAway(0)
    scrollRef.current?.scrollToEnd({ animated: true })
  }, [])

  /** Pesan terpin terbaru — yang ditampilkan baris pin di atas thread. */
  const latestPinned = useMemo(() => {
    if (pinned.length === 0) return null
    return pinned.reduce((latest, m) =>
      new Date(m.createdAt).getTime() > new Date(latest.createdAt).getTime() ? m : latest,
    )
  }, [pinned])

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
        // UI-C001: room 404 (roomGone) menyembunyikan footer — composer yang
        // tetap tampil di bawah EmptyState "tidak tersedia" mengundang kirim
        // ke ruang yang sudah tidak ada (selalu gagal + retry yang sia-sia).
        error || roomGone || !roomId ? undefined : (
        /*
          Footer dipecah ke <ChatRoomFooter> (2026-09-26): layar ini
          menyentuh plafon G-11, dan blok ini murni penyusunan — tidak
          memakai state ruang selain yang dilewatkan sebagai prop.
        */
        <ChatRoomFooter
          showJumpToLatest={atBottom === false && messages.length > 0}
          onJumpToLatest={jumpToLatest}
          newMessageCount={newWhileAway}
          completed={isChatCompleted}
          closedNotice={closedNoticeText}
          orderId={room?.orderId}
          onOpenOrder={(id) => router.push(ROUTES.orderDetail(id))}
          draft={draft}
          onDraftChange={handleDraftChange}
          onSend={(p) => void handleSend(p)}
          attachments={composerAttachments}
          onAttach={() => setAttachSheetOpen(true)}
          onMicPress={() => setVoiceSheetOpen(true)}
          onRemoveAttachment={(localId) => {
            // B04: menghapus chip saat upload berjalan ikut membatalkan
            // request-nya — bukan sekadar menyembunyikan chip.
            uploadControllersRef.current.get(localId)?.abort()
            setAttachments((prev) => prev.filter((a) => a.localId !== localId))
          }}
          onCancelAttachment={handleCancelAttachment}
          onRetryAttachment={(localId) => {
            const a = attachments.find((x) => x.localId === localId)
            if (a?.picked) void uploadAttachment(localId, a.picked)
          }}
          sending={sending}
          disabled={loading}
          replyTo={composerReplyTo}
          onCancelReply={() => setReplyTarget(null)}
          // Batch 43: strip mode pesan sementara + toolbar format teks.
          ephemeralLabel={ttlSeconds != null ? ephemeralDurationLabel(ttlSeconds) : null}
          viewOnceActive={viewOnceOn}
          onOpenEphemeral={() => setEphemeralSheetOpen(true)}
          onClearEphemeral={() => {
            setTtlSeconds(null)
            setViewOnceOn(false)
          }}
          formatBar
        />
        )
      }
    >
      {/* Header: mode pilih mengganti identitas ruang selama pilihan aktif —
          persis pola layar Notifikasi, tanpa ActionSheet/BottomSheet. */}
      {selecting ? (
        <SelectionBar
          // translate(): template literal di atribut JSX tidak terbaca
          // generator katalog i18n — copy dinamis wajib dibungkus.
          title={translate(`${selectedIds.size} pesan dipilih`)}
          actions={selectionActions}
          onClose={exitSelect}
          closeLabel="Keluar dari mode pilih pesan"
          // Revisi 2026-09-27: pemilih emoji TIDAK lagi satu baris penuh di
          // header (menutupi konten di atas) — ia <ChatReactionPopover> yang
          // mengambang di dekat bubble yang ditekan lama (dirender di bawah).
        />
      ) : (
        <ChatRoomHeader
          name={counterpartName ?? "Percakapan"}
          avatar={
            room?.counterpart?.avatarUrl ? { uri: room.counterpart.avatarUrl } : undefined
          }
          sealTier={room?.counterpart?.sealTier ?? null}
          status={statusText}
          // B11: titik hijau "online" hanya bila datanya segar — data basi
          // tidak boleh mengklaim kepastian.
          online={presenceStatus.kind === "online"}
          loading={loading && !room}
          orderId={room?.orderId ? truncateMiddle(room.orderId, 6, 4) : undefined}
          onOrderPress={
            room?.orderId ? () => router.push(ROUTES.orderDetail(room.orderId!)) : undefined
          }
          onProfilePress={
            counterpartUsername
              ? () => router.push(ROUTES.userProfile(counterpartUsername))
              : undefined
          }
          onBack={() => (router.canGoBack() ? router.back() : router.replace(ROUTES.home))}
          onMenuPress={() => setRoomMenuOpen(true)}
          // Pencarian inline client-side (2026-09-28): ikon kaca pembesar di
          // kiri menu — membuka bar cari di bawah header (highlight +
          // next/prev di pesan yang sudah dimuat, tanpa endpoint).
          extra={
            <IconButton
              icon={MagnifyingGlass}
              variant="ghost"
              size="sm"
              accessibilityLabel={translate("Cari di percakapan")}
              onPress={() => setInlineSearchOpen(true)}
            />
          }
        />
      )}

      {/* Bar pencarian inline: di bawah header, di atas thread. */}
      {!selecting && inlineSearchOpen ? (
        <ChatInlineSearchBar
          query={inlineQuery}
          onQueryChange={setInlineQuery}
          matches={inlineMatches}
          activeIndex={inlineIndex}
          onPrev={() => stepInlineMatch(-1)}
          onNext={() => stepInlineMatch(1)}
          onClose={closeInlineSearch}
        />
      ) : null}
      {/* B12: pratinjau hasil aktif — cuplikan dengan konteks sebelum/sesudah
          keyword; ketuk untuk melompat ke pesannya di thread. */}
      {!selecting && inlineSearchOpen && inlineActiveId ? (
        <ChatSearchSnippet
          message={inlineActiveMessage}
          query={inlineQuery}
          counterpartName={counterpartName}
          timeLabel={inlineActiveMessage ? formatTime(inlineActiveMessage.createdAt) : undefined}
          onPress={() => jumpToInlineMatch(inlineActiveId)}
        />
      ) : null}

      {/* Baris pesan terpin: SATU baris ringkas (bukan deretan chip scroll).
          Ketuk = lompat ke pesannya; tekan lama = lepas pin. Tingginya diukur
          lewat onLayout untuk menjaga jangkar scroll — lihat efek di atas. */}
      {latestPinned ? (
        <ChatPinnedBar
          message={latestPinned}
          count={pinned.length}
          onPress={(m) => jumpToMessage(m.id)}
          onUnpin={(m) => void handleTogglePin(m)}
          onLayout={(e) => setPinnedBarHeight(e.nativeEvent.layout.height)}
        />
      ) : null}
      {/* F-06 (audit): FlatList menggantikan ScrollView + messages.map —
          thread panjang (ratusan bubble bergambar) dulu ter-mount penuh.
          Bubble TIDAK dianimasikan per-item: auto-scroll ke pesan terbaru +
          pesan baru tiap poll akan jitter bila posisi divisualkan bertahap. */}
      <FlatList
        ref={scrollRef}
        className="flex-1"
        removeClippedSubviews={false}
        // B10: baris campuran (hari/pemisah/pesan); baris "day" sticky.
        data={threadRows}
        keyExtractor={(row) => row.key}
        stickyHeaderIndices={stickyDayIndices}
        // Revisi 2026-09-27: gutter horizontal HANYA dari baris bubble
        // (`px-5` di <ChatMessageBubble>) — padding di sini DOBEL (40px)
        // dan membuat inset kiri/kanan tidak proporsional.
        contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[4], flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleScroll}
        scrollEventThrottle={SCROLL_EVENT_THROTTLE}
        ListHeaderComponent={
          messages.length > 0 ? (
            // px-5: kompensasi gutter list yang dihapus (lihat atas) —
            // tombol "Muat pesan sebelumnya" tetap sejajar dengan bubble.
            <View style={{ paddingTop: tokens.space[3] }} className="px-5">
              <LoadMore
                status={olderStatus}
                onLoadMore={() => void loadOlder()}
                hideEnd
                idleLabel="Muat pesan sebelumnya"
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View className="pt-3">
              <ListLoading />
            </View>
          ) : roomGone ? (
            <EmptyState
              icon={Chats}
              title="Percakapan tidak tersedia"
              description="Ruang chat ini telah dihapus atau dinonaktifkan."
              action={
                <Button onPress={() => router.replace(ROUTES.chat)}>
                  Kembali ke daftar chat
                </Button>
              }
            />
          ) : error ? (
            <ErrorState
              title="Gagal memuat"
              description={error}
              onRetry={() => void fetchMessages()}
            />
          ) : (
            <EmptyState
              icon={Chats}
              title="Belum ada pesan"
              description="Mulai percakapan Anda."
            />
          )
        }
        renderItem={({ item: row }) => {
          // B10: pemisah hari sebagai baris sticky (bukan di dalam row).
          if (row.kind === "day") {
            return <ChatDaySeparator label={row.label} />
          }
          // B02: pemisah "Belum dibaca" — ketuk = kembali ke titik itu.
          if (row.kind === "unread") {
            return (
              <ChatUnreadSeparator count={row.count} onPress={() => jumpToMessage(row.anchorId)} />
            )
          }
          const m = row.message
          const index = row.index
          return (
            <ChatMessageRow
              message={m}
              previous={index > 0 ? visibleMessages[index - 1] : undefined}
              // Pesan tepat di bawahnya — penentu "bubble terakhir grup menit"
              // (jam hanya tampil di situ, ala WhatsApp).
              next={index < visibleMessages.length - 1 ? visibleMessages[index + 1] : undefined}
              // B10: pemisah hari sudah jadi baris sticky tersendiri.
              hideDaySeparator
              // B09: sorot pesan asal balasan + navigasi konteks kutipan.
              highlighted={highlightedId === m.id}
              onQuotePress={handleQuotePress}
            selecting={selecting}
            selected={selectedIds.has(m.id)}
            readByCounterpart={readByCounterpart.has(m.id)}
            // Foto + nama lawan bicara untuk gelembung masuk (2026-09-26).
            // Revisi 2026-09-27 (UI polish): sealTier ikut diteruskan agar
            // seal verifikasi tampil di samping nama pengirim bubble.
            // Revisi 2026-09-28 (produk): DM 1:1 → disembunyikan total
            // (showSenderIdentity=false); ruang transaksi/grup → tetap tampil.
            counterpart={{
              name: counterpartName,
              avatarUrl: room?.counterpart?.avatarUrl,
              sealTier: room?.counterpart?.sealTier ?? null,
            }}
            showSenderIdentity={showPeerIdentity}
            // Swipe kanan bubble = jalan pintas balas (2026-09-28).
            // Tekan lama "Balas" di SelectionBar TETAP ADA — gesture ini
            // hanya memanggil setReplyTarget yang sama. Nonaktif saat mode
            // pilih agar tidak bentrok dengan toggle pilihan.
            onSwipeReply={selecting ? undefined : (m) => setReplyTarget(m)}
            // Revisi 2026-09-27: KETUKAN bubble teks = NO-OP di luar mode
            // pilih (tidak membuka apa pun); saat mode pilih aktif ketukan
            // men-toggle pilihan. Aksi (menu/reaksi) HANYA lewat tekan lama
            // → masuk mode pilih + popover reaksi mengambang di dekat bubble.
            onPress={(target) => {
              if (selecting) toggleSelect(target.id)
            }}
            onLongPress={(target, anchor) => {
              if (!selecting) enterSelect(target.id)
              setReactionPopover({ message: target, anchor })
            }}
            onReact={(target, emoji) => void handleReact(target, emoji)}
            onAttachmentPress={openAttachment}
            // Batch 43: hasil terjemahan per pesan + tombol Beli kartu produk.
            // ChatTranslation (translatedText) → prop row ({ text, … }).
            translation={
              translations[m.id]
                ? {
                    text: translations[m.id].translatedText,
                    sourceLang: translations[m.id].sourceLang,
                    targetLang: translations[m.id].targetLang,
                  }
                : undefined
            }
            onBuyProductCard={
              isSelfChat
                ? undefined
                : (card) => {
                    setCreateOrderProduct(card)
                    setCreateOrderSheetOpen(true)
                  }
            }
            // CN-015: kirim ulang pesan yang gagal.
            onRetry={(target) => void handleRetry(target)}
            // Pencarian inline: sorot kata kunci; hasil aktif lebih tegas.
            searchHighlight={
              inlineSearchOpen && inlineMatchIds.has(m.id)
                ? { query: inlineQuery, focused: m.id === inlineActiveId }
                : undefined
            }
            />
          )
        }}
        // Scroll ke puncak = muat riwayat lebih lama (tombol eksplisit tetap
        // ada di header list untuk status error).
        onStartReached={() => {
          if (olderStatus === "idle" && messages.length > 0) void loadOlder()
        }}
        onStartReachedThreshold={120}
        onScrollToIndexFailed={(info) => {
          // Tinggi bubble variabel — perkirakan lewat averageItemLength
          // (dipakai lompat-ke-hasil-pencarian J-07).
          scrollRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true,
          })
        }}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={9}
      // removeClippedSubviews DIHAPUS (2026-09-23): sumber klasik baris/layar
      // blank saat scroll di Android — view terpotong tak selalu direstorasi.
      />

      <MediaViewer
        item={viewerItem}
        onClose={() => setViewerItem(null)}
        onOpenError={(msg) => toast.show({ title: msg, tone: "danger" })}
      />

      <ImageViewer
        visible={imageViewer != null}
        images={imageViewer?.images ?? []}
        index={imageViewer?.index ?? 0}
        onClose={() => setImageViewer(null)}
      />

      {/* Pemilih reaksi MENGAMBANG (revisi 2026-09-27): pil emoji di dekat
          bubble yang ditekan lama — bukan baris penuh di header. Backdrop
          transparan: tidak menutupi layar. Pilih → bereaksi + keluar mode
          pilih; ketuk di luar → tutup popover saja. */}
      <ChatReactionPopover
        target={reactionPopover}
        emojis={QUICK_REACTIONS}
        onPick={(emoji) => {
          const target = reactionPopover?.message
          setReactionPopover(null)
          if (target) {
            exitSelect()
            void handleReact(target, emoji)
          }
        }}
        onDismiss={() => setReactionPopover(null)}
      />

      {/* Menu ⋮ RUANG (bukan per pesan): lihat pesanan, cari pesan, profil
          lawan bicara, bisukan, arsipkan — mutasi ruangnya di dalam komponen. */}
      <ChatRoomMenu
        open={roomMenuOpen}
        room={room}
        counterpartUsername={counterpartUsername ?? undefined}
        onClose={() => setRoomMenuOpen(false)}
        onSearch={openSearch}
        onRoomChange={(patch) => setRoom((prev) => (prev ? { ...prev, ...patch } : prev))}
        // Batch 43 FE-CHAT.
        isSelfChat={isSelfChat}
        onExport={() => void handleExport()}
        onOpenStarred={() => setStarredOpen(true)}
        onOpenPolls={() => setPollsOpen(true)}
        onOpenCreateOrder={() => {
          setCreateOrderProduct(null)
          setCreateOrderSheetOpen(true)
        }}
        onOpenReport={() => setReportSheetOpen(true)}
      />

      {/* Edit pesan teks sendiri — draft + simpan di dalam komponen. */}
      <ChatEditSheet
        message={editTarget}
        roomId={roomId}
        onClose={() => setEditTarget(null)}
        onSaved={handleEdited}
      />

      {/* Teruskan ke percakapan lain — semua ruang, paginasi (C-10); bisa
          membawa lebih dari satu pesan sekaligus (mode pilih). */}
      <ChatForwardSheet
        open={forwardOpen}
        roomId={roomId}
        targets={forwardTarget ?? []}
        onClose={closeForward}
        onForwarded={() => {
          closeForward()
          exitSelect()
        }}
      />

      {/* Cari pesan dalam ruang (J-07): hasil yang termuat di thread
          dilompati via scrollToIndex, yang lebih tua diberi keterangan. */}
      <ChatSearchSheet
        open={searchOpen}
        roomId={roomId}
        counterpartName={counterpartName ?? undefined}
        onClose={() => setSearchOpen(false)}
        onJump={jumpToMessage}
      />

      {/* Copy dialog dipecah ke object literal: ternary/template di atribut
          JSX tidak terbaca generator katalog i18n, sedangkan properti objek
          (`title`, `description`) dibaca — jadi kedua varian ikut terkatalog
          dan bisa diterjemahkan. */}
      <Dialog
        title={deleteCopy.title}
        description={deleteCopy.description}
        visible={deleteOpen}
        destructive
        loading={deleting}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => void handleDeleteSelected()}
        onCancel={() => setDeleteOpen(false)}
        onRequestClose={() => setDeleteOpen(false)}
      />

      {/* Menu lampiran (+) composer: Gambar / Video / File / Voice Note
          + aksi batch 43 (lokasi, polling, kartu produk). */}
      <ChatAttachmentSheet
        visible={attachSheetOpen}
        onRequestClose={() => setAttachSheetOpen(false)}
        onPickImage={(quality) => void handlePickImage(quality)}
        onPickVideo={() => void handlePickVideo()}
        onPickFile={() => void handlePickFile()}
        onRecordVoice={() => {
          setAttachSheetOpen(false)
          setVoiceSheetOpen(true)
        }}
        extraActions={[
          {
            key: "location",
            label: "Lokasi",
            description: "Bagikan lokasi GPS saat ini",
            icon: MapPin,
            onPress: () => setLocationSheetOpen(true),
          },
          {
            key: "poll",
            label: "Polling",
            description: "Buat voting di percakapan ini",
            icon: ChartBar,
            onPress: () => setPollsOpen(true),
          },
          {
            key: "product",
            label: "Kartu produk",
            description: "Bagikan salah satu etalase Anda",
            icon: Storefront,
            onPress: () => setShowcasePickerOpen(true),
          },
        ]}
      />

      {/* ── Sheets batch 43 FE-CHAT ──────────────────────────────────── */}
      {/* Terjemah pesan (selection bar → sheet). */}
      <ChatTranslateSheet
        message={translateTarget}
        roomId={roomId}
        onRequestClose={() => setTranslateTarget(null)}
        onApply={(messageId, translation) => {
          setTranslations((prev) => ({ ...prev, [messageId]: translation }))
        }}
      />

      {/* Pesan berbintang di ruang ini. */}
      <ChatStarredSheet
        roomId={roomId}
        visible={starredOpen}
        onRequestClose={() => setStarredOpen(false)}
        onJumpToMessage={(id) => jumpToMessage(id)}
        onUnstarred={(id) =>
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isStarred: false } : m)))
        }
      />

      {/* Polling: list + buat + vote. */}
      <ChatPollsSheet
        roomId={roomId}
        visible={pollsOpen}
        onRequestClose={() => setPollsOpen(false)}
      />

      {/* Kirim lokasi GPS. */}
      <ChatLocationSheet
        visible={locationSheetOpen}
        onRequestClose={() => setLocationSheetOpen(false)}
        onSend={(loc) => void sendLocation({ latitude: loc.lat, longitude: loc.lng, label: loc.label })}
      />

      {/* Pesan sementara + sekali-lihat untuk pesan berikutnya. */}
      <ChatEphemeralSheet
        visible={ephemeralSheetOpen}
        currentSeconds={ttlSeconds ?? 0}
        viewOnce={viewOnceOn}
        onRequestClose={() => setEphemeralSheetOpen(false)}
        onSelect={(seconds) => setTtlSeconds(seconds > 0 ? seconds : null)}
        onViewOnceChange={(v) => setViewOnceOn(v)}
      />

      {/* Laporkan pesan / blokir lawan bicara (room-based, tanpa userId). */}
      <ChatReportSheet
        roomId={roomId}
        visible={reportSheetOpen}
        onRequestClose={() => setReportSheetOpen(false)}
        onOpenBlock={() => {
          setReportSheetOpen(false)
          setBlockDialogOpen(true)
        }}
      />
      <ChatBlockDialog
        visible={blockDialogOpen}
        roomId={roomId}
        counterpartName={counterpartName}
        onDismiss={() => setBlockDialogOpen(false)}
      />

      {/* Buat transaksi dari chat (escrow). */}
      <ChatCreateOrderSheet
        roomId={roomId}
        visible={createOrderSheetOpen}
        productCard={createOrderProduct}
        onRequestClose={() => {
          setCreateOrderSheetOpen(false)
          setCreateOrderProduct(null)
        }}
        onCreated={(created) => {
          setCreateOrderSheetOpen(false)
          setCreateOrderProduct(null)
          router.push(ROUTES.orderDetail(created.order.orderId))
        }}
      />

      {/* Pilih etalase → kirim kartu produk. */}
      <ChatShowcasePickerSheet
        visible={showcasePickerOpen}
        onRequestClose={() => setShowcasePickerOpen(false)}
        onPick={(item) => void sendProductCard(item)}
      />

      {/* Perekam voice note — hasil diantrekan ke unggahan ruang. */}
      <VoiceNoteRecorder
        visible={voiceSheetOpen}
        onRequestClose={() => setVoiceSheetOpen(false)}
        onRecorded={(file) => void handleVoiceRecorded(file)}
      />
    </Screen>
  )
}