/**
 * Kahade — logika murni status baca pesan saya (audit chat B5).
 *
 * Ikon status: jam (mengirim/antre) → centang (terkirim ke server) → centang
 * ganda (dibaca). Tidak ada tahap "delivered": backend tidak punya delivered
 * receipt, dan klien TIDAK mengarang statusnya (lihat CHT-007 +
 * docs/rekomendasi-backend-chat.md).
 *
 * Dua sumber kebenaran, keduanya harus bergerak SATU ARAH:
 *   - event realtime `chat.read` (cepat, tetapi bisa terlewat saat socket putus
 *     atau aplikasi di latar),
 *   - `GET /read-receipts` (lengkap, tetapi baru dipanggil sesekali).
 * Status baca bersifat MONOTON — pesan yang sudah dibaca tidak menjadi
 * "belum dibaca" lagi — sehingga hasil keduanya digabung dengan UNION, bukan
 * saling menimpa. Sebelumnya `refreshReadReceipts` MENGGANTI himpunan: respons
 * GET yang tertinggal dari event socket menghapus centang ganda yang baru saja
 * tampil (kedip mundur).
 */
import type { ChatMessage } from "@/lib/api/chat"
import { isTempMessageId } from "@/lib/chat-optimistic"

/** Toleransi (ms) perbandingan `createdAt` pesan vs `readAt` event. */
const READ_AT_SLACK_MS = 1000

/**
 * Gabungkan id yang terbaca ke himpunan lama. Mengembalikan `prev` APA ADANYA
 * bila tidak ada id baru — pemanggil `setState` bisa bail-out tanpa render.
 */
export function mergeReadIds(
  prev: ReadonlySet<string>,
  ids: Iterable<string>,
): ReadonlySet<string> {
  let next: Set<string> | null = null
  for (const id of ids) {
    if (!id || prev.has(id) || next?.has(id)) continue
    next ??= new Set(prev)
    next.add(id)
  }
  return next ?? prev
}

/** Id pesan yang `isRead` pada respons `GET /read-receipts`. */
export function readIdsFromReceipts(
  receipts: readonly { messageId: string; isRead: boolean }[],
): string[] {
  return receipts.filter((r) => r.isRead).map((r) => r.messageId)
}

export type ReadEvent = {
  /** `null` = baca massal ("seluruh pesan saya dibaca"). */
  messageId: string | null
  /** Kapan pembaca menandai (ISO, jam server). */
  readAt?: string | null
}

/**
 * Pesan MILIK SAYA yang menjadi "dibaca" akibat satu event `chat.read`.
 *
 *   - event untuk satu `messageId` → hanya pesan itu (tidak menyimpulkan lebih);
 *   - event massal → semua pesan saya yang sudah dikonfirmasi server dan dibuat
 *     pada/sebelum `readAt`. Event massal berasal dari `POST /read` (pembaca
 *     membuka ruang / kembali ke dasar thread) sehingga memang menandai semua
 *     pesan masuk hingga saat itu. `readAt` tak terbaca → semua pesan saya
 *     yang terkonfirmasi (sesuai kontrak hook: "seluruh pesan saya dibaca").
 *
 * Pesan optimistis (`temp-…`/`sendStatus`) tidak pernah ikut: belum dikenal
 * server, jadi belum mungkin dibaca siapa pun.
 */
export function messagesReadByEvent(
  messages: readonly ChatMessage[],
  event: ReadEvent,
): string[] {
  if (event.messageId) return [event.messageId]
  const readAt = event.readAt ? Date.parse(event.readAt) : Number.NaN
  const bounded = Number.isFinite(readAt)
  const out: string[] = []
  for (const m of messages) {
    if (!m.fromUser || m.sendStatus || isTempMessageId(m.id) || m.isDeleted) continue
    if (bounded) {
      const createdAt = Date.parse(m.createdAt)
      if (Number.isFinite(createdAt) && createdAt > readAt + READ_AT_SLACK_MS) continue
    }
    out.push(m.id)
  }
  return out
}
