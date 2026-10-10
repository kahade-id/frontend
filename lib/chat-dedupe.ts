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
import { reconcileReactionViewer } from "@/lib/realtime/chat-events"

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
/**
 * 2026-10-08 (keluhan "double-send"): identitas pengguna yang sedang login.
 *
 * Pada koneksi lambat, gema `chat.new_message` untuk pesan SAYA bisa tiba
 * lebih dulu daripada respons POST — dan bila payload gema tidak menandai
 * sisi-pengirim (`fromUser`/`isMine` absen), `normalizeChatMessage` memberi
 * `fromUser: false`. Sebelumnya gema seperti itu TIDAK PERNAH dicocokkan
 * dengan bubble optimistis, jadi ia di-append sebagai pesan baru → bubble
 * ganda yang menetap (POST resolve mengganti bubble optimistis dengan pesan
 * ber-id SAMA).
 *
 * `selfIds` (id publik `USR-…` dan/atau id internal) membuat pencocokan
 * sadar-identitas: gema netral yang PENGIRIMNYA saya tetap menggantikan
 * bubble optimistis. Tanpa `selfIds`, perilaku lama dipertahankan
 * (konservatif: tidak menebak).
 */
export type ChatMergeOptions = {
  /** Id milik pengguna login (publik `USR-…` dan/atau id internal). */
  selfIds?: readonly (string | null | undefined)[]
}

function selfIdSet(opts?: ChatMergeOptions): Set<string> {
  const set = new Set<string>()
  for (const id of opts?.selfIds ?? []) if (typeof id === "string" && id) set.add(id)
  return set
}

/** Id pengirim yang dibawa sebuah pesan (backend bisa mengisi salah satunya). */
function senderIdsOf(m: Pick<ChatMessage, "senderId" | "sender">): string[] {
  const ids = [m.senderId, m.sender?.userId, m.sender?.id]
  return ids.filter((id): id is string => typeof id === "string" && id.length > 0)
}

/**
 * True bila pesan ini JELAS milik saya meski `fromUser` bernilai false —
 * hanya ketika `selfIds` dikenal DAN id pengirimnya cocok.
 */
function isOwnBySender(m: ChatMessage, ids: Set<string>): boolean {
  if (m.fromUser) return true
  if (ids.size === 0) return false
  return senderIdsOf(m).some((id) => ids.has(id))
}

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
  // Tim8 P1: decorate-sort-undecorate — `new Date()` per perbandingan =
  // O(N log N) parse; sekarang tepat 1 parse per item. Hasil urutan identik
  // (sort stabil; ts sama → urutan asal dipertahankan).
  return items
    .map((m) => ({ m, ts: new Date(m.createdAt).getTime() }))
    .sort((a, b) => a.ts - b.ts)
    .map(({ m }) => m)
}

/**
 * Tim8 P1: perbandingan reaksi dangkal (panjang + emoji/count/reactedByMe
 * per posisi) — pengganti `JSON.stringify` per pesan per merge.
 */
function sameReactions(
  a: { emoji: string; count: number; reactedByMe: boolean }[] | undefined,
  b: { emoji: string; count: number; reactedByMe: boolean }[] | undefined,
): boolean {
  const ra = a ?? []
  const rb = b ?? []
  if (ra.length !== rb.length) return false
  for (let i = 0; i < ra.length; i++) {
    const x = ra[i]
    const y = rb[i]
    if (x.emoji !== y.emoji || x.count !== y.count || x.reactedByMe !== y.reactedByMe)
      return false
  }
  return true
}

/**
 * BFE-007: perbandingan data polling dangkal (id + angka vote + status
 * tutup + vote saya) — pengganti `JSON.stringify` per pesan per merge.
 * Dipakai untuk mendeteksi view polling yang lebih baru pada pesan yang
 * sudah dikenal (race view netral vs sender-view pada `chat.new_message`
 * POLL: broadcast netral tiba duluan dengan `fromUser=false`).
 */
function samePoll(
  a: ChatMessage["poll"],
  b: ChatMessage["poll"],
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (
    a.id !== b.id ||
    a.totalVotes !== b.totalVotes ||
    a.isClosed !== b.isClosed ||
    a.allowMultiple !== b.allowMultiple ||
    a.deadline !== b.deadline ||
    a.createdBy.userId !== b.createdBy.userId
  )
    return false
  const av = a.myVotes ?? []
  const bv = b.myVotes ?? []
  if (av.length !== bv.length || av.some((v, i) => v !== bv[i])) return false
  const ao = a.options ?? []
  const bo = b.options ?? []
  if (ao.length !== bo.length) return false
  for (let i = 0; i < ao.length; i++) {
    const x = ao[i]
    const y = bo[i]
    if (x.index !== y.index || x.text !== y.text || x.votes !== y.votes) return false
  }
  return true
}

export function mergeChatMessages(
  prev: ChatMessage[],
  incoming: ChatMessage[],
  opts?: ChatMergeOptions,
): ChatMergeResult {
  const ids = selfIdSet(opts)
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
    const match = findOptimisticMatch(working, m, opts)
    const idx = match ? indexById.get(match.id) : undefined
    if (match && idx !== undefined) {
      // Audit chat B4/I24: bubble server MEWARISI kunci render milik bubble
      // optimistis — kunci baris FlatList tidak berubah, jadi baris tidak
      // di-unmount/mount ulang (itu yang tampak sebagai kedip/animasi masuk
      // dua kali).
      working[idx] = withClientKey(m, match)
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
  // Tim8 P1: `incoming.find(...)` per pesan = O(N·M); index sekali → O(N+M).
  const incomingById = new Map(incoming.map((m) => [m.id, m]))
  const patched = working.map((m) => {
    const next = incomingById.get(m.id)
    if (!next) return m
    // Audit Pesan 2026-10-10 (realtime #3): `chat.message_updated` disiarkan
    // ke seluruh ruang dari SUDUT PANDANG PENGEDIT (`fromUser: true` untuk
    // semua penerima), dan gema netral `chat.new_message` membawa
    // `fromUser: false` untuk pesan saya sendiri. Arah bubble tidak boleh
    // berbalik karena sudut pandang payload: `fromUser` hanya boleh NAIK ke
    // true bila pengirimnya memang saya (id cocok), tidak pernah turun.
    // Bila `selfIds` dikenal, HANYA id pengirim yang dipercaya (bukan
    // `fromUser` payload — itulah sumber pembalikan arah). Tanpa selfIds,
    // perilaku lama (BFE-007: view yang tiba belakangan menaikkan fromUser).
    const nextFromUser =
      m.fromUser || (ids.size === 0 ? next.fromUser : senderIdsOf(next).some((id) => ids.has(id)))
    // Reaksi dari payload sudut pandang lain → `reactedByMe` dihitung ulang
    // dari `users[]` (otoritatif) terhadap identitas saya.
    const nextReactions = next.reactions ? reconcileReactionViewer(next.reactions, [...ids]) : next.reactions
    const same =
      next.isPinned === m.isPinned &&
      next.isEdited === m.isEdited &&
      next.isDeleted === m.isDeleted &&
      next.text === m.text &&
      nextFromUser === m.fromUser &&
      samePoll(next.poll, m.poll) &&
      sameReactions(nextReactions, m.reactions)
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
      // Realtime #23: tombstone dari poll juga melepas lampiran (seperti
      // applyDeletedTombstone) supaya media pesan terhapus tidak tertinggal.
      attachments: next.isDeleted ? [] : (next.attachments ?? m.attachments),
      editedAt: next.editedAt ?? m.editedAt,
      reactions: nextReactions,
      fromUser: nextFromUser,
      poll: next.poll,
      viewOnceViewedAt: next.viewOnceViewedAt ?? m.viewOnceViewedAt,
    }
  })
  if (!changed) return { next: prev, added: 0, hasFreshFromOther: false, changed: false }
  return {
    next: sortByTimeAsc([...patched, ...fresh]),
    added: fresh.length,
    // Gema netral milik SAYA bukan "pesan baru dari lawan bicara" — tanpa
    // koreksi ini, mark-as-read bisa terpicu oleh pesan sendiri (centang biru
    // palsu ke lawan bicara).
    hasFreshFromOther: fresh.some((m) => !isOwnBySender(m, ids)),
    changed: true,
  }
}

/**
 * Audit chat B4: kunci render stabil. Pesan optimistis membawa `clientKey`
 * (= id temp); pesan server yang MENGGANTIKANNYA mewarisi kunci itu supaya
 * baris thread tidak di-remount saat id berganti dari `temp-…` ke id server.
 */
export function clientKeyOf(m: Pick<ChatMessage, "id" | "clientKey">): string {
  return m.clientKey ?? m.id
}

function withClientKey(serverMessage: ChatMessage, optimisticMessage: ChatMessage): ChatMessage {
  const key = clientKeyOf(optimisticMessage)
  // Pesan yang kunci-nya memang sama dengan id sendiri tidak perlu diberi
  // field (menjaga objek tetap ringkas & perbandingan field-by-field).
  if (key === serverMessage.id) return serverMessage
  return serverMessage.clientKey === key ? serverMessage : { ...serverMessage, clientKey: key }
}

/**
 * Audit chat B4 — ganti pesan optimistis dengan pesan resmi dari server
 * (respons POST / gema antrean kirim) dan PASTIKAN tidak ada dobel.
 *
 * Bug asli (`prev.map(m => m.id === tempId || m.id === msg.id ? msg : m)`):
 * bila gema realtime tiba lebih dulu dan lolos dari pencocokan (teks dinormalisasi
 * server, tipe `FILE`→`VIDEO`, nama berkas disanitasi, …), list memuat DUA entri —
 * temp dan gema — lalu `map` mengganti KEDUANYA dengan pesan yang sama:
 * dua bubble ber-id sama yang menetap. Di sini hanya satu entri yang bertahan,
 * di posisi entri pertama, dan urutan waktu dipulihkan (waktu server otoritatif).
 *
 * Mengembalikan `prev` apa adanya bila temp maupun gema tidak ada (mis. list
 * di-reset oleh muat-ulang) — pemanggil memutuskan apakah perlu menambahkan.
 */
export function reconcileSentMessage(
  prev: ChatMessage[],
  tempId: string,
  sent: ChatMessage,
): ChatMessage[] {
  const optimistic = prev.find((m) => m.id === tempId)
  const hasEcho = prev.some((m) => m.id === sent.id)
  if (!optimistic && !hasEcho) return prev
  const merged = optimistic ? withClientKey(sent, optimistic) : sent
  const out: ChatMessage[] = []
  let placed = false
  for (const m of prev) {
    if (m.id === tempId || m.id === sent.id) {
      if (!placed) {
        out.push(merged)
        placed = true
      }
      continue
    }
    out.push(m)
  }
  return sortByTimeAsc(out)
}

function attachmentList(m: Pick<ChatMessage, "attachments">) {
  return m.attachments ?? []
}

/**
 * Dua lampiran dianggap sama bila nama berkas sama DAN ukurannya tidak
 * bertentangan (0/absen = tidak dilaporkan → kompatibel). Server kadang
 * mengisi ulang `fileSize`; nama yang berbeda tetap berarti berkas berbeda.
 */
function sameAttachment(
  a: NonNullable<ChatMessage["attachments"]>[number],
  b: NonNullable<ChatMessage["attachments"]>[number],
): boolean {
  if ((a.fileName ?? "") !== (b.fileName ?? "")) return false
  const sa = a.fileSize ?? 0
  const sb = b.fileSize ?? 0
  return sa === 0 || sb === 0 || sa === sb
}

function sameAttachments(a: Pick<ChatMessage, "attachments">, b: Pick<ChatMessage, "attachments">): boolean {
  const la = attachmentList(a)
  const lb = attachmentList(b)
  if (la.length !== lb.length) return false
  const used = new Set<number>()
  for (const x of la) {
    const at = lb.findIndex((y, i) => !used.has(i) && sameAttachment(x, y))
    if (at < 0) return false
    used.add(at)
  }
  return true
}

/**
 * Keluarga tipe: server boleh mengklasifikasi ulang media (mis. klien kirim
 * `FILE` untuk video, server menyimpan `VIDEO`). Teks + lampiran + balasan
 * tetap harus sama, jadi keluarga yang sama sudah cukup tegas.
 */
function typeFamily(type: string | undefined): string {
  switch (type) {
    case "IMAGE":
    case "VIDEO":
    case "FILE":
    case "VOICE":
      return "MEDIA"
    default:
      return type ?? ""
  }
}

/** CRLF → LF + trim: server/OS berbeda soal akhir baris & spasi pinggir. */
function normalizeBody(text: string | undefined | null): string {
  return (text ?? "").replace(/\r\n?/g, "\n").trim()
}

/**
 * Penanda klien yang BOLEH dipantulkan backend pada gema pesan (tidak ada di
 * kontrak hari ini — lihat docs/rekomendasi-backend-chat.md). Bila ada dan
 * sama dengan idempotency key bubble optimistis, itu pencocokan paling pasti:
 * tanpa tebak-tebakan teks/waktu.
 */
function echoedClientKey(m: ChatMessage): string | null {
  const raw = m as unknown as Record<string, unknown>
  for (const field of ["idempotencyKey", "clientMessageId", "clientId"]) {
    const value = raw[field]
    if (typeof value === "string" && value) return value
  }
  return null
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
 * - keluarga tipe, teks (CRLF dinormalisasi + trim), `replyToId`, dan lampiran
 *   (nama sama, ukuran tidak bertentangan) sama;
 * - selisih `createdAt` ≤ `OPTIMISTIC_MATCH_WINDOW_MS`.
 *
 * Pintasan: bila gema memantulkan idempotency key yang sama dengan kandidat,
 * kriteria di atas dilewati — itu identitas, bukan perkiraan.
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
  opts?: ChatMergeOptions,
): ChatMessage | null {
  // `sendStatus` hanya ada di pesan lokal — jangan pernah "mencocokkan"
  // pesan optimistis dengan pesan optimistis lain.
  if (incoming.sendStatus) return null
  // Gema milik sendiri: `fromUser` ATAU (karena payload gema bisa netral)
  // id pengirimnya cocok dengan identitas saya.
  if (!isOwnBySender(incoming, selfIdSet(opts))) return null
  const echoed = echoedClientKey(incoming)
  if (echoed) {
    const byKey = messages.find(
      (m) => m.sendStatus === "sending" && m.fromUser && m.sendIdempotencyKey === echoed,
    )
    if (byKey) return byKey
  }
  const incomingAt = Date.parse(incoming.createdAt)
  if (Number.isNaN(incomingAt)) return null
  const text = normalizeBody(incoming.text)
  const replyToId = incoming.replyToId ?? null
  const family = typeFamily(incoming.messageType)
  let best: ChatMessage | null = null
  let bestAt = Number.POSITIVE_INFINITY
  for (const m of messages) {
    if (m.sendStatus !== "sending" || !m.fromUser) continue
    if (typeFamily(m.messageType) !== family) continue
    if (normalizeBody(m.text) !== text) continue
    if ((m.replyToId ?? null) !== replyToId) continue
    if (!sameAttachments(m, incoming)) continue
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
