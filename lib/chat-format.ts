/**
 * Kahade — pemformatan teks chat (batch 43 FE-CHAT, 2026-09-28).
 *
 * Sintaks ringan (WhatsApp-style + spoiler/underline):
 *   **tebal** / *tebal*   _miring_   `mono`   __garis bawah__   ~coret~
 *   ||spoiler||   [label](https://tautan)   + tautan telanjang https://…
 *
 * Bug #6 (audit Pesan 2026-10-10): toolbar format sudah dihapus dari composer
 * (keputusan produk 2026-10-02), jadi pengguna mengetik marker secara manual —
 * dan kebiasaan yang mereka bawa adalah WhatsApp: `*tebal*` satu bintang dan
 * `~coret~`. Keduanya dulu tidak dikenali (hanya `**`), sehingga "bold tidak
 * terlihat". Aturan boundary-nya sama dengan `_miring_` supaya `2*3*4` atau
 * `a~b` tidak ikut terformat.
 *
 * Murni (tanpa RN) — bisa di-unit-test di Node. Renderer aman ada di
 * `components/ui/chat-formatted-text.tsx`; toolbar di
 * `components/ui/chat-format-bar.tsx`.
 */

export type ChatTextFormat =
  | "bold"
  | "italic"
  | "mono"
  | "underline"
  | "strike"
  | "spoiler"
  | "link"

export type ChatSegment = {
  text: string
  bold?: boolean
  italic?: boolean
  mono?: boolean
  underline?: boolean
  /** Coret (~teks~) — gaya WhatsApp. */
  strike?: boolean
  spoiler?: boolean
  /** URL tujuan — ada bila segmen adalah tautan. */
  linkUrl?: string
}

const MARKERS: Record<Exclude<ChatTextFormat, "link">, { open: string; close: string }> = {
  bold: { open: "**", close: "**" },
  italic: { open: "_", close: "_" },
  mono: { open: "`", close: "`" },
  underline: { open: "__", close: "__" },
  strike: { open: "~", close: "~" },
  spoiler: { open: "||", close: "||" },
}

/** True bila teks mengandung sintaks format apa pun (untuk fast-path render). */
export function hasChatMarkup(text: string): boolean {
  if (!text) return false
  return (
    text.includes("**") ||
    text.includes("__") ||
    text.includes("`") ||
    text.includes("||") ||
    /(^|[\s(])_[^_\s]/.test(text) ||
    // `*tebal*` satu bintang & `~coret~` (gaya WhatsApp) — boundary sama
    // dengan miring supaya `2*3` / `a~b` tidak memicu parse.
    /(^|[\s(])\*[^*\s]/.test(text) ||
    /(^|[\s(])~[^~\s]/.test(text) ||
    /\[[^\]]+\]\(https?:\/\/[^\s)]+\)/.test(text) ||
    /https?:\/\/[^\s<]+/.test(text)
  )
}

const URL_RE = /^https?:\/\/[^\s<]+/

/** Pangkas tanda baca penutup yang nyasar dari tautan telanjang. */
function trimTrailingPunct(url: string): string {
  return url.replace(/[.,;:!?)\]}'"]+$/, "")
}

const OPEN_BOUNDARY = new Set([" ", "\t", "\n", "(", "[", "{", "<", ">", '"', "'", "“", "‘", "—", "-", "–"])
const CLOSE_BOUNDARY = new Set([
  " ",
  "\t",
  "\n",
  ")",
  "]",
  "}",
  ">",
  '"',
  "'",
  "”",
  "’",
  ".",
  ",",
  ";",
  ":",
  "!",
  "?",
  "—",
  "-",
  "–",
])

function isOpenBoundary(ch: string | undefined): boolean {
  return ch === undefined || OPEN_BOUNDARY.has(ch)
}

function isCloseBoundary(ch: string | undefined): boolean {
  return ch === undefined || CLOSE_BOUNDARY.has(ch)
}

type Ctx = Partial<Pick<ChatSegment, "bold" | "italic" | "mono" | "underline" | "strike" | "spoiler">>

/**
 * Parse teks berformat menjadi segmen. Murni & defensif: input aneh
 * (marker tak berpasangan, nesting rusak) di-render sebagai teks biasa.
 */
export function parseChatMarkup(text: string, ctx: Ctx = {}): ChatSegment[] {
  const segments: ChatSegment[] = []
  let plain = ""
  const flush = () => {
    if (plain) {
      segments.push({ text: plain, ...ctx })
      plain = ""
    }
  }
  const pushFormatted = (inner: string, key: keyof Ctx) => {
    flush()
    // Nesting satu level: isi di-parse ulang dengan konteks bertambah.
    // `mono` dan tautan bersifat literal — isinya tidak di-parse.
    const innerCtx = { ...ctx, [key]: true }
    for (const seg of parseChatMarkup(inner, innerCtx)) segments.push(seg)
  }

  let i = 0
  const n = text.length
  while (i < n) {
    const prev = i > 0 ? text[i - 1] : undefined

    // 1) Tautan markdown [label](url)
    if (text[i] === "[") {
      const closeLabel = text.indexOf("]", i + 1)
      if (closeLabel > i + 1 && text[closeLabel + 1] === "(") {
        const closeParen = text.indexOf(")", closeLabel + 2)
        if (closeParen > closeLabel + 2) {
          const label = text.slice(i + 1, closeLabel)
          const url = text.slice(closeLabel + 2, closeParen)
          if (/^https?:\/\/[^\s)]+$/.test(url)) {
            flush()
            segments.push({ text: label || url, linkUrl: url, ...ctx })
            i = closeParen + 1
            continue
          }
        }
      }
    }

    // 2) Tautan telanjang
    const urlMatch = URL_RE.exec(text.slice(i))
    if (urlMatch) {
      flush()
      const url = trimTrailingPunct(urlMatch[0])
      segments.push({ text: url, linkUrl: url, ...ctx })
      i += url.length
      continue
    }

    // 3) Marker dua karakter: spoiler, bold, underline
    const two = text.slice(i, i + 2)
    if (two === "||" || two === "**" || two === "__") {
      const key: keyof Ctx = two === "||" ? "spoiler" : two === "**" ? "bold" : "underline"
      const end = text.indexOf(two, i + 2)
      if (end > i + 2) {
        const inner = text.slice(i + 2, end)
        // Marker kosong/tanpa isi → perlakukan literal.
        if (inner.trim().length > 0) {
          pushFormatted(inner, key)
          i = end + 2
          continue
        }
      }
    }

    // 4) Mono `...` (literal di dalamnya)
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1)
      if (end > i + 1) {
        const inner = text.slice(i + 1, end)
        if (inner.length > 0) {
          flush()
          segments.push({ text: inner, mono: true, ...ctx })
          i = end + 1
          continue
        }
      }
    }

    // 5) Marker SATU karakter ber-boundary: _miring_, *tebal* (WhatsApp),
    //    ~coret~. Boundary wajib agar snake_case / 2*3*4 / a~b tidak kena.
    const single = text[i]
    const singleKey: keyof Ctx | null =
      single === "_" ? "italic" : single === "*" ? "bold" : single === "~" ? "strike" : null
    if (singleKey && text[i + 1] !== single && isOpenBoundary(prev)) {
      const end = text.indexOf(single, i + 1)
      if (end > i + 1 && text[end + 1] !== single && isCloseBoundary(text[end + 1])) {
        const inner = text.slice(i + 1, end)
        // Isi tidak boleh diawali/diakhiri spasi (`* bukan *` = literal) —
        // aturan WhatsApp, mencegah perkalian "2 * 3 * 4" jadi tebal.
        if (inner.trim().length > 0 && inner[0] !== " " && inner[inner.length - 1] !== " ") {
          pushFormatted(inner, singleKey)
          i = end + 1
          continue
        }
      }
    }

    plain += text[i]
    i += 1
  }
  flush()
  return segments
}

export type ChatFormatEdit = {
  value: string
  /** Kursor/seleksi baru. */
  start: number
  end: number
}

const looksLikeUrl = (s: string) => /^https?:\/\/[^\s]+$/.test(s.trim())

/**
 * Terapkan/hapus format pada rentang seleksi (dipakai toolbar).
 *
 * - Seleksi kosong → sisipkan pasangan marker kosong, kursor di tengah.
 * - Seleksi sudah terbungkus marker yang sama → toggle OFF (buka bungkus).
 * - "link": seleksi berupa URL → `[url](url)`; selain itu
 *   `[seleksi](https://)` dengan kursor pada `https://` agar mudah diganti.
 */
export function applyChatFormat(
  value: string,
  start: number,
  end: number,
  format: ChatTextFormat,
): ChatFormatEdit {
  const len = value.length
  const s = Math.max(0, Math.min(start, len))
  const e = Math.max(0, Math.min(end, len))
  const [from, to] = s <= e ? [s, e] : [e, s]
  const selected = value.slice(from, to)

  if (format === "link") {
    if (!selected) {
      const insert = "[tautan](https://)"
      const next = value.slice(0, from) + insert + value.slice(to)
      // Kursor pada label "tautan".
      return { value: next, start: from + 1, end: from + 7 }
    }
    const url = looksLikeUrl(selected) ? selected.trim() : "https://"
    const insert = `[${selected}](${url})`
    const next = value.slice(0, from) + insert + value.slice(to)
    if (looksLikeUrl(selected)) {
      const ns = from + insert.length
      return { value: next, start: ns, end: ns }
    }
    // Kursor pada "https://" agar user mengganti URL.
    const urlStart = from + selected.length + 3
    return { value: next, start: urlStart, end: urlStart + 8 }
  }

  const { open, close } = MARKERS[format]

  if (!selected) {
    const next = value.slice(0, from) + open + close + value.slice(to)
    const cursor = from + open.length
    return { value: next, start: cursor, end: cursor }
  }

  // Toggle off: seleksi sudah terbungkus pasangan marker ini.
  const before = value.slice(Math.max(0, from - open.length), from)
  const after = value.slice(to, to + close.length)
  if (before === open && after === close) {
    const next = value.slice(0, from - open.length) + selected + value.slice(to + close.length)
    return { value: next, start: from - open.length, end: from - open.length + selected.length }
  }

  const next = value.slice(0, from) + open + selected + close + value.slice(to)
  return { value: next, start: from + open.length, end: from + open.length + selected.length }
}
