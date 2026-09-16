import { readList } from "@/lib/api/response"
/**
 * Kahade — domain `support` (7 endpoint). Tiket bantuan + balasan +
 * tutup/buka lagi/beri rating.
 */
import { http, seg } from "@/lib/api/client"
import { pickUserId } from "@/lib/api/response"
import type { CreateTicketDto } from "@/lib/api/types"

export type SupportMessage = {
  id: string
  text: string
  fromUser: boolean
  createdAt: string
}

/** Tiket dukungan. */
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
  /** Rating yang sudah terkirim (1–5) — `null` = belum memberi rating. */
  rating?: number | null
  ratingComment?: string | null
}

/**
 * Backend mengembalikan baris Prisma mentah: balasan ada di `replies`
 * (field `message`, `isStaff`), bukan `messages`/`text`/`fromUser` — dan
 * TIDAK ada kolom `ticketNumber`. Tanpa normalisasi, seksi "Percakapan" di
 * detail tiket selalu kosong dan nomor tiket ter-render kosong.
 * Nomor tiket diturunkan dari id (6 karakter akhir) — stabil per tiket.
 */
function normalizeSupportMessage(raw: unknown): SupportMessage {
  const record = (raw ?? {}) as Record<string, unknown>
  return {
    id: pickUserId(record),
    text:
      typeof record.message === "string"
        ? record.message
        : typeof record.text === "string"
          ? record.text
          : "",
    fromUser: raw && typeof raw === "object" && "fromUser" in record
      ? Boolean(record.fromUser)
      : record.isStaff !== true,
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : typeof record.createdAt === "number"
          ? new Date(record.createdAt).toISOString()
          : "",
  }
}

function normalizeSupportTicket(raw: unknown): SupportTicket {
  const record = (raw ?? {}) as Record<string, unknown>
  const replies = Array.isArray(record.replies) ? (record.replies as unknown[]) : []
  const messages = replies.map((r) => normalizeSupportMessage(r))
  const latest =
    (Array.isArray(record.messages) && (record.messages as unknown[]).at(-1)) ?? replies.at(-1) ?? null
  const id = pickUserId(record)
  return {
    id,
    ticketNumber:
      typeof record.ticketNumber === "string" && record.ticketNumber
        ? record.ticketNumber
        : `TK-${(id.slice(-6) || "------").toUpperCase()}`,
    subject: typeof record.subject === "string" ? record.subject : "",
    status: typeof record.status === "string" ? record.status : "OPEN",
    category: typeof record.category === "string" ? record.category : undefined,
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : typeof record.createdAt === "string"
          ? record.createdAt
          : "",
    lastMessage: latest ? normalizeSupportMessage(latest) : null,
    messages,
    attachmentKeys: Array.isArray(record.attachments)
      ? (record.attachments as unknown[]).filter((a): a is string => typeof a === "string")
      : undefined,
    rating: typeof record.rating === "number" ? record.rating : null,
    ratingComment: typeof record.ratingComment === "string" ? record.ratingComment : null,
  }
}

export function listSupportTickets(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/support/tickets", { auth: "required", retry: 1, signal })
    .then((raw) => readList<unknown>(raw, ["tickets", "data"]).map(normalizeSupportTicket))
}

export function getSupportTicket(ticketId: string, signal?: AbortSignal) {
  return http.get<unknown>(`/v1/support/tickets/${seg(ticketId)}`, {
    auth: "required",
    retry: 1,
    signal,
  }).then(normalizeSupportTicket)
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

// ------------------------------------------------------------------
// Aksi pemilik tiket (audit P2 cluster tiket): tutup / buka lagi / rating.
// Ketiga endpoint tanpa DTO whitelist (body dibacakan @Param + field polos),
// jadi bentuk body di bawah mengikuti signature controller apa adanya.
// ------------------------------------------------------------------

/** POST /v1/support/tickets/{id}/close — tutup tiket sendiri (tanpa body). Status selain CLOSED/RESOLVED → CLOSED. */
export function closeSupportTicket(ticketId: string) {
  return http.post<Record<string, unknown>>(
    `/v1/support/tickets/${seg(ticketId)}/close`,
    undefined,
    { auth: "required" },
  )
}

/** POST /v1/support/tickets/{id}/reopen — buka lagi tiket CLOSED → OPEN (tanpa body). */
export function reopenSupportTicket(ticketId: string) {
  return http.post<Record<string, unknown>>(
    `/v1/support/tickets/${seg(ticketId)}/reopen`,
    undefined,
    { auth: "required" },
  )
}

/** POST /v1/support/tickets/{id}/rate — rating 1–5 + komentar opsional; hanya untuk tiket RESOLVED/CLOSED. */
export function rateSupportTicket(ticketId: string, rating: number, comment?: string) {
  return http.post<Record<string, unknown>, { rating: number; comment?: string }>(
    `/v1/support/tickets/${seg(ticketId)}/rate`,
    { rating, ...(comment && comment.trim() ? { comment: comment.trim() } : {}) },
    { auth: "required" },
  )
}
