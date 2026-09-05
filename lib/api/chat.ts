import { readList, readPage } from "@/lib/api/response"
/**
 * Kahade — domain `chat` (ruang & pesan, lampiran, read receipt).
 *
 * Catatan spec:
 *   - `GET /rooms/{roomId}/messages` memakai paginasi KURSOR: query `cursor`
 *     (id/waktu pesan tertua yang sudah dimuat), `limit`, `excludeIds`
 *     (id yang sudah ada, dipisah koma). Spec menandai ketiganya REQUIRED,
 *     tetapi halaman pertama tidak punya kursor — dikirim kosong bila tidak
 *     ada (client membuang nilai undefined). Bentuk respons tidak
 *     didokumentasikan; kami menerima array langsung ATAU `{ items, nextCursor }`
 *     dan menormalkannya lewat `normalizeMessagesPage`.
 *   - `GET /rooms` & `GET /rooms/{roomId}/attachments` memakai page/limit.
 */
import { http, seg } from "@/lib/api/client"
import type { ChatAttachmentDto, SendMessageDto } from "@/lib/api/types"

export const CHAT_PAGE_SIZE = 30

export type ChatRoom = {
  id: string
  counterpart?: {
    id: string
    username: string
    fullName?: string
    avatarUrl?: string | null
  }
  orderId?: string | null
  lastMessage?: ChatMessage | null
  unreadCount: number
  updatedAt: string
}

export type ChatMessage = {
  id: string
  text?: string
  senderId?: string | null
  messageType: "TEXT" | "IMAGE" | "FILE" | "SYSTEM" | string
  fromUser: boolean
  attachments?: ChatAttachmentDto[]
  replyToId?: string | null
  createdAt: string
}

function normalizeChatMessage(raw: ChatMessage & Record<string, unknown>): ChatMessage {
  return {
    ...raw,
    text: raw.text ?? (typeof raw.content === "string" ? raw.content : undefined),
    senderId: raw.senderId ?? null,
    fromUser:
      typeof raw.fromUser === "boolean"
        ? raw.fromUser
        : raw.isMine === true || raw.isFromCurrentUser === true,
  }
}

function normalizeChatRoom(raw: ChatRoom & Record<string, unknown>): ChatRoom {
  const other = raw.otherUser as ChatRoom["counterpart"] | undefined
  const last = raw.lastMessage as (ChatMessage & Record<string, unknown>) | null | undefined
  return {
    ...raw,
    counterpart: raw.counterpart ?? other,
    lastMessage: last ? normalizeChatMessage(last) : null,
    unreadCount: typeof raw.unreadCount === "number" ? raw.unreadCount : 0,
  }
}

export function listChatRooms(
  options: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  const query = { page: options.page ?? 1, limit: options.limit ?? CHAT_PAGE_SIZE }
  return http
    .get<unknown>("/v1/chat/rooms", {
      query,
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => {
      const page = readPage<ChatRoom & Record<string, unknown>>(raw, query, ["rooms"])
      return { ...page, data: page.data.map(normalizeChatRoom) }
    })
}

export type ChatMessagesQuery = {
  /** Kursor halaman berikutnya (dari `nextCursor` atau id pesan tertua) */
  cursor?: string
  limit?: number
  /** Id pesan yang sudah dimiliki klien (dikirim dipisah koma) */
  excludeIds?: string[]
}

export type ChatMessagesPage = {
  items: ChatMessage[]
  nextCursor?: string | null
}

type RawMessagesResponse =
  | ChatMessage[]
  | {
      items?: ChatMessage[]
      data?: ChatMessage[]
      messages?: ChatMessage[]
      nextCursor?: string | null
      cursor?: string | null
    }

function normalizeMessagesPage(raw: RawMessagesResponse): ChatMessagesPage {
  if (Array.isArray(raw)) return { items: raw.map(normalizeChatMessage), nextCursor: null }
  const items = readList<ChatMessage & Record<string, unknown>>(raw, ["messages"])
  return { items: items.map(normalizeChatMessage), nextCursor: raw.nextCursor ?? raw.cursor ?? null }
}

export async function getChatMessages(
  roomId: string,
  query: ChatMessagesQuery = {},
): Promise<ChatMessagesPage> {
  const raw = await http.get<RawMessagesResponse>(`/v1/chat/rooms/${seg(roomId)}/messages`, {
    query: {
      cursor: query.cursor,
      limit: query.limit ?? CHAT_PAGE_SIZE,
      excludeIds: query.excludeIds?.length ? query.excludeIds.join(",") : undefined,
    },
    auth: "required",
    retry: 1,
  })
  return normalizeMessagesPage(raw)
}

export function sendChatMessage(roomId: string, dto: SendMessageDto) {
  return http.post<ChatMessage, SendMessageDto>(`/v1/chat/rooms/${seg(roomId)}/messages`, dto, {
    auth: "required",
  })
}

export function markChatRoomRead(roomId: string) {
  return http.post<void>(`/v1/chat/rooms/${seg(roomId)}/read`, undefined, { auth: "required" })
}

export function deleteChatMessage(roomId: string, messageId: string) {
  return http.delete<void>(`/v1/chat/rooms/${seg(roomId)}/messages/${seg(messageId)}`, {
    auth: "required",
    responseType: "void",
  })
}

export function uploadChatAttachment(roomId: string, formData: FormData) {
  return http.post<ChatAttachmentDto>(`/v1/chat/rooms/${seg(roomId)}/upload`, undefined, {
    formData,
    auth: "required",
  })
}

export function getChatAttachments(roomId: string, query: { page?: number; limit?: number } = {}) {
  return http
    .get<ChatAttachmentDto[]>(`/v1/chat/rooms/${seg(roomId)}/attachments`, {
      query: { page: query.page ?? 1, limit: query.limit ?? CHAT_PAGE_SIZE },
      auth: "required",
      retry: 1,
    })
    .then((raw) => readList<ChatAttachmentDto>(raw, ["attachments"]))
}
