/**
 * Kahade — jangkar "pesan pertama yang belum dibaca" (B02).
 *
 * Layar room menandai ruang TERBACA segera setelah dibuka
 * (`markChatRoomRead`), jadi jangkar harus dihitung SEKALI dari data
 * `unreadCount` daftar room SEBELUM penandaan itu — modul ini murni agar
 * bisa di-test tanpa layar.
 *
 * `unreadCount` server = jumlah pesan MASUK yang belum dibaca. Jangkar =
 * pesan masuk tertua di antara `unreadCount` pesan masuk terbaru. Pesan
 * sendiri dan pesan sistem tidak mengonsumsi jatah unread.
 */

export type AnchorMessage = {
  id: string
  /** true = pesan kiriman sendiri (tidak dihitung sebagai unread). */
  fromUser: boolean
  /** Pesan sistem tidak dihitung sebagai unread. */
  messageType?: string
}

/**
 * Id pesan pertama yang belum dibaca, atau `null` bila tidak ada
 * (`unreadCount` 0 / tidak ada pesan masuk). `messages` diurut menaik
 * (terlama → terbaru), seperti state thread layar.
 */
export function firstUnreadMessageId(
  messages: readonly AnchorMessage[],
  unreadCount: number,
): string | null {
  if (!Number.isFinite(unreadCount) || unreadCount <= 0 || messages.length === 0) {
    return null
  }
  let remaining = Math.trunc(unreadCount)
  let anchor: string | null = null
  for (let i = messages.length - 1; i >= 0 && remaining > 0; i--) {
    const m = messages[i]
    if (m.fromUser) continue
    if ((m.messageType ?? "").toUpperCase() === "SYSTEM") continue
    anchor = m.id
    remaining--
  }
  return anchor
}
