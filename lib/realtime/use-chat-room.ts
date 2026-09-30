/**
 * Kahade — hook realtime per ruang chat (GAP-B2, G105–G116).
 *
 * - `join-room` / `leave-room` ke room `chat:<roomId>`; hak akses divalidasi
 *   di SISI SERVER (`isRoomParticipant` di gateway) — ack `success: false`
 *   berarti tetap di jalur REST fallback (polling tidak pernah dimatikan
 *   total).
 * - Listener didaftarkan ulang setiap join dan DIBERSIHKAN saat unmount /
 *   ganti room / ganti akun / putus koneksi.
 * - Reconnect (terdeteksi via `epoch` provider): join ulang + `onReconnect`
 *   untuk sinkronisasi cursor via REST (G109).
 * - Event `chat.typing` difilter dari gema milik sendiri (server
 *   me-broadcast termasuk ke pengirim) dan diberi expiry otomatis
 *   (G110) lewat `createTypingTracker`.
 * - `user.online` / `user.offline` tidak membawa roomId di payload, tetapi
 *   dikirim per-room kecuali ke socket pengirim — yang diterima hook ini
 *   pasti lawan bicara di room yang sedang di-join.
 *
 * `createChatRoomHandlers` adalah tabel routing MURNI (event, payload) →
 * callback, sehingga bisa diuji dengan mock emitter tanpa socket live
 * (G125). Payload yang tidak valid / room lain / gema sendiri diabaikan
 * diam-diam (fail-closed di sisi UI: tidak merusak thread).
 */
import { useCallback, useEffect, useRef } from "react"

import type { ChatReaction } from "@/lib/api/chat"
import {
  CHAT_SOCKET_EVENTS,
  ORDER_SOCKET_EVENTS,
  createTypingTracker,
  type ChatMessageDeletedPayload,
  type ChatPinPayload,
  type ChatPollClosedPayload,
  type ChatPollCreatedPayload,
  type ChatPollUpdatedPayload,
  type ChatReactionPayload,
  type ChatReadPayload,
  type ChatTypingPayload,
  type OrderStatusChangedPayload,
} from "./chat-events"
import { useRealtime, useRealtimeActions } from "./realtime-context"

export type ChatRoomRealtimeCallbacks = {
  /** Payload mentah `chat.new_message` (belum dinormalisasi). */
  onMessage?: (raw: unknown) => void
  /** Payload mentah `chat.message_updated`. */
  onMessageUpdated?: (raw: unknown) => void
  onMessageDeleted?: (messageId: string) => void
  onReaction?: (messageId: string, reactions: ChatReaction[]) => void
  onPin?: (messageId: string, isPinned: boolean) => void
  /** messageId null = bulk read (seluruh pesan saya dibaca). */
  onRead?: (messageId: string | null) => void
  onTyping?: (isTyping: boolean) => void
  onPresence?: (isOnline: boolean) => void
  /** BFI-117: pesan sekali-lihat dikonsumsi penerima. */
  onViewOnceConsumed?: (messageId: string) => void
  /** BFI-113: room di-pin/unpin (event ke `user:<id>`). */
  onRoomPinned?: (roomId: string, position: number) => void
  onRoomUnpinned?: (roomId: string) => void
  /** BFI-119: polling di room. */
  onPollCreated?: (pollId: string, question: string) => void
  onPollUpdated?: (pollId: string, voterId: string) => void
  onPollClosed?: (pollId: string) => void
  /**
   * BFI-118: status order berubah (`order.status_changed` + legacy
   * `order.status`, room `order:<orderId>` yang ikut di-join saat
   * `join-room`). Layar chat memakai ini untuk me-refetch data order
   * (kartu status, countdown, tombol aksi) tanpa remount.
   */
  onOrderStatusChanged?: (orderId: string, status: string) => void
  /** Dipanggil setelah reconnect + join ulang: sinkronisasi cursor via REST. */
  onReconnect?: () => void
}

type CallbacksSource = ChatRoomRealtimeCallbacks | (() => ChatRoomRealtimeCallbacks)

function resolveCallbacks(source: CallbacksSource): ChatRoomRealtimeCallbacks {
  return typeof source === "function" ? (source as () => ChatRoomRealtimeCallbacks)() : source
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/**
 * Tabel routing event → callback. Murni: tanpa socket, tanpa React.
 */
export function createChatRoomHandlers(
  roomId: string,
  viewerId: string | null,
  source: CallbacksSource,
): Record<string, (payload: unknown) => void> {
  const callbacks = () => resolveCallbacks(source)
  const sameRoom = (payload: unknown): boolean =>
    isRecord(payload) && payload.roomId === roomId
  /** Gema milik sendiri (server broadcast termasuk ke socket pengirim). */
  const isSelf = (payload: unknown): boolean =>
    viewerId != null && isRecord(payload) && payload.userId === viewerId
  /**
   * BFI-118: `order.status_changed` + legacy `order.status` — di-emit ke
   * room `order:<orderId>` yang otomatis di-join server saat `join-room`
   * (gateway `handleJoinRoom`). Payload TIDAK membawa roomId, jadi tanpa
   * filter sameRoom; pemanggil membandingkan `orderId` dengan order yang
   * sedang dibuka lalu me-refetch data order (kartu status, countdown,
   * tombol aksi) tanpa remount.
   */
  const onOrderStatus = (payload: unknown) => {
    if (!isRecord(payload)) return
    const { orderId, status } = payload as Partial<OrderStatusChangedPayload>
    if (
      typeof orderId === "string" &&
      orderId &&
      typeof status === "string" &&
      status
    ) {
      callbacks().onOrderStatusChanged?.(orderId, status)
    }
  }

  return {
    [CHAT_SOCKET_EVENTS.NEW_MESSAGE]: (payload) => {
      if (sameRoom(payload)) callbacks().onMessage?.(payload)
    },
    [CHAT_SOCKET_EVENTS.MESSAGE_UPDATED]: (payload) => {
      if (sameRoom(payload)) callbacks().onMessageUpdated?.(payload)
    },
    [CHAT_SOCKET_EVENTS.MESSAGE_DELETED]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload)) return
      const { messageId } = payload as Partial<ChatMessageDeletedPayload>
      if (typeof messageId === "string" && messageId) {
        callbacks().onMessageDeleted?.(messageId)
      }
    },
    [CHAT_SOCKET_EVENTS.REACTION_UPDATED]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload)) return
      const { messageId, reactions } = payload as Partial<ChatReactionPayload>
      if (typeof messageId === "string" && messageId && Array.isArray(reactions)) {
        callbacks().onReaction?.(messageId, reactions as ChatReaction[])
      }
    },
    [CHAT_SOCKET_EVENTS.MESSAGE_PINNED]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload)) return
      const { messageId } = payload as Partial<ChatPinPayload>
      if (typeof messageId === "string" && messageId) callbacks().onPin?.(messageId, true)
    },
    [CHAT_SOCKET_EVENTS.MESSAGE_UNPINNED]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload)) return
      const { messageId } = payload as Partial<ChatPinPayload>
      if (typeof messageId === "string" && messageId) callbacks().onPin?.(messageId, false)
    },
    [CHAT_SOCKET_EVENTS.READ]: (payload) => {
      // BFI-114: gema mark-as-read milik sendiri diabaikan — KECUALI event
      // sinkronisasi multi-device (`isOwnDeviceSync`, dikirim BE ke
      // perangkat milik pembaca sendiri). Tanpa pengecualian ini, status
      // baca antar-perangkat tidak pernah sinkron saat `hideReadReceipts`
      // aktif karena userId selalu == viewerId di semua perangkat sendiri.
      if (!sameRoom(payload) || !isRecord(payload)) return
      const { messageId, isOwnDeviceSync } = payload as Partial<ChatReadPayload>
      if (isSelf(payload) && isOwnDeviceSync !== true) return
      callbacks().onRead?.(typeof messageId === "string" && messageId ? messageId : null)
    },
    [CHAT_SOCKET_EVENTS.TYPING]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload) || isSelf(payload)) return
      const { isTyping } = payload as Partial<ChatTypingPayload>
      callbacks().onTyping?.(isTyping === true)
    },
    [CHAT_SOCKET_EVENTS.USER_ONLINE]: () => {
      callbacks().onPresence?.(true)
    },
    [CHAT_SOCKET_EVENTS.USER_OFFLINE]: () => {
      callbacks().onPresence?.(false)
    },
    /**
     * BFI-119: polling di room — payload aktual BE (chat.service.ts):
     * created `{ roomId, pollId, question }`, updated
     * `{ roomId, pollId, voterId }`, closed `{ roomId, pollId }`.
     * Pemanggil memakai ini untuk me-refetch daftar poll (listPolls)
     * alih-alih menunggu poll REST berikutnya.
     */
    [CHAT_SOCKET_EVENTS.POLL_CREATED]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload)) return
      const { pollId, question } = payload as Partial<ChatPollCreatedPayload>
      if (typeof pollId === "string" && pollId && typeof question === "string") {
        callbacks().onPollCreated?.(pollId, question)
      }
    },
    [CHAT_SOCKET_EVENTS.POLL_UPDATED]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload)) return
      const { pollId, voterId } = payload as Partial<ChatPollUpdatedPayload>
      if (typeof pollId === "string" && pollId && typeof voterId === "string") {
        callbacks().onPollUpdated?.(pollId, voterId)
      }
    },
    [CHAT_SOCKET_EVENTS.POLL_CLOSED]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload)) return
      const { pollId } = payload as Partial<ChatPollClosedPayload>
      if (typeof pollId === "string" && pollId) {
        callbacks().onPollClosed?.(pollId)
      }
    },
    /** BFI-118: status order berubah (room `order:<orderId>`). */
    [ORDER_SOCKET_EVENTS.STATUS_CHANGED]: onOrderStatus,
    /** BFI-118: varian legacy `order.status` (masih di-emit berdampingan). */
    [ORDER_SOCKET_EVENTS.STATUS]: onOrderStatus,
  }
}

export function useChatRoomRealtime(
  roomId: string | undefined,
  callbacks: ChatRoomRealtimeCallbacks,
  opts?: { enabled?: boolean },
): {
  status: ReturnType<typeof useRealtime>["status"]
  healthy: boolean
  /** G112: kirim sinyal mengetik via socket bila sehat, fallback REST. */
  sendTyping: (isTyping: boolean) => void
} {
  const { socket, status, epoch } = useRealtime()
  // PERF-FIX (state audit): aksi stabil via context terpisah.
  const { viewerId, joinRoom, leaveRoom, unwrapEvent } = useRealtimeActions()
  const enabled = opts?.enabled !== false
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks
  const joinedRef = useRef(false)
  const epochRef = useRef(0)
  const healthy = status === "connected"

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!roomId) return
      // Socket sehat → emit langsung (tanpa menunggu round-trip HTTP).
      // Server memverifikasi keanggotaan room; rate limit silent di server.
      if (healthy && socket && joinedRef.current) {
        socket.emit(isTyping ? "typing.start" : "typing.stop", { roomId })
        return
      }
      // Fallback REST — dipakai saat socket belum sehat / join gagal.
      void import("@/lib/api/chat")
        .then((m) => m.sendChatTyping(roomId, isTyping))
        .catch((err: unknown) => {
          // L-3 (audit ronde-2): log internal hanya di dev — jangan bocor
          // ke konsol produksi.
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn("[chat] typing fallback gagal", err)
          }
        })
    },
    [roomId, healthy, socket],
  )

  useEffect(() => {
    if (!roomId || !socket || !enabled || status !== "connected") return
    let cancelled = false
    // Typing: sinyal mentah → tracker (expiry otomatis) → callback.
    const tracker = createTypingTracker((isTyping) => {
      if (!cancelled) callbacksRef.current.onTyping?.(isTyping)
    })
    const handlers = createChatRoomHandlers(roomId, viewerId, {
      onMessage: (raw) => callbacksRef.current.onMessage?.(raw),
      onMessageUpdated: (raw) => callbacksRef.current.onMessageUpdated?.(raw),
      onMessageDeleted: (id) => callbacksRef.current.onMessageDeleted?.(id),
      onReaction: (id, reactions) => callbacksRef.current.onReaction?.(id, reactions),
      onPin: (id, isPinned) => callbacksRef.current.onPin?.(id, isPinned),
      onRead: (id) => callbacksRef.current.onRead?.(id),
      onTyping: (isTyping) => tracker.signal(isTyping),
      onPresence: (isOnline) => callbacksRef.current.onPresence?.(isOnline),
      // BFI-118/BFI-119: teruskan callback poll & status order ke tabel
      // routing — tanpanya listener di atas tidak pernah memanggil balik.
      onPollCreated: (pollId, question) =>
        callbacksRef.current.onPollCreated?.(pollId, question),
      onPollUpdated: (pollId, voterId) =>
        callbacksRef.current.onPollUpdated?.(pollId, voterId),
      onPollClosed: (pollId) => callbacksRef.current.onPollClosed?.(pollId),
      onOrderStatusChanged: (orderId, status) =>
        callbacksRef.current.onOrderStatusChanged?.(orderId, status),
    })
    // G110: simpan wrapper listener per event agar cleanup hanya melepas
    // listener MILIK hook ini — `socket.off(event)` tanpa argumen akan
    // mencabut listener room lain yang kebetulan mount bersamaan.
    const wrapped = new Map<string, (raw: unknown) => void>()
    const attach = () => {
      // SEMUA event melewati verifikasi envelope HMAC dulu (G108):
      // payload mentah server = payload asli + `_ts` + `_signature`.
      // Event tak-valid diabaikan diam-diam (fail-closed di sisi UI).
      for (const [event, handler] of Object.entries(handlers)) {
        const listener = (raw: unknown) => {
          const payload = unwrapEvent(raw)
          if (payload !== null) handler(payload)
        }
        wrapped.set(event, listener)
        socket.on(event, listener)
      }
    }
    const detach = () => {
      for (const [event, listener] of wrapped) socket.off(event, listener)
      wrapped.clear()
    }

    void (async () => {
      const ok = await joinRoom(roomId).catch(() => false)
      if (cancelled) {
        // Join berhasil tepat saat cleanup: langsung leave lagi agar tidak
        // ada room menggantung di server.
        if (ok) leaveRoom(roomId)
        return
      }
      if (!ok) return // REST fallback tetap jalan (polling tidak dimatikan).
      joinedRef.current = true
      attach()
      const previousEpoch = epochRef.current
      epochRef.current = epoch
      if (previousEpoch !== 0 && previousEpoch !== epoch) {
        // Reconnect: pesan yang terlewat diambil via REST (G109).
        callbacksRef.current.onReconnect?.()
      }
    })()

    return () => {
      cancelled = true
      tracker.dispose()
      detach()
      if (joinedRef.current) {
        joinedRef.current = false
        leaveRoom(roomId)
      }
    }
  }, [roomId, socket, status, epoch, enabled, viewerId, joinRoom, leaveRoom, unwrapEvent])

  return { status, healthy, sendTyping }
}
