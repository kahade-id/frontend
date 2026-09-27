/**
 * Kahade — dedupe pesan optimistis vs gema server (fix duplikat 2026-09-28).
 *
 * Akar masalah: `handleSend` menampilkan pesan optimistis (`id: "temp-…"`,
 * `sendStatus: "sending"`) lalu POST. Backend me-broadcast `chat.new_message`
 * TERMASUK ke socket pengirim (gema milik sendiri tidak difilter untuk event
 * ini), sehingga gema tiba dengan id server ASLI — `mergeIncoming` hanya
 * menyaring berdasar `m.id`, gema lolos sebagai "pesan baru" dan di-append.
 * Saat POST resolve, entri optimistis diganti pesan server → DUA bubble
 * dengan id server yang sama. Tanpa perubahan kontrak API (DTO kirim tidak
 * punya `clientMsgId`), pencocokan dilakukan client-side di sini.
 *
 * Modul MURNI (tanpa React/socket) supaya bisa di-unit-test via vitest.
 */
import type { ChatMessage } from "@/lib/api/chat"

/**
 * Jendela maksimum (ms) antara `createdAt` pesan optimistis dan gema server
 * yang dianggap cocok. Longgar terhadap skew jam client↔server, tapi cukup
 * sempit agar pesan "sending" basi tidak mencuri gema pesan lain.
 */
export const OPTIMISTIC_MATCH_WINDOW_MS = 120_000

/**
 * Inti penggabungan pesan masuk — MURNI (tanpa React) supaya seluruh
 * perilakunya (dedupe optimistis, C-07 patch, urutan waktu) bisa diuji
 * lewat vitest (`tests/chat-dedupe.test.ts`).
 */
export type ChatMergeResult = {
  /**
   * Daftar hasil terurut waktu menaik. Identik (`===`) dengan `prev` bila
   * tidak ada perubahan — pemanggil bisa memakainya untuk skip setState.
   */
  next: ChatMessage[]
  /** Jumlah pesan yang benar-benar baru (penggantian optimistis ≠ baru). */
  added: number
  /** Ada pesan baru dari lawan bicara (pemicu mark-as-read). */
  hasFreshFromOther: boolean
  /** True bila ada perubahan apa pun (append / ganti optimistis / patch). */
  changed: boolean
}

function sortByTimeAsc(items: ChatMessage[]): ChatMessage[] {
  return [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

export function mergeChatMessages(
  prev: ChatMessage[],
  incoming: ChatMessage[],
): ChatMergeResult {
  const known = new Map(prev.map((m) => [m.id, m]))
  // Fix duplikat 2026-09-28: gema server untuk pesan optimistis (gema
  // realtime bisa tiba SEBELUM POST resolve — id server ≠ id temp)
  // MENGGANTIKAN pesan optimistisnya di tempat, bukan di-append.
  // Pencocokan terhadap `working` (bukan `prev`): bila dua gema tiba dalam
  // satu batch, gema kedua tidak boleh mencuri slot yang sudah diganti.
  const working = [...prev]
  const indexById = new Map(working.map((m, i) => [m.id, i] as const))
  const fresh: ChatMessage[] = []
  let replacedOptimistic = false
  for (const m of incoming) {
    if (known.has(m.id)) continue
    const match = findOptimisticMatch(working, m)
    const idx = match ? indexById.get(match.id) : undefined
    if (match && idx !== undefined) {
      working[idx] = m
      indexById.delete(match.id)
      indexById.set(m.id, idx)
      replacedOptimistic = true
    } else {
      fresh.push(m)
    }
  }
  // C-07 (audit): pesan yang SUDAH ada di thread ikut disegarkan dari data
  // poll (reaksi, pin, edit, teks) — sebelumnya reaksi/read dari lawan
  // bicara tidak pernah muncul sampai keluar-masuk ruang.
  let changed = fresh.length > 0 || replacedOptimistic
  const patched = working.map((m) => {
    const next = known.get(m.id) ? incoming.find((i) => i.id === m.id) : undefined
    if (!next) return m
    const same =
      next.isPinned === m.isPinned &&
      next.isEdited === m.isEdited &&
      next.isDeleted === m.isDeleted &&
      next.text === m.text &&
      JSON.stringify(next.reactions ?? []) === JSON.stringify(m.reactions ?? [])
    if (same) return m
    changed = true
    return {
      ...m,
      text: next.text,
      isPinned: next.isPinned,
      isEdited: next.isEdited,
      // CN-003: penghapusan yang tiba via poll/reconnect harus ikut
      // menandai tombstone (jalur realtime memakai applyDeletedTombstone).
      isDeleted: next.isDeleted,
      editedAt: next.editedAt ?? m.editedAt,
      reactions: next.reactions,
    }
  })
  if (!changed) return { next: prev, added: 0, hasFreshFromOther: false, changed: false }
  return {
    next: sortByTimeAsc([...patched, ...fresh]),
    added: fresh.length,
    hasFreshFromOther: fresh.some((m) => !m.fromUser),
    changed: true,
  }
}

function attachmentSignature(m: Pick<ChatMessage, "attachments">): string {
  return (m.attachments ?? [])
    .map((a) => `${a.fileName ?? ""}|${a.fileSize ?? 0}`)
    .sort()
    .join(";")
}

/**
 * Cari pesan optimistis (`sendStatus: "sending"`) yang cocok dengan pesan
 * server yang baru tiba (gema realtime / hasil poll / respons POST).
 *
 * Kriteria cocok — semuanya harus sama:
 * - gema milik sendiri (`fromUser`) dan BUKAN pesan lokal berstatus
 *   (`sendStatus` hanya ada di pesan optimistis);
 * - kandidat masih `"sending"` (yang `"failed"` menunggu retry eksplisit
 *   pengguna — jangan disentuh);
 * - `messageType`, teks (trim), `replyToId`, dan sidik lampiran sama;
 * - selisih `createdAt` ≤ `OPTIMISTIC_MATCH_WINDOW_MS`.
 *
 * Bila beberapa kandidat cocok (mis. teks identik dikirim beruntun), yang
 * TERLAMA menang (FIFO) — gema server tiba sesuai urutan kirim.
 *
 * Catatan: `replyToId` ikut dibandingkan — inilah yang membuat kasus
 * "duplikat saat reply" tertangani; `replyTo` (objek kutipan) milik pesan
 * server yang menang dipakai apa adanya.
 */
export function findOptimisticMatch(
  messages: ChatMessage[],
  incoming: ChatMessage,
): ChatMessage | null {
  if (!incoming.fromUser || incoming.sendStatus) return null
  const incomingAt = Date.parse(incoming.createdAt)
  if (Number.isNaN(incomingAt)) return null
  const text = (incoming.text ?? "").trim()
  const replyToId = incoming.replyToId ?? null
  const signature = attachmentSignature(incoming)
  let best: ChatMessage | null = null
  let bestAt = Number.POSITIVE_INFINITY
  for (const m of messages) {
    if (m.sendStatus !== "sending" || !m.fromUser) continue
    if (m.messageType !== incoming.messageType) continue
    if ((m.text ?? "").trim() !== text) continue
    if ((m.replyToId ?? null) !== replyToId) continue
    if (attachmentSignature(m) !== signature) continue
    const at = Date.parse(m.createdAt)
    if (Number.isNaN(at)) continue
    if (Math.abs(incomingAt - at) > OPTIMISTIC_MATCH_WINDOW_MS) continue
    if (at < bestAt) {
      best = m
      bestAt = at
    }
  }
  return best
}
