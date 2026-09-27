/**
 * Kahade — routing event realtime per ruang chat (GAP-B2, G105–G116).
 *
 * Modul MURNI: tanpa react, tanpa react-native, tanpa socket.io-client
 * secara runtime (hanya type-import) — bisa diuji di Vitest (node) tanpa
 * stub. Dipakai oleh `useChatRoomRealtime` (hook) dan langsung oleh test
 * (G125) dengan mock emitter dua klien.
 *
 * `createChatRoomHandlers` adalah tabel routing (event, payload) →
 * callback. Payload yang tidak valid / room lain / gema sendiri diabaikan
 * diam-diam (fail-closed di sisi UI: tidak merusak thread).
 */
import type { ChatReaction } from "@/lib/api/chat"
import {
  CHAT_SOCKET_EVENTS,
  reconcileReactionViewer,
  type ChatMessageDeletedPayload,
  type ChatPinPayload,
  type ChatReactionPayload,
  type ChatReadPayload,
  type ChatTypingPayload,
} from "./chat-events"

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
 *
 * @param roomId id ruang yang di-join (`chat:<roomId>` di server).
 * @param viewerId id internal viewer (JWT sub) — untuk filter gema event
 *   milik sendiri dan rekonsiliasi `reactedByMe` dari payload netral.
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
        // Server mengirim payload per-viewer (room `user:<id>`) DAN payload
        // netral (room `chat:<id>`) ke socket yang sama; yang netral selalu
        // `reactedByMe: false`. Rekonsiliasi dari daftar `users` (otoritatif)
        // agar payload netral yang tiba belakangan tidak mematikan chip
        // reaksi milik sendiri (G113).
        callbacks().onReaction?.(
          messageId,
          reconcileReactionViewer(reactions as ChatReaction[], viewerId),
        )
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
      // Gema mark-as-read milik sendiri diabaikan — hanya bacaan lawan
      // bicara yang menarik (payload.userId = id internal pembaca).
      if (!sameRoom(payload) || !isRecord(payload) || isSelf(payload)) return
      const { messageId } = payload as Partial<ChatReadPayload>
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
  }
}
