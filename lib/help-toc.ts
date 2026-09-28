/**
 * Kahade — daftar isi artikel bantuan (batch 139, item F03).
 *
 * Fungsi murni: memecah konten markdown ringan (format yang sama seperti
 * dirender `HelpArticleContent`) menjadi entri heading. Dipakai layar detail
 * artikel untuk membuat daftar isi yang bisa diketuk → lompat ke heading
 * (anchor) tanpa menutup isi.
 *
 * Heading di luar level 1–3 diabaikan — sama seperti renderer.
 */
export type ArticleTocEntry = {
  /** Urutan heading di antara semua heading (dipakai sebagai anchor id). */
  index: number
  /** 1–3 */
  level: number
  /** Teks heading (sudah di-trim, tanpa inline markup berat). */
  text: string
}

const HEADING_RE = /^(#{1,3})\s+(.+)$/

/** Buang inline markup ringan supaya label TOC terbaca bersih. */
export function stripInlineMarkup(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim()
}

export function parseArticleHeadings(content: string): ArticleTocEntry[] {
  const entries: ArticleTocEntry[] = []
  let index = 0
  for (const rawLine of (content ?? "").split(/\r?\n/)) {
    const line = rawLine.trim()
    const m = HEADING_RE.exec(line)
    if (!m) continue
    const text = stripInlineMarkup(m[2])
    if (!text) continue
    entries.push({ index, level: m[1].length, text })
    index += 1
  }
  return entries
}
