/**
 * Kahade — kontroler aksi pesan chat yang OPTIMISTIS (audit chat A1–A3).
 *
 * Layar ruang chat hanya menyediakan "tangan" (setState, panggilan API) lewat
 * dependency injection; urutan yang WAJIB benar ada di sini supaya bisa diuji
 * tanpa merender layar 4.000 baris:
 *
 *   1. terapkan perubahan ke UI SEKETIKA (sinkron, sebelum `await` pertama),
 *   2. panggil server,
 *   3. gagal → batalkan PERSIS (operasi kebalik pada state terkini) dan
 *      laporkan galatnya ke pemanggil untuk toast.
 *
 * Aturan produk: setiap perubahan optimistis WAJIB bisa dibatalkan saat
 * backend menolak — tidak ada status "setengah jadi" yang tertinggal.
 */
import type { ChatMessage } from "@/lib/api/chat"
import {
  isTempMessageId,
  removeMessagesByIds,
  restoreMessages,
  setPinnedOptimistic,
  settleWithConcurrency,
} from "@/lib/chat-optimistic"

type Updater<T> = (updater: (prev: T) => T) => void

// ── Pin / unpin ─────────────────────────────────────────────────────────

export type PinChangeDeps = {
  roomId: string
  message: ChatMessage
  /** `true` = pin, `false` = lepas pin. */
  wantPin: boolean
  pin: (roomId: string, messageId: string) => Promise<unknown>
  unpin: (roomId: string, messageId: string) => Promise<unknown>
  /** Tambal satu pesan di thread. */
  patchMessage: (messageId: string, patch: (m: ChatMessage) => ChatMessage) => void
  /** Ubah daftar pesan terpin (baris pin di atas thread). */
  setPinned: Updater<ChatMessage[]>
}

export type PinChangeResult = { ok: true } | { ok: false; error: unknown }

/**
 * Pin / lepas pin optimistis. Ikon pin di bubble DAN baris pin di atas thread
 * berubah sebelum request selesai; gagal → keduanya dikembalikan.
 */
export async function applyPinChange(deps: PinChangeDeps): Promise<PinChangeResult> {
  const { message, wantPin } = deps
  // 1. Optimistis (sinkron).
  deps.patchMessage(message.id, (m) => ({ ...m, isPinned: wantPin }))
  deps.setPinned((prev) => setPinnedOptimistic(prev, message, wantPin))
  try {
    // 2. Server.
    await (wantPin ? deps.pin : deps.unpin)(deps.roomId, message.id)
    return { ok: true }
  } catch (error) {
    // 3. Rollback: operasi kebalikan pada state terkini.
    deps.patchMessage(message.id, (m) => ({ ...m, isPinned: !wantPin }))
    deps.setPinned((prev) => setPinnedOptimistic(prev, message, !wantPin))
    return { ok: false, error }
  }
}

// ── Bintang / batal bintang (audit Pesan 2026-10-10, #9e) ───────────────

export type StarChangeDeps = {
  roomId: string
  /** Pesan terpilih (bisa multi). */
  targets: readonly ChatMessage[]
  /** `true` = bintangi semua, `false` = lepas bintang semua. */
  wantStar: boolean
  star: (roomId: string, messageId: string) => Promise<unknown>
  unstar: (roomId: string, messageId: string) => Promise<unknown>
  setMessages: Updater<ChatMessage[]>
  /** Batas request serentak (default 5). */
  concurrency?: number
}

export type StarChangeResult = {
  /** Pesan yang berhasil diubah di server. */
  changed: ChatMessage[]
  /** Pesan yang ditolak server — sudah dikembalikan ke keadaan semula. */
  failed: { message: ChatMessage; error: unknown }[]
}

/**
 * Bintang optimistis: ikon bintang di semua pesan terpilih berubah SEKETIKA;
 * yang ditolak server dikembalikan ke nilai `isStarred` sebelumnya — per
 * pesan, bukan semua (satu kegagalan tidak membatalkan yang lain). Dulu
 * `isStarred` baru ditambal SETELAH semua request selesai: di koneksi lambat
 * pengguna menekan "Bintangi" dan tidak terjadi apa-apa selama beberapa detik.
 */
export async function applyStarChange(deps: StarChangeDeps): Promise<StarChangeResult> {
  const { targets, wantStar } = deps
  if (targets.length === 0) return { changed: [], failed: [] }
  const before = new Map(targets.map((m) => [m.id, m.isStarred === true] as const))
  const ids = new Set(before.keys())
  // 1. Optimistis (sinkron).
  deps.setMessages((prev) => prev.map((m) => (ids.has(m.id) ? { ...m, isStarred: wantStar } : m)))
  // 2. Server (settled: tiap pesan melapor sendiri).
  const op = wantStar ? deps.star : deps.unstar
  const results = await settleWithConcurrency(
    targets.map((m) => () => op(deps.roomId, m.id)),
    deps.concurrency ?? 5,
  )
  const changed: ChatMessage[] = []
  const failed: StarChangeResult["failed"] = []
  results.forEach((r, i) => {
    const message = targets[i]
    if (r.status === "fulfilled") changed.push(message)
    else failed.push({ message, error: r.reason })
  })
  // 3. Rollback HANYA yang gagal, ke nilai semula masing-masing.
  if (failed.length > 0) {
    const failedIds = new Set(failed.map((f) => f.message.id))
    deps.setMessages((prev) =>
      prev.map((m) => (failedIds.has(m.id) ? { ...m, isStarred: before.get(m.id) ?? false } : m)),
    )
  }
  return { changed, failed }
}

// ── Hapus pesan ─────────────────────────────────────────────────────────

export type DeleteMessagesDeps = {
  roomId: string
  /** Pesan milik sendiri yang dipilih untuk dihapus. */
  targets: readonly ChatMessage[]
  remove: (roomId: string, messageId: string) => Promise<unknown>
  setMessages: Updater<ChatMessage[]>
  setPinned: Updater<ChatMessage[]>
  /**
   * Pesan optimistis (`temp-…`) tidak ada di server — cukup dilupakan dari
   * antrean lokal persisten supaya tidak muncul lagi saat ruang dibuka ulang.
   */
  forgetLocal: (messageId: string) => void
  /**
   * Id yang sedang dihapus. Diisi selama request berjalan supaya poll/gema
   * realtime tidak menghidupkan bubble yang sedang dihapus (berkedip).
   */
  pending?: Set<string>
  /** Batas request serentak (default 5). */
  concurrency?: number
}

export type DeleteMessagesResult = {
  deleted: ChatMessage[]
  failed: { message: ChatMessage; error: unknown }[]
}

/**
 * Hapus pesan optimistis: bubble hilang SEKETIKA; hanya yang ditolak server
 * dikembalikan ke posisi waktunya (satu kegagalan tidak membatalkan sisanya).
 */
export async function applyDeleteMessages(
  deps: DeleteMessagesDeps,
): Promise<DeleteMessagesResult> {
  const { targets } = deps
  if (targets.length === 0) return { deleted: [], failed: [] }
  const ids = new Set(targets.map((m) => m.id))
  for (const id of ids) deps.pending?.add(id)

  // 1. Optimistis (sinkron): buang dari thread + baris pin.
  deps.setMessages((prev) => removeMessagesByIds(prev, ids))
  deps.setPinned((prev) => removeMessagesByIds(prev, ids))

  const localOnly = targets.filter((m) => isTempMessageId(m.id))
  for (const m of localOnly) deps.forgetLocal(m.id)
  const serverTargets = targets.filter((m) => !isTempMessageId(m.id))

  // 2. Server (hanya pesan yang benar-benar ada di sana).
  const settled = await settleWithConcurrency(
    serverTargets.map((m) => () => deps.remove(deps.roomId, m.id)),
    deps.concurrency ?? 5,
  )

  const deleted: ChatMessage[] = [...localOnly]
  const failed: DeleteMessagesResult["failed"] = []
  settled.forEach((res, i) => {
    const message = serverTargets[i]
    if (!message) return
    if (res.status === "fulfilled") deleted.push(message)
    else failed.push({ message, error: res.reason })
  })

  // 3. Rollback hanya untuk yang gagal; yang berhasil dipastikan hilang
  //    (poll bisa saja membawanya kembali selagi request berjalan).
  if (failed.length > 0) {
    const restored = failed.map((f) => f.message)
    deps.setMessages((prev) => restoreMessages(prev, restored))
    const wasPinned = restored.filter((m) => m.isPinned === true)
    if (wasPinned.length > 0) {
      deps.setPinned((prev) => wasPinned.reduce((acc, m) => setPinnedOptimistic(acc, m, true), prev))
    }
  }
  const deletedIds = new Set(deleted.map((m) => m.id))
  if (deletedIds.size > 0) deps.setMessages((prev) => removeMessagesByIds(prev, deletedIds))
  for (const id of ids) deps.pending?.delete(id)
  return { deleted, failed }
}
