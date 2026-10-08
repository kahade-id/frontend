/**
 * Kahade — daftar "siapa memberi reaksi apa" (audit chat E13, MURNI).
 *
 * Sumber: `ChatMessage.reactions[]` (`summarizeReactions` backend) — tiap emoji
 * membawa `count`, `reactedByMe`, dan (bila server menyertakannya)
 * `users: [{ userId, fullName }]`. Server TIDAK dijamin mengirim `users`
 * (kontrak tak menyebutnya wajib), jadi daftar dibangun dengan urutan
 * kejujuran:
 *
 *   1. nama dari `users` bila ada;
 *   2. "Anda" bila `reactedByMe` (walau `users` tak memuat saya);
 *   3. DM 1:1: sisa reaksi pasti milik lawan bicara → namanya diketahui;
 *   4. selain itu: baris "Pengguna lain" sebanyak sisanya — jumlahnya tetap
 *      jujur, namanya tidak dikarang.
 */
import type { ChatReaction } from "@/lib/api/chat"

export type ReactorRow = {
  key: string
  emoji: string
  name: string
  /** Reaksi saya — bisa ditarik dari daftar. */
  mine: boolean
  /** `true` bila nama tidak diketahui (placeholder). */
  anonymous: boolean
}

export type ReactorLabels = { you: string; someone: string }

export type BuildReactorRowsOptions = {
  /** Id milik pengguna login (publik `USR-…` dan/atau internal). */
  selfIds: readonly string[]
  /** Nama lawan bicara — dipakai untuk DM 1:1 saat server tak mengirim `users`. */
  counterpartName?: string | null
  /** Ruang 1:1 (hanya dua pihak). */
  isDirect: boolean
  labels: ReactorLabels
}

/** Batas baris placeholder per emoji — daftar tetap ringkas di ruang ramai. */
const MAX_ANONYMOUS_ROWS = 20

export function buildReactorRows(
  reactions: readonly ChatReaction[],
  opts: BuildReactorRowsOptions,
): ReactorRow[] {
  const selfIds = new Set(opts.selfIds.filter(Boolean))
  const rows: ReactorRow[] = []
  for (const r of reactions) {
    if (r.count <= 0) continue
    const emojiRows: ReactorRow[] = []
    for (const [i, user] of (r.users ?? []).entries()) {
      const mine = selfIds.has(user.userId)
      emojiRows.push({
        key: `${r.emoji}:${user.userId || i}`,
        emoji: r.emoji,
        name: mine ? opts.labels.you : (user.fullName?.trim() || opts.labels.someone),
        mine,
        anonymous: !mine && !user.fullName?.trim(),
      })
    }
    if (r.reactedByMe && !emojiRows.some((row) => row.mine)) {
      emojiRows.unshift({
        key: `${r.emoji}:me`,
        emoji: r.emoji,
        name: opts.labels.you,
        mine: true,
        anonymous: false,
      })
    }
    // Sisa yang namanya tak diketahui, tidak melebihi hitungan server.
    const unknown = Math.min(Math.max(0, r.count - emojiRows.length), MAX_ANONYMOUS_ROWS)
    const counterpart = opts.counterpartName?.trim()
    for (let i = 0; i < unknown; i++) {
      const isTheCounterpart = opts.isDirect && unknown === 1 && !!counterpart
      emojiRows.push({
        key: `${r.emoji}:anon-${i}`,
        emoji: r.emoji,
        name: isTheCounterpart ? (counterpart as string) : opts.labels.someone,
        mine: false,
        anonymous: !isTheCounterpart,
      })
    }
    rows.push(...emojiRows)
  }
  return rows
}

/** Total reaksi pada satu pesan (untuk tab "Semua"). */
export function totalReactions(reactions: readonly ChatReaction[]): number {
  return reactions.reduce((sum, r) => sum + Math.max(0, r.count), 0)
}
