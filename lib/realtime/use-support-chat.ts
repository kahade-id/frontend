/**
 * Kahade — hook realtime per percakapan livechat dukungan
 * (Poin 5, gelombang 2, 2026-10-04).
 *
 * - Memakai socket BERSAMA dari `RealtimeProvider` (namespace `/` yang sama
 *   dengan chat, transport websocket-only) — tidak membuat socket baru.
 * - `support.join` / `support.leave` ke percakapan; ack join membawa
 *   `messages[30]` (riwayat awal) + `agentOnline` + `queuePosition`.
 * - Listener didaftarkan ulang setiap join dan DIBERSIHKAN saat unmount /
 *   ganti percakapan / putus koneksi.
 * - Reconnect (terdeteksi via `epoch` provider): join ulang + `onJoinAck`
 *   dipanggil lagi sehingga layar bisa me-merge riwayat server (pesan yang
 *   terlewat saat putus).
 * - Semua event server melewati `unwrapEvent` (verifikasi envelope HMAC bila
 *   WS_HMAC_KEY aktif di backend) — event tak-valid diabaikan diam-diam.
 *
 * `createSupportChatHandlers` adalah tabel routing MURNI (event, payload) →
 * callback, sehingga bisa diuji dengan mock emitter tanpa socket live —
 * pola yang sama dengan `createChatRoomHandlers` (G125).
 */
import { useCallback, useEffect, useRef } from "react"

import {
  SUPPORT_CHAT_SOCKET_EVENTS,
  emitSupportJoin,
  emitSupportMessage,
  normalizeSupportChatMessage,
  type SupportAssignedPayload,
  type SupportEscalatedPayload,
  type SupportJoinAck,
  type SupportMessageAck,
  type SupportTypingPayload,
} from "./support-chat-events"
import { createTypingTracker } from "./chat-events"
import { useRealtime, useRealtimeActions } from "./realtime-context"

export type SupportChatRealtimeCallbacks = {
  /** Ack `support.join` — join pertama MAUPUN join ulang setelah reconnect. */
  onJoinAck?: (ack: SupportJoinAck) => void
  /** Payload mentah `support.message.new` (sudah lewat unwrapEvent). */
  onMessage?: (raw: unknown) => void
  /** Indikator mengetik agen (expiry otomatis dari tracker). */
  onTyping?: (isTyping: boolean, senderName?: string | null) => void
  onAgentJoined?: () => void
  onAgentLeft?: () => void
  /** Payload mentah `support.assigned` (sudah lewat unwrapEvent). */
  onAssigned?: (raw: unknown) => void
  /** Payload mentah `support.escalated` (sudah lewat unwrapEvent). */
  onEscalated?: (raw: unknown) => void
}

type CallbacksSource =
  | SupportChatRealtimeCallbacks
  | (() => SupportChatRealtimeCallbacks)

function resolveCallbacks(
  source: CallbacksSource,
): SupportChatRealtimeCallbacks {
  return typeof source === "function"
    ? (source as () => SupportChatRealtimeCallbacks)()
    : source
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/**
 * Tabel routing event → callback. Murni: tanpa socket, tanpa React.
 * Payload dari percakapan lain diabaikan (socket bersama bisa membawa
 * event percakapan lain bila layar lain mount bersamaan).
 */
export function createSupportChatHandlers(
  conversationId: string,
  viewerId: string | null,
  source: CallbacksSource,
): Record<string, (payload: unknown) => void> {
  const callbacks = () => resolveCallbacks(source)
  const sameConversation = (payload: unknown): boolean =>
    !isRecord(payload) ||
    payload.conversationId === undefined ||
    payload.conversationId === conversationId
  /** Gema milik sendiri: typing USER dari viewer ini bukan dari agen. */
  const isSelfTyping = (payload: unknown): boolean =>
    viewerId != null &&
    isRecord(payload) &&
    payload.senderId === viewerId &&
    String(payload.senderType ?? "").toUpperCase() === "USER"

  return {
    [SUPPORT_CHAT_SOCKET_EVENTS.MESSAGE_NEW]: (payload) => {
      if (!sameConversation(payload)) return
      const msg = normalizeSupportChatMessage(payload)
      if (!msg) return
      callbacks().onMessage?.(msg)
    },
    [SUPPORT_CHAT_SOCKET_EVENTS.TYPING]: (payload) => {
      if (!sameConversation(payload) || !isRecord(payload)) return
      if (isSelfTyping(payload)) return
      const p = payload as Partial<SupportTypingPayload>
      const isTyping = p.isTyping === true
      const senderName =
        typeof p.senderType === "string" &&
        p.senderType.toUpperCase() === "AGENT"
          ? (typeof (p as Record<string, unknown>).senderName === "string"
              ? ((p as Record<string, unknown>).senderName as string)
              : null)
          : null
      callbacks().onTyping?.(isTyping, senderName)
    },
    [SUPPORT_CHAT_SOCKET_EVENTS.AGENT_JOINED]: (payload) => {
      if (!sameConversation(payload)) return
      callbacks().onAgentJoined?.()
    },
    [SUPPORT_CHAT_SOCKET_EVENTS.AGENT_LEFT]: (payload) => {
      if (!sameConversation(payload)) return
      callbacks().onAgentLeft?.()
    },
    [SUPPORT_CHAT_SOCKET_EVENTS.ASSIGNED]: (payload) => {
      if (!sameConversation(payload)) return
      if (!isRecord(payload)) return
      const p = payload as Partial<SupportAssignedPayload>
      if (typeof p.agentName !== "string" || !p.agentName) return
      callbacks().onAssigned?.(payload)
    },
    [SUPPORT_CHAT_SOCKET_EVENTS.ESCALATED]: (payload) => {
      if (!sameConversation(payload)) return
      if (!isRecord(payload)) return
      const p = payload as Partial<SupportEscalatedPayload>
      if (typeof p.ticketId !== "string" || !p.ticketId) return
      callbacks().onEscalated?.(payload)
    },
  }
}

/**
 * Hook realtime livechat untuk satu percakapan.
 *
 * @param conversationId id percakapan dari `POST /v1/support/chat/conversations`.
 *   `undefined` = belum dibuat (layar masih REST) → hook tidak join.
 */
export function useSupportChatRealtime(
  conversationId: string | undefined,
  callbacks: SupportChatRealtimeCallbacks,
  opts?: { enabled?: boolean; retryKey?: number },
): {
  status: ReturnType<typeof useRealtime>["status"]
  healthy: boolean
  /** Kirim pesan teks via socket. Promise resolve dengan hasil ack. */
  sendMessage: (content: string) => Promise<SupportMessageAck>
} {
  const { socket, status, epoch } = useRealtime()
  // PERF-FIX (state audit): aksi stabil via context terpisah.
  const { viewerId, unwrapEvent } = useRealtimeActions()
  const enabled = opts?.enabled !== false
  const retryKey = opts?.retryKey ?? 0
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks
  const joinedRef = useRef(false)
  const conversationRef = useRef(conversationId)
  conversationRef.current = conversationId
  /** Nama pengirim typing terakhir (untuk label "X sedang mengetik"). */
  const typingNameRef = useRef<string | null>(null)
  const healthy = status === "connected"

  const sendMessage = useCallback(
    async (content: string): Promise<SupportMessageAck> => {
      const cid = conversationRef.current
      if (!socket || !cid || !joinedRef.current) {
        return { success: false, messageId: null, message: "not-connected" }
      }
      try {
        return await emitSupportMessage(socket, {
          conversationId: cid,
          content,
        })
      } catch {
        return { success: false, messageId: null, message: "emit-failed" }
      }
    },
    [socket],
  )

  useEffect(() => {
    if (!conversationId || !socket || !enabled || status !== "connected")
      return
    let cancelled = false
    // Typing agen: sinyal mentah → tracker (expiry otomatis) → callback.
    const tracker = createTypingTracker((isTyping) => {
      if (!cancelled)
        callbacksRef.current.onTyping?.(isTyping, typingNameRef.current)
    })
    const handlers = createSupportChatHandlers(conversationId, viewerId, {
      onMessage: (raw) => callbacksRef.current.onMessage?.(raw),
      onTyping: (isTyping, name) => {
        if (isTyping && name) typingNameRef.current = name
        tracker.signal(isTyping)
      },
      onAgentJoined: () => callbacksRef.current.onAgentJoined?.(),
      onAgentLeft: () => callbacksRef.current.onAgentLeft?.(),
      onAssigned: (raw) => callbacksRef.current.onAssigned?.(raw),
      onEscalated: (raw) => callbacksRef.current.onEscalated?.(raw),
    })
    // Simpan wrapper listener per event agar cleanup hanya melepas listener
    // MILIK hook ini (socket dipakai bersama layar chat lain).
    const wrapped = new Map<string, (raw: unknown) => void>()
    const attach = () => {
      // SEMUA event melewati verifikasi envelope HMAC dulu (sama seperti
      // client chat): payload mentah server = payload asli + `_ts` +
      // `_signature`. Event tak-valid diabaikan diam-diam.
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
      const ack = await emitSupportJoin(socket, conversationId).catch(
        (): SupportJoinAck => ({
          success: false,
          conversation: null,
          messages: [],
          agentOnline: false,
          queuePosition: null,
          message: "join-failed",
        }),
      )
      if (cancelled) {
        // Join berhasil tepat saat cleanup: langsung leave lagi agar tidak
        // ada percakapan menggantung di server.
        if (ack.success) {
          socket.emit(SUPPORT_CHAT_SOCKET_EVENTS.LEAVE, { conversationId })
        }
        return
      }
      if (!ack.success) {
        // Serahkan ke layar agar bisa menampilkan error + tombol "Coba lagi"
        // (retry menaikkan `retryKey` → efek jalan ulang → join lagi).
        callbacksRef.current.onJoinAck?.(ack)
        return
      }
      joinedRef.current = true
      attach()
      // Join pertama maupun join ulang (reconnect): serahkan ack ke layar
      // untuk merge riwayat `messages[30]` (pesan yang terlewat saat putus).
      callbacksRef.current.onJoinAck?.(ack)
    })()

    return () => {
      cancelled = true
      tracker.dispose()
      detach()
      if (joinedRef.current) {
        joinedRef.current = false
        socket.emit(SUPPORT_CHAT_SOCKET_EVENTS.LEAVE, { conversationId })
      }
    }
  }, [
    conversationId,
    socket,
    status,
    epoch,
    enabled,
    retryKey,
    viewerId,
    unwrapEvent,
  ])

  return { status, healthy, sendMessage }
}
