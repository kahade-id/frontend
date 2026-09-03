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

function splitByQuery(text: string, query: string): Segment[] {
  const q = query.trim()
  if (!q) return [{ value: text, match: false }]
  const re = new RegExp(`(${escapeRegExp(q)})`, "ig")
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
