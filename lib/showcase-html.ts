/**
 * Kahade — deskripsi etalase HTML (benefit 7 Kahade+, "custom etalase").
 *
 * Anggota Kahade+ aktif boleh menulis deskripsi karya sebagai HTML ringan
 * (bold/italic/list/link), bukan plaintext. Modul ini berisi:
 *
 *   1. `sanitizeShowcaseHtml()` — sanitasi allowlist SEBELUM render maupun
 *      SEBELUM dikirim ke backend. JANGAN pernah render HTML mentah.
 *   2. `parseShowcaseHtmlBlocks()` — parser kecil yang mengubah subset yang
 *      diizinkan menjadi blok + segmen untuk di-render sebagai <Text> native
 *      (repo ini tidak memakai react-native-webview / render-html).
 *
 * Tag yang diizinkan: p, br, b, strong, i, em, u, s, ul, ol, li, a, blockquote.
 * Atribut: hanya `href` pada <a>, dan hanya http(s) — `javascript:` dan
 * skema lain dibuang. Event handler (on*), <style>, <script>, <iframe>,
 * <object>, <embed>, komentar HTML, dan semua tag lain dihapus (isi teksnya
 * dipertahankan).
 *
 * Catatan kontrak: backend kontrak etalase menerima `description` string —
 * HTML yang sudah disanitasi dikirim sebagai string biasa. Batas panjang
 * tetap mengikuti API_CONSTRAINTS.CreateShowcaseItemDto.description.
 */
export type ShowcaseHtmlSegment = {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  href?: string
}

export type ShowcaseHtmlBlock = {
  segments: ShowcaseHtmlSegment[]
  /** "ul" → bullet, "ol" → bernomor (dengan `index`). */
  bullet?: "ul" | "ol"
  index?: number
  quote?: boolean
}

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
])

/** Panjang maksimum HTML mentah yang diproses — pelindung DoS regex. */
const MAX_HTML_LENGTH = 50_000

function stripDangerousBlocks(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, "")
    .replace(/<object\b[^>]*>[\s\S]*?<\/object\s*>/gi, "")
    .replace(/<(embed|link|meta|base|form|input|button|video|audio|source|track)\b[^>]*\/?>/gi, "")
}

/** Ambil href yang aman (http/https saja) dari atribut tag <a>. */
function safeHref(attrs: string): string | undefined {
  const match = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
  const raw = (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim()
  if (/^https?:\/\//i.test(raw)) return raw
  return undefined
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number.parseInt(code, 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : ""
    })
}

/**
 * Sanitasi allowlist. Idempoten: menjalankan dua kali tidak merusak hasil.
 * Selalu panggil sebelum render DAN sebelum kirim ke server.
 */
export function sanitizeShowcaseHtml(html: string): string {
  if (typeof html !== "string") return ""
  let input = html.length > MAX_HTML_LENGTH ? html.slice(0, MAX_HTML_LENGTH) : html
  input = stripDangerousBlocks(input)
  // Hapus event handler & atribut style di semua tag yang tersisa.
  input = input.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
  input = input.replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
  const out: string[] = []
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g
  let last = 0
  let match: RegExpExecArray | null
  for (;;) {
    match = tagRe.exec(input)
    if (!match) break
    out.push(input.slice(last, match.index))
    last = match.index + match[0].length
    const name = match[1].toLowerCase()
    const isClose = match[0][1] === "/"
    if (!ALLOWED_TAGS.has(name)) continue // tag tak dikenal: buang tag, simpan isi
    if (name === "br") {
      out.push("<br>")
      continue
    }
    if (name === "a" && !isClose) {
      const href = safeHref(match[2])
      out.push(href ? `<a href="${href}">` : "<a>")
      continue
    }
    out.push(isClose ? `</${name}>` : `<${name}>`)
  }
  out.push(input.slice(last))
  return out.join("")
}

type InlineState = { bold: boolean; italic: boolean; underline: boolean; strike: boolean; href?: string }

/**
 * Parser satu-pass: HTML tersanitasi → blok (paragraf / item list / kutipan)
 * berisi segmen inline. Toleran terhadap nesting yang rusak — state inline
 * hanya on/off per tag, jadi `</b>` yang tak berpasangan tidak merusak sisa
 * dokumen.
 */
export function parseShowcaseHtmlBlocks(html: string): ShowcaseHtmlBlock[] {
  const clean = sanitizeShowcaseHtml(html)
  const blocks: ShowcaseHtmlBlock[] = []
  let current: ShowcaseHtmlBlock = { segments: [] }
  let listKind: "ul" | "ol" | null = null
  let listIndex = 0
  const inline: InlineState = { bold: false, italic: false, underline: false, strike: false }

  const pushText = (raw: string) => {
    const text = decodeEntities(raw)
    if (!text) return
    const lastSeg = current.segments[current.segments.length - 1]
    if (
      lastSeg &&
      lastSeg.bold === inline.bold &&
      lastSeg.italic === inline.italic &&
      lastSeg.underline === inline.underline &&
      lastSeg.strike === inline.strike &&
      lastSeg.href === inline.href
    ) {
      lastSeg.text += text
    } else {
      current.segments.push({
        text,
        ...(inline.bold ? { bold: true } : {}),
        ...(inline.italic ? { italic: true } : {}),
        ...(inline.underline ? { underline: true } : {}),
        ...(inline.strike ? { strike: true } : {}),
        ...(inline.href ? { href: inline.href } : {}),
      })
    }
  }

  const flushBlock = () => {
    const hasText = current.segments.some((s) => s.text.trim().length > 0)
    if (hasText || current.bullet) blocks.push(current)
    current = { segments: [] }
  }

  const tagRe = /<(\/?)([a-z]+)([^>]*)>|([^<]+)/gi
  let match: RegExpExecArray | null
  for (;;) {
    match = tagRe.exec(clean)
    if (!match) break
    if (match[4] !== undefined) {
      pushText(match[4])
      continue
    }
    const isClose = match[1] === "/"
    const name = match[2].toLowerCase()
    if (!ALLOWED_TAGS.has(name)) continue
    switch (name) {
      case "br":
        pushText("\n")
        break
      case "p":
        if (!isClose) flushBlock()
        else flushBlock()
        break
      case "ul":
      case "ol":
        if (!isClose) {
          listKind = name
          listIndex = 0
        } else {
          listKind = null
        }
        flushBlock()
        break
      case "li":
        if (!isClose) {
          flushBlock()
          listIndex += 1
          current.bullet = listKind ?? "ul"
          if (listKind === "ol") current.index = listIndex
        } else {
          flushBlock()
        }
        break
      case "blockquote":
        if (!isClose) {
          flushBlock()
          current.quote = true
        } else {
          flushBlock()
        }
        break
      case "b":
      case "strong":
        inline.bold = !isClose
        break
      case "i":
      case "em":
        inline.italic = !isClose
        break
      case "u":
        inline.underline = !isClose
        break
      case "s":
        inline.strike = !isClose
        break
      case "a":
        inline.href = isClose ? undefined : safeHref(match[3])
        if (!isClose) inline.underline = true
        break
      default:
        break
    }
  }
  flushBlock()
  // Buang blok yang hanya berisi whitespace di awal/akhir.
  while (blocks.length > 0 && blocks[0].segments.every((s) => !s.text.trim())) blocks.shift()
  while (blocks.length > 0 && blocks[blocks.length - 1].segments.every((s) => !s.text.trim())) blocks.pop()
  return blocks
}

/** true bila HTML (setelah sanitasi) tidak punya konten teks sama sekali. */
export function isShowcaseHtmlEmpty(html: string): boolean {
  return parseShowcaseHtmlBlocks(html).every((b) => b.segments.every((s) => !s.text.trim()))
}

/**
 * true bila HTML mengandung pemformatan/list/kutipan/tautan nyata — dipakai
 * layar detail untuk memutuskan me-render <ShowcaseHtmlView> alih-alih
 * <Text> polos. Deskripsi plaintext (tanpa tag format) tetap di-render
 * sebagai teks biasa supaya tampilannya tidak berubah.
 */
export function showcaseHtmlHasFormatting(html: string): boolean {
  if (typeof html !== "string" || !/<[a-z][^>]*>/i.test(html)) return false
  return parseShowcaseHtmlBlocks(html).some(
    (block) =>
      block.bullet !== undefined ||
      block.quote === true ||
      block.segments.some(
        (s) => s.bold === true || s.italic === true || s.strike === true || s.href !== undefined,
      ),
  )
}
