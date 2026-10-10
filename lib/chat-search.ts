/**
 * Kahade — pencarian keyword di dalam satu room chat (client-side).
 *
 * Berbeda dengan <ChatSearchSheet> (GET /v1/chat/rooms/{id}/search ke SELURUH
 * riwayat server): modul ini hanya mencari di pesan yang SUDAH dimuat di
 * klien — tanpa endpoint tambahan, tanpa beban server. Dipakai bar pencarian
 * inline di header room: hasil di-highlight langsung di thread dan dilompati
 * via next/prev (lihat `components/ui/chat-inline-search.tsx`).
 */

/** Bentuk minimal pesan yang bisa dicari — cukup untuk logika murni. */
import { translate } from "@/lib/i18n/translate"

export type SearchableMessage = {
  id: string
  text?: string | null
  /** Pesan terhapus tidak ikut hasil (teksnya placeholder). */
  isDeleted?: boolean
}

/**
 * Kembalikan id pesan yang teksnya mengandung `query` (case-insensitive),
 * dalam urutan thread. Query kosong / < 2 karakter → [] (terlalu berisik).
 */
export function findMessageMatches(
  messages: readonly SearchableMessage[],
  query: string,
): string[] {
  const q = query.trim().toLocaleLowerCase()
  if (q.length < 2) return []
  const out: string[] = []
  for (const m of messages) {
    if (m.isDeleted) continue
    const text = m.text
    if (!text) continue
    if (text.toLocaleLowerCase().includes(q)) out.push(m.id)
  }
  return out
}

export type HighlightSpan = { text: string; hit: boolean }

/**
 * Pecah `text` menjadi segmen biasa vs segmen yang cocok `query`
 * (case-insensitive) untuk di-render sebagai highlight di bubble.
 * Query kosong → satu segmen biasa.
 */
export function splitHighlightSpans(text: string, query: string): HighlightSpan[] {
  const q = query.trim()
  if (!q || !text) return [{ text, hit: false }]
  // Escape karakter regex dari ketikan user.
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(escaped, "gi")
  const spans: HighlightSpan[] = []
  let last = 0
  let m: RegExpExecArray | null
  // Guard loop tak berujung untuk pola zero-width (tidak mungkin dari
  // escape di atas, tapi murah untuk dipertahankan).
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index), hit: false })
    spans.push({ text: m[0], hit: true })
    last = m.index + m[0].length
    if (m[0].length === 0) re.lastIndex++
  }
  if (last < text.length) spans.push({ text: text.slice(last), hit: false })
  return spans.length ? spans : [{ text, hit: false }]
}

/**
 * Label chip "3 dari 12" — 1-based untuk manusia. Di luar jangkauan → "".
 */
export function matchCounterLabel(index: number, total: number): string {
  if (total <= 0 || index < 0 || index >= total) return ""
  // Audit Pesan 2026-10-10 (room #23): lewat kamus — "3 dari 12" dulu
  // literal Indonesia di UI Inggris.
  return translate("{x} dari {y}", { x: index + 1, y: total })
}

/** Karakter konteks di tiap sisi keyword dalam cuplikan hasil pencarian. */
export const SEARCH_SNIPPET_CONTEXT_CHARS = 40
/** Maksimal jendela konteks per cuplikan — baris hasil tetap ringkas. */
const SEARCH_SNIPPET_MAX_WINDOWS = 2

/**
 * Cuplikan hasil pencarian (B12): potongan teks di sekitar kemunculan
 * keyword — `contextChars` karakter sebelum & sesudah tiap kemunculan —
 * dengan segmen keyword tetap ditandai `hit` untuk di-highlight.
 * Jendela yang bertumpukan digabung; antar jendela disisipi " … ".
 * Query kosong / tidak cocok → [].
 */
export function buildSearchSnippet(
  text: string,
  query: string,
  contextChars: number = SEARCH_SNIPPET_CONTEXT_CHARS,
): HighlightSpan[] {
  const q = query.trim()
  if (!q || !text) return []
  const lower = text.toLocaleLowerCase()
  const lq = q.toLocaleLowerCase()
  const positions: number[] = []
  let from = 0
  for (;;) {
    const idx = lower.indexOf(lq, from)
    if (idx < 0) break
    positions.push(idx)
    from = idx + Math.max(1, lq.length)
  }
  if (positions.length === 0) return []

  // Jendela [start, end) per kemunculan, lalu gabung yang bertumpukan.
  const windows: Array<[number, number]> = positions.map((p) => [
    Math.max(0, p - contextChars),
    Math.min(text.length, p + lq.length + contextChars),
  ])
  windows.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const w of windows) {
    const lastM = merged[merged.length - 1]
    if (lastM && w[0] <= lastM[1]) lastM[1] = Math.max(lastM[1], w[1])
    else merged.push([w[0], w[1]])
  }

  const out: HighlightSpan[] = []
  merged.slice(0, SEARCH_SNIPPET_MAX_WINDOWS).forEach(([start, end], wi) => {
    if (wi > 0) out.push({ text: " … ", hit: false })
    const slice = text.slice(start, end)
    for (const span of splitHighlightSpans(slice, q)) out.push(span)
  })
  return out
}
