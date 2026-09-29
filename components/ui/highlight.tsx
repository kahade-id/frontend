/**
 * Kahade — <Highlight> penekanan substring (§3.1 emphasis, hasil pencarian).
 *
 * Merender `text` dengan bagian yang cocok `query` ditebalkan. Dipakai di
 * hasil SearchField (nama kontak, judul transaksi, nomor rekening).
 *
 * Kenapa penekanan lewat WEIGHT + tone, bukan background kuning
 * (non-obvious): sistem monokrom & flat — warna semantic eksklusif untuk
 * status transaksi (§2.3). Kontras "600 text-primary" di atas "400
 * text-secondary" sudah jelas terbaca dan konsisten dengan <Emphasis>.
 *
 * Pencocokan case-insensitive, semua kemunculan, karakter regex di-escape.
 * Bagian match dirender sebagai Text nested `variant="inherit"` agar
 * mewarisi size/family parent — hanya weight & tone yang berubah.
 */
import { Fragment, useMemo } from "react"

import { Text, type TextProps, type TextTone } from "@/components/ui/text"

export type HighlightProps = Omit<TextProps, "children"> & {
  text: string
  /** Substring yang ditonjolkan; kosong = render polos */
  query?: string
  /** Tone bagian yang cocok. Default "primary". */
  matchTone?: TextTone
  /** Weight bagian yang cocok. Default 600. */
  matchWeight?: 500 | 600 | 700
}

type Segment = { value: string; match: boolean }

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Tim8 P2: cache RegExp per query string — <Highlight> dipakai per baris
 * hasil pencarian; tanpa cache tiap baris mengkompilasi ulang regex yang
 * sama di tiap keystroke. Aman dibagi: `String.split` mengkloning regex
 * (tidak memakai/mengubah `lastIndex` instance cache).
 */
const HIGHLIGHT_REGEX_CACHE = new Map<string, RegExp>()
const HIGHLIGHT_REGEX_CACHE_MAX = 32
function regexForQuery(query: string): RegExp {
  const q = query.trim()
  let re = HIGHLIGHT_REGEX_CACHE.get(q)
  if (!re) {
    re = new RegExp(`(${escapeRegExp(q)})`, "ig")
    if (HIGHLIGHT_REGEX_CACHE.size >= HIGHLIGHT_REGEX_CACHE_MAX) {
      const oldest = HIGHLIGHT_REGEX_CACHE.keys().next().value
      if (oldest !== undefined) HIGHLIGHT_REGEX_CACHE.delete(oldest)
    }
    HIGHLIGHT_REGEX_CACHE.set(q, re)
  }
  return re
}

function splitByQuery(text: string, query: string): Segment[] {
  const q = query.trim()
  if (!q) return [{ value: text, match: false }]
  const re = regexForQuery(query)
  return text
    .split(re)
    .filter((part) => part.length > 0)
    .map((part) => ({ value: part, match: part.toLowerCase() === q.toLowerCase() }))
}

export function Highlight({
  text,
  query = "",
  matchTone = "primary",
  matchWeight = 600,
  tone = "secondary",
  ...rest
}: HighlightProps) {
  const segments = useMemo(() => splitByQuery(text, query), [text, query])

  return (
    <Text tone={tone} {...rest}>
      {segments.map((seg, i) =>
        seg.match ? (
          <Text key={i} variant="inherit" tone={matchTone} weight={matchWeight}>
            {seg.value}
          </Text>
        ) : (
          <Fragment key={i}>{seg.value}</Fragment>
        ),
      )}
    </Text>
  )
}
