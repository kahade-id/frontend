/**
 * Kahade — realtime livechat dukungan: konstanta event & helper MURNI
 * (Poin 5, gelombang 2, 2026-10-04).
 *
 * Modul ini TIDAK menyentuh react-native / socket.io-client secara runtime
 * (hanya type-import), sehingga bisa diuji di Vitest (node) tanpa stub —
 * sama seperti `lib/realtime/chat-events.ts`.
 *
 * Protokol wire (backend, live di main):
 * - Socket.IO namespace `/` (sama dengan chat), transport websocket-only.
 * - Auth `auth: { token }` — socket bersama lewat `useRealtime`.
 * - Client → server: `support.join` { conversationId }, `support.leave`,
 *   `support.message` { conversationId, content?, attachments? }.
 * - Server → client: `support.message.new`, `support.typing`,
 *   `support.agent_joined`, `support.agent_left`, `support.assigned`,
 *   `support.escalated`.
 * - Ack `support.join`: { success, conversation, messages[30], agentOnline,
 *   queuePosition }.
 * - Ack `support.message`: { success, data?, message? }.
 * - Event bertanda tangan bila WS_HMAC_KEY aktif: diverifikasi lewat
 *   `unwrapEvent` dari context realtime (sama seperti client chat).
 */

import type { Socket } from "socket.io-client"

/** Nama event socket livechat — satu sumber kebenaran untuk klien. */
export const SUPPORT_CHAT_SOCKET_EVENTS = {
  /** Client → server: gabung percakapan (ack: SupportJoinAck). */
  JOIN: "support.join",
  /** Client → server: keluar percakapan. */
  LEAVE: "support.leave",
  /** Client → server: kirim pesan (ack: SupportMessageAck). */
  MESSAGE: "support.message",
  /** Server → client: pesan baru (SupportChatMessagePayload). */
  MESSAGE_NEW: "support.message.new",
  /** Server → client: indikator mengetik (SupportTypingPayload). */
  TYPING: "support.typing",
  /** Server → client: agen masuk ke percakapan. */
  AGENT_JOINED: "support.agent_joined",
  /** Server → client: agen keluar dari percakapan. */
  AGENT_LEFT: "support.agent_left",
  /** Server → client: percakapan di-assign ke agen (SupportAssignedPayload). */
  ASSIGNED: "support.assigned",
  /** Server → client: percakapan dieskalasi jadi tiket (SupportEscalatedPayload). */
  ESCALATED: "support.escalated",
} as const

/** Peran pengirim livechat — enum backend. */
export type SupportSenderType = "USER" | "AGENT" | "SYSTEM"

const SUPPORT_SENDER_TYPES: ReadonlySet<string> = new Set([
  "USER",
  "AGENT",
  "SYSTEM",
])

/** Lampiran pesan livechat — bentuk dinormalisasi (toleran: bisa string URL atau objek). */
export type SupportChatAttachment = {
  url?: string | null
  name?: string | null
  mimeType?: string | null
  size?: number | null
}

/** Pesan livechat yang dinormalisasi untuk UI. */
export type SupportChatMessage = {
  id: string
  conversationId: string
  senderType: SupportSenderType
  senderId: string | null
  senderName: string | null
  content: string
  attachments: SupportChatAttachment[]
  createdAt: string
  /** Status percakapan saat pesan dikirim (dibaca toleran, bila dikirim). */
  conversationStatus?: string | null
}

/** Payload mentah `support.message.new`. */
export type SupportChatMessagePayload = {
  id?: unknown
  conversationId?: unknown
  senderType?: unknown
  senderId?: unknown
  senderName?: unknown
  content?: unknown
  attachments?: unknown
  createdAt?: unknown
  conversationStatus?: unknown
}

/** Payload mentah `support.typing`. */
export type SupportTypingPayload = {
  conversationId?: unknown
  senderType?: unknown
  senderId?: unknown
  isTyping?: unknown
  expiresAt?: unknown
}

/** Payload mentah `support.assigned`. */
export type SupportAssignedPayload = {
  conversationId?: unknown
  agentName?: unknown
  agentId?: unknown
}

/** Payload mentah `support.escalated`. */
export type SupportEscalatedPayload = {
  conversationId?: unknown
  ticketId?: unknown
  ticketNumber?: unknown
  subject?: unknown
}

/** Bentuk ack `support.join` yang dinormalisasi. */
export type SupportJoinAck = {
  success: boolean
  conversation: Record<string, unknown> | null
  messages: SupportChatMessage[]
  agentOnline: boolean
  queuePosition: number | null
  /** Pesan penolakan dari server (bila success = false). */
  message?: string | null
}

/** Bentuk ack `support.message` yang dinormalisasi. */
export type SupportMessageAck = {
  success: boolean
  /** Id pesan di server (bila dikembalikan) — untuk swap optimistic. */
  messageId: string | null
  message?: string | null
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null
}

function normalizeAttachment(raw: unknown): SupportChatAttachment | null {
  if (typeof raw === "string") {
    return raw ? { url: raw } : null
  }
  if (typeof raw !== "object" || raw === null) return null
  const r = raw as Record<string, unknown>
  const url = pickString(r.url ?? r.fileUrl ?? r.file_url ?? r.key)
  const name = pickString(r.name ?? r.fileName ?? r.file_name)
  const mimeType = pickString(r.mimeType ?? r.mime_type ?? r.contentType)
  const size =
    typeof r.size === "number" && Number.isFinite(r.size) ? r.size : null
  if (!url && !name) return null
  return { url, name, mimeType, size }
}

/**
 * Normalisasi boundary: pesan mentah backend → `SupportChatMessage`.
 * Mengembalikan `null` bila bentuknya tidak bisa dibaca (tanpa id) —
 * pemanggil mengabaikannya (fail-closed di sisi UI).
 */
export function normalizeSupportChatMessage(
  raw: unknown,
): SupportChatMessage | null {
  if (typeof raw !== "object" || raw === null) return null
  const r = raw as SupportChatMessagePayload
  const id =
    pickString(r.id) ?? pickString((r as Record<string, unknown>).messageId)
  if (!id) return null
  const senderTypeRaw = pickString(r.senderType)?.toUpperCase() ?? null
  const senderType: SupportSenderType =
    senderTypeRaw && SUPPORT_SENDER_TYPES.has(senderTypeRaw)
      ? (senderTypeRaw as SupportSenderType)
      : "SYSTEM"
  const attachments = Array.isArray(r.attachments)
    ? (r.attachments as unknown[])
        .map(normalizeAttachment)
        .filter((a): a is SupportChatAttachment => a !== null)
    : []
  return {
    id,
    conversationId: pickString(r.conversationId) ?? "",
    senderType,
    senderId: pickString(r.senderId),
    senderName: pickString(r.senderName),
    content: typeof r.content === "string" ? r.content : "",
    attachments,
    createdAt:
      typeof r.createdAt === "string" && r.createdAt
        ? r.createdAt
        : new Date().toISOString(),
    conversationStatus: pickString(r.conversationStatus),
  }
}

/**
 * Normalisasi ack `support.join` (bisa fungsi callback socket.io atau
 * objek langsung). `messages[30]` = riwayat awal dari server.
 */
export function parseSupportJoinAck(ack: unknown): SupportJoinAck {
  const empty: SupportJoinAck = {
    success: false,
    conversation: null,
    messages: [],
    agentOnline: false,
    queuePosition: null,
  }
  if (typeof ack !== "object" || ack === null) return empty
  const r = ack as Record<string, unknown>
  const messages = Array.isArray(r.messages)
    ? (r.messages as unknown[])
        .map(normalizeSupportChatMessage)
        .filter((m): m is SupportChatMessage => m !== null)
    : []
  const queuePosition =
    typeof r.queuePosition === "number" && Number.isFinite(r.queuePosition)
      ? r.queuePosition
      : null
  return {
    success: r.success === true,
    conversation:
      typeof r.conversation === "object" && r.conversation !== null
        ? (r.conversation as Record<string, unknown>)
        : null,
    messages,
    agentOnline: r.agentOnline === true,
    queuePosition,
    message: pickString(r.message),
  }
}

/**
 * Normalisasi ack `support.message`. Bentuk `data` backend dibaca toleran
 * (objek dengan `id` / `messageId`, atau id langsung di root).
 */
export function parseSupportMessageAck(ack: unknown): SupportMessageAck {
  if (typeof ack !== "object" || ack === null) {
    return { success: false, messageId: null }
  }
  const r = ack as Record<string, unknown>
  const data =
    typeof r.data === "object" && r.data !== null
      ? (r.data as Record<string, unknown>)
      : null
  const messageId =
    pickString(data?.id ?? data?.messageId) ??
    pickString(r.id ?? r.messageId) ??
    null
  return {
    success: r.success === true,
    messageId,
    message: pickString(r.message),
  }
}

/** Emit `support.message` dengan ack + timeout — dipakai hook (unit-testable lewat socket mock). */
export const SUPPORT_SEND_ACK_TIMEOUT_MS = 10_000

export function emitSupportMessage(
  socket: Pick<Socket, "emit">,
  payload: { conversationId: string; content: string; attachments?: unknown[] },
  timeoutMs: number = SUPPORT_SEND_ACK_TIMEOUT_MS,
): Promise<SupportMessageAck> {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ success: false, messageId: null, message: "timeout" }),
      timeoutMs,
    )
    socket.emit(
      SUPPORT_CHAT_SOCKET_EVENTS.MESSAGE,
      payload,
      (ack: unknown) => {
        clearTimeout(timer)
        resolve(parseSupportMessageAck(ack))
      },
    )
  })
}

/** Emit `support.join` dengan ack + timeout — dipakai hook. */
export const SUPPORT_JOIN_ACK_TIMEOUT_MS = 10_000

export function emitSupportJoin(
  socket: Pick<Socket, "emit">,
  conversationId: string,
  timeoutMs: number = SUPPORT_JOIN_ACK_TIMEOUT_MS,
): Promise<SupportJoinAck> {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () =>
        resolve({
          success: false,
          conversation: null,
          messages: [],
          agentOnline: false,
          queuePosition: null,
          message: "timeout",
        }),
      timeoutMs,
    )
    socket.emit(
      SUPPORT_CHAT_SOCKET_EVENTS.JOIN,
      { conversationId },
      (ack: unknown) => {
        clearTimeout(timer)
        resolve(parseSupportJoinAck(ack))
      },
    )
  })
}
