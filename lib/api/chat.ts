/**
 * Kahade — domain `chat` (ruang & pesan, lampiran, read receipt).
 */
import { http, seg } from "@/lib/api/client"
import type { ChatAttachmentDto, SendMessageDto } from "@/lib/api/types"

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

export function listChatRooms() {
  return http.get<ChatRoom[]>("/v1/chat/rooms", { auth: "required", retry: 1 })
}

export function getChatMessages(
  roomId: string,
  query?: { page?: number; limit?: number; before?: string },
) {
  return http.get<ChatMessage[]>(`/v1/chat/rooms/${seg(roomId)}/messages`, {
    query,
    auth: "required",
    retry: 1,
  })
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

export function getChatAttachments(roomId: string) {
  return http.get<ChatAttachmentDto[]>(`/v1/chat/rooms/${seg(roomId)}/attachments`, {
    auth: "required",
    retry: 1,
  })
}
