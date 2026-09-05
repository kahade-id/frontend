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
  messageType: "TEXT" | "IMAGE" | "FILE" | "SYSTEM" | string
  fromUser: boolean
  attachments?: ChatAttachmentDto[]
  replyToId?: string | null
  createdAt: string
}

export function listChatRooms(query: { page?: number; limit?: number } = {}) {
  return http.get<ChatRoom[]>("/v1/chat/rooms", {
    query: { page: query.page ?? 1, limit: query.limit ?? CHAT_PAGE_SIZE },
    auth: "required",
    retry: 1,
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
  | { items?: ChatMessage[]; data?: ChatMessage[]; messages?: ChatMessage[]; nextCursor?: string | null; cursor?: string | null }

function normalizeMessagesPage(raw: RawMessagesResponse): ChatMessagesPage {
  if (Array.isArray(raw)) return { items: raw, nextCursor: null }
  const items = raw.items ?? raw.data ?? raw.messages ?? []
  return { items, nextCursor: raw.nextCursor ?? raw.cursor ?? null }
}

export async function getChatMessages(roomId: string, query: ChatMessagesQuery = {}): Promise<ChatMessagesPage> {
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
  return http.post<ChatAttachmentDto, FormData>(`/v1/chat/rooms/${seg(roomId)}/upload`, formData, {
    auth: "required",
  })
}

export function getChatAttachments(roomId: string, query: { page?: number; limit?: number } = {}) {
  return http.get<ChatAttachmentDto[]>(`/v1/chat/rooms/${seg(roomId)}/attachments`, {
    query: { page: query.page ?? 1, limit: query.limit ?? CHAT_PAGE_SIZE },
    auth: "required",
    retry: 1,
  })
}
