/**
 * Kahade — jendela render + batas join socket daftar chat (audit chat F15, MURNI).
 *
 * Daftar chat = baris RAPAT (±70 px, 8–10 per layar) yang bisa berjumlah ribuan
 * lewat "muat lebih banyak" — beda dengan kartu feed (default PaginatedList):
 *
 *   - initialNumToRender 12: menutup layar pertama di perangkat tinggi tanpa
 *     celah kosong di bawah saat pertama dilukis (default feed hanya 6);
 *   - maxToRenderPerBatch 8 + batching 40 ms: lukis berikutnya cepat tetapi
 *     tidak menyumbat thread JS (tiap baris membawa gestur swipe);
 *   - windowSize 7 (±3 layar): setiap baris di jendela memegang gestur RNGH +
 *     shared value Reanimated — default feed 11 (±5 layar) menahan ±90 baris
 *     ter-mount, ±56 di sini; cukup untuk fling tanpa blank.
 *
 * `removeClippedSubviews` tetap false (blank-scroll di Android — lihat
 * PaginatedList) dan TANPA getItemLayout: tinggi baris bergantung skala font
 * (pengaturan A-/A+ dan Dynamic Type OS), jadi angka tetap akan meleset.
 */
import { FEED_LIST_WINDOWING, type ListWindowing } from "@/lib/list-windowing"

export const CHAT_LIST_WINDOWING = {
  initialNumToRender: 12,
  maxToRenderPerBatch: 8,
  windowSize: 7,
  updateCellsBatchingPeriod: 40,
} as const satisfies ListWindowing

/**
 * Batas ruang yang di-join untuk indikator "mengetik…" di daftar. Daftar
 * ribuan ruang dulu membuat SEMUA ruang yang termuat di-join — ratusan batch
 * × 2 dtk dan ribuan room di sisi server demi indikator yang hanya terlihat
 * di beberapa baris teratas. Ruang paling atas (pin + percakapan terbaru)
 * adalah yang aktif secara wajar.
 */
export const TYPING_JOIN_MAX_ROOMS = 60

/** Ambil id yang akan di-join: yang teratas saja, dalam urutan daftar. */
export function limitTypingRoomIds(
  roomIds: readonly string[],
  max: number = TYPING_JOIN_MAX_ROOMS,
): string[] {
  return roomIds.slice(0, Math.max(0, max))
}

export { FEED_LIST_WINDOWING }
