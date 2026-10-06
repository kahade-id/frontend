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

import { readList, readPage, unwrapResponse } from "@/lib/api/response"

import { buildUrl, createIdempotencyKey, http, refreshAccessToken, seg } from "@/lib/api/client"
import { ApiError, DEFAULT_ERROR_MESSAGES } from "@/lib/api/errors"
import { getAccessToken } from "@/lib/api/session"
import type { ChatAttachmentDto, SendMessageDto } from "@/lib/api/types"
import type { SealTier } from "@/components/ui/verified-seal"

export const CHAT_PAGE_SIZE = 30

/** Bentuk `otherUser` backend — SELARAS dengan `chat.service.ts` (list + getRoom). */
export type ChatRoomOtherUser = {
  userId: string
  fullName?: string | null
  username?: string | null
  avatarUrl?: string | null
  /** R1 (audit 2026-09-26): tier seal lawan bicara. */
  sealTier?: SealTier | null
  /** Status online lawan bicara (dihormati pengaturan privasinya di server). */
  isOnline?: boolean
  /** Kapan terakhir terlihat (ISO); null bila tidak diketahui/disembunyikan. */
  lastSeenAt?: string | null
}

export type ChatRoom = {
  id: string
  counterpart?: {
    id: string
    /** Nullable — registrasi via HP tidak wajib mengisi username. */
    username: string | null
    fullName?: string
    avatarUrl?: string | null
    /** R1 (audit 2026-09-26): tier seal lawan bicara dari GET /v1/chat/rooms (otherUser.sealTier). */
    sealTier?: SealTier | null
  }
  /**
   * BFI-127/BFI-137 (audit integrasi 2026-09-30): backend mengirim lawan
   * bicara 1:1 sebagai `otherUser` (BERSARANG, bukan top-level) di list maupun
   * getRoom — `normalizeChatRoom` mengangkat `isOnline`/`lastSeenAt` dari sini
   * ke top-level `ChatRoom` (lihat field di bawah). `counterpart` tetap dipakai
   * kompatibilitas bentuk lama.
   */
  otherUser?: ChatRoomOtherUser | null
  orderId?: string | null
  lastMessage?: ChatMessage | null
  unreadCount: number
  updatedAt: string
  /** INQUIRY = ruang pra-transaksi; ORDER = ruang order (naming backend). */
  roomType?: string
  /**
   * DRIFT-06 (2026-09-28): backend mengirim `type` (bukan `roomType`) di
   * GET /v1/chat/rooms — `normalizeChatRoom` meneruskannya via spread.
   */
  type?: string
  subject?: string | null
  isArchived?: boolean
  isMuted?: boolean
  /** Mute sementara (jam) — undefined = mute permanen. */
  mutedUntil?: string | null
  /**
   * Status online lawan bicara — DIANGKAT `normalizeChatRoom` dari
   * `otherUser.isOnline` (BFI-127). Backend TIDAK PERNAH mengirimnya
   * top-level (komentar lama yang mengklaim "GET /rooms sudah menyertakan"
   * salah); layar daftar chat membaca field ini.
   */
  isOnline?: boolean
  /** Kapan lawan bicara terakhir terlihat — diangkat dari `otherUser` (BFI-127). */
  lastSeenAt?: string | null
}

/**
 * FAL-013: tipe pesan — dicerminkan dari enum `ChatMessageType` backend
 * (production, backend/prisma/schema.prisma): 9 nilai
 * (TEXT|IMAGE|FILE|SYSTEM|VOICE|VIDEO|LOCATION|PRODUCT_CARD|ORDER_CARD).
 * `POLL` adalah nilai SINTETIS SISI KLIEN (bukan dari backend) untuk me-render
 * polling sebagai pesan di thread (commit d81c97c) — sengaja dipertahankan di
 * union agar switch render tetap exhaustive. Literal PENUH tanpa `| string`
 * supaya exhaustive-switch diingatkan compiler saat backend menambah tipe baru.
 * SUMBER KEBENARAN: backend; tipe baru di backend WAJIB ditambahkan di sini.
 */
export type ChatMessageType =
  | "TEXT"
  | "IMAGE"
  | "FILE"
  | "SYSTEM"
  | "VOICE"
  | "VIDEO"
  | "LOCATION"
  | "PRODUCT_CARD"
  | "ORDER_CARD"
  | "POLL"

const CHAT_MESSAGE_TYPE_SET: ReadonlySet<string> = new Set([
  "TEXT",
  "IMAGE",
  "FILE",
  "SYSTEM",
  "VOICE",
  "VIDEO",
  "LOCATION",
  "PRODUCT_CARD",
  "ORDER_CARD",
  "POLL",
])

/**
 * FAL-013: persempit string mentah (mis. dari antrean persisten chat) ke
 * ChatMessageType. Nilai tak dikenal jatuh ke "TEXT" daripada menembus
 * tipe — runtime backend selalu mengirim salah satu dari 9 nilai backend
 * di atas (`POLL` hanya dibuat sisi klien, tidak pernah datang dari server).
 */
export function asChatMessageType(value: unknown): ChatMessageType {
  return typeof value === "string" && CHAT_MESSAGE_TYPE_SET.has(value)
    ? (value as ChatMessageType)
    : "TEXT"
}

export type ChatMessage = {
  id: string
  text?: string
  senderId?: string | null
  messageType: ChatMessageType
  fromUser: boolean
  attachments?: ChatAttachmentDto[]
  replyToId?: string | null
  /**
   * Pesan yang dikutip (balasan) — dikirim backend bila `replyToId` terisi.
   * `normalizeChatMessage` meneruskannya via spread; tipe ini membuatnya
   * eksplisit untuk render kutipan di bubble.
   */
  replyTo?: {
    id: string
    content?: string | null
    messageType?: string
    isDeleted?: boolean
    senderName?: string | null
    /** BFI-136: userId pengirim pesan yang dikutip (`replyTo.sender.userId`). */
    senderId?: string | null
    /** BFI-136: nama file lampiran pertama pesan yang dikutip. */
    fileName?: string | null
  } | null
  createdAt: string
  /** BFI-136: kapan pesan dibuat/diubah menurut server (`serializeMessage`). */
  updatedAt?: string
  /** BFI-136: id room pemilik pesan (dari `serializeMessage.roomId`). */
  roomId?: string
  /**
   * BFI-136: objek pengirim dari backend
   * (`{ id, userId, fullName, avatarUrl }`) — sebelumnya hanya `senderId`
   * yang diketik; info lain terbuang dari tipe walau ada di runtime.
   */
  sender?: {
    id?: string | null
    userId?: string | null
    fullName?: string | null
    avatarUrl?: string | null
  } | null
  /** BFI-136: kapan pesan dihapus (ISO); null/undefined = tidak dihapus. */
  deletedAt?: string | null
  /** BFI-136: kapan pesan dipin (ISO); terisi berarti sedang terpin. */
  pinnedAt?: string | null
  /** BFI-136: durasi pesan suara/video (detik). */
  durationSeconds?: number | null
  /** BFI-136: id pesan sumber bila pesan ini hasil forward. */
  forwardedFromId?: string | null
  /**
   * BFI-136: info pesan sumber forward
   * (`{ id, roomId, content, messageType, senderName, senderId }`).
   */
  forwardedFrom?: {
    id: string
    roomId?: string | null
    content?: string | null
    messageType?: string
    senderName?: string | null
    senderId?: string | null
  } | null
  /** Terpin di room (backend membatasi jumlah per room). */
  isPinned?: boolean
  /** Pesan teks sudah diedit pengirimnya. */
  isEdited?: boolean
  editedAt?: string | null
  /** CN-003: pesan dihapus — backend kirim content null + isDeleted true. */
  isDeleted?: boolean
  /**
   * CN-015: status kirim lokal (hanya untuk pesan optimistis).
   * - "queued": menunggu koneksi; antrean chat terpisah akan mengirim otomatis
   * - "sending": sedang dikirim ke server
   * - "failed": kiriman perlu dicoba lagi manual; jangan hapus diam-diam
   * - undefined: pesan dari server (status baca dihitung dari read receipt)
   */
  sendStatus?: "queued" | "sending" | "failed"
  /** Kunci lokal untuk menghindari penggandaan pesan saat antrean/retry. */
  sendIdempotencyKey?: string
  /** Kapan pesan terbaca per pembaca (userId → ISO), atau ISO tunggal. */
  readAt?: Record<string, string> | string | null
  /** Reaksi emoji tersummari (emoji, count, reactedByMe, users). */
  reactions?: ChatReaction[]
  // ── Batch 43 FE-CHAT (2026-09-28) ────────────────────────────────
  /** Pesan LOCATION — backend mengirim objek { lat, lng, label } atau null. */
  location?: { lat: number; lng: number; label?: string | null } | null
  /** Snapshot kartu (PRODUCT_CARD / ORDER_CARD) — type guard di asProductCard/asOrderCard. */
  card?: Record<string, unknown> | null
  /** Pesan sementara: TTL detik; null = bukan pesan sementara. */
  ephemeralTtlSeconds?: number | null
  /** Kapan pesan kedaluwarsa (ISO) — dihapus permanen oleh worker purge. */
  expiresAt?: string | null
  /** Sekali-lihat: hilang setelah dibaca lawan bicara (grace singkat). */
  viewOnce?: boolean
  /** Kapan pesan sekali-lihat dikonsumsi (ISO) — null = belum. */
  viewOnceViewedAt?: string | null
  /** Berbintang oleh saya (diisi client dari GET /starred). */
  isStarred?: boolean
  /** Kapan dibintangi (ISO) — dari GET /starred. */
  starredAt?: string
  // ── 2026-10-02: pesan POLL — backend buat otomatis saat createPoll ──
  /** ID polling (messageType POLL). */
  pollId?: string | null
  /** Data polling ter-embed (messageType POLL) — di-render via ChatPollCard. */
  poll?: ChatPoll | null
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

/**
 * UI-C002 (audit UI/UX 2026-09-27): teks preview satu baris untuk daftar
 * chat. Pesan terakhir yang hanya berisi lampiran (tanpa teks) harus
 * menampilkan "(lampiran)" — bukan baris kosong — konsisten dengan
 * <ChatPinnedBar> dan <ChatSearchSheet>. Murni, bisa di-unit-test.
 */
export function chatRoomPreview(
  last: Pick<ChatMessage, "text" | "attachments"> | null | undefined,
  /** Label terjemahan untuk pesan berisi lampiran saja. */
  attachmentLabel = "(lampiran)",
): string {
  const text = last?.text?.trim()
  if (text) return text
  return last?.attachments?.length ? attachmentLabel : ""
}

/**
 * CHT-011 (audit UI/UX 2026-09-28): label konsisten untuk pesan tanpa teks
 * di semua permukaan (kutipan balasan, pinned bar, daftar room).
 *
 * Sebelumnya kutipan balasan memakai "Gambar"/"Video"/"Pesan suara"/"Berkas"
 * sementara permukaan lain memakai "(lampiran)" untuk pesan yang SAMA.
 * Tipe lampiran (IMAGE/VIDEO/VOICE/FILE) memakai "(lampiran)" — selaras
 * dengan keputusan UI-C002 yang sudah diuji (tests/chat-uiux.test.ts).
 * Tipe khusus batch 43 yang BUKAN lampiran (lokasi, kartu produk/order)
 * memakai label spesifiknya, karena "(lampiran)" menyesatkan untuknya.
 *
 * Mengembalikan string Indonesia ( = kunci i18n); pemanggil membungkus
 * dengan translate() bila perlu bahasa lain. Murni, bisa di-unit-test.
 */
export function nonTextMessageLabel(messageType?: string | null): string {
  switch ((messageType ?? "").toUpperCase()) {
    case "LOCATION":
      return "Lokasi"
    case "PRODUCT_CARD":
      return "Kartu produk"
    case "ORDER_CARD":
      return "Kartu pesanan"
    case "POLL":
      return "Polling"
    default:
      return "(lampiran)"
  }
}

/**
 * Normalisasi satu pesan chat dari respons REST ATAU payload realtime
 * (`chat.new_message` / `chat.message_updated`) — serializer SAMA untuk
 * kedua jalur (G107). Diekspor agar lapisan realtime tidak menduplikasi
 * logika ini.
 */
export function normalizeChatMessage(raw: Record<string, unknown>): ChatMessage {
  const record = raw as ChatMessage & Record<string, unknown>
  return {
    ...record,
    text: record.text ?? (typeof record.content === "string" ? record.content : undefined),
    senderId: record.senderId ?? null,
    fromUser:
      typeof record.fromUser === "boolean"
        ? record.fromUser
        : record.isMine === true || record.isFromCurrentUser === true,
    // Backend memakai `content`/`isEdited`; raw tetap dipertahankan lewat ...raw.
    isPinned: record.isPinned === true,
    isEdited: record.isEdited === true,
    // CN-003: pesan terhapus — jangan andalkan content null saja.
    isDeleted: record.isDeleted === true,
  }
}

/**
 * DRIFT-05 (fix 2026-09-26): backend mengirim `userId` (public user ID), bukan
 * `id`; `username` nullable (registrasi via HP). Normalisasi di sini supaya
 * tipe jujur — sebelumnya `counterpart.id` selalu `undefined` di runtime.
 */
function normalizeCounterpart(
  other: Record<string, unknown> | undefined,
  counterpart: Record<string, unknown> | undefined,
  sealTier: SealTier | null,
): ChatRoom["counterpart"] | undefined {
  if (!other && !counterpart) return undefined

  // `otherUser` is the canonical viewer-relative identity returned by the
  // current API. `counterpart` is only a legacy alias and may be stale (some
  // payloads contain the viewer there); it must never overwrite the peer.
  const merged = { ...counterpart, ...other }
  const otherHasIdentity = Boolean(
    other &&
      ((typeof other.userId === "string" && other.userId.trim()) ||
        (typeof other.username === "string" && other.username.trim())),
  )
  const canonicalId =
    typeof other?.userId === "string" && other.userId.trim()
      ? other.userId
      : typeof other?.id === "string" && other.id.trim()
        ? other.id
        : null
  const legacyId =
    typeof counterpart?.id === "string" && counterpart.id.trim()
      ? counterpart.id
      : typeof counterpart?.userId === "string" && counterpart.userId.trim()
        ? counterpart.userId
        : ""
  const id = canonicalId ?? (otherHasIdentity ? "" : legacyId)
  return {
    ...merged,
    id,
    username: typeof merged.username === "string" ? merged.username : null,
    sealTier,
  } as ChatRoom["counterpart"]
}

function normalizeUsername(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^@/, "").toLocaleLowerCase("en-US")
}

/** Compare the resolved public profile with the authenticated viewer. */
export function isSameDmAccount(
  target: { id?: string | null; username?: string | null },
  viewer: { id?: string | null; username?: string | null },
): boolean {
  const targetId = target.id?.trim() ?? ""
  const viewerId = viewer.id?.trim() ?? ""
  return Boolean(
    (targetId && viewerId && targetId === viewerId) ||
      (target.username && viewer.username &&
        normalizeUsername(target.username) === normalizeUsername(viewer.username)),
  )
}

/**
 * Fail-closed identity check before a profile-originated DM is opened.
 * A room may be minimal on POST /chat/dm, in which case callers must fetch
 * GET /chat/rooms/:id first. Contradictory IDs/usernames always reject.
 */
export function isChatRoomForDmTarget(
  room: ChatRoom | null | undefined,
  target: { id?: string | null; username: string },
): boolean {
  if (!room || !room.id || room.orderId) return false
  const roomType = (room.type ?? room.roomType)?.toUpperCase()
  if (roomType && roomType !== "INQUIRY") return false

  const expectedUsername = normalizeUsername(target.username)
  if (!expectedUsername) return false
  const counterpartUsername =
    room.otherUser?.username ?? room.counterpart?.username ?? null
  const counterpartId =
    room.otherUser?.userId?.trim() || room.counterpart?.id?.trim() || ""
  const expectedId = target.id?.trim() ?? ""
  const usernameMatches =
    Boolean(counterpartUsername) && normalizeUsername(counterpartUsername) === expectedUsername

  if (counterpartUsername && !usernameMatches) return false
  if (counterpartId && expectedId && counterpartId !== expectedId) return false

  // At least one server-reported identity must match. An unverified room ID
  // alone is not enough to expose its messages.
  return usernameMatches || Boolean(counterpartId && expectedId && counterpartId === expectedId)
}

export function normalizeChatRoom(raw: ChatRoom & Record<string, unknown>): ChatRoom {
  // BFI-137: `otherUser` kini bertipe eksplisit (ChatRoomOtherUser) — tanpa
  // `as`-cast yang menyembunyikan drift dari compiler. Bentuk lama
  // (`counterpart` datar) tetap dibaca sebagai fallback.
  const otherRaw = raw.otherUser as ChatRoomOtherUser | Record<string, unknown> | null | undefined
  const other: ChatRoomOtherUser | undefined =
    otherRaw && typeof otherRaw === "object"
      ? {
          userId:
            typeof (otherRaw as Record<string, unknown>).userId === "string"
              ? (otherRaw as { userId: string }).userId
              : "",
          fullName: typeof (otherRaw as Record<string, unknown>).fullName === "string"
            ? (otherRaw as { fullName?: string }).fullName ?? null
            : null,
          username: typeof (otherRaw as Record<string, unknown>).username === "string"
            ? (otherRaw as { username?: string }).username ?? null
            : null,
          avatarUrl: typeof (otherRaw as Record<string, unknown>).avatarUrl === "string"
            ? (otherRaw as { avatarUrl?: string }).avatarUrl ?? null
            : null,
          sealTier: (otherRaw as ChatRoomOtherUser).sealTier ?? null,
          isOnline: (otherRaw as ChatRoomOtherUser).isOnline,
          lastSeenAt: (otherRaw as ChatRoomOtherUser).lastSeenAt ?? null,
        }
      : undefined
  const last = raw.lastMessage as (ChatMessage & Record<string, unknown>) | null | undefined
  // R1 (audit 2026-09-26): `otherUser` membawa sealTier lawan bicara, tapi
  // `counterpart` backend tidak — gabungkan agar header chat bisa render
  // <VerifiedSeal> tanpa N+1.
  const sealTier = other?.sealTier
    ?? (raw.counterpart as ChatRoom["counterpart"] | undefined)?.sealTier
    ?? null
  // BFI-127: angkat isOnline/lastSeenAt dari otherUser — sebelumnya dibuang
  // sehingga indikator online daftar chat tidak pernah menyala.
  const isOnline = other?.isOnline ?? (typeof raw.isOnline === "boolean" ? raw.isOnline : undefined)
  const lastSeenAt =
    typeof other?.lastSeenAt === "string"
      ? other.lastSeenAt
      : typeof raw.lastSeenAt === "string"
        ? raw.lastSeenAt
        : undefined
  return {
    ...raw,
    otherUser: other ?? raw.otherUser ?? null,
    isOnline,
    lastSeenAt,
    counterpart: normalizeCounterpart(
      other as unknown as Record<string, unknown> | undefined,
      raw.counterpart as Record<string, unknown> | undefined,
      sealTier,
    ),
    lastMessage: last ? normalizeChatMessage(last) : null,
    unreadCount: typeof raw.unreadCount === "number" ? raw.unreadCount : 0,
  }
}

/**
 * DM 1:1 vs ruang transaksi/grup (2026-09-28, permintaan produk).
 *
 * Backend hanya mengenal dua tipe ruang (`ChatRoomType`: ORDER/INQUIRY) —
 * DM "Kirim Pesan" dibuat sebagai INQUIRY tanpa order (`getOrCreateDm`).
 * Admin hanya bisa masuk ke ruang ber-order (jalur sengketa), sehingga
 * "DM 1-by-1" = ruang TANPA `orderId` dan bukan ORDER.
 *
 * Dipakai untuk menyembunyikan foto + nama lawan bicara di bubble DM
 * (ala WhatsApp — hanya bubble), sementara di ruang transaksi/grup
 * identitas pengirim tetap tampil. Murni logika tampilan: tanpa mengubah
 * kontrak API.
 */
export function isOneToOneChatRoom(
  room: Pick<ChatRoom, "orderId" | "roomType" | "type"> | null | undefined,
): boolean {
  if (!room) return false
  const t = room.type ?? room.roomType
  return !room.orderId && t !== "ORDER"
}

export function listChatRooms(
  options: { page?: number; limit?: number; archived?: boolean } = {},
  signal?: AbortSignal,
) {
  const query: Record<string, number | boolean> = {
    page: options.page ?? 1,
    limit: options.limit ?? CHAT_PAGE_SIZE,
  }
  // B4 (fix 2026-09-26): backend memfilter arsip SERVER-SIDE — tanpa
  // `archived=true`, room terarsip tidak pernah dikembalikan
  // (ParseBoolPipe di GET /v1/chat/rooms). Tab "Diarsipkan" wajib memakai
  // query terpisah dengan param ini; JANGAN filter arsip client-side dari
  // query utama (itu yang membuat arsip "menguap" tiap refetch).
  if (options.archived !== undefined) query.archived = options.archived
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
 * D1-003 (perf 2026-09-29): GET /v1/chat/rooms/:roomId — SATU room ringan
 * untuk header layar percakapan. Pengganti `listChatRooms({page:1})` yang
 * sebelumnya di-fetch ulang hanya untuk menemukan 1 baris header.
 * Bentuk respons SAMA dengan satu entri daftar (tipe ChatRoom).
 */
export function getChatRoom(roomId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/chat/rooms/${seg(roomId)}`, {
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => normalizeChatRoom(raw as ChatRoom & Record<string, unknown>))
}

/** NS-006 (perf-fix, 2026-09-29): hasil GET /v1/chat/unread-count. */
export type ChatUnreadCountResult = { unreadCount: number }

/**
 * GET /v1/chat/unread-count — total unread chat viewer (SATU angka agregat
 * dari counter denormalisasi, bukan daftar 50 room). Pengganti ringan untuk
 * badge tab Pesan yang sebelumnya menjumlahkan `unreadCount` halaman pertama
 * `listChatRooms`.
 */
export function getChatUnreadCount(signal?: AbortSignal) {
  return http.get<ChatUnreadCountResult>("/v1/chat/unread-count", {
    auth: "required",
    retry: 1,
    signal,
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
    if (Date.now() - hit.at < ttl) return hit.room
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
  /**
   * D1-004 (perf 2026-09-29): hanya pesan yang LEBIH BARU dari id ini
   * (mode delta untuk poll fallback — bukan 30 pesan penuh tiap tick).
   */
  afterMessageId?: string
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
      afterMessageId: query.afterMessageId,
    },
    auth: "required",
    retry: 1,
  })
  return normalizeMessagesPage(raw)
}

export function sendChatMessage(
  roomId: string,
  dto: SendMessageDto,
  opts: { idempotencyKey?: string } = {},
) {
  return http
    .post<unknown, SendMessageDto>(`/v1/chat/rooms/${seg(roomId)}/messages`, dto, {
      auth: "required",
      // The same key follows an offline queue through every later attempt.
      // The transport creates one automatically for ordinary sends.
      headers: opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : undefined,
    })
    // 2026-10-02 (Bug 5): WAJIB normalize — backend mengirim `content`,
    // bukan `text`. Tanpa ini bubble optimistis kosong sampai refresh
    // (GET memakai normalizeChatMessage, POST tidak).
    .then((raw) => normalizeChatMessage((raw ?? {}) as Record<string, unknown>))
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

/**
 * B04: parse respons upload chat — unwrap envelope `{success,data}`/`{data}`
 * persis seperti client fetch (`unwrapResponse`), lalu validasi bentuk DTO
 * (fileName/fileUrl wajib string). Fail-closed: PARSE bila respons tidak
 * valid, supaya lampiran rusak tidak lolos sebagai DTO palsu.
 *
 * Diekspor untuk test (dipakai internal oleh uploadChatAttachmentProgress).
 */
export function parseChatUploadResponse(bodyText: string): ChatAttachmentDto {
  let body: unknown
  try {
    body = JSON.parse(bodyText)
  } catch {
    throw new ApiError({ code: "PARSE", message: "Respons unggahan tidak valid." })
  }
  const dto = unwrapResponse(body) as Record<string, unknown> | null
  if (
    !dto ||
    typeof dto !== "object" ||
    typeof dto.fileName !== "string" ||
    typeof dto.fileUrl !== "string"
  ) {
    throw new ApiError({ code: "PARSE", message: "Respons unggahan tidak memuat lampiran." })
  }
  return dto as ChatAttachmentDto
}

/**
 * Unggah lampiran chat via `XMLHttpRequest` dengan LAPORAN PROGRESS (B04).
 *
 * `fetch` tidak melaporkan progress upload — pola sama dengan
 * `uploadDirectVideo` di lib/api/upload.ts. Auth: Bearer <redacted> sesi
 * (satu kali refresh-and-retry bila 401, selaras client.ts). `signal`
 * membatalkan unggahan (tombol "batal" per file di composer).
 *
 * BFE-001: endpoint upload bertanda `@Idempotency()` — interceptor global
 * backend melempar 400 `IDEMPOTENCY_KEY_REQUIRED` bila header absen.
 * Setiap pemanggilan WAJIB mengirim `Idempotency-Key: <uuid v4>`.
 * `opts.idempotencyKey` dipakai bila diberikan (retry WAJIB memakai key
 * yang SAMA dengan attempt pertama — key disimpan di item antrean upload
 * di chat-room-screen); bila tidak diberikan, satu key baru dibangkitkan
 * per panggilan dan dipakai ulang untuk retry refresh-token 401 internal.
 */
export function uploadChatAttachmentProgress(
  roomId: string,
  formData: FormData,
  opts: {
    /** Fraksi 0–1 kemajuan upload. */
    onProgress?: (fraction: number) => void
    signal?: AbortSignal
    timeoutMs?: number
    /**
     * UPV-05: ukuran file (byte) untuk timeout ADAPTIF. Bila diisi, default
     * `timeoutMs` mengikuti rumus `uploadDirectVideo` (120 dtk basis +
     * byte/100 — 100 KB/s konservatif; min 10 mnt, maks 30 mnt) sehingga
     * video 50 MiB di koneksi lambat tidak TIMEOUT padahal server menerima.
     * Bila tidak diisi → 300 dtk seperti sebelumnya.
     */
    fileBytes?: number
    /**
     * BFE-001: key idempotensi UUID v4 untuk request ini. Retry attempt
     * yang sama WAJIB memakai key yang sama — pemanggil (antrean upload)
     * membangkitkan sekali per berkas via `createIdempotencyKey()`.
     */
    idempotencyKey?: string
  } = {},
): Promise<ChatAttachmentDto> {
  // UPV-05: timeout adaptif mengikuti pola uploadDirectVideo
  // (lib/api/upload.ts) — 50 MiB @ 100 KB/s ≈ 524 dtk > 300 dtk fixed lama.
  const fileBytes = typeof opts.fileBytes === "number" && opts.fileBytes > 0 ? opts.fileBytes : 0
  const adaptiveTimeout = fileBytes > 0
    ? Math.min(1_800_000, Math.max(600_000, 120_000 + fileBytes / 100))
    : 300_000
  const { onProgress, signal, timeoutMs = adaptiveTimeout } = opts
  // BFE-001: satu key untuk SELURUH panggilan ini — termasuk retry
  // refresh-token 401 di `run()` di bawah (closure yang sama).
  const idempotencyKey = opts.idempotencyKey ?? createIdempotencyKey()
  return new Promise<ChatAttachmentDto>((resolvePromise, rejectPromise) => {
    let settled = false
    const resolve = (v: ChatAttachmentDto) => {
      if (!settled) {
        settled = true
        resolvePromise(v)
      }
    }
    const reject = (e: unknown) => {
      if (!settled) {
        settled = true
        rejectPromise(e)
      }
    }
    if (signal?.aborted) {
      reject(new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan." }))
      return
    }

    const sendOnce = (token: string): Promise<void> =>
      new Promise<void>((resolveXhr, rejectXhr) => {
        const xhr = new XMLHttpRequest()
        const onAbort = () => xhr.abort()
        signal?.addEventListener("abort", onAbort, { once: true })
        const cleanup = () => signal?.removeEventListener("abort", onAbort)
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            onProgress?.(Math.min(1, Math.max(0, event.loaded / event.total)))
          }
        }
        xhr.timeout = timeoutMs
        xhr.ontimeout = () => {
          cleanup()
          rejectXhr(
            new ApiError({
              code: "TIMEOUT",
              message: "Unggahan terlalu lama. Periksa koneksi lalu coba lagi.",
              path: `/v1/chat/rooms/${roomId}/upload`,
            }),
          )
        }
        xhr.onabort = () => {
          cleanup()
          rejectXhr(new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan." }))
        }
        xhr.onerror = () => {
          cleanup()
          rejectXhr(
            new ApiError({
              code: "NETWORK",
              message: DEFAULT_ERROR_MESSAGES.NETWORK,
              path: `/v1/chat/rooms/${roomId}/upload`,
            }),
          )
        }
        xhr.onload = () => {
          cleanup()
          const bodyText = typeof xhr.responseText === "string" ? xhr.responseText : ""
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolveXhr()
              resolve(parseChatUploadResponse(bodyText))
            } catch (err) {
              rejectXhr(err)
            }
            return
          }
          if (xhr.status === 401) {
            rejectXhr({ retriable401: true as const })
            return
          }
          let message = DEFAULT_ERROR_MESSAGES.SERVER
          try {
            const body = JSON.parse(bodyText) as { message?: unknown }
            if (typeof body.message === "string" && body.message) message = body.message
          } catch {
            // Pakai pesan default.
          }
          rejectXhr(
            new ApiError({
              code:
                xhr.status === 413
                  ? "PAYLOAD_TOO_LARGE"
                  : xhr.status >= 500
                    ? "SERVER"
                    : xhr.status === 400
                      ? "BAD_REQUEST"
                      : "UNKNOWN",
              message,
              // CPY-012: message bisa berasal dari body backend (bahasa tak terjamin).
              clientMessage: false,
              path: `/v1/chat/rooms/${roomId}/upload`,
            }),
          )
        }
        xhr.open("POST", buildUrl(`/v1/chat/rooms/${seg(roomId)}/upload`))
        xhr.setRequestHeader("Accept", "application/json")
        xhr.setRequestHeader("Authorization", `Bearer ${token}`)
        // BFE-001: header WAJIB — backend @Idempotency() menolak 400
        // IDEMPOTENCY_KEY_REQUIRED bila absen (akar "upload selalu gagal").
        xhr.setRequestHeader("Idempotency-Key", idempotencyKey)
        // JANGAN set Content-Type — XHR mengisi multipart boundary sendiri.
        xhr.send(formData as unknown as Parameters<XMLHttpRequest["send"]>[0])
      })

    const run = async () => {
      try {
        const token = await getAccessToken()
        if (!token) {
          throw new ApiError({
            code: "UNAUTHORIZED",
            message: DEFAULT_ERROR_MESSAGES.UNAUTHORIZED,
            path: `/v1/chat/rooms/${roomId}/upload`,
          })
        }
        try {
          await sendOnce(token)
        } catch (err) {
          const retriable =
            err && typeof err === "object" && (err as { retriable401?: unknown }).retriable401 === true
          if (!retriable || signal?.aborted) throw err
          const fresh = await refreshAccessToken()
          if (!fresh) {
            throw new ApiError({
              code: "UNAUTHORIZED",
              message: DEFAULT_ERROR_MESSAGES.UNAUTHORIZED,
              path: `/v1/chat/rooms/${roomId}/upload`,
            })
          }
          await sendOnce(fresh)
        }
      } catch (err) {
        reject(err)
      }
    }
    void run()
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

/**
 * PRF-002: POST /v1/chat/dm — buka (atau pakai ulang) room DM dengan username,
 * tanpa pesan pertama. Dipakai tombol "Kirim Pesan" di profil (WhatsApp-like).
 * Backend memakai ulang room INQUIRY yang sudah ada bila tersedia.
 */
export function getOrCreateDm(username: string, signal?: AbortSignal) {
  return http
    .post<unknown, { username: string }>("/v1/chat/dm", { username }, { auth: "required", signal })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      const roomRaw = (record.room ?? record) as ChatRoom & Record<string, unknown>
      return normalizeChatRoom(roomRaw)
    })
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

/**
 * KONTRAK TIM B (item 18, 2026-09-28) — DELETE /v1/chat/rooms/:roomId.
 *
 * Auth JWT, hanya anggota room. Tanpa bulk — 1-by-1.
 * 200 → { deleted: true, roomId, permanent }
 *   - permanent=true  → DM/inquiry tanpa transaksi: HARD DELETE permanen.
 *   - permanent=false → room order yang COMPLETED: SOFT DELETE (riwayat
 *     dipertahankan untuk audit).
 * 404 { code: "NOT_FOUND" } — room tidak ada / sudah dihapus.
 * 403 { code: "NOT_ORDER_PARTICIPANT" } — pemanggil bukan anggota room.
 * 409 { code: "CHAT_ROOM_DELETE_ORDER_NOT_COMPLETED" } — order belum
 *   COMPLETED (termasuk CANCELLED/DISPUTED — fail closed di server).
 *
 * UI (daftar chat → swipe kiri → "Hapus") memanggil ini SETELAH dialog
 * konfirmasi. Untuk room transaksi, status order dicek dulu via getOrder
 * (lihat `canDeleteChatRoom`); 409 di atas adalah jaring pengaman bila
 * status berubah di antara pengecekan dan eksekusi.
 */
export type DeleteChatRoomResult = {
  deleted: boolean
  roomId: string
  permanent: boolean
}

export function deleteChatRoom(roomId: string): Promise<DeleteChatRoomResult> {
  return http.delete<DeleteChatRoomResult>(`/v1/chat/rooms/${seg(roomId)}`, {
    auth: "required",
  })
}

/**
 * Aturan hapus ruang TRANSAKSI (item 18): room yang terikat order hanya boleh
 * dihapus bila order-nya COMPLETED. Pemanggil WAJIB memeriksa ini lewat
 * `getOrder(orderId)` (API existing) SEBELUM menampilkan opsi hapus; bila
 * belum boleh, opsi disembunyikan dan pesan jelas ditampilkan.
 *
 * Room DM (tanpa orderId) tidak terikat aturan ini.
 */
export function canDeleteChatRoom(orderStatus: string | null | undefined): boolean {
  // Room DM (tidak ada order) → bebas dihapus oleh pemiliknya.
  if (orderStatus === null || orderStatus === undefined) return true
  return orderStatus === "COMPLETED"
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

// ====================================================================
// Batch 43 FE-CHAT (2026-09-28): terjemahan, ekspor, privasi, bintang,
// self-chat, polling, pin room (backend), template balasan "/", blokir,
// lapor, buat order dari chat, lokasi, kartu, ephemeral/view-once.
//
// Kontrak backend: branch mega/be-chat, commit 9bd7dd9 (tsc 0, 115/115
// test). Semua respons dinormalisasi defensif — shape backend
// `Promise<object>` generik di controller, jadi field yang hilang
// diperlakukan sebagai nilai default, bukan throw.
// ====================================================================

/** Kebijakan DM (GET/PATCH /v1/chat/privacy). */
export type DmPolicy = "EVERYONE" | "FOLLOWING" | "NONE"

export type ChatPrivacySettings = {
  hideReadReceipts: boolean
  dmPolicy: DmPolicy
}

const DM_POLICIES: DmPolicy[] = ["EVERYONE", "FOLLOWING", "NONE"]

/** Opsi kebijakan DM untuk UI radio + copy penjelasan per opsi. */
export const DM_POLICY_OPTIONS: { value: DmPolicy; label: string; description: string }[] = [
  {
    value: "EVERYONE",
    label: "Semua orang",
    description: "Siapa pun bisa mengirimi Anda pesan langsung baru.",
  },
  {
    value: "FOLLOWING",
    label: "Hanya yang saya ikuti",
    description: "Hanya orang yang Anda follow yang bisa memulai DM baru.",
  },
  {
    value: "NONE",
    label: "Tidak ada",
    description: "Tolak semua pesan langsung baru. Percakapan yang sudah ada tidak terpengaruh.",
  },
]

function normalizePrivacy(raw: unknown): ChatPrivacySettings {
  const record = (raw ?? {}) as Record<string, unknown>
  const dmPolicy = DM_POLICIES.includes(record.dmPolicy as DmPolicy)
    ? (record.dmPolicy as DmPolicy)
    : "EVERYONE"
  return {
    hideReadReceipts: record.hideReadReceipts === true,
    dmPolicy,
  }
}

/** GET /v1/chat/privacy — pengaturan privasi chat milik sendiri. */
export function getChatPrivacy(signal?: AbortSignal): Promise<ChatPrivacySettings> {
  return http
    .get<unknown>("/v1/chat/privacy", { auth: "required", retry: 1, signal })
    .then(normalizePrivacy)
}

/** PATCH /v1/chat/privacy — ubah privasi chat milik sendiri. */
export function updateChatPrivacy(
  dto: Partial<ChatPrivacySettings>,
): Promise<ChatPrivacySettings> {
  return http
    .patch<unknown, Partial<ChatPrivacySettings>>("/v1/chat/privacy", dto, {
      auth: "required",
    })
    .then(normalizePrivacy)
}

// ── Terjemahan pesan ────────────────────────────────────────────────

export type ChatTranslation = {
  messageId: string
  targetLang: string
  translatedText: string
  sourceLang: string | null
}

/**
 * POST /v1/chat/rooms/{roomId}/messages/{messageId}/translate.
 * Backend melempar 501 (TRANSLATION_NOT_CONFIGURED) bila provider belum
 * dikonfigurasi — pemanggil UI WAJIB memetakan ke "belum tersedia", bukan
 * error generik.
 */
export function translateChatMessage(
  roomId: string,
  messageId: string,
  targetLang: string,
): Promise<ChatTranslation> {
  return http
    .post<unknown, { targetLang: string }>(
      `/v1/chat/rooms/${seg(roomId)}/messages/${seg(messageId)}/translate`,
      { targetLang },
      { auth: "required" },
    )
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      return {
        messageId: typeof record.messageId === "string" ? record.messageId : messageId,
        targetLang: typeof record.targetLang === "string" ? record.targetLang : targetLang,
        translatedText: typeof record.translatedText === "string" ? record.translatedText : "",
        sourceLang: typeof record.sourceLang === "string" ? record.sourceLang : null,
      }
    })
}

/** Kode backend bila provider terjemahan belum dikonfigurasi (HTTP 501). */
export const TRANSLATION_NOT_CONFIGURED = "TRANSLATION_NOT_CONFIGURED"

/** Kode backend bila DM ditolak kebijakan penerima (HTTP 403). */
export const CHAT_DM_NOT_ALLOWED = "CHAT_DM_NOT_ALLOWED"

/** True bila error adalah penolakan DM karena kebijakan privasi penerima. */
export function isDmNotAllowedError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "backendCode" in err &&
    (err as { backendCode?: unknown }).backendCode === CHAT_DM_NOT_ALLOWED
  )
}

// ── Ekspor chat ─────────────────────────────────────────────────────

export type ChatExport = {
  filename: string
  /** Isi txt (atau JSON sebagai string). */
  content: string
}

/**
 * GET /v1/chat/rooms/{roomId}/export?format=txt — riwayat sebagai teks.
 * Backend membatasi 5000 pesan (CHAT_EXPORT_TOO_LARGE bila lewat).
 */
export async function exportChatRoom(
  roomId: string,
  format: "txt" | "json" = "txt",
  signal?: AbortSignal,
): Promise<ChatExport> {
  const content = await http.get<string>(`/v1/chat/rooms/${seg(roomId)}/export`, {
    query: { format },
    auth: "required",
    responseType: "text",
    signal,
  })
  return { filename: `chat-export-${roomId}.${format}`, content }
}

// ── Pesan berbintang ────────────────────────────────────────────────

/** POST /v1/chat/rooms/{roomId}/starred/{messageId} */
export function starChatMessage(roomId: string, messageId: string) {
  return http
    .post<{ starred: boolean }>(`/v1/chat/rooms/${seg(roomId)}/starred/${seg(messageId)}`, undefined, {
      auth: "required",
    })
    .then((raw) => ({ starred: (raw as { starred?: unknown })?.starred === true }))
}

/** DELETE /v1/chat/rooms/{roomId}/starred/{messageId} */
export function unstarChatMessage(roomId: string, messageId: string) {
  return http
    .delete<{ starred: boolean }>(`/v1/chat/rooms/${seg(roomId)}/starred/${seg(messageId)}`, {
      auth: "required",
    })
    .then((raw) => ({ starred: (raw as { starred?: unknown })?.starred === true }))
}

/** GET /v1/chat/rooms/{roomId}/starred — daftar pesan berbintang (per user). */
export function listStarredMessages(roomId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/chat/rooms/${seg(roomId)}/starred`, { auth: "required", retry: 1, signal })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      const list = Array.isArray(record.messages)
        ? record.messages
        : Array.isArray(record.items)
          ? record.items
          : []
      return (list as (ChatMessage & Record<string, unknown>)[]).map((entry) => {
        // Backend mengirim { starredAt, message } — terima juga pesan langsung.
        const msg = (
          entry && typeof entry === "object" && "message" in entry
            ? (entry as { message?: unknown }).message ?? entry
            : entry
        ) as ChatMessage & Record<string, unknown>
        const starredAt =
          entry && typeof entry === "object" && "starredAt" in entry
            ? (entry as { starredAt?: unknown }).starredAt
            : undefined
        return {
          ...normalizeChatMessage(msg),
          isStarred: true,
          starredAt: typeof starredAt === "string" ? starredAt : undefined,
        }
      })
    })
}

// ── Chat dengan diri sendiri ────────────────────────────────────────

/** POST /v1/chat/self — get-or-create room "pesan tersimpan". */
export function getOrCreateSelfRoom(): Promise<ChatRoom & { isSelf: true }> {
  return http
    .post<unknown>("/v1/chat/self", undefined, { auth: "required" })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      const roomRaw = (record.room ?? record) as ChatRoom & Record<string, unknown>
      return { ...normalizeChatRoom(roomRaw), isSelf: true as const }
    })
}

// ── Polling ─────────────────────────────────────────────────────────

export type ChatPollOption = { index: number; text: string; votes: number }

export type ChatPoll = {
  id: string
  roomId: string
  question: string
  options: ChatPollOption[]
  totalVotes: number
  allowMultiple: boolean
  deadline: string | null
  isClosed: boolean
  myVotes: number[]
  createdBy: { userId: string; fullName?: string | null }
  createdAt: string
}

/** Batas dari backend (app.constants): opsi 2–10, pertanyaan ≤300 char. */
export const CHAT_POLL_MIN_OPTIONS = 2
export const CHAT_POLL_MAX_OPTIONS = 10
export const CHAT_POLL_QUESTION_MAX = 300

function normalizePoll(raw: unknown): ChatPoll {
  const record = (raw ?? {}) as Record<string, unknown>
  const options = Array.isArray(record.options)
    ? record.options.map((o, i) => {
        const item = (o ?? {}) as Record<string, unknown>
        return {
          index: typeof item.index === "number" ? item.index : i,
          text: typeof item.text === "string" ? item.text : "",
          votes: typeof item.votes === "number" ? item.votes : 0,
        }
      })
    : []
  const createdBy = (record.createdBy ?? {}) as Record<string, unknown>
  return {
    id: typeof record.id === "string" ? record.id : "",
    roomId: typeof record.roomId === "string" ? record.roomId : "",
    question: typeof record.question === "string" ? record.question : "",
    options,
    totalVotes: typeof record.totalVotes === "number" ? record.totalVotes : 0,
    allowMultiple: record.allowMultiple === true,
    deadline: typeof record.deadline === "string" ? record.deadline : null,
    isClosed: record.isClosed === true,
    myVotes: Array.isArray(record.myVotes)
      ? record.myVotes.filter((v): v is number => typeof v === "number")
      : [],
    createdBy: {
      userId: typeof createdBy.userId === "string" ? createdBy.userId : "",
      fullName: typeof createdBy.fullName === "string" ? createdBy.fullName : null,
    },
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
  }
}

/** POST /v1/chat/rooms/{roomId}/polls */
export function createPoll(
  roomId: string,
  dto: { question: string; options: string[]; allowMultiple?: boolean; deadline?: string },
) {
  return http
    .post<unknown, typeof dto>(`/v1/chat/rooms/${seg(roomId)}/polls`, dto, { auth: "required" })
    .then(normalizePoll)
}

/** GET /v1/chat/rooms/{roomId}/polls */
export function listPolls(roomId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/chat/rooms/${seg(roomId)}/polls`, { auth: "required", retry: 1, signal })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      const list = Array.isArray(record.polls)
        ? record.polls
        : Array.isArray(raw)
          ? raw
          : []
      return (list as unknown[]).map(normalizePoll)
    })
}

/** GET /v1/chat/rooms/{roomId}/polls/{pollId} */
export function getPoll(roomId: string, pollId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/chat/rooms/${seg(roomId)}/polls/${seg(pollId)}`, {
      auth: "required",
      retry: 1,
      signal,
    })
    .then(normalizePoll)
}

/** POST /v1/chat/rooms/{roomId}/polls/{pollId}/vote */
export function votePoll(roomId: string, pollId: string, optionIndexes: number[]) {
  return http
    .post<unknown, { optionIndexes: number[] }>(
      `/v1/chat/rooms/${seg(roomId)}/polls/${seg(pollId)}/vote`,
      { optionIndexes },
      { auth: "required" },
    )
    .then(normalizePoll)
}

/** POST /v1/chat/rooms/{roomId}/polls/{pollId}/close (hanya pembuat). */
export function closePoll(roomId: string, pollId: string) {
  return http
    .post<unknown>(`/v1/chat/rooms/${seg(roomId)}/polls/${seg(pollId)}/close`, undefined, {
      auth: "required",
    })
    .then(normalizePoll)
}

// ── Pin room (tersinkron backend) ────────────────────────────────────

export type PinnedChatRoom = {
  roomId: string
  position: number
  pinnedAt: string
}

/** GET /v1/chat/pinned — ruang terpin milik sendiri, urut posisi. */
export function listPinnedChatRooms(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/chat/pinned", { auth: "required", retry: 1, signal })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      const list = Array.isArray(record.pinnedRooms)
        ? record.pinnedRooms
        : Array.isArray(raw)
          ? raw
          : []
      return (list as Record<string, unknown>[])
        .filter((p) => typeof p?.roomId === "string")
        .map((p) => ({
          roomId: p.roomId as string,
          position: typeof p.position === "number" ? p.position : 0,
          pinnedAt: typeof p.pinnedAt === "string" ? p.pinnedAt : "",
        }))
    })
}

/** POST /v1/chat/rooms/{roomId}/pin */
export function pinChatRoomOnServer(roomId: string, position?: number) {
  return http
    .post<{ roomId: string; position: number }, { position?: number }>(
      `/v1/chat/rooms/${seg(roomId)}/pin`,
      position !== undefined ? { position } : {},
      { auth: "required" },
    )
}

/** DELETE /v1/chat/rooms/{roomId}/pin */
export function unpinChatRoomOnServer(roomId: string) {
  return http
    .delete<{ unpinned: boolean }>(`/v1/chat/rooms/${seg(roomId)}/pin`, { auth: "required" })
    .then((raw) => ({ unpinned: (raw as { unpinned?: unknown })?.unpinned !== false }))
}

// ── Template balasan "/" ────────────────────────────────────────────

export type ChatReplyTemplate = {
  id: string
  shortcut: string
  text: string
  createdAt: string
  updatedAt: string
}

/** Shortcut backend: huruf kecil/angka/underscore, ≤32. */
export const REPLY_TEMPLATE_SHORTCUT_RE = /^[a-z0-9_]+$/
export const REPLY_TEMPLATE_SHORTCUT_MAX = 32
export const REPLY_TEMPLATE_TEXT_MAX = 500

function normalizeReplyTemplate(raw: unknown): ChatReplyTemplate {
  const record = (raw ?? {}) as Record<string, unknown>
  return {
    id: typeof record.id === "string" ? record.id : "",
    shortcut: typeof record.shortcut === "string" ? record.shortcut : "",
    text: typeof record.text === "string" ? record.text : "",
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  }
}

/** GET /v1/chat/reply-templates */
export function listReplyTemplates(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/chat/reply-templates", { auth: "required", retry: 1, signal })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      const list = Array.isArray(record.templates)
        ? record.templates
        : Array.isArray(raw)
          ? raw
          : []
      return (list as unknown[]).map(normalizeReplyTemplate)
    })
}

/** POST /v1/chat/reply-templates */
export function createReplyTemplate(dto: { shortcut: string; text: string }) {
  return http
    .post<unknown, typeof dto>("/v1/chat/reply-templates", dto, { auth: "required" })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      return normalizeReplyTemplate(record.template ?? raw)
    })
}

/** PATCH /v1/chat/reply-templates/{templateId} */
export function updateReplyTemplate(
  templateId: string,
  dto: { shortcut?: string; text?: string },
) {
  return http
    .patch<unknown, typeof dto>(`/v1/chat/reply-templates/${seg(templateId)}`, dto, {
      auth: "required",
    })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      return normalizeReplyTemplate(record.template ?? raw)
    })
}

/** DELETE /v1/chat/reply-templates/{templateId} */
export function deleteReplyTemplate(templateId: string) {
  return http.delete<unknown>(`/v1/chat/reply-templates/${seg(templateId)}`, {
    auth: "required",
  })
}

// ── Blokir & laporkan dari room ─────────────────────────────────────

export type ChatReportCategory =
  | "FRAUD"
  | "FAKE_IDENTITY"
  | "INAPPROPRIATE_CONTENT"
  | "TNC_VIOLATION"
  | "MONEY_LAUNDERING"
  | "SPAM"
  | "OTHER"

/** Kategori laporan + label Indonesia untuk UI. */
export const CHAT_REPORT_CATEGORIES: { value: ChatReportCategory; label: string }[] = [
  { value: "FRAUD", label: "Penipuan" },
  { value: "FAKE_IDENTITY", label: "Identitas palsu" },
  { value: "INAPPROPRIATE_CONTENT", label: "Konten tidak pantas" },
  { value: "TNC_VIOLATION", label: "Pelanggaran S&K" },
  { value: "MONEY_LAUNDERING", label: "Pencucian uang" },
  { value: "SPAM", label: "Spam" },
  { value: "OTHER", label: "Lainnya" },
]

/**
 * POST /v1/chat/rooms/{roomId}/block — blokir lawan bicara room ini.
 * 409 USER_ALREADY_BLOCKED bila sudah diblokir.
 */
export function blockCounterpartFromRoom(roomId: string) {
  return http
    .post<{ message: string }>(`/v1/chat/rooms/${seg(roomId)}/block`, undefined, {
      auth: "required",
    })
    .then((raw) => ({
      message:
        typeof (raw as { message?: unknown })?.message === "string"
          ? (raw as { message: string }).message
          : "",
    }))
}

/**
 * POST /v1/chat/rooms/{roomId}/report — laporkan lawan bicara room ini.
 * description minimal 20 karakter (validasi backend).
 */
export function reportCounterpartFromRoom(
  roomId: string,
  dto: { category: ChatReportCategory; description: string; relatedMessageId?: string },
) {
  return http
    .post<{ message: string; reportId: string }, typeof dto>(
      `/v1/chat/rooms/${seg(roomId)}/report`,
      dto,
      { auth: "required" },
    )
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      return {
        message: typeof record.message === "string" ? record.message : "",
        reportId: typeof record.reportId === "string" ? record.reportId : "",
      }
    })
}

// ── Buat order escrow dari chat ─────────────────────────────────────

export type CreateOrderFromChatDto = {
  /** ID etalase yang dinegosiasikan (penjual = pemilik etalase). */
  showcaseId?: string
  /** Judul order (wajib bila tanpa showcaseId, min 3). */
  title?: string
  /** Deskripsi order (wajib bila tanpa showcaseId, min 10). */
  description?: string
  /** Harga sepakati dalam RUPIAH (bila diisi; bila tidak pakai harga etalase). */
  hargaSepakat?: number
  qty?: number
  /** Peran pemanggil bila tanpa showcaseId (default BUYER). */
  role?: "BUYER" | "SELLER"
  orderType?: "PHYSICAL_GOODS" | "DIGITAL_GOODS" | "SERVICE" | "OTHER"
  deliveryDeadlineDays?: number
  feeResponsibility?: "BUYER" | "SELLER" | "SPLIT"
}

export type CreatedOrderFromChat = {
  order: {
    /** Kode order publik (mis. KHD-…). */
    orderId: string
    status: string
    feeCalculation?: unknown
    confirmationDeadlineAt?: string | null
  }
  roomId: string
}

/**
 * POST /v1/chat/rooms/{roomId}/order — buat order ESCROW 1-by-1 dari ruang
 * negosiasi (INQUIRY). Uang HANYA lewat escrow: seluruh logika finansial
 * didelegasikan ke OrdersService di backend. TIDAK ADA jalur kirim uang
 * langsung — keputusan user, jangan pernah menambahkannya di sini.
 */
export function createOrderFromChat(
  roomId: string,
  dto: CreateOrderFromChatDto,
): Promise<CreatedOrderFromChat> {
  return http
    .post<unknown, CreateOrderFromChatDto>(`/v1/chat/rooms/${seg(roomId)}/order`, dto, {
      auth: "required",
    })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      const order = (record.order ?? {}) as Record<string, unknown>
      return {
        order: {
          orderId: typeof order.orderId === "string" ? order.orderId : "",
          status: typeof order.status === "string" ? order.status : "",
          feeCalculation: order.feeCalculation,
          confirmationDeadlineAt:
            typeof order.confirmationDeadlineAt === "string"
              ? order.confirmationDeadlineAt
              : null,
        },
        roomId: typeof record.roomId === "string" ? record.roomId : roomId,
      }
    })
}

// ── Lokasi & kartu (tipe payload pesan) ─────────────────────────────

export type ChatLocationPayload = {
  lat: number
  lng: number
  label?: string | null
}

export type ChatProductCardPayload = {
  kind: "PRODUCT_CARD"
  showcaseId: string
  title: string
  priceMin: string | null
  priceMax: string | null
  imageUrl: string | null
  sellerUsername: string
  sellerName?: string | null
  snapshotAt: string
}

export type ChatOrderCardPayload = {
  kind: "ORDER_CARD"
  /** ID internal (cuid) — untuk GET order lanjutan. */
  orderId: string
  /** Kode order publik. */
  orderCode: string
  title: string
  status: string
  orderValue: string
  buyerUsername: string
  sellerUsername: string
  snapshotAt: string
}

/** Type guard: `card` backend → kartu produk. */
export function asProductCard(card: unknown): ChatProductCardPayload | null {
  if (!card || typeof card !== "object") return null
  const c = card as Record<string, unknown>
  if (c.kind !== "PRODUCT_CARD" || typeof c.showcaseId !== "string") return null
  return {
    kind: "PRODUCT_CARD",
    showcaseId: c.showcaseId,
    title: typeof c.title === "string" ? c.title : "",
    priceMin: typeof c.priceMin === "string" ? c.priceMin : null,
    priceMax: typeof c.priceMax === "string" ? c.priceMax : null,
    imageUrl: typeof c.imageUrl === "string" ? c.imageUrl : null,
    sellerUsername: typeof c.sellerUsername === "string" ? c.sellerUsername : "",
    sellerName: typeof c.sellerName === "string" ? c.sellerName : null,
    snapshotAt: typeof c.snapshotAt === "string" ? c.snapshotAt : "",
  }
}

/** Type guard: `card` backend → kartu order. */
export function asOrderCard(card: unknown): ChatOrderCardPayload | null {
  if (!card || typeof card !== "object") return null
  const c = card as Record<string, unknown>
  if (c.kind !== "ORDER_CARD" || typeof c.orderId !== "string") return null
  return {
    kind: "ORDER_CARD",
    orderId: c.orderId,
    orderCode: typeof c.orderCode === "string" ? c.orderCode : "",
    title: typeof c.title === "string" ? c.title : "",
    status: typeof c.status === "string" ? c.status : "",
    orderValue: typeof c.orderValue === "string" ? c.orderValue : "0",
    buyerUsername: typeof c.buyerUsername === "string" ? c.buyerUsername : "",
    sellerUsername: typeof c.sellerUsername === "string" ? c.sellerUsername : "",
    snapshotAt: typeof c.snapshotAt === "string" ? c.snapshotAt : "",
  }
}
