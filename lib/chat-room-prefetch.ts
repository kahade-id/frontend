/**
 * Kahade — prefetch header room chat (consume-once).
 *
 * PERF-FIX (network P1): daftar chat SUDAH memegang objek `ChatRoom` penuh,
 * tapi tap baris tidak prefetch apa pun — layar room selalu `GET
 * /v1/chat/rooms/:roomId` + `GET` pesan dari nol. Modul ini menitipkan objek
 * room dari daftar ke cache modul saat baris dibuka; layar room mengonsumsi
 * (sekali pakai) untuk header dan melewatkan request header.
 *
 * Pola mengikuti `lib/showcase-detail-prefetch.ts` (TTL 90 dtk, cap 50
 * entri, sweep saat write). Bedanya: tidak ada fetch jaringan di sini —
 * datanya sudah di tangan.
 */
import type { ChatRoom } from "@/lib/api/chat"

/** Umur seed — cukup untuk jeda tap → render layar room. */
export const CHAT_ROOM_PREFETCH_TTL_MS = 90_000

/** Batas ukuran cache — baris dibuka tanpa dibaca tidak menumpuk. */
export const CHAT_ROOM_PREFETCH_MAX_ENTRIES = 50

type PrefetchEntry = { at: number; room: ChatRoom }

const cache = new Map<string, PrefetchEntry>()

function sweepExpired(now: number): void {
  for (const [key, entry] of cache) {
    if (now - entry.at >= CHAT_ROOM_PREFETCH_TTL_MS) cache.delete(key)
  }
}

function evictOverflow(): void {
  for (const [key] of cache) {
    if (cache.size <= CHAT_ROOM_PREFETCH_MAX_ENTRIES) break
    cache.delete(key)
  }
}

/**
 * Titipkan objek room dari daftar — dipanggil saat baris chat dibuka
 * (sebelum `router.push`). Tidak melempar.
 */
export function seedChatRoomPrefetch(room: ChatRoom, now: number = Date.now()): void {
  if (!room || !room.id) return
  sweepExpired(now)
  cache.set(room.id, { at: now, room })
  evictOverflow()
}

/**
 * Ambil seed bila masih segar — SEKALI PAKAI (dihapus dari cache).
 * Dipakai layar room untuk header sebelum memutuskan fetch jaringan.
 */
export function consumePrefetchedChatRoom(
  roomId: string,
  now: number = Date.now(),
): ChatRoom | null {
  const entry = cache.get(roomId)
  cache.delete(roomId)
  if (!entry || now - entry.at >= CHAT_ROOM_PREFETCH_TTL_MS) return null
  return entry.room
}

/** Untuk test / invalidasi eksplisit. */
export function clearChatRoomPrefetch(roomId?: string): void {
  if (roomId) cache.delete(roomId)
  else cache.clear()
}
