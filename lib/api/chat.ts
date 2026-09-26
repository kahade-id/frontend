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

import { readList, readPage } from "@/lib/api/response"

import { http, seg } from "@/lib/api/client"
import type { ChatAttachmentDto, SendMessageDto } from "@/lib/api/types"
import type { SealTier } from "@/components/ui/verified-seal"

export const CHAT_PAGE_SIZE = 30

export type ChatRoom = {
  id: string
  counterpart?: {
    id: string
    username: string
    fullName?: string
    avatarUrl?: string | null
    /** R1 (audit 2026-09-26): tier seal lawan bicara dari GET /v1/chat/rooms (otherUser.sealTier). */
    sealTier?: SealTier | null
  }
  orderId?: string | null
  lastMessage?: ChatMessage | null
  unreadCount: number
  updatedAt: string
  /** INQUIRY = ruang pra-transaksi; ORDER = ruang order (naming backend). */
  roomType?: string
  subject?: string | null
  isArchived?: boolean
  isMuted?: boolean
  /** Mute sementara (jam) — undefined = mute permanen. */
  mutedUntil?: string | null
  /** Status online lawan bicara (GET /rooms sudah menyertakan). */
  isOnline?: boolean
  lastSeenAt?: string | null
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
  /** Terpin di room (backend membatasi jumlah per room). */
  isPinned?: boolean
  /** Pesan teks sudah diedit pengirimnya. */
  isEdited?: boolean
  editedAt?: string | null
  /** Kapan pesan terbaca per pembaca (userId → ISO), atau ISO tunggal. */
  readAt?: Record<string, string> | string | null
  /** Reaksi emoji tersummari (emoji, count, reactedByMe, users). */
  reactions?: ChatReaction[]
}

/** Reaksi emoji pada pesan (summarizeReactions backend). */
export type ChatReaction = {
  emoji: string
  count: number
  reactedByMe: boolean
  users?: { userId: string; fullName?: string | null }[]
}

export type ChatPresence = {
  roomId: string
  userId: string | null
  isOnline: boolean
  lastSeenAt?: string | null
}

export type ChatReadReceipt = {
  messageId: string
  isRead: boolean
  readAt?: string | null
}

export type InquiryRoom = {
  id: string
  type: string
  status: string
  subject?: string | null
  initiatorId: string
  counterpartId: string
}

export type ChatSearchResult = {
  message: ChatMessage
  room: {
    id: string
    type?: string
    subject?: string | null
    counterpart?: ChatRoom["counterpart"]
    order?: { orderId?: string; title?: string; status?: string } | null
  }
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
    // Backend memakai `content`/`isEdited`; raw tetap dipertahankan lewat ...raw.
    isPinned: raw.isPinned === true,
    isEdited: raw.isEdited === true,
  }
}

function normalizeChatRoom(raw: ChatRoom & Record<string, unknown>): ChatRoom {
  const other = raw.otherUser as (ChatRoom["counterpart"] & Record<string, unknown>) | undefined
  const last = raw.lastMessage as (ChatMessage & Record<string, unknown>) | null | undefined
  // R1 (audit 2026-09-26): `otherUser` membawa sealTier lawan bicara, tapi
  // `counterpart` backend tidak — gabungkan agar header chat bisa render
  // <VerifiedSeal> tanpa N+1.
  const sealTier = (other?.sealTier as SealTier | null | undefined)
    ?? (raw.counterpart as ChatRoom["counterpart"] | undefined)?.sealTier
    ?? null
  return {
    ...raw,
    // R1: hasil merge di-assert ke tipe counterpart — `other` datang dari
    // `Record<string, unknown>` sehingga id/username terbaca opsional oleh
    // TS; runtime tetap objek merge yang sama (tanpa perubahan perilaku).
    counterpart: (raw.counterpart || other
      ? { ...(other ?? {}), ...(raw.counterpart ?? {}), sealTier }
      : undefined) as ChatRoom["counterpart"],
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

/**
 * Cari ruang chat milik SATU order dengan memindai halaman ruang secara
 * beraturan dan BERHENTI begitu ketemu (maksimal `FIND_ROOM_MAX_PAGES` halaman).
 *
 * G-09 (audit escrow 2026-09-24): `openChat` dulu memuat `listChatRooms()`
 * sekali besar hanya untuk mencari satu ruang, dan ruang lama di luar halaman
 * pertama tidak pernah ketemu → pengguna salah arah ke daftar chat. Memindai
 * berhalaman + berhenti saat ketemu menjamin ruang ketemu bila masih ada di
 * jendela wajar, tanpa memuat seluruh daftar ruang.
 */
export const FIND_ROOM_MAX_PAGES = 5

/**
 * R2 (audit ronde-2, butir #112): backend belum menyediakan
 * `GET /chat/rooms/by-order/{id}`, jadi satu MATCH dipetakan dan diingat agar
 * penyapuan halaman-halaman daftar room (beberapa GET, ~5 detik TTL) tidak
 * diulang tiap kali order yang sama dibuka. Hasil NEGATIF ikut di-cache singkat
 * supaya perjalanan order-baru-tanpa-room tidak menyapu sampai 5 halaman
 * berkali-kali; TTL negatif lebih kecil karena room bisa muncul kapan saja.
 */
const FIND_ROOM_CACHE_TTL_MS = 5 * 60_000
const FIND_ROOM_MISS_TTL_MS = 30_000
const findRoomCache = new Map<string, { room: ChatRoom | null; at: number }>()

export async function findChatRoomByOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<ChatRoom | null> {
  const hit = findRoomCache.get(orderId)
  if (hit) {
    const ttl = hit.room ? FIND_ROOM_CACHE_TTL_MS : FIND_ROOM_MISS_TTL_MS
    if (!hit.room || Date.now() - hit.at < ttl) return hit.room
    // Positif kedaluwarsa: verifikasi ulang ringan — room bisa jadi dipindah.
  }
  for (let page = 1; page <= FIND_ROOM_MAX_PAGES; page += 1) {
    const res = await listChatRooms({ page, limit: CHAT_PAGE_SIZE }, signal)
    const match = res.data.find((r) => r.orderId === orderId)
    if (match) {
      findRoomCache.set(orderId, { room: match, at: Date.now() })
      return match
    }
    // Halaman tidak penuh = daftar habis; berhenti lebih awal.
    if (res.data.length < CHAT_PAGE_SIZE) break
  }
  findRoomCache.set(orderId, { room: null, at: Date.now() })
  return null
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
  signal?: AbortSignal,
): Promise<ChatMessagesPage> {
  const raw = await http.get<RawMessagesResponse>(`/v1/chat/rooms/${seg(roomId)}/messages`, {
    signal,
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

export function getChatAttachments(roomId: string, query: { page?: number; limit?: number } = {}, signal?: AbortSignal) {
  return http
    .get<ChatAttachmentDto[]>(`/v1/chat/rooms/${seg(roomId)}/attachments`, {
      query: { page: query.page ?? 1, limit: query.limit ?? CHAT_PAGE_SIZE },
      auth: "required",
      signal,
    })
    .then((raw) => readList<ChatAttachmentDto>(raw, ["attachments"]))
}

// ------------------------------------------------------------------
// Fitur lanjutan (spec backend: reaksi, pin, forward, arsip, bisukan,
// presence, typing, read receipt, pencarian, inquiry).
// Respons mutation dikembalikan sebagai apa adanya (spec tidak
// mendokumentasikan schema response) — normalisasi ringan di sini.
// ------------------------------------------------------------------

/** Emoji cepat untuk UI reaksi (subset; backend menerima 1–8 code point). */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "👏"] as const

/** POST /v1/chat/inquiries — buka ruang pra-transaksi (nego sebelum order). */
export function createInquiry(dto: {
  counterpartId: string
  subject?: string
  message: string
}) {
  return http.post<{ room: InquiryRoom; message?: ChatMessage }, typeof dto>(
    "/v1/chat/inquiries",
    dto,
    { auth: "required" },
  )
}

/** GET /v1/chat/search — cari isi pesan di SEMUA percakapan pengguna. */
export function searchAllMessages(q: string, options: { limit?: number } = {}, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/chat/search", {
      query: { q, limit: options.limit ?? 20 },
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      const list = Array.isArray(record.results)
        ? record.results
        : Array.isArray(record.messages)
          ? record.messages
          : []
      return {
        query: typeof record.query === "string" ? record.query : q,
        results: list as ChatSearchResult[],
      }
    })
}

/** GET /v1/chat/rooms/{roomId}/search — cari pesan dalam SATU ruang (kursor). */
export function searchRoomMessages(
  roomId: string,
  q: string,
  options: { cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
) {
  return http
    .get<unknown>(`/v1/chat/rooms/${seg(roomId)}/search`, {
      query: { q, cursor: options.cursor, limit: options.limit ?? 20 },
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      const list = readList<ChatMessage & Record<string, unknown>>(record, ["messages"])
      return {
        items: list.map(normalizeChatMessage),
        nextCursor: (record.nextCursor as string | null | undefined) ?? null,
      }
    })
}

/** PATCH /v1/chat/rooms/{roomId}/messages/{messageId} — edit pesan teks sendiri. */
export function editChatMessage(roomId: string, messageId: string, content: string) {
  return http.patch<ChatMessage, { content: string }>(
    `/v1/chat/rooms/${seg(roomId)}/messages/${seg(messageId)}`,
    { content },
    { auth: "required" },
  )
}

/** POST …/reactions — tambah reaksi emoji. Kembalikan ringkasan reaksi terbaru. */
export function addReaction(roomId: string, messageId: string, emoji: string) {
  return http
    .post<unknown, { emoji: string }>(
      `/v1/chat/rooms/${seg(roomId)}/messages/${seg(messageId)}/reactions`,
      { emoji },
      { auth: "required" },
    )
    .then((raw) => normalizeReactionPayload(raw, messageId))
}

/** DELETE …/reactions/{emoji} — tarik reaksi. Emoji di-URL-encode di path. */
export function removeReaction(roomId: string, messageId: string, emoji: string) {
  return http
    .delete<unknown>(
      `/v1/chat/rooms/${seg(roomId)}/messages/${seg(messageId)}/reactions/${encodeURIComponent(emoji)}`,
      { auth: "required", responseType: "json" },
    )
    .then((raw) => normalizeReactionPayload(raw, messageId))
}

function normalizeReactionPayload(raw: unknown, messageId: string): {
  roomId?: string
  messageId: string
  reactions: ChatReaction[]
} {
  const record = (raw ?? {}) as Record<string, unknown>
  const reactions = Array.isArray(record.reactions)
    ? (record.reactions as ChatReaction[])
    : []
  return {
    roomId: typeof record.roomId === "string" ? record.roomId : undefined,
    messageId,
    reactions,
  }
}

/** POST …/pin — pin pesan (maks per room dibatasi backend). */
export function pinChatMessage(roomId: string, messageId: string) {
  return http.post<ChatMessage>(
    `/v1/chat/rooms/${seg(roomId)}/messages/${seg(messageId)}/pin`,
    undefined,
    { auth: "required" },
  )
}

/** DELETE …/pin — unpin pesan. */
export function unpinChatMessage(roomId: string, messageId: string) {
  return http.delete<ChatMessage>(
    `/v1/chat/rooms/${seg(roomId)}/messages/${seg(messageId)}/pin`,
    { auth: "required" },
  )
}

/** GET /v1/chat/rooms/{roomId}/pins — daftar pesan terpin. */
export function getPinnedMessages(roomId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/chat/rooms/${seg(roomId)}/pins`, { auth: "required", retry: 1, signal })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      const list = Array.isArray(record.pins)
        ? record.pins
        : Array.isArray(record.messages)
          ? record.messages
          : Array.isArray(raw)
            ? raw
            : []
      return (list as (ChatMessage & Record<string, unknown>)[]).map(normalizeChatMessage)
    })
}

/**
 * POST …/forward — teruskan pesan ke room LAIN dengan lawan bicara yang sama
 * (dibatasi backend; target yang tidak memenuhi syarat masuk `skipped`).
 */
export function forwardChatMessage(roomId: string, messageId: string, targetRoomIds: string[]) {
  return http.post<
    { sourceMessageId: string; forwarded: unknown[]; skipped: { roomId: string; reason: string }[] },
    { targetRoomIds: string[] }
  >(`/v1/chat/rooms/${seg(roomId)}/messages/${seg(messageId)}/forward`, { targetRoomIds }, {
    auth: "required",
  })
}

/** PUT /v1/chat/rooms/{roomId}/archive — arsip/buka arsip (per user). */
export function setRoomArchived(roomId: string, archived = true) {
  return http.put<{ roomId: string; isArchived: boolean; archivedAt: string | null }, { archived: boolean }>(
    `/v1/chat/rooms/${seg(roomId)}/archive`,
    { archived },
    { auth: "required" },
  )
}

/** PUT /v1/chat/rooms/{roomId}/mute — bisukan (opsional `durationHours` 1–720). */
export function setRoomMuted(roomId: string, muted = true, durationHours?: number) {
  return http.put<{ roomId: string; isMuted: boolean; mutedUntil: string | null }, { muted: boolean; durationHours?: number }>(
    `/v1/chat/rooms/${seg(roomId)}/mute`,
    { muted, durationHours },
    { auth: "required" },
  )
}

/** GET /v1/chat/rooms/{roomId}/presence — online/last-seen lawan bicara. */
export function getRoomPresence(roomId: string, signal?: AbortSignal) {
  return http.get<ChatPresence>(`/v1/chat/rooms/${seg(roomId)}/presence`, {
    auth: "required",
    retry: 1,
    signal,
  })
}

/**
 * POST /v1/chat/rooms/{roomId}/typing — indikator mengetik.
 * Lawan bicara menerimanya lewat event realtime (WebSocket); endpoint REST
 * ini hanya untuk mengirim state.
 */
export function sendChatTyping(roomId: string, isTyping: boolean) {
  return http.post<{ sent: boolean }, { isTyping: boolean }>(`/v1/chat/rooms/${seg(roomId)}/typing`, { isTyping }, {
    auth: "required",
  })
}

/** GET /v1/chat/rooms/{roomId}/read-receipts — read receipt seluruh room. */
export function getReadReceipts(roomId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/chat/rooms/${seg(roomId)}/read-receipts`, { auth: "required", retry: 1, signal })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      const list = Array.isArray(record.receipts) ? (record.receipts as ChatReadReceipt[]) : []
      return { roomId: (record.roomId as string) ?? roomId, receipts: list }
    })
}

/** POST …/messages/{messageId}/read — tandai satu pesan terbaca. */
export function markMessageRead(roomId: string, messageId: string) {
  return http.post<unknown>(
    `/v1/chat/rooms/${seg(roomId)}/messages/${seg(messageId)}/read`,
    undefined,
    { auth: "required" },
  )
}
