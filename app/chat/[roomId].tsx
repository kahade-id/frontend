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
 *   - Pesan lama dimuat ke ATAS lewat <LoadMore> dengan kursor (`nextCursor`
 *     dari server, fallback id pesan tertua) + `excludeIds` id yang sudah
 *     dimiliki agar tidak duplikat. Akhir = halaman kosong / lebih kecil
 *     dari CHAT_PAGE_SIZE.
 *   - Hapus pesan: long-press gelembung milik sendiri → ActionSheet
 *     (Salin / Hapus). Hapus memakai Dialog destruktif.
 *   - Lampiran gambar dibuka di <MediaViewer>; berkas lain → buka eksternal.
 *   - Nama lawan bicara diambil dari daftar ruang (GET /rooms tidak punya
 *     endpoint detail) — bila tidak ditemukan judul tetap "Percakapan".
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"

import { Chats, Copy, PaperPlaneRight, PencilSimple, Package, PushPin, Smiley, Trash } from "phosphor-react-native"

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
import { Crossfade } from "@/components/ui/fade-in"
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

/** Jarak poll pesan baru saat ruang terbuka. Push tetap pemicu utama. */
const CHAT_POLL_MS = 8000
/** Jarak poll status online lawan bicara (REST; WS realtime belum ada di app). */
const PRESENCE_POLL_MS = 30000

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
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
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
        api.chat.listChatRooms({ page: 1, limit: CHAT_PAGE_SIZE }, controller.signal).catch(() => ({
          data: [] as ChatRoom[],
          meta: { page: 1, limit: CHAT_PAGE_SIZE, totalPages: 1 },
        })),
      ])
      if (controller.signal.aborted) return
      const items = sortByTime(page.items)
      setMessages(items)
      setNextCursor(
        page.nextCursor ?? (page.items.length >= CHAT_PAGE_SIZE ? (items[0]?.id ?? null) : null),
      )
      setOlderStatus(page.items.length < CHAT_PAGE_SIZE ? "end" : "idle")
      setRoom(rooms.data.find((r) => r.id === roomId) ?? null)
      await api.chat.markChatRoomRead(roomId).catch(() => undefined)
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
    } catch {
      // Read receipt bersifat kosmetik — kegagalan tidak boleh mengganggu ruang.
    }
  }, [roomId])

  // ── Daftar pesan terpin (baris pin di atas thread) ──
  const refreshPinned = useCallback(async () => {
    if (!roomId) return
    try {
      setPinned(await getPinnedMessages(roomId))
    } catch {
      setPinned([])
    }
  }, [roomId])

  // ── Presence lawan bicara (REST poll; WS realtime belum ada di app) ──
  const refreshPresence = useCallback(async () => {
    if (!roomId) return
    try {
      setPresence(await getRoomPresence(roomId))
    } catch {
      setPresence(null)
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    void refreshReadReceipts()
    void refreshPinned()
    void refreshPresence()
    const t = setInterval(() => void refreshPresence(), PRESENCE_POLL_MS)
    return () => clearInterval(t)
  }, [roomId, refreshPresence, refreshPinned, refreshReadReceipts])

  // ── Poll pesan baru ────────────────────────────────────────────────────
  // Tanpa ini, balasan lawan bicara TIDAK PERNAH muncul selama ruang
  // dibuka: layar hanya menambah pesan hasil kiriman sendiri, dan push
  // notification hanya membantu bila ditap. Poll 8 detik mengambil halaman
  // TERBARU (tanpa cursor) lalu menggabungkan id yang belum dikenal ke
  // thread — pesan lama yang sedang dibaca tidak pernah digeser.
  const mergeIncoming = useCallback(
    (incoming: ChatMessage[]) => {
      let added = 0
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id))
        const fresh = incoming.filter((m) => !known.has(m.id))
        added = fresh.length
        if (!added) return prev
        // Pesan masuk dari lawan bicara → badge tab Notifikasi harus turun
        // segera (ruang terbuka = terbaca), bukan menunggu poll 60 detik.
        if (fresh.some((m) => !m.fromUser) && roomId) {
          void api.chat.markChatRoomRead(roomId).catch(() => undefined)
          void refreshUnreadCount()
        }
        return sortByTime([...prev, ...fresh])
      })
      return added
    },
    [roomId],
  )

  const pollNewMessages = useCallback(async () => {
    if (!roomId) return
    const page = await api.chat.getChatMessages(roomId, { limit: CHAT_PAGE_SIZE })
    mergeIncoming(sortByTime(page.items))
  }, [roomId, mergeIncoming])

  usePolling(pollNewMessages, CHAT_POLL_MS, Boolean(roomId) && !error && !loading)

  // ── Auto-scroll ke pesan terbaru ───────────────────────────────────────
  // Thread tumbuh ke bawah, tetapi ScrollView mulai di ATAS: membuka ruang
  // menampilkan pesan TERLAMA dari halaman terakhir dan pengguna harus
  // menggulir manual. Gulir ke ujung bawah hanya ketika id pesan TERAKHIR
  // berubah (muat awal, kirim, pesan masuk) — memuat pesan lama di atas
  // (LoadMore) tidak mengubah id terakhir sehingga posisi baca tidak lompat.
  const scrollRef = useRef<ScrollView>(null)
  const lastSeenEndId = useRef<string | undefined>(undefined)
  const lastMessageId = messages[messages.length - 1]?.id
  const handleContentSizeChange = useCallback(() => {
    if (lastMessageId && lastSeenEndId.current !== lastMessageId) {
      lastSeenEndId.current = lastMessageId
      scrollRef.current?.scrollToEnd({ animated: false })
    }
  }, [lastMessageId])

  const loadOlder = useCallback(async () => {
    if (!roomId || olderStatus === "loading" || olderStatus === "end") return
    setOlderStatus("loading")
    try {
      const page = await api.chat.getChatMessages(roomId, {
        cursor: nextCursor ?? messages[0]?.id,
        limit: CHAT_PAGE_SIZE,
        excludeIds: messages.map((m) => m.id),
      })
      const known = new Set(messages.map((m) => m.id))
      const fresh = page.items.filter((m) => !known.has(m.id))
      setMessages((prev) => sortByTime([...fresh, ...prev]))
      const oldest = sortByTime(fresh)[0]
      setNextCursor(page.nextCursor ?? oldest?.id ?? null)
      setOlderStatus(fresh.length === 0 || page.items.length < CHAT_PAGE_SIZE ? "end" : "idle")
    } catch {
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
        setMessages((prev) => [...prev, msg])
        setDraft("")
        setAttachments([])
        // Hentikan indikator mengetik setelah pesan terkirim.
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingActive.current = false
        void sendChatTyping(roomId, false).catch(() => undefined)
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
    [roomId, attachments, toast.show],
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
        const idx = optimistic.findIndex((r) => r.emoji === emoji)
        optimistic[idx] = { ...optimistic[idx], count: Math.max(1, optimistic[idx].count - 1), reactedByMe: false }
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

  // ── Forward: hanya ke room lain dengan lawan bicara yang sama ──
  const [forwardRooms, setForwardRooms] = useState<ChatRoom[]>([])
  const openForward = useCallback(async () => {
    if (!roomId || !room?.counterpart?.id) {
      toast.show({ title: "Tidak ada room lain untuk meneruskan", tone: "info" })
      return
    }
    try {
      const { data } = await api.chat.listChatRooms({ page: 1, limit: 50 })
      const targets = data.filter(
        (r) => r.id !== roomId && r.counterpart?.id === room.counterpart?.id,
      )
      if (targets.length === 0) {
        toast.show({
          title: "Tidak ada percakapan lain dengan pengguna ini",
          tone: "info",
        })
        return
      }
      setForwardRooms(targets)
    } catch {
      toast.show({ title: "Gagal memuat daftar percakapan", tone: "danger" })
    }
  }, [roomId, room, toast.show])

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

  // ── Typing indicator: kirim saat draft berubah, hentikan 3 dtk setelah diam ──
  const notifyTyping = useCallback(() => {
    if (!roomId) return
    if (!typingActive.current) {
      typingActive.current = true
      void sendChatTyping(roomId, true).catch(() => undefined)
    }
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      typingActive.current = false
      void sendChatTyping(roomId, false).catch(() => undefined)
    }, 3000)
  }, [roomId])

  useEffect(() => {
    if (draft.trim()) notifyTyping()
  }, [draft, notifyTyping])

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current)
    }
  }, [])

  const openAttachment = useCallback((a: ChatAttachmentDto) => {
    setViewerItem({ url: a.fileUrl, mimeType: a.mimeType, title: a.fileName, fileName: a.fileName })
  }, [])

  const counterpartName =
    room?.counterpart?.fullName ??
    (room?.counterpart?.username ? `@${room.counterpart.username}` : undefined)
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
          room?.orderId ? (
            <IconButton
              icon={Package}
              variant="ghost"
              accessibilityLabel="Lihat pesanan terkait"
              onPress={() => router.push(ROUTES.orderDetail(room.orderId!))}
            />
          ) : undefined
        }
      />
      {presence ? (
        <View className="flex-row items-center gap-2 px-6 py-1.5">
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
                "flex-row items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5",
                focusRing,
              )}
            >
              <Icon icon={PushPin} size="xs" tone="default" />
              <Text variant="caption" tone="secondary" className="max-w-[160px]" numberOfLines={1}>
                {m.text ?? "(lampiran)"}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
      ) : null}
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName="px-6"
        contentContainerStyle={{ paddingBottom: tokens.space[4] }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={handleContentSizeChange}
      >
        {/* v2: skeleton → pesan crossfade (signature moment). Bubble TIDAK
            dianimasikan per-item: auto-scroll ke pesan terbaru + pesan baru
            tiap poll akan jitter bila posisi divisualkan bertahap. */}
        <Crossfade loading={loading && messages.length === 0} skeleton={<ListLoading />}>
          {error ? (
          <ErrorState
            title="Gagal memuat"
            description={error}
            onRetry={() => void fetchMessages()}
          />
        ) : messages.length === 0 ? (
          <EmptyState icon={Chats} title="Belum ada pesan" description="Mulai percakapan Anda." />
        ) : (
          <View className="gap-1" style={{ paddingTop: tokens.space[3] }}>
            <LoadMore
              status={olderStatus}
              onLoadMore={() => void loadOlder()}
              hideEnd
              idleLabel="Muat pesan sebelumnya"
            />
            {messages.map((m, i) => (
              <ChatMessageBubble
                key={m.id}
                direction={m.fromUser ? "outgoing" : "incoming"}
                text={m.text}
                time={formatDateTime(m.createdAt)}
                grouped={messages[i - 1]?.fromUser === m.fromUser}
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
            ))}
            </View>
          )}
        </Crossfade>
      </ScrollView>

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
            onPress: () => void openForward(),
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
        <View className="flex-row flex-wrap justify-center gap-3 px-6 py-2">
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

      {/* Teruskan ke room lain dengan lawan bicara yang sama */}
      <BottomSheet
        avoidKeyboard
        visible={forwardRooms.length > 0 && actionMessage != null}
        onRequestClose={() => setForwardRooms([])}
        title="Teruskan ke…"
        description="Hanya percakapan lain dengan pengguna yang sama."
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
                "flex-row items-center gap-1 rounded-md px-4 py-3",
                focusRing,
              )}
            >
              <Text variant="body" className="flex-1" numberOfLines={1}>
                {r.counterpart?.fullName ??
                  `@${r.counterpart?.username ?? "—"}`}
                {r.subject ? ` — ${r.subject}` : ""}
              </Text>
              <Icon icon={PaperPlaneRight} size="sm" tone="default" />
            </PressableScale>
          ))}
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