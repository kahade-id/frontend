/**
 * Kahade — domain `support` (7 endpoint). Tiket bantuan + balasan +
 * tutup/buka lagi/beri rating.
 */

import { readList } from "@/lib/api/response"

import { http, seg } from "@/lib/api/client"
import { pickUserId } from "@/lib/api/response"
import type { CreateTicketDto } from "@/lib/api/types"

export type SupportMessage = {
  id: string
  text: string
  fromUser: boolean
  createdAt: string
  /** Item 130: lampiran balasan (fileKey, maks 5 — BE-IMP ReplyTicketDto.attachments). */
  attachments?: string[]
  /**
   * Batch 139 (F16): peran pengirim — dibaca toleran dari `isBot` /
   * `senderRole` bila backend mengirimnya; undefined = "agen" (fallback).
   */
  senderRole?: "agent" | "bot"
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
  /**
   * Batch 139 (F06): posisi antrean live support dari server.
   * undefined = backend belum mengirim → UI menampilkan fallback jujur
   * (bukan janji waktu palsu).
   */
  queuePosition?: number | null
  /** Batch 139 (F06): estimasi tunggu (menit) dari server, bila ada. */
  estimatedWaitMinutes?: number | null
  /**
   * Batch 139 (F12): batas respons SLA dari server (ISO string).
   * undefined = belum tersedia → UI jujur "belum tersedia dari server".
   */
  slaDueAt?: string | null
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
  // Batch 139 (F16): peran pengirim — toleran terhadap `isBot` / `senderRole`.
  const senderRoleRaw = record.senderRole
  const senderRole: SupportMessage["senderRole"] =
    record.isBot === true
      ? "bot"
      : typeof senderRoleRaw === "string" && senderRoleRaw.toLowerCase() === "bot"
        ? "bot"
        : undefined
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
    // Item 130: lampiran per balasan — hanya string fileKey yang lolos.
    attachments: Array.isArray(record.attachments)
      ? (record.attachments as unknown[]).filter((a): a is string => typeof a === "string")
      : undefined,
    ...(senderRole ? { senderRole } : {}),
  }
}

function pickFiniteNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined
}

function pickIsoString(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined
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
    // Batch 139 (F06/F12): field opsional dari server — dibaca toleran,
    // undefined bila backend belum mengirim (UI menampilkan fallback jujur).
    queuePosition:
      pickFiniteNumber(record.queuePosition) ?? pickFiniteNumber(record.queue_number) ?? null,
    estimatedWaitMinutes:
      pickFiniteNumber(record.estimatedWaitMinutes) ??
      pickFiniteNumber(record.estimated_wait_minutes) ??
      null,
    slaDueAt:
      pickIsoString(record.slaDueAt) ?? pickIsoString(record.responseDueAt) ?? null,
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

/**
 * POST /v1/support/tickets/{id}/reply.
 * Item 130: `attachments` (fileKey, maks 5) — didukung BE-IMP; bila backend
 * lama mengabaikan field tak dikenal, balasan teks tetap terkirim.
 */
export function replySupportTicket(ticketId: string, message: string, attachments?: string[]) {
  return http.post<SupportTicket, { message: string; attachments?: string[] }>(
    `/v1/support/tickets/${seg(ticketId)}/reply`,
    { message, ...(attachments?.length ? { attachments: attachments.slice(0, 5) } : {}) },
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

/**
 * Status tiket yang dianggap "perlu perhatian" untuk dot di menu drawer
 * "Tiket Bantuan".
 *
 * Keterbatasan jujur: backend TIDAK punya penanda "belum dibaca" per tiket
 * (tidak ada endpoint unread khusus support), jadi unread SEJATI tidak bisa
 * dihitung tanpa API baru. Fallback yang dipakai drawer: dot menyala bila
 * ada tiket berstatus terbuka — itu sinyal terbaik dari data yang ada hari
 * ini. Dipisah sebagai fungsi murni supaya bisa di-unit-test.
 */
const OPEN_TICKET_STATUSES: ReadonlySet<string> = new Set([
  "OPEN",
  "IN_PROGRESS",
  "WAITING_USER",
])

export function hasOpenSupportTicket(tickets: readonly SupportTicket[]): boolean {
  return tickets.some((t) => OPEN_TICKET_STATUSES.has(t.status))
}
