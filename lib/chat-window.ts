/**
 * Kahade — jendela thread chat terbatas dua arah (FE-019).
 *
 * Masalah: thread tumbuh tanpa batas — `loadOlder()` prepend tanpa pernah
 * membuang, sehingga ruang aktif bisa menahan ratusan bubble (+ gambar) di
 * memori. FlatList memvirtualisasi render (F-06), tapi array `messages` dan
 * seluruh pemrosesan turunannya (search, threadRows, merge) tetap O(n) tanpa
 * batas.
 *
 * Model: jendela geser maksimum `CHAT_WINDOW_MAX_MESSAGES` pesan.
 *   - `loadOlder` (pengguna membaca riwayat ke ATAS): halaman lama di-prepend,
 *     kelebihan dibuang dari sisi TERBARU — jauh dari viewport, scroll anchor
 *     tidak terganggu. Flag `newestTruncated` menandai potongan.
 *   - Kembali ke dasar + `newestTruncated`: sisi terbaru diambil ulang via
 *     `afterMessageId` (jangkar = pesan terkonfirmasi terakhir DI DALAM
 *     jendela), flag dibersihkan, kelebihan dibuang dari sisi TERLAMA.
 *   - Pesan optimistis/gagal (`sendStatus`) TIDAK PERNAH dibuang — mereka
 *     transient dan milik pengguna; proteksi ini membuat trim aman dipanggil
 *     dari jalur mana pun.
 *
 * Modul MURNI (tanpa React) supaya seluruh perilaku trim bisa di-unit-test
 * (`tests/chat-window.test.ts`). Array diasumsikan terurut waktu MENAIK
 * (terlama dulu), sama seperti state `messages` di `app/chat/[roomId].tsx`.
 */
import type { ChatMessage } from "@/lib/api/chat"

/**
 * Batas jendela: 4 halaman × 30 pesan (`CHAT_PAGE_SIZE` di `lib/api/chat.ts`).
 * Ditulis literal (bukan import nilai) supaya modul ini tetap MURNI tanpa
 * menarik rantai API client — sinkronisasi nilai dijaga komentar ini + test.
 */
export const CHAT_WINDOW_MAX_MESSAGES = 120

export type ChatWindowTrim = {
  /** Array hasil (identik `===` dengan masukan bila tidak ada yang dibuang). */
  next: ChatMessage[]
  /** Jumlah pesan non-pending yang dibuang. */
  dropped: number
}

/** Pesan lokal yang belum terkonfirmasi server — tidak boleh dibuang trim. */
function isPending(m: ChatMessage): boolean {
  return m.sendStatus === "sending" || m.sendStatus === "failed"
}

function dropFrom(
  messages: ChatMessage[],
  max: number,
  fromNewest: boolean,
): ChatWindowTrim {
  const excess = messages.length - max
  if (excess <= 0) return { next: messages, dropped: 0 }
  const drop = new Set<number>()
  let remaining = excess
  if (fromNewest) {
    for (let i = messages.length - 1; i >= 0 && remaining > 0; i--) {
      if (!isPending(messages[i])) {
        drop.add(i)
        remaining--
      }
    }
  } else {
    for (let i = 0; i < messages.length && remaining > 0; i++) {
      if (!isPending(messages[i])) {
        drop.add(i)
        remaining--
      }
    }
  }
  if (drop.size === 0) return { next: messages, dropped: 0 }
  return { next: messages.filter((_, i) => !drop.has(i)), dropped: drop.size }
}

/**
 * Buang kelebihan dari sisi TERBARU (akhir array). Dipakai setelah
 * `loadOlder`: pengguna di puncak thread, pesan terbaru jauh dari viewport.
 */
export function trimNewestSide(
  messages: ChatMessage[],
  max: number = CHAT_WINDOW_MAX_MESSAGES,
): ChatWindowTrim {
  return dropFrom(messages, max, true)
}

/**
 * Buang kelebihan dari sisi TERLAMA (awal array). Dipakai saat kembali ke
 * dasar thread (setelah fetch ulang sisi terbaru) — viewport aman karena
 * pengguna di dasar.
 */
export function trimOldestSide(
  messages: ChatMessage[],
  max: number = CHAT_WINDOW_MAX_MESSAGES,
): ChatWindowTrim {
  return dropFrom(messages, max, false)
}
