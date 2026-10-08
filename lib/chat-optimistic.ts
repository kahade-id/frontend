/**
 * Kahade — helper MURNI untuk aksi chat yang optimistis (audit chat A1–A3).
 *
 * Pola yang dikunci di sini (sama dengan `handleReact`): UI berubah SEKETIKA,
 * lalu server dipanggil, lalu — bila server menolak — perubahan DIBATALKAN
 * persis dan pengguna diberi tahu. Semua fungsi di bawah tidak menyentuh
 * React/jaringan supaya urutan "terapkan → panggil → rollback" bisa diuji.
 *
 * Konvensi rollback: yang dikembalikan adalah OPERASI KEBALIKANNYA pada state
 * TERKINI (bukan snapshot lama). Snapshot lama bisa menimpa perubahan sah yang
 * masuk selagi request berjalan (gema realtime, poll, reaksi lawan bicara).
 */
import type { ChatMessage } from "@/lib/api/chat"

/** Id sementara milik pesan optimistis (belum dikenal server). */
export const TEMP_MESSAGE_ID_PREFIX = "temp-"

export function isTempMessageId(id: string): boolean {
  return id.startsWith(TEMP_MESSAGE_ID_PREFIX)
}

/**
 * Id sementara DITURUNKAN dari idempotency key (audit chat B4): satu bubble
 * optimistis ⇄ satu key, tanpa perlu tabel pemetaan. Tidak mungkin bentrok
 * antar pesan (key = UUID) dan tetap bisa dikaitkan ke key-nya setelah restart
 * (id pesan gagal disimpan di antrean persisten).
 */
export function createTempMessageId(idempotencyKey: string): string {
  return `${TEMP_MESSAGE_ID_PREFIX}${idempotencyKey}`
}

/**
 * Urutkan menaik menurut `createdAt` — 1 parse per pesan (decorate-sort-
 * undecorate). Sort stabil: waktu sama → urutan asal dipertahankan.
 */
export function sortMessagesByTime(items: readonly ChatMessage[]): ChatMessage[] {
  return items
    .map((m) => ({ m, ts: new Date(m.createdAt).getTime() }))
    .sort((a, b) => a.ts - b.ts)
    .map(({ m }) => m)
}

/**
 * Buang pesan berdasarkan id. Mengembalikan `prev` APA ADANYA (identitas sama)
 * bila tidak ada yang cocok — pemanggil `setMessages` bisa bail-out tanpa render.
 */
export function removeMessagesByIds(
  prev: ChatMessage[],
  ids: ReadonlySet<string>,
): ChatMessage[] {
  if (ids.size === 0) return prev
  const next = prev.filter((m) => !ids.has(m.id))
  return next.length === prev.length ? prev : next
}

/**
 * Rollback hapus: sisipkan kembali pesan yang sempat dibuang, terurut waktu.
 * Pesan yang SUDAH ada lagi (mis. poll membawanya kembali) tidak digandakan.
 */
export function restoreMessages(
  prev: ChatMessage[],
  removed: readonly ChatMessage[],
): ChatMessage[] {
  if (removed.length === 0) return prev
  const known = new Set(prev.map((m) => m.id))
  const missing = removed.filter((m) => !known.has(m.id))
  if (missing.length === 0) return prev
  return sortMessagesByTime([...prev, ...missing])
}

/**
 * Daftar pesan terpin (baris pin di atas thread) setelah pin/unpin
 * OPTIMISTIS. `wantPin=true` menambah (atau menyegarkan) entri; `false`
 * membuangnya. Memanggil fungsi yang sama dengan `!wantPin` adalah rollback.
 */
export function setPinnedOptimistic(
  prev: ChatMessage[],
  message: ChatMessage,
  wantPin: boolean,
  nowIso: string = new Date().toISOString(),
): ChatMessage[] {
  const exists = prev.some((p) => p.id === message.id)
  if (!wantPin) return exists ? prev.filter((p) => p.id !== message.id) : prev
  const pinnedCopy: ChatMessage = {
    ...message,
    isPinned: true,
    pinnedAt: message.pinnedAt ?? nowIso,
  }
  return exists
    ? prev.map((p) => (p.id === message.id ? pinnedCopy : p))
    : [...prev, pinnedCopy]
}

/**
 * Jalankan tugas async dengan batas konkurensi dan semantik "settled":
 * TIDAK PERNAH reject — setiap tugas melaporkan hasilnya sendiri, urutan hasil
 * = urutan tugas. Dipakai hapus massal: satu pesan gagal tidak membatalkan
 * sisanya, dan 50 request tidak dibuka serentak di HP kelas bawah.
 */
export async function settleWithConcurrency<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length)
  let next = 0
  const workers = Math.max(1, Math.min(Math.floor(limit) || 1, tasks.length))
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (next < tasks.length) {
        const index = next
        next += 1
        try {
          results[index] = { status: "fulfilled", value: await tasks[index]() }
        } catch (reason) {
          results[index] = { status: "rejected", reason }
        }
      }
    }),
  )
  return results
}
