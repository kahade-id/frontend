/**
 * Kahade — realtime chat: konstanta event & helper MURNI (GAP-B2, G101–G125).
 *
 * Modul ini TIDAK menyentuh react-native / socket.io-client secara runtime
 * (hanya type-import), sehingga bisa diuji di Vitest (node) tanpa stub.
 *
 * Peta event backend (terverifikasi dari
 * `backend/src/modules/realtime/realtime.gateway.ts` +
 * `backend/src/modules/chat/chat.service.ts`, 2026-09-26):
 *
 * | Event                 | Arah            | Payload                                  |
 * |-----------------------|-----------------|------------------------------------------|
 * | chat.new_message      | server → klien  | pesan terserialisasi (netral di room     |
 * |                       |                 | `chat:<id>`, per-viewer di `user:<id>`)  |
 * | chat.message_updated  | server → klien  | pesan terserialisasi (sudut pandang      |
 * |                       |                 | editor)                                  |
 * | chat.message_deleted  | server → klien  | { messageId, roomId } (tombstone)        |
 * | chat.read             | server → klien  | { roomId, userId, messageId?, readAt }   |
 * | chat.reaction_updated | server → klien  | { roomId, messageId, reactions[] }      |
 * | chat.message_pinned / | server → klien  | { roomId, messageId, isPinned, pinnedBy }|
 * | chat.message_unpinned |                 |                                          |
 * | chat.typing           | dua arah        | { roomId, userId, fullName, isTyping,    |
 * |                       |                 |   expiresAt } (unified; gantikan         |
 * |                       |                 |   typing.start/stop legacy)              |
 * | user.online /         | server → klien  | { userId } (broadcast ke room, kecuali   |
 * | user.offline          |                 | socket pengirim)                         |
 * | join-room / leave-room| klien → server  | { roomId } → ack { success, message? }   |
 * |                       |                 | (guard partisipasi di SISI SERVER —       |
 * |                       |                 | `isRoomParticipant`; klien tidak perlu   |
 * |                       |                 | validasi REST tambahan)                  |
 *
 * Catatan serialisasi (CN-004/CN-005, sudah diperbaiki di backend):
 * broadcast room memakai payload NETRAL (`fromUser: false`,
 * `reactedByMe: false` selalu); payload per-viewer yang benar dikirim ke
 * room `user:<id>`. Klien menerima KEDUANYA → dedup by messageId dengan
 * merge "sticky" (lihat `mergeMessageLists`).
 *
 * Keamanan: token TIDAK PERNAH di query URL (B-39) — hanya `auth: { token }`
 * di handshake (lihat `buildSocketOptions`).
 */
import type { ManagerOptions, SocketOptions } from "socket.io-client"
import type { ChatMessage, ChatReaction } from "@/lib/api/chat"

/** Nama event socket chat — satu sumber kebenaran untuk klien. */
export const CHAT_SOCKET_EVENTS = {
  NEW_MESSAGE: "chat.new_message",
  MESSAGE_UPDATED: "chat.message_updated",
  MESSAGE_DELETED: "chat.message_deleted",
  READ: "chat.read",
  REACTION_UPDATED: "chat.reaction_updated",
  MESSAGE_PINNED: "chat.message_pinned",
  MESSAGE_UNPINNED: "chat.message_unpinned",
  TYPING: "chat.typing",
  USER_ONLINE: "user.online",
  USER_OFFLINE: "user.offline",
} as const

/** Event `error` bawaan socket.io untuk pesan error dari server. */
export const SOCKET_SERVER_ERROR_EVENT = "error"

/** Pesan hapus: { messageId, roomId }. */
export type ChatMessageDeletedPayload = {
  messageId: string
  roomId: string
}

/** Read receipt: userId = PEMBACA (id internal, dari JWT sub). */
export type ChatReadPayload = {
  roomId: string
  userId: string
  messageId?: string | null
  readAt: string
  markedCount?: number
}

/** Update reaksi: reactions sudah di-summarize server (per-viewer bila lewat `user:<id>`). */
export type ChatReactionPayload = {
  roomId: string
  messageId: string
  reactions: ChatReaction[]
}

/** Pin / unpin pesan. */
export type ChatPinPayload = {
  roomId: string
  messageId: string
  isPinned: boolean
  pinnedBy?: string | null
}

/** Indikator mengetik: userId = pengetik (id internal). */
export type ChatTypingPayload = {
  roomId: string
  userId: string
  fullName?: string | null
  isTyping: boolean
  expiresAt?: string | null
}

/**
 * Jaring pengaman indikator mengetik di sisi penerima (ms).
 *
 * Pengirim (REST) mengirim `true` sekali per sesi mengetik dan `false`
 * 3 detik setelah keystroke terakhir; state mengetik di gateway bertahan
 * 8 detik (TYPING_HOLD_MS backend). 10 detik di sini hanya menutup kasus
 * paket `stop` hilang — BUKAN 3 detik, karena pengirim tidak mengirim
 * heartbeat berkala sehingga expiry 3 detik akan mematikan indikator di
 * tengah sesi mengetik yang panjang.
 */
export const TYPING_EXPIRY_MS = 10_000

/**
 * Ambil id internal viewer (JWT `sub`) dari access token — murni, tanpa
 * network. Dipakai untuk menyaring gema event milik sendiri (typing/read
 * yang di-broadcast server termasuk ke socket pengirim).
 */
export function getViewerIdFromToken(token: string | null | undefined): string | null {
  if (!token || typeof token !== "string") return null
  try {
    const parts = token.split(".")
    if (parts.length !== 3 || !parts[1]) return null
    const json = base64UrlDecode(parts[1])
    if (!json) return null
    const data = JSON.parse(json) as { sub?: unknown }
    return typeof data.sub === "string" && data.sub.length > 0 ? data.sub : null
  } catch {
    return null
  }
}

function base64UrlDecode(input: string): string | null {
  try {
    const b64 = input.replace(/-/g, "+").replace(/_/g, "/")
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4)
    if (typeof Buffer !== "undefined") {
      return Buffer.from(padded, "base64").toString("utf8")
    }
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/**
 * Opsi koneksi socket.io (G101/G103/G104/G121).
 *
 * - `transports: ["websocket"]`: server MEMBUANG long-polling (B-39) —
 *   token tidak boleh menumpang query string poll.
 * - `auth: { token }`: token dikirim di payload handshake, BUKAN di URL.
 * - Backoff reconnect dengan jitter: socket.io `reconnectionDelay` tumbuh
 *   eksponensial s.d. `reconnectionDelayMax`, dikali faktor acak
 *   `randomizationFactor` (0.5 = ±50% jitter).
 */
export function buildSocketOptions(token: string): Partial<ManagerOptions & SocketOptions> {
  return {
    transports: ["websocket"],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30_000,
    randomizationFactor: 0.5,
    timeout: 10_000,
  }
}

function sortByTime(items: ChatMessage[]): ChatMessage[] {
  return [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

export type MergeResult = {
  messages: ChatMessage[]
  /** Pesan yang benar-benar baru (belum dikenal). */
  added: number
  /** Subset `incoming` yang belum dikenal — untuk efek samping (mark-as-read). */
  fresh: ChatMessage[]
}

/**
 * Gabung daftar pesan masuk ke thread — SATU-SATUNYA logika dedup/merge
 * untuk REST poll, kirim optimistis, DAN event realtime (G108).
 *
 * - Deduplikasi by `id` terhadap state terkini (menutup balap poll vs
 *   realtime vs respons kirim).
 * - Pesan yang sudah dikenal ikut di-patch (teks/edit/pin/reaksi) dari data
 *   terbaru — event `chat.message_updated` / `chat.reaction_updated`
 *   mengalir lewat sini juga.
 * - `fromUser` bersifat sticky-true: payload netral broadcast room selalu
 *   `fromUser: false`, sedangkan payload per-viewer (`user:<id>`) benar.
 *   Kepengarangan pesan tidak pernah berubah, jadi "pernah true" menang —
 *   tanpa ini pesan sendiri dari perangkat lain ter-render sebagai pesan
 *   masuk sampai payload viewer tiba.
 */
export function mergeMessageLists(
  prev: ChatMessage[],
  incoming: ChatMessage[],
): MergeResult {
  const known = new Map(prev.map((m) => [m.id, m]))
  const fresh = incoming.filter((m) => !known.has(m.id))
  let changed = fresh.length > 0
  const patched = prev.map((m) => {
    const next = known.get(m.id) ? incoming.find((i) => i.id === m.id) : undefined
    if (!next) return m
    const fromUser = m.fromUser || next.fromUser === true
    const same =
      next.isPinned === m.isPinned &&
      next.isEdited === m.isEdited &&
      next.text === m.text &&
      fromUser === m.fromUser &&
      JSON.stringify(next.reactions ?? []) === JSON.stringify(m.reactions ?? [])
    if (same) return m
    changed = true
    return {
      ...m,
      text: next.text,
      isPinned: next.isPinned,
      isEdited: next.isEdited,
      editedAt: next.editedAt ?? m.editedAt,
      reactions: next.reactions,
      fromUser,
    }
  })
  if (!changed) return { messages: prev, added: 0, fresh: [] }
  return { messages: sortByTime([...patched, ...fresh]), added: fresh.length, fresh }
}

/**
 * Terapkan tombstone hapus (event `chat.message_deleted`) — konsisten dengan
 * yang dibawa REST poll: baris tetap ada sebagai "Pesan ini telah dihapus"
 * (CN-003), bukan difilter keluar.
 */
export function applyDeletedTombstone(
  prev: ChatMessage[],
  messageId: string,
): ChatMessage[] {
  let changed = false
  const next = prev.map((m) => {
    if (m.id !== messageId || m.isDeleted) return m
    changed = true
    return { ...m, isDeleted: true, text: undefined, attachments: [] }
  })
  return changed ? next : prev
}

/**
 * Ganti ringkasan reaksi satu pesan (event `chat.reaction_updated`) —
 * server adalah sumber kebenaran (wholesale replace).
 */
export function applyReactionSummary(
  prev: ChatMessage[],
  messageId: string,
  reactions: ChatReaction[],
): ChatMessage[] {
  let changed = false
  const next = prev.map((m) => {
    if (m.id !== messageId) return m
    if (JSON.stringify(m.reactions ?? []) === JSON.stringify(reactions ?? [])) return m
    changed = true
    return { ...m, reactions }
  })
  return changed ? next : prev
}

/**
 * Rekonsiliasi `reactedByMe` dari ringkasan reaksi terhadap id viewer
 * (G113).
 *
 * Server mengirim `chat.reaction_updated` dua kali ke socket yang sama:
 * payload per-viewer (room `user:<id>`, `reactedByMe` benar) dan payload
 * NETRAL (room `chat:<id>`, `reactedByMe` selalu false). Bila yang netral
 * tiba belakangan, `applyReactionSummary` wholesale akan mematikan chip
 * reaksi milik sendiri. Daftar `users` di tiap entri bersifat otoritatif
 * (diisi server dari baris reaksi), jadi `reactedByMe` dihitung ulang
 * darinya — eksak, bukan sticky.
 *
 * Tanpa `users` / tanpa viewerId, payload dikembalikan apa adanya.
 */
export function reconcileReactionViewer(
  reactions: ChatReaction[],
  viewerId: string | null,
): ChatReaction[] {
  if (!viewerId || !Array.isArray(reactions)) return reactions
  let changed = false
  const next = reactions.map((entry) => {
    const users = entry.users
    if (!Array.isArray(users)) return entry
    const mine = users.some((u) => u != null && u.userId === viewerId)
    if (mine === entry.reactedByMe) return entry
    changed = true
    return { ...entry, reactedByMe: mine }
  })
  return changed ? next : reactions
}

/**
 * Pelacak indikator mengetik dengan expiry otomatis (G110).
 *
 * `signal(true)` tiap ada event mengetik → `onChange(true)`; bila tidak ada
 * sinyal susulan dalam `expiryMs`, `onChange(false)` dipanggil otomatis —
 * indikator tidak pernah macet menyala bila paket `stop` hilang.
 */
export function createTypingTracker(
  onChange: (isTyping: boolean) => void,
  expiryMs: number = TYPING_EXPIRY_MS,
): { signal: (isTyping: boolean) => void; dispose: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  return {
    signal(isTyping: boolean) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (isTyping) {
        timer = setTimeout(() => {
          timer = null
          onChange(false)
        }, expiryMs)
      }
      onChange(isTyping)
    },
    dispose() {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}
