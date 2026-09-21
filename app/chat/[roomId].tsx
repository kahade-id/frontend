/**
 * Screen — Ruang Chat Detail.
 *
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
import { useCallback, useEffect, useRef, useState } from "react"
import { FlatList, Platform, ScrollView, View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"

import { Chats, Copy, MagnifyingGlass, PaperPlaneRight, PencilSimple, Package, PushPin, Smiley, Trash } from "phosphor-react-native"

import { api, isApiError, userMessage } from "@/lib/api"
import { refreshUnreadCount } from "@/lib/unread-count"
import { usePolling } from "@/lib/use-polling"
import {
  CHAT_PAGE_SIZE,
  QUICK_REACTIONS,
  addReaction,
  editChatMessage,
  forwardChatMessage,
  getPinnedMessages,
  getReadReceipts,
  getRoomPresence,
  pinChatMessage,
  removeReaction,
  searchRoomMessages,
  sendChatTyping,
  unpinChatMessage,
  type ChatMessage,
  type ChatPresence,
  type ChatReaction,
  type ChatRoom,
} from "@/lib/api/chat"
import type { ChatAttachmentDto, SendMessageDto } from "@/lib/api/types"
import { useCopy } from "@/lib/clipboard"
import { formatDateTime } from "@/lib/format"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { logWarn } from "@/lib/telemetry"
import { pickImage, pickedImageToFormData, type PickedImage } from "@/lib/image-picker"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { ActionSheet } from "@/components/ui/action-sheet"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { TextArea } from "@/components/ui/text-area"
import { IconButton } from "@/components/ui/icon-button"
import { ChatAttachmentItem } from "@/components/ui/chat-attachment-item"
import {
  ChatComposer,
  type ChatComposerPayload,
  type ComposerAttachment,
} from "@/components/ui/chat-composer"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { Dialog } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadMore, type LoadMoreStatus } from "@/components/ui/load-more"
import { MediaViewer, isImageMedia, type MediaViewerItem } from "@/components/ui/media-viewer"
import { ListLoading } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { isImageMime } from "@/lib/mime"

import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"

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
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Fitur lanjutan: reaksi, pin, edit, forward, read receipt, presence ──
  const [reactTarget, setReactTarget] = useState<ChatMessage | null>(null)
  const [editTarget, setEditTarget] = useState<ChatMessage | null>(null)
  const [editText, setEditText] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
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
  // sudah ada sejak API-GAP 2026-09-15, UI-nya yang belum.
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 400)
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchRequest = useRef<AbortController | null>(null)

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
      if (!roomId) return
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

  const handleDelete = useCallback(async () => {
    if (!roomId || !deleteTarget) return
    setDeleting(true)
    try {
      await api.chat.deleteChatMessage(roomId, deleteTarget.id)
      setMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.show({ title: "Pesan dihapus", tone: "success", duration: 2500 })
    } catch (err) {
      toast.show({
        title: "Gagal menghapus pesan",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setDeleting(false)
    }
  }, [roomId, deleteTarget, toast.show])

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

  // ── Edit pesan teks milik sendiri ──
  const openEdit = useCallback((message: ChatMessage) => {
    setEditTarget(message)
    setEditText(message.text ?? "")
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!roomId || !editTarget) return
    const content = editText.trim()
    if (!content || content === editTarget.text) {
      setEditTarget(null)
      return
    }
    setSavingEdit(true)
    try {
      const updated = await editChatMessage(roomId, editTarget.id, content)
      patchMessage(editTarget.id, (m) => ({
        ...m,
        text: updated.text ?? content,
        isEdited: true,
        editedAt: (updated as { editedAt?: string }).editedAt ?? new Date().toISOString(),
      }))
      setEditTarget(null)
    } catch (err) {
      toast.show({
        title: "Gagal menyimpan perubahan",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setSavingEdit(false)
    }
  }, [roomId, editTarget, editText, patchMessage, toast.show])

  // ── Forward: picker ruang penuh dengan paginasi ──
  // C-10 (audit): sebelumnya hanya 50 ruang pertama DAN hanya yang lawan
  // bicaranya sama — fitur nyaris tak berguna. Endpoint forward menerima
  // array `targetRoomIds` ruang APA pun; picker kini memuat semua ruang
  // (paginasi 50/halaman) kecuali ruang aktif.
  const [forwardRooms, setForwardRooms] = useState<ChatRoom[]>([])
  const [forwardOpen, setForwardOpen] = useState(false)
  const [forwardLoading, setForwardLoading] = useState(false)
  const forwardPage = useRef(1)
  const [forwardHasMore, setForwardHasMore] = useState(false)

  const loadForwardPage = useCallback(
    async (page: number) => {
      setForwardLoading(true)
      try {
        const res = await api.chat.listChatRooms({ page, limit: 50 })
        const targets = res.data.filter((r) => r.id !== roomId)
        setForwardRooms((prev) => {
          if (page === 1) return targets
          const seen = new Set(prev.map((r) => r.id))
          return [...prev, ...targets.filter((r) => !seen.has(r.id))]
        })
        forwardPage.current = page
        setForwardHasMore(page < res.meta.totalPages)
      } catch (err) {
        logWarn("chat:forward-rooms", err)
        toast.show({ title: "Gagal memuat daftar percakapan", tone: "danger" })
      } finally {
        setForwardLoading(false)
      }
    },
    [roomId, toast.show],
  )

  const openForward = useCallback(() => {
    if (!roomId) return
    setForwardRooms([])
    setForwardHasMore(false)
    setForwardOpen(true)
    void loadForwardPage(1)
  }, [roomId, loadForwardPage])

  const handleForwardTo = useCallback(
    async (message: ChatMessage, targetRoomId: string) => {
      if (!roomId) return
      try {
        const res = await forwardChatMessage(roomId, message.id, [targetRoomId])
        if (res.skipped.length > 0) {
          toast.show({
            title: "Pesan tidak diteruskan",
            description: res.skipped[0].reason,
            tone: "danger",
          })
          return
        }
        setForwardOpen(false)
        setForwardRooms([])
        toast.show({ title: "Pesan diteruskan", tone: "success", duration: 2500 })
      } catch (err) {
        toast.show({
          title: "Gagal meneruskan pesan",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      }
    },
    [roomId, toast.show],
  )

  // ── Pencarian pesan dalam ruang (J-07) ──────────────────────────────
  useEffect(() => {
    if (!searchOpen) return
    searchRequest.current?.abort()
    if (!debouncedSearch || !roomId) {
      setSearchResults([])
      setSearchError(null)
      setSearchLoading(false)
      return
    }
    const controller = new AbortController()
    searchRequest.current = controller
    setSearchLoading(true)
    searchRoomMessages(roomId, debouncedSearch, { limit: 20 }, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return
        setSearchResults(res.items)
        setSearchError(null)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        logWarn("chat:search", err)
        setSearchError(userMessage(err))
        setSearchResults([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearchLoading(false)
      })
    return () => controller.abort()
  }, [searchOpen, debouncedSearch, roomId])

  const openSearch = useCallback(() => {
    setSearchQuery("")
    setSearchResults([])
    setSearchError(null)
    setSearchOpen(true)
  }, [])

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
  const composerAttachments = attachments

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
        error || !roomId ? undefined : (
        <View>
          <ChatComposer
            value={draft}
            onChangeText={setDraft}
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
        </View>
        )
      }
    >
      <Header
        title={counterpartName ?? "Percakapan"}
        right={
          <View className="flex-row items-center">
            <IconButton
              icon={MagnifyingGlass}
              variant="ghost"
              accessibilityLabel="Cari pesan di percakapan ini"
              onPress={openSearch}
            />
            {room?.orderId ? (
              <IconButton
                icon={Package}
                variant="ghost"
                accessibilityLabel="Lihat pesanan terkait"
                onPress={() => router.push(ROUTES.orderDetail(room.orderId!))}
              />
            ) : null}
          </View>
        }
      />
      {presence ? (
        <View className="flex-row items-center gap-2 px-5 py-1.5">
          <View
            className={cn(
              "h-2 w-2 rounded-full",
              presence.isOnline ? "bg-success" : "bg-border",
            )}
          />
          <Text variant="caption" tone="secondary">
            {presence.isOnline
              ? "Online"
              : presence.lastSeenAt
                ? `Terakhir dilihat ${formatDateTime(presence.lastSeenAt)}`
                : "Offline"}
          </Text>
        </View>
      ) : null}
      {pinned.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-3"
          contentContainerClassName="flex-row gap-2 py-2"
        >
          {pinned.map((m) => (
            <PressableScale
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={`Pesan terpin: ${m.text ?? "lampiran"}`}
              scaleOnPress={false}
              onPress={() => setActionMessage(m)}
              containerClassName={cn(
                "flex-row items-center rounded-md border border-border bg-surface px-2.5 py-1.5",
                focusRing,
              )}
              // kelas baris ada di className (View isi PressableScale) — lihat S8
              className="flex-row items-center gap-1.5"
            >
              <Icon icon={PushPin} size="xs" tone="default" />
              <Text variant="caption" tone="secondary" className="max-w-[160px]" numberOfLines={1}>
                {m.text ?? "(lampiran)"}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
      ) : null}
      {/* F-06 (audit): FlatList menggantikan ScrollView + messages.map —
          thread panjang (ratusan bubble bergambar) dulu ter-mount penuh.
          Bubble TIDAK dianimasikan per-item: auto-scroll ke pesan terbaru +
          pesan baru tiap poll akan jitter bila posisi divisualkan bertahap. */}
      <FlatList
        ref={scrollRef}
        className="flex-1"
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerClassName="px-5"
        contentContainerStyle={{ paddingBottom: tokens.space[4], flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={handleContentSizeChange}
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
          <View className="gap-1">
            <ChatMessageBubble
              direction={m.fromUser ? "outgoing" : "incoming"}
              text={m.text}
              time={formatDateTime(m.createdAt)}
              grouped={index > 0 && messages[index - 1]?.fromUser === m.fromUser}
                // Status baca pesan saya: read-receipt dari lawan bicara
                // (GET /read-receipts) naik ke ikon centang ganda "read".
                status={m.fromUser ? (readByCounterpart.has(m.id) ? "read" : "sent") : undefined}
                reactions={m.reactions}
                onReact={(emoji) => void handleReact(m, emoji)}
                isPinned={m.isPinned}
                isEdited={m.isEdited}
                // Klik biasa membuka menu yang sama dengan tekan-lama: tanpa
                // ini pesan terasa "mati" saat diklik (terutama di web, yang
                // tidak punya affordance tekan-lama).
                onPress={() => setActionMessage(m)}
                onLongPress={() => setActionMessage(m)}
              >
                {m.attachments?.length ? (
                  <View className="gap-2">
                    {m.attachments.map((a, j) => (
                      <ChatAttachmentItem
                        key={`${m.id}-${j}`}
                        attachment={a}
                        layout={
                          isImageMedia({ url: a.fileUrl, mimeType: a.mimeType }) ? "tile" : "row"
                        }
                        onPress={() => openAttachment(a)}
                      />
                    ))}
                  </View>
            ) : undefined}
          </ChatMessageBubble>
          </View>
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
        removeClippedSubviews={Platform.OS === "android"}
      />

      <MediaViewer
        item={viewerItem}
        onClose={() => setViewerItem(null)}
        onOpenError={(msg) => toast.show({ title: msg, tone: "danger" })}
      />

      <ActionSheet
        visible={actionMessage != null}
        onRequestClose={() => setActionMessage(null)}
        title="Pesan"
        actions={[
          {
            key: "react",
            label: "Reaksi",
            icon: Smiley,
            onPress: () => setReactTarget(actionMessage),
          },
          {
            key: "pin",
            label: actionMessage?.isPinned ? "Lepas pin" : "Pin pesan",
            icon: PushPin,
            onPress: () => {
              if (actionMessage) void handleTogglePin(actionMessage)
            },
          },
          ...(actionMessage?.fromUser && actionMessage.messageType === "TEXT" && actionMessage.text
            ? [
                {
                  key: "edit",
                  label: "Edit pesan",
                  icon: PencilSimple,
                  onPress: () => openEdit(actionMessage),
                },
              ]
            : []),
          {
            key: "forward",
            label: "Teruskan",
            icon: PaperPlaneRight,
            onPress: () => openForward(),
          },
          {
            key: "copy",
            label: "Salin teks",
            icon: Copy,
            disabled: !actionMessage?.text,
            onPress: () => {
              if (actionMessage?.text) void copy(actionMessage.text)
            },
          },
          ...(actionMessage?.fromUser
            ? [
                {
                  key: "delete",
                  label: "Hapus pesan",
                  icon: Trash,
                  destructive: true,
                  onPress: () => setDeleteTarget(actionMessage),
                },
              ]
            : []),
        ]}
      />

      {/* Pilih emoji reaksi — sheet terpisah karena ActionSheet item memakai
          ikon, bukan teks bebas (emoji). */}
      <BottomSheet
        avoidKeyboard
        visible={reactTarget != null}
        onRequestClose={() => setReactTarget(null)}
        title="Reaksi"
        showHandle={false}
      >
        <View className="flex-row flex-wrap justify-center gap-3 px-5 py-2">
          {QUICK_REACTIONS.map((emoji) => (
            <PressableScale
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`Reaksi ${emoji}`}
              onPress={() => {
                if (reactTarget) void handleReact(reactTarget, emoji)
                setReactTarget(null)
              }}
              containerClassName={cn("items-center rounded-full p-2", focusRing)}
            >
              <Text variant="h2" className="text-2xl">
                {emoji}
              </Text>
            </PressableScale>
          ))}
        </View>
      </BottomSheet>

      {/* Edit pesan teks sendiri */}
      <BottomSheet
        avoidKeyboard
        visible={editTarget != null}
        onRequestClose={() => setEditTarget(null)}
        title="Edit pesan"
        footer={
          <View className="gap-2">
            <Button
              fullWidth
              loading={savingEdit}
              disabled={!editText.trim() || editText.trim() === editTarget?.text}
              onPress={() => void handleSaveEdit()}
            >
              Simpan
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onPress={() => setEditTarget(null)}
            >
              Batal
            </Button>
          </View>
        }
      >
        <View className="px-5 pb-2">
          <TextArea
            value={editText}
            onChangeText={setEditText}
            rows={4}
            placeholder="Tulis ulang pesan Anda"
            accessibilityLabel="Isi pesan yang diedit"
          />
        </View>
      </BottomSheet>

      {/* Teruskan ke percakapan lain — semua ruang, paginasi (C-10) */}
      <BottomSheet
        avoidKeyboard
        visible={forwardOpen && actionMessage != null}
        onRequestClose={() => {
          setForwardOpen(false)
          setForwardRooms([])
        }}
        title="Teruskan ke…"
        description="Pilih percakapan tujuan pesan."
        showHandle={false}
      >
        <View className="px-2 pb-2">
          {forwardRooms.map((r) => (
            <PressableScale
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={`Teruskan ke ${r.counterpart?.fullName ?? r.counterpart?.username ?? "percakapan"}`}
              onPress={() => {
                if (actionMessage) void handleForwardTo(actionMessage, r.id)
              }}
              containerClassName={cn(
                "rounded-md px-4 py-3",
                focusRing,
              )}
              // kelas baris + lebar penuh di className View isi PressableScale;
              // di containerClassName `flex-row` tidak pernah menyentuh anak
              // (S8 check-screens) dan baris jadi kolom.
              className="w-full flex-row items-center gap-1"
            >
              <Text variant="body" className="flex-1" numberOfLines={1}>
                {r.counterpart?.fullName ??
                  `@${r.counterpart?.username ?? "—"}`}
                {r.subject ? ` — ${r.subject}` : ""}
              </Text>
              <Icon icon={PaperPlaneRight} size="sm" tone="default" />
            </PressableScale>
          ))}
          {forwardLoading ? (
            <View className="py-2">
              <ListLoading />
            </View>
          ) : null}
          {!forwardLoading && forwardRooms.length === 0 ? (
            <EmptyState
              icon={Chats}
              title="Belum ada percakapan lain"
              description="Pesan dapat diteruskan ke percakapan Anda yang lain."
            />
          ) : null}
          {forwardHasMore && !forwardLoading ? (
            <Button
              variant="ghost"
              fullWidth
              onPress={() => void loadForwardPage(forwardPage.current + 1)}
            >
              Muat percakapan lain
            </Button>
          ) : null}
        </View>
      </BottomSheet>

      {/* Cari pesan dalam ruang — GET /v1/chat/rooms/{id}/search (J-07).
          Hasil yang sudah termuat di thread bisa dilompati (scrollToIndex);
          yang lebih tua dari riwayat termuat diberi keterangan. */}
      <BottomSheet
        avoidKeyboard
        visible={searchOpen}
        onRequestClose={() => setSearchOpen(false)}
        title="Cari pesan"
        description="Cari teks dalam percakapan ini."
        showHandle={false}
      >
        <View className="gap-3 px-5 pb-3">
          <Input
            variant="search"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Ketik kata kunci…"
            accessibilityLabel="Kata kunci pencarian pesan"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            autoFocus
          />
          {searchLoading ? (
            <ListLoading />
          ) : searchError ? (
            <Text variant="caption" tone="danger">
              {searchError}
            </Text>
          ) : debouncedSearch && searchResults.length === 0 ? (
            <Text variant="caption" tone="secondary">
              Tidak ada pesan yang cocok dengan kata kunci itu.
            </Text>
          ) : (
            searchResults.map((r) => (
              <PressableScale
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={`Lompat ke pesan: ${r.text ?? "(lampiran)"}`}
                onPress={() => jumpToMessage(r.id)}
                containerClassName={cn("rounded-md px-2 py-2", focusRing)}
                className="w-full gap-0.5"
              >
                <Text variant="body" numberOfLines={2}>
                  {r.text || (r.attachments?.length ? "(lampiran)" : "(pesan tanpa teks)")}
                </Text>
                <Text variant="caption" tone="secondary">
                  {formatDateTime(r.createdAt)} · {r.fromUser ? "Anda" : counterpartName ?? "Lawan bicara"}
                </Text>
              </PressableScale>
            ))
          )}
        </View>
      </BottomSheet>

      <Dialog
        title="Hapus pesan ini?"
        description="Pesan akan dihapus untuk semua peserta ruang."
        visible={deleteTarget != null}
        destructive
        loading={deleting}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        onRequestClose={() => setDeleteTarget(null)}
      />
    </Screen>
  )
}