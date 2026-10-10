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
import { useCallback, useEffect, useRef, useState } from "react"

import type { ChatReaction } from "@/lib/api/chat"
import {
  CHAT_SOCKET_EVENTS,
  ORDER_SOCKET_EVENTS,
  createTypingRoster,
  type ChatMessageDeletedPayload,
  type ChatMessagesExpiredPayload,
  type ChatPinPayload,
  type ChatPollClosedPayload,
  type ChatPollCreatedPayload,
  type ChatPollUpdatedPayload,
  type ChatReactionPayload,
  type ChatReadPayload,
  type ChatRoomPinPayload,
  type ChatTypingPayload,
  type ChatViewOnceConsumedPayload,
  type OrderStatusChangedPayload,
  type TypingRosterEntry,
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
  /**
   * messageId null = bulk read (seluruh pesan saya dibaca). `meta` membawa
   * waktu baca server (`readAt`) supaya klien bisa membatasi simpulan "baca
   * massal" pada pesan yang memang dibuat sebelum itu (audit chat B5), dan
   * `ownDeviceSync` = event sinkronisasi multi-device milik PEMBACA SENDIRI
   * (bukan lawan bicara membaca pesan saya — jangan dipakai untuk centang).
   */
  onRead?: (
    messageId: string | null,
    meta?: { readAt?: string | null; markedCount?: number; ownDeviceSync?: boolean },
  ) => void
  /**
   * `who` = pengetik (audit chat G17: nama dari payload `chat.typing.username`).
   * Boolean ini berlaku untuk SATU pengetik; jumlah pengetik terkini lewat `onTypers`.
   */
  onTyping?: (isTyping: boolean, who?: { userId: string; name: string | null }) => void
  /** Daftar pengetik TERKINI (expiry per pengguna) — kosong = tak seorang pun. */
  onTypers?: (typers: readonly TypingRosterEntry[]) => void
  onPresence?: (isOnline: boolean) => void
  /** BFI-117: pesan sekali-lihat dikonsumsi penerima. */
  onViewOnceConsumed?: (messageId: string) => void
  /** BFI-113: room di-pin/unpin (event ke `user:<id>`). */
  onRoomPinned?: (roomId: string, position: number) => void
  onRoomUnpinned?: (roomId: string) => void
  /** BFI-119: polling di room — granular (question/voterId tersedia). */
  onPollCreated?: (pollId: string, question: string) => void
  onPollUpdated?: (pollId: string, voterId: string) => void
  onPollClosed?: (pollId: string) => void
  /** NCC-006: polling dibuat/diubah/ditutup — pollId null bila tak terbaca. */
  onPollChanged?: (pollId: string | null) => void
  /** NCC-006: pesan ephemeral kedaluwarsa — hapus dari thread. */
  onMessagesExpired?: (messageIds: string[]) => void
  /** NCC-006: room di-pin/unpin (antar perangkat) — sinkron daftar room. */
  onRoomPinChanged?: (isPinned: boolean) => void
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
      const { messageId, isOwnDeviceSync, readAt, markedCount } =
        payload as Partial<ChatReadPayload>
      // Audit Pesan 2026-10-10 (realtime #1, KRITIS): backend menyetel
      // `isOwnDeviceSync: true` pada SETIAP `chat.read` — termasuk siaran ke
      // lawan bicara. Flag itu hanya bermakna "sinkron perangkat saya" bila
      // `userId` payload = saya. Dulu semua bacaan lawan bicara dibuang
      // → centang ganda tidak pernah naik secara live.
      const self = isSelf(payload)
      if (self && isOwnDeviceSync !== true) return
      callbacks().onRead?.(typeof messageId === "string" && messageId ? messageId : null, {
        readAt: typeof readAt === "string" ? readAt : null,
        markedCount: typeof markedCount === "number" ? markedCount : undefined,
        ownDeviceSync: self && isOwnDeviceSync === true,
      })
    },
    [CHAT_SOCKET_EVENTS.TYPING]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload) || isSelf(payload)) return
      const { isTyping, userId, username } = payload as Partial<ChatTypingPayload>
      callbacks().onTyping?.(isTyping === true, {
        userId: typeof userId === "string" && userId ? userId : "peer",
        name: typeof username === "string" && username.trim() ? username.trim() : null,
      })
    },
    [CHAT_SOCKET_EVENTS.USER_ONLINE]: () => {
      callbacks().onPresence?.(true)
    },
    [CHAT_SOCKET_EVENTS.USER_OFFLINE]: () => {
      callbacks().onPresence?.(false)
    },
    /**
     * BFI-119/NCC-006: polling di room — payload aktual BE (chat.service.ts):
     * created `{ roomId, pollId, question }`, updated
     * `{ roomId, pollId, voterId }`, closed `{ roomId, pollId }`.
     * Pemanggil memakai ini untuk me-refetch daftar poll (listPolls)
     * alih-alih menunggu poll REST berikutnya (BFI-119) atau memakai
     * `onPollChanged` longgar (NCC-006) — keduanya dipanggil.
     */
    [CHAT_SOCKET_EVENTS.POLL_CREATED]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload)) return
      const { pollId, question } = payload as Partial<ChatPollCreatedPayload>
      if (typeof pollId === "string" && pollId) {
        if (typeof question === "string") callbacks().onPollCreated?.(pollId, question)
        callbacks().onPollChanged?.(pollId)
      } else {
        callbacks().onPollChanged?.(null)
      }
    },
    [CHAT_SOCKET_EVENTS.POLL_UPDATED]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload)) return
      const { pollId, voterId } = payload as Partial<ChatPollUpdatedPayload>
      if (typeof pollId === "string" && pollId) {
        if (typeof voterId === "string") callbacks().onPollUpdated?.(pollId, voterId)
        callbacks().onPollChanged?.(pollId)
      } else {
        callbacks().onPollChanged?.(null)
      }
    },
    [CHAT_SOCKET_EVENTS.POLL_CLOSED]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload)) return
      const { pollId } = payload as Partial<ChatPollClosedPayload>
      if (typeof pollId === "string" && pollId) {
        callbacks().onPollClosed?.(pollId)
        callbacks().onPollChanged?.(pollId)
      } else {
        callbacks().onPollChanged?.(null)
      }
    },
    /**
     * BFI-117/NCC-006: pesan sekali-lihat dikonsumsi penerima
     * (`{ roomId, messageId, viewerId? }`) — tandai sebagai sudah dibuka.
     */
    [CHAT_SOCKET_EVENTS.MESSAGE_VIEW_ONCE_CONSUMED]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload)) return
      const { messageId } = payload as Partial<ChatViewOnceConsumedPayload>
      if (typeof messageId === "string" && messageId) {
        callbacks().onViewOnceConsumed?.(messageId)
      }
    },
    /** NCC-006: pesan ephemeral kedaluwarsa — hapus dari thread. */
    [CHAT_SOCKET_EVENTS.MESSAGES_EXPIRED]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload)) return
      const { messageIds } = payload as Partial<ChatMessagesExpiredPayload>
      if (Array.isArray(messageIds)) {
        callbacks().onMessagesExpired?.(
          messageIds.filter((id): id is string => typeof id === "string" && id.length > 0),
        )
      }
    },
    // BFI-113/NCC-006: pin/unpin ROOM dikirim ke room `user:<id>` (bukan
    // `chat:<id>`), tetapi socket yang sama menerimanya; payload selalu
    // membawa roomId sehingga filter sameRoom tetap berlaku saat layar room
    // terkait sedang terbuka. Kedua bentuk callback dipanggil: granular
    // (BFI-113: roomId + position) dan longgar (NCC-006: boolean).
    [CHAT_SOCKET_EVENTS.ROOM_PINNED]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload)) return
      const { roomId, position } = payload as Partial<ChatRoomPinPayload>
      if (typeof roomId !== "string" || !roomId) return
      if (typeof position === "number") callbacks().onRoomPinned?.(roomId, position)
      callbacks().onRoomPinChanged?.(true)
    },
    [CHAT_SOCKET_EVENTS.ROOM_UNPINNED]: (payload) => {
      if (!sameRoom(payload) || !isRecord(payload)) return
      const { roomId } = payload as Partial<ChatRoomPinPayload>
      if (typeof roomId !== "string" || !roomId) return
      callbacks().onRoomUnpinned?.(roomId)
      callbacks().onRoomPinChanged?.(false)
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
  /**
   * Audit Pesan 2026-10-10 (realtime #7): "sehat" = socket tersambung DAN
   * join ruang ini diakui server. Join yang ditolak/timeout tidak memasang
   * listener apa pun; dulu `healthy` tetap true sehingga polling fallback
   * ikut mati dan ruang membeku sampai reconnect.
   */
  const [joined, setJoined] = useState(false)
  const healthy = status === "connected" && joined

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
    // Typing: sinyal mentah → roster (expiry otomatis PER PENGGUNA) → callback.
    // `onTyping` boolean tetap dipanggil (kompatibel) bersama daftar lengkapnya.
    const roster = createTypingRoster((typers) => {
      if (cancelled) return
      callbacksRef.current.onTypers?.(typers)
      callbacksRef.current.onTyping?.(typers.length > 0)
    })
    const handlers = createChatRoomHandlers(roomId, viewerId, {
      onMessage: (raw) => callbacksRef.current.onMessage?.(raw),
      onMessageUpdated: (raw) => callbacksRef.current.onMessageUpdated?.(raw),
      onMessageDeleted: (id) => callbacksRef.current.onMessageDeleted?.(id),
      onReaction: (id, reactions) => callbacksRef.current.onReaction?.(id, reactions),
      onPin: (id, isPinned) => callbacksRef.current.onPin?.(id, isPinned),
      onRead: (id, meta) => callbacksRef.current.onRead?.(id, meta),
      onTyping: (isTyping, who) => roster.signal(who?.userId ?? "peer", isTyping, who?.name),
      onPresence: (isOnline) => callbacksRef.current.onPresence?.(isOnline),
      // BFI-118/BFI-119: teruskan callback poll & status order ke tabel
      // routing — tanpanya listener di atas tidak pernah memanggil balik.
      onPollCreated: (pollId, question) =>
        callbacksRef.current.onPollCreated?.(pollId, question),
      onPollUpdated: (pollId, voterId) =>
        callbacksRef.current.onPollUpdated?.(pollId, voterId),
      onPollClosed: (pollId) => callbacksRef.current.onPollClosed?.(pollId),
      // NCC-006: teruskan callback longgar polling / view-once /
      // ephemeral / pin room — tanpanya handler tabel di atas diam.
      onPollChanged: (pollId) => callbacksRef.current.onPollChanged?.(pollId),
      onViewOnceConsumed: (messageId) =>
        callbacksRef.current.onViewOnceConsumed?.(messageId),
      onMessagesExpired: (messageIds) =>
        callbacksRef.current.onMessagesExpired?.(messageIds),
      onRoomPinned: (roomId, position) =>
        callbacksRef.current.onRoomPinned?.(roomId, position),
      onRoomUnpinned: (roomId) => callbacksRef.current.onRoomUnpinned?.(roomId),
      onRoomPinChanged: (isPinned) =>
        callbacksRef.current.onRoomPinChanged?.(isPinned),
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
      setJoined(true)
      attach()
      epochRef.current = epoch
      // Realtime #9/#15: SETIAP join sukses diikuti sinkronisasi REST —
      // bukan hanya reconnect. Pesan yang tiba di antara GET awal dan ack
      // join (atau selagi listener belum terpasang) dulu hilang karena
      // polling fallback dijeda saat socket sehat. Delta-nya murah.
      callbacksRef.current.onReconnect?.()
    })()

    return () => {
      cancelled = true
      roster.dispose()
      // Socket putus / ganti ruang: tanpa ini "mengetik…" yang terakhir tampil
      // menetap selamanya (timer expiry ikut dibuang bersama roster).
      callbacksRef.current.onTypers?.([])
      callbacksRef.current.onTyping?.(false)
      detach()
      setJoined(false)
      if (joinedRef.current) {
        joinedRef.current = false
        leaveRoom(roomId)
      }
    }
  }, [roomId, socket, status, epoch, enabled, viewerId, joinRoom, leaveRoom, unwrapEvent])

  return { status, healthy, sendTyping }
}
