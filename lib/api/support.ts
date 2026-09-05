/**
 * Kahade — domain `support` (4 endpoint). Tiket bantuan + balasan.
 */
import { http, seg } from "@/lib/api/client"
import type { CreateTicketDto } from "@/lib/api/types"

export type SupportMessage = {
  id: string
  text: string
  fromUser: boolean
  createdAt: string
}

/** Tiket dukungan — UNVERIFIED. */
export type SupportTicket = {
  id: string
  ticketNumber: string
  subject: string
  status: "OPEN" | "IN_PROGRESS" | "WAITING_USER" | "RESOLVED" | "CLOSED" | string
  category?: string
  updatedAt: string
  lastMessage?: SupportMessage | null
  messages?: SupportMessage[]
  attachmentKeys?: string[]
}

export function listSupportTickets() {
  return http.get<SupportTicket[]>("/v1/support/tickets", { auth: "required", retry: 1 })
}

export function getSupportTicket(ticketId: string) {
  return http.get<SupportTicket>(`/v1/support/tickets/${seg(ticketId)}`, {
    auth: "required",
    retry: 1,
  })
}

/** POST /v1/support/tickets — DTO spec hanya attachments; subject dikirim di body juga (toleran). */
export function createSupportTicket(dto: CreateTicketDto & { subject?: string; message?: string }) {
  return http.post<SupportTicket, CreateTicketDto & { subject?: string; message?: string }>(
    "/v1/support/tickets",
    dto,
    { auth: "required" },
  )
}

export function replySupportTicket(ticketId: string, message: string) {
  return http.post<SupportTicket, { message: string }>(
    `/v1/support/tickets/${seg(ticketId)}/reply`,
    { message },
    { auth: "required" },
  )
}
