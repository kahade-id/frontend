/**
 * Screen — Ruang Chat Detail.
 * GET  /v1/chat/rooms/{roomId}/messages   (kursor: cursor/limit/excludeIds)
 * POST /v1/chat/rooms/{roomId}/messages   (TEXT/IMAGE/FILE + attachments)
 * POST /v1/chat/rooms/{roomId}/upload     (multipart → ChatAttachmentDto)
 * POST /v1/chat/rooms/{roomId}/read
 * DELETE /v1/chat/rooms/{roomId}/messages/{messageId}
 *
 * Keputusan non-obvious:
 *   - Lampiran: tombol klip di ChatComposer → galeri → unggah ke endpoint
 *     upload ruang (bukan presigned umum, supaya file tercatat di ruang dan
 *     muncul di GET /attachments). Sambil diunggah status "uploading";
 *     gagal → "error" + coba lagi. Saat kirim, `messageType` = IMAGE bila
 *     semua lampiran gambar, FILE bila ada non-gambar, TEXT bila tanpa
 *     lampiran.
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
  FlatList,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { useLocalSearchParams, router } from "expo-router"

import {
  Chats,
  Copy,
  PaperPlaneRight,
  PencilSimple,
  PushPin,
  Trash,
} from "phosphor-react-native"

import { api, isApiError, userMessage } from "@/lib/api"
import { getOrder, type Order } from "@/lib/api/orders"
import { refreshUnreadCount } from "@/lib/unread-count"
import { usePolling } from "@/lib/use-polling"
import {
  CHAT_PAGE_SIZE,
  QUICK_REACTIONS,
  addReaction,
  getPinnedMessages,
  getReadReceipts,
  getRoomPresence,
  pinChatMessage,
  removeReaction,
  sendChatTyping,
  unpinChatMessage,
  type ChatMessage,
  type ChatPresence,
  type ChatReaction,
  type ChatRoom,
} from "@/lib/api/chat"
import type { ChatAttachmentDto, SendMessageDto } from "@/lib/api/types"
import { useCopy } from "@/lib/clipboard"
import { formatDateTime, truncateMiddle } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { logWarn } from "@/lib/telemetry"
import { pickImage, pickedImageToFormData, type PickedImage } from "@/lib/image-picker"
import { translate } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ChatEditSheet } from "@/components/ui/chat-edit-sheet"
import { ChatForwardSheet } from "@/components/ui/chat-forward-sheet"
import { ChatMessageRow } from "@/components/ui/chat-message-row"
import { ChatPinnedBar } from "@/components/ui/chat-pinned-bar"
import { ChatRoomHeader } from "@/components/ui/chat-room-header"
import { ChatRoomMenu } from "@/components/ui/chat-room-menu"
import { ChatSearchSheet } from "@/components/ui/chat-search-sheet"
import { type ChatComposerPayload, type ComposerAttachment } from "@/components/ui/chat-composer"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { LoadMore, type LoadMoreStatus } from "@/components/ui/load-more"
import { MediaViewer, type MediaViewerItem } from "@/components/ui/media-viewer"
import { ListLoading } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { ChatRoomFooter } from "@/components/ui/chat-room-footer"
import { SelectionBar, type SelectionAction } from "@/components/ui/selection-bar"
import { useToast } from "@/components/ui/toast"
import { isImageMime } from "@/lib/mime"


/** Lampiran composer + berkas lokal untuk unggah ulang bila gagal. */
type LocalAttachment = ComposerAttachment & { picked?: PickedImage }

/** Jarak poll pesan baru saat ruang AKTIF. Push tetap pemicu utama. */
const CHAT_POLL_MS = 8000
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
  return attachments.every(isImage) ? "IMAGE" : "FILE"
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
  const { roomId, title } = useLocalSearchParams<{ roomId: string; title?: string }>()
  const titleParam = typeof title === "string" && title.trim() ? title.trim() : undefined
  const toast = useToast()
  const { copy } = useCopy()

  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [olderStatus, setOlderStatus] = useState<LoadMoreStatus>("idle")
  const [draft, setDraft] = useState("")
  const [attachments, setAttachments] = useState<LocalAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const [viewerItem, setViewerItem] = useState<MediaViewerItem | null>(null)
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
  const [pinned, setPinned] = useState<ChatMessage[]>([])
  const [presence, setPresence] = useState<ChatPresence | null>(null)
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

  const fetchMessages = useCallback(async () => {
    if (!roomId) return
    initialRequest.current?.abort()
    const controller = new AbortController()
    initialRequest.current = controller
    setLoading(true)
    setError(null)
    try {
      const [page, rooms] = await Promise.all([
        api.chat.getChatMessages(roomId, { limit: CHAT_PAGE_SIZE }, controller.signal),
        api.chat.listChatRooms({ page: 1, limit: CHAT_PAGE_SIZE }, controller.signal).catch((err) => {
          logWarn("chat:rooms-lookup", err)
          return {
            data: [] as ChatRoom[],
            meta: { page: 1, limit: CHAT_PAGE_SIZE, totalPages: 1 },
          }
        }),
      ])
      if (controller.signal.aborted) return
      const items = sortByTime(page.items)
      setMessages(items)
      setNextCursor(
        page.nextCursor ?? (page.items.length >= CHAT_PAGE_SIZE ? (items[0]?.id ?? null) : null),
      )
      setOlderStatus(page.items.length < CHAT_PAGE_SIZE ? "end" : "idle")
      setRoom(rooms.data.find((r) => r.id === roomId) ?? null)
      await api.chat.markChatRoomRead(roomId).catch((err) => logWarn("chat:mark-read-open", err))
      // Ruang sudah dibuka dan ditandai terbaca → segarkan badge tab agar
      // angka unread turun segera, bukan menunggu poll 60 detik.
      void refreshUnreadCount()
    } catch (err) {
      if (!controller.signal.aborted) setError(userMessage(err))
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
    } catch (err) {
      if (signal?.aborted) return
      logWarn("chat:presence", err)
      setPresence(null)
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    void refreshReadReceipts()
    void refreshPinned()
    void refreshPresence()
  }, [roomId, refreshPresence, refreshPinned, refreshReadReceipts])
  usePolling(refreshPresence, PRESENCE_POLL_MS, Boolean(roomId))

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
      setMessages((prev) => {
        const known = new Map(prev.map((m) => [m.id, m]))
        const fresh = incoming.filter((m) => !known.has(m.id))
        added = fresh.length
        // C-07 (audit): pesan yang SUDAH ada di thread ikut disegarkan dari
        // data poll (reaksi, pin, edit, teks) — sebelumnya reaksi/read dari
        // lawan bicara tidak pernah muncul sampai keluar-masuk ruang.
        let changed = added > 0
        const patched = prev.map((m) => {
          const next = known.get(m.id) ? incoming.find((i) => i.id === m.id) : undefined
          if (!next) return m
          const same =
            next.isPinned === m.isPinned &&
            next.isEdited === m.isEdited &&
            next.text === m.text &&
            JSON.stringify(next.reactions ?? []) === JSON.stringify(m.reactions ?? [])
          if (same) return m
          changed = true
          return {
            ...m,
            text: next.text,
            isPinned: next.isPinned,
            isEdited: next.isEdited,
            editedAt: next.editedAt ?? m.editedAt,
            reactions: next.reactions,
          }
        })
        if (!changed) return prev
        // Pesan masuk dari lawan bicara → badge tab Notifikasi harus turun
        // segera (ruang terbuka = terbaca), bukan menunggu poll 60 detik.
        if (added > 0 && fresh.some((m) => !m.fromUser) && roomIdRef.current) {
          void api.chat
            .markChatRoomRead(roomIdRef.current)
            .catch((err) => logWarn("chat:mark-read", err))
          void refreshUnreadCount()
        }
        return sortByTime([...patched, ...fresh])
      })
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

  usePolling(pollNewMessages, pollInterval, Boolean(roomId) && !error && !loading)

  // ── Auto-scroll ke pesan terbaru ───────────────────────────────────────
  // Thread tumbuh ke bawah, tetapi ScrollView mulai di ATAS: membuka ruang
  // menampilkan pesan TERLAMA dari halaman terakhir dan pengguna harus
  // menggulir manual. Gulir ke ujung bawah hanya ketika id pesan TERAKHIR
  // berubah (muat awal, kirim, pesan masuk) — memuat pesan lama di atas
  // (LoadMore) tidak mengubah id terakhir sehingga posisi baca tidak lompat.
  // F-06 (audit): thread dirender <FlatList> (virtualisasi) — sebelumnya
  // ScrollView + messages.map menahan 200+ bubble ter-mount penuh dengan
  // gambar; memori & FPS jatuh di Android low-end.
  const scrollRef = useRef<FlatList<ChatMessage>>(null)
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
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
      const bottom =
        contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_BOTTOM_PX
      if (atBottomRef.current !== bottom) {
        atBottomRef.current = bottom
        setAtBottom(bottom)
      }
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
      const index = messages.findIndex((m) => m.id === messageId)
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
    [messages, toast.show],
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

  const uploadAttachment = useCallback(
    async (localId: string, picked: PickedImage) => {
      if (!roomId) return
      setAttachments((prev) =>
        prev.map((a) =>
          a.localId === localId ? { ...a, status: "uploading", progress: undefined } : a,
        ),
      )
      try {
        const form = await pickedImageToFormData(picked)
        const dto = await api.chat.uploadChatAttachment(roomId, form)
        setAttachments((prev) =>
          prev.map((a) =>
            a.localId === localId
              ? { ...a, ...dto, fileSize: dto.fileSize || picked.size, status: "idle", progress: 1 }
              : a,
          ),
        )
      } catch {
        setAttachments((prev) =>
          prev.map((a) => (a.localId === localId ? { ...a, status: "error" } : a)),
        )
      }
    },
    [roomId],
  )

  const handleAttach = useCallback(async () => {
    const picked = await pickImage()
    if (picked.status === "denied") {
      toast.show({ title: "Akses galeri ditolak", tone: "danger" })
      return
    }
    if (picked.status !== "picked") return
    const localId = `${Date.now()}-${picked.asset.name}`
    setAttachments((prev) => [
      ...prev,
      {
        localId,
        fileName: picked.asset.name,
        fileUrl: picked.asset.uri,
        mimeType: picked.asset.mimeType,
        fileSize: picked.asset.size,
        status: "uploading",
        picked: picked.asset,
      },
    ])
    await uploadAttachment(localId, picked.asset)
  }, [toast.show, uploadAttachment])

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
        })
        // C-01 (audit): append mentah bisa menghasilkan gelembung GANDA bila
        // poll 8 detik sudah lebih dulu memasukkan pesan yang sama (server
        // mengembalikan pesan sendiri di halaman terbaru). mergeIncoming
        // menyaring berdasarkan id.
        mergeIncoming([msg], roomId)
        // Pengguna aktif → poll kembali cepat bila sedang idle.
        emptyPolls.current = 0
        setPollInterval(CHAT_POLL_MS)
        setDraft("")
        setAttachments([])
        // Hentikan indikator mengetik setelah pesan terkirim.
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingActive.current = false
        void sendChatTyping(roomId, false).catch((err) => logWarn("chat:typing-stop", err))
        void refreshReadReceipts()
      } catch (err) {
        toast.show({
          title: "Gagal mengirim pesan",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        setSending(false)
      }
    },
    [roomId, attachments, toast.show, mergeIncoming],
  )

  // ── Mode pilih: masuk / keluar / toggle ────────────────────────────────
  const selecting = selectedIds.size > 0
  const selectedMessages = useMemo(
    () => messages.filter((m) => selectedIds.has(m.id)),
    [messages, selectedIds],
  )
  /** Aksi per-pesan (reaksi, pin, edit) hanya sah untuk satu pilihan. */
  const singleSelected = selectedMessages.length === 1 ? (selectedMessages[0] ?? null) : null

  const exitSelect = useCallback(() => setSelectedIds(new Set()), [])

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
      void sendChatTyping(roomId, true).catch((err) => logWarn("chat:typing", err))
    }
    // F-07: pengguna sedang mengetik → percakapan hidup, poll cepat.
    emptyPolls.current = 0
    setPollInterval(CHAT_POLL_MS)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      typingActive.current = false
      void sendChatTyping(roomId, false).catch((err) => logWarn("chat:typing", err))
    }, 3000)
  }, [roomId])

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
    setViewerItem({ url: a.fileUrl, mimeType: a.mimeType, title: a.fileName, fileName: a.fileName })
  }, [])

  // C-06 (audit): ruang di luar 30 pertama tidak ditemukan di GET /rooms —
  // nama lawan bicara jatuh ke param navigasi `title` sebelum "Percakapan".
  const counterpartName =
    room?.counterpart?.fullName ??
    (room?.counterpart?.username ? `@${room.counterpart.username}` : undefined) ??
    titleParam
  const counterpartUsername = room?.counterpart?.username
  const composerAttachments = attachments

  // ── Header ruang: identitas + status + order id ────────────────────────
  /**
   * Baris status di bawah nama. "mengetik…" menang atas online (lawan bicara
   * yang sedang mengetik adalah informasi paling hidup), lalu online, lalu
   * terakhir dilihat, lalu offline. `presence` null = belum termuat → baris
   * status dikosongkan supaya tinggi header tidak melompat dua kali.
   */
  const statusText = presence
    ? presence.isOnline
      ? "Online"
      : presence.lastSeenAt
        ? `Terakhir dilihat ${formatDateTime(presence.lastSeenAt)}`
        : "Offline"
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
        error || !roomId ? undefined : (
        /*
          Footer dipecah ke <ChatRoomFooter> (2026-09-26): layar ini
          menyentuh plafon G-11, dan blok ini murni penyusunan — tidak
          memakai state ruang selain yang dilewatkan sebagai prop.
        */
        <ChatRoomFooter
          showJumpToLatest={atBottom === false && messages.length > 0}
          onJumpToLatest={jumpToLatest}
          completed={isChatCompleted}
          closedNotice={closedNoticeText}
          orderId={room?.orderId}
          onOpenOrder={(id) => router.push(ROUTES.orderDetail(id))}
          draft={draft}
          onDraftChange={setDraft}
          onSend={(p) => void handleSend(p)}
          attachments={composerAttachments}
          onAttach={() => void handleAttach()}
          onRemoveAttachment={(localId) =>
            setAttachments((prev) => prev.filter((a) => a.localId !== localId))
          }
          onRetryAttachment={(localId) => {
            const a = attachments.find((x) => x.localId === localId)
            if (a?.picked) void uploadAttachment(localId, a.picked)
          }}
          sending={sending}
          disabled={loading}
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
          quickReactions={
            singleSelected
              ? {
                  emojis: QUICK_REACTIONS,
                  onPick: (emoji) => {
                    const target = singleSelected
                    exitSelect()
                    void handleReact(target, emoji)
                  },
                }
              : undefined
          }
        />
      ) : (
        <ChatRoomHeader
          name={counterpartName ?? "Percakapan"}
          avatar={
            room?.counterpart?.avatarUrl ? { uri: room.counterpart.avatarUrl } : undefined
          }
          status={statusText}
          online={presence?.isOnline === true}
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
        />
      )}

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
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerClassName="px-5"
        contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[4], flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleScroll}
        scrollEventThrottle={SCROLL_EVENT_THROTTLE}
        ListHeaderComponent={
          messages.length > 0 ? (
            <View style={{ paddingTop: tokens.space[3] }}>
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
        renderItem={({ item: m, index }) => (
          <ChatMessageRow
            message={m}
            previous={index > 0 ? messages[index - 1] : undefined}
            selecting={selecting}
            selected={selectedIds.has(m.id)}
            readByCounterpart={readByCounterpart.has(m.id)}
            // Foto + nama lawan bicara untuk gelembung masuk (2026-09-26).
            counterpart={{ name: counterpartName, avatarUrl: room?.counterpart?.avatarUrl }}
            // Mode pilih (v3 2026-09-21): di luar mode pilih ketuk/tekan lama
            // langsung MEMILIH pesan ini (satu langkah, tanpa ActionSheet);
            // saat mode pilih aktif setiap ketukan men-toggle pilihan. Web
            // tetap bisa memilih tanpa affordance tekan-lama.
            onPress={(target) => (selecting ? toggleSelect(target.id) : enterSelect(target.id))}
            onReact={(target, emoji) => void handleReact(target, emoji)}
            onAttachmentPress={openAttachment}
          />
        )}
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

      {/* Menu ⋮ RUANG (bukan per pesan): lihat pesanan, cari pesan, profil
          lawan bicara, bisukan, arsipkan — mutasi ruangnya di dalam komponen. */}
      <ChatRoomMenu
        open={roomMenuOpen}
        room={room}
        counterpartUsername={counterpartUsername}
        onClose={() => setRoomMenuOpen(false)}
        onSearch={openSearch}
        onRoomChange={(patch) => setRoom((prev) => (prev ? { ...prev, ...patch } : prev))}
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
    </Screen>
  )
}