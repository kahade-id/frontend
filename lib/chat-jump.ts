/**
 * Kahade — rencana "lompat ke pesan" (audit chat D10/D11, MURNI).
 *
 * Satu pintu untuk semua pemicu lompat: hasil pencarian, kutipan balasan,
 * baris pin, pesan berbintang, pemisah "Belum dibaca". Fungsi ini hanya
 * MEMUTUSKAN — tidak menggulir, tidak memuat, tidak menampilkan toast — supaya
 * setiap cabang yang dulu jatuh ke satu toast generik ("Pesan belum termuat")
 * punya perilaku yang jelas dan teruji:
 *
 *   scroll     pesannya ada di thread → gulir tepat ke sana + sorot,
 *   load-older belum termuat tetapi riwayat masih ada → muat halaman lama
 *              satu per satu sampai ketemu (dibatasi anggaran halaman),
 *   blocked    tidak bisa dijangkau, dengan ALASAN:
 *                deleted       — pesan asli sudah dihapus,
 *                hidden        — disembunyikan di perangkat ini ("hapus untuk saya"),
 *                not-found     — riwayat habis tanpa menemukannya (kedaluwarsa/dihapus server),
 *                out-of-range  — anggaran halaman habis; terlalu lama untuk dimuat otomatis.
 */

/** Bentuk minimal baris thread — cukup untuk logika murni. */
export type JumpRow =
  | { kind: "day" | "unread"; key: string }
  | { kind: "msg"; key: string; message: { id: string; isDeleted?: boolean } }

export type JumpBlockedReason = "deleted" | "hidden" | "not-found" | "out-of-range"

export type JumpPlan =
  | { kind: "scroll"; index: number }
  | { kind: "load-older" }
  | { kind: "blocked"; reason: JumpBlockedReason }

/** Halaman riwayat lama yang boleh dimuat otomatis untuk satu lompatan. */
export const JUMP_MAX_PAGES = 15

/** Indeks BARIS (bukan indeks pesan) milik `messageId`; -1 bila tidak ada. */
export function findThreadRowIndex(rows: readonly JumpRow[], messageId: string): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.kind === "msg" && row.message.id === messageId) return i
  }
  return -1
}

export type PlanJumpInput = {
  messageId: string
  rows: readonly JumpRow[]
  /** Id yang disembunyikan lokal (thread tidak memuatnya). */
  hiddenIds?: ReadonlySet<string>
  /** Pemanggil sudah tahu pesan asli terhapus (mis. `replyTo.isDeleted` di kutipan). */
  knownDeleted?: boolean
  /** Masih ada halaman riwayat yang lebih lama untuk dimuat. */
  canLoadOlder: boolean
  /** Halaman lama yang sudah dimuat untuk lompatan ini. */
  pagesLoaded: number
  maxPages?: number
}

export function planJump(input: PlanJumpInput): JumpPlan {
  const { messageId, rows, hiddenIds, knownDeleted, canLoadOlder, pagesLoaded } = input
  const maxPages = input.maxPages ?? JUMP_MAX_PAGES
  if (knownDeleted) return { kind: "blocked", reason: "deleted" }
  const index = findThreadRowIndex(rows, messageId)
  if (index >= 0) {
    const row = rows[index]
    // Tombstone ("Pesan ini telah dihapus") bukan tujuan yang berarti.
    if (row.kind === "msg" && row.message.isDeleted) return { kind: "blocked", reason: "deleted" }
    return { kind: "scroll", index }
  }
  if (hiddenIds?.has(messageId)) return { kind: "blocked", reason: "hidden" }
  if (!canLoadOlder) return { kind: "blocked", reason: "not-found" }
  if (pagesLoaded >= maxPages) return { kind: "blocked", reason: "out-of-range" }
  return { kind: "load-older" }
}
