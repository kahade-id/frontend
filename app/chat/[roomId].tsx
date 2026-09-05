import { LoadingScreen } from "@/components/ui/loading-screen"
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
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Chats, Copy, Trash } from "phosphor-react-native"

import { api, isApiError, userMessage } from "@/lib/api"
import { CHAT_PAGE_SIZE, type ChatMessage, type ChatRoom } from "@/lib/api/chat"
import type { ChatAttachmentDto, SendMessageDto } from "@/lib/api/types"
import { useCopy } from "@/lib/clipboard"
import { formatDateTime } from "@/lib/format"
import { pickImage, pickedImageToFormData, type PickedImage } from "@/lib/image-picker"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { ActionSheet } from "@/components/ui/action-sheet"
import { Button } from "@/components/ui/button"
import { ChatAttachmentItem } from "@/components/ui/chat-attachment-item"
import {
  ChatComposer,
  type ChatComposerPayload,
  type ComposerAttachment,
} from "@/components/ui/chat-composer"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadMore, type LoadMoreStatus } from "@/components/ui/load-more"
import { MediaViewer, isImageMedia, type MediaViewerItem } from "@/components/ui/media-viewer"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { useToast } from "@/components/ui/toast"

/** Lampiran composer + berkas lokal untuk unggah ulang bila gagal. */
type LocalAttachment = ComposerAttachment & { picked?: PickedImage }

function messageTypeFor(
  attachments: ChatAttachmentDto[],
): NonNullable<SendMessageDto["messageType"]> {
  if (attachments.length === 0) return "TEXT"
  return attachments.every((a) => a.mimeType.startsWith("image/")) ? "IMAGE" : "FILE"
}

function sortByTime(items: ChatMessage[]): ChatMessage[] {
  return [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

export default function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  const insets = useSafeAreaInsets()
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
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)

  const [viewerItem, setViewerItem] = useState<MediaViewerItem | null>(null)
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchMessages = useCallback(async () => {
    if (!roomId) return
    setLoading(true)
    setError(null)
    try {
      const [page, rooms] = await Promise.all([
        api.chat.getChatMessages(roomId, { limit: CHAT_PAGE_SIZE }),
        api.chat.listChatRooms().catch(() => [] as ChatRoom[]),
      ])
      const items = sortByTime(page.items)
      setMessages(items)
      setNextCursor(
        page.nextCursor ?? (page.items.length >= CHAT_PAGE_SIZE ? (items[0]?.id ?? null) : null),
      )
      setOlderStatus(page.items.length < CHAT_PAGE_SIZE ? "end" : "idle")
      setRoom(rooms.find((r) => r.id === roomId) ?? null)
      await api.chat.markChatRoomRead(roomId).catch(() => undefined)
    } catch (err) {
      setError(isApiError(err) ? userMessage(err) : "Gagal memuat pesan.")
    } finally {
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    void fetchMessages()
  }, [fetchMessages])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchMessages()
    setRefreshing(false)
  }, [fetchMessages])

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

  const openAttachment = useCallback((a: ChatAttachmentDto) => {
    setViewerItem({ url: a.fileUrl, mimeType: a.mimeType, title: a.fileName, fileName: a.fileName })
  }, [])

  const counterpartName =
    room?.counterpart?.fullName ??
    (room?.counterpart?.username ? `@${room.counterpart.username}` : undefined)
  const composerAttachments = useMemo(() => attachments, [attachments])

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
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
      }
    >
      <Header
        title={counterpartName ?? "Percakapan"}
        right={
          room?.orderId ? (
            <Button
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => router.push(ROUTES.orderDetail(room.orderId!))}
            >
              Pesanan
            </Button>
          ) : undefined
        }
      />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading && messages.length === 0 ? (
          <LoadingScreen message="Memuat percakapan…" />
        ) : error ? (
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
      </PullToRefresh>

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
