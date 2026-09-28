/**
 * Kahade — <Markdown>: renderer markdown AMAN & terbatas untuk isi artikel
 * bantuan (mega-batch FE-IMP-5, item 121).
 *
 * Isi artikel bantuan di-render kaya (heading, paragraf, bullet, bold,
 * italic, tautan, gambar) tanpa pustaka markdown eksternal. Aturan
 * keamanan:
 * - TIDAK ada `dangerouslySetInnerHTML` / WebView — semua lewat komponen
 *   React Native biasa, teks di-render sebagai string (escape otomatis).
 * - Tautan & gambar HANYA skema https (tanpa kredensial userinfo) — skema
 *   lain (javascript:, data:, file:) dan http: non-TLS ditolak lalu
 *   di-render sebagai teks polos. Validasi terpusat di `safeHttpsLink`
 *   (`lib/external-url.ts`) — satu gate dengan seluruh call-site
 *   `Linking.openURL` (R-1 audit ronde-2).
 * - Konstruksi yang tidak dikenali di-render sebagai paragraf polos
 *   (fail-safe), bukan di-skip diam-diam.
 *
 * Didukung: heading `#`/`##`/`###`, bullet `-`/`*`/`•` (dan `1.` bernomor
 * sebagai bullet), `**tebal**`, `*miring*`/`_miring_`, `` `kode` ``,
 * `[teks](url)`, dan gambar `![alt](url)` satu baris penuh.
 */
import { useMemo, useState } from "react"
import { Image, Linking, Pressable, View, type ViewProps } from "react-native"

import { Text } from "@/components/ui/text"
import { safeHttpsLink } from "@/lib/external-url"
import { logWarn } from "@/lib/telemetry"

// ------------------------------------------------------------------
// Model
// ------------------------------------------------------------------

export type InlineSegment =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "code"; value: string }
  | { kind: "link"; value: string; url: string }

export type MarkdownBlock =
  | { kind: "heading"; level: 1 | 2 | 3; segments: InlineSegment[] }
  | { kind: "paragraph"; segments: InlineSegment[] }
  | { kind: "bullet"; items: InlineSegment[][] }
  | { kind: "image"; uri: string; alt: string }

// ------------------------------------------------------------------
// Validasi URL
// ------------------------------------------------------------------

/**
 * Kompatibilitas mundur: dulu validator lokal lemah (regex, menerima http:
 * dan URL berkredensial). Kini mendelegasikan ke `safeHttpsLink`
 * (R-1 audit ronde-2) — dipakai juga di call-site sebagai penjaga
 * defense-in-depth sebelum `Linking.openURL`.
 */
export function isSafeExternalUrl(url: string): boolean {
  return safeHttpsLink(url) !== undefined
}

// ------------------------------------------------------------------
// Parser inline
// ------------------------------------------------------------------

const INLINE_PATTERN =
  /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g

/**
 * Pecah satu baris menjadi segmen inline. Konstruksi tak seimbang (mis.
 * `**` tanpa penutup) dibiarkan sebagai teks polos.
 */
export function parseInline(line: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  let last = 0
  INLINE_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INLINE_PATTERN.exec(line)) !== null) {
    if (match.index > last) {
      segments.push({ kind: "text", value: line.slice(last, match.index) })
    }
    const [full, imgAlt, imgUrl, linkText, linkUrl, bold, italicStar, italicUnder, code] = match
    if (imgAlt !== undefined) {
      // Gambar inline di tengah kalimat → render sebagai tautan berlabel
      // (gambar blok hanya untuk baris yang seluruhnya gambar).
      // R-1: `safeHttpsLink` mengembalikan URL ternormalisasi bila lolos
      // gate (menolak http: & URL berkredensial); selain itu teks polos.
      const safeImg = safeHttpsLink(imgUrl)
      segments.push(
        safeImg
          ? { kind: "link", value: imgAlt || imgUrl, url: safeImg }
          : { kind: "text", value: full },
      )
    } else if (linkText !== undefined) {
      const safeLink = safeHttpsLink(linkUrl)
      segments.push(
        safeLink
          ? { kind: "link", value: linkText, url: safeLink }
          : { kind: "text", value: full },
      )
    } else if (bold !== undefined) {
      segments.push({ kind: "bold", value: bold })
    } else if (italicStar !== undefined || italicUnder !== undefined) {
      segments.push({ kind: "italic", value: (italicStar ?? italicUnder) as string })
    } else if (code !== undefined) {
      segments.push({ kind: "code", value: code })
    } else {
      segments.push({ kind: "text", value: full })
    }
    last = match.index + full.length
  }
  if (last < line.length) {
    segments.push({ kind: "text", value: line.slice(last) })
  }
  if (segments.length === 0) segments.push({ kind: "text", value: line })
  return segments
}

// ------------------------------------------------------------------
// Parser blok
// ------------------------------------------------------------------

const HEADING_PATTERN = /^(#{1,3})\s+(.*)$/
const BULLET_PATTERN = /^\s*[-*•]\s+(.*)$/
const NUMBERED_PATTERN = /^\s*\d+[.)]\s+(.*)$/
const IMAGE_LINE_PATTERN = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/

/** Pecah sumber markdown menjadi blok render. Pure — dikunci test. */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const lines = source.replace(/\r\n?/g, "\n").split("\n")
  let paragraphLines: string[] = []
  let bulletItems: InlineSegment[][] = []

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({ kind: "paragraph", segments: parseInline(paragraphLines.join(" ")) })
      paragraphLines = []
    }
  }
  const flushBullets = () => {
    if (bulletItems.length > 0) {
      blocks.push({ kind: "bullet", items: bulletItems })
      bulletItems = []
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === "") {
      flushParagraph()
      flushBullets()
      continue
    }
    const heading = HEADING_PATTERN.exec(line)
    if (heading) {
      flushParagraph()
      flushBullets()
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3,
        segments: parseInline(heading[2]),
      })
      continue
    }
    const imageLine = IMAGE_LINE_PATTERN.exec(line)
    if (imageLine) {
      flushParagraph()
      flushBullets()
      const uri = imageLine[2].trim()
      // R-1: gambar hanya dimuat dari URL https bersih (ternormalisasi).
      const safeUri = safeHttpsLink(uri)
      if (safeUri) {
        blocks.push({ kind: "image", uri: safeUri, alt: imageLine[1] })
      } else {
        blocks.push({ kind: "paragraph", segments: parseInline(line) })
      }
      continue
    }
    const bullet = BULLET_PATTERN.exec(line) ?? NUMBERED_PATTERN.exec(line)
    if (bullet) {
      flushParagraph()
      bulletItems.push(parseInline(bullet[1]))
      continue
    }
    flushBullets()
    paragraphLines.push(line)
  }
  flushParagraph()
  flushBullets()
  return blocks
}

// ------------------------------------------------------------------
// Komponen
// ------------------------------------------------------------------

function InlineText({ segments }: { segments: InlineSegment[] }) {
  return (
    <Text variant="inherit">
      {segments.map((seg, i) => {
        switch (seg.kind) {
          case "bold":
            return (
              <Text key={i} variant="inherit" weight={700}>
                {seg.value}
              </Text>
            )
          case "italic":
            return (
              <Text key={i} variant="inherit" className="italic">
                {seg.value}
              </Text>
            )
          case "code":
            return (
              <Text key={i} variant="inherit" className="font-mono-500">
                {seg.value}
              </Text>
            )
          case "link":
            return (
              <Pressable
                key={i}
                accessibilityRole="link"
                accessibilityLabel={seg.value}
                onPress={() => {
                  // Defense-in-depth: segmen sudah divalidasi saat parse,
                  // validasi ulang sebelum openURL (R-1).
                  if (!isSafeExternalUrl(seg.url)) return
                  const safe = safeHttpsLink(seg.url)
                  if (!safe) return
                  Linking.openURL(safe).catch((err: unknown) =>
                    logWarn("markdown", err),
                  )
                }}
              >
                <Text variant="inherit" tone="primary" className="underline">
                  {seg.value}
                </Text>
              </Pressable>
            )
          default:
            return <Text key={i} variant="inherit">{seg.value}</Text>
        }
      })}
    </Text>
  )
}

function MarkdownImage({ uri, alt }: { uri: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    // Gambar gagal dimuat → fallback tautan berlabel, bukan kotak kosong.
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={alt || uri}
        onPress={() => {
          // R-1: fallback tautan gambar gagal-muat juga lewat gate https.
          const safe = safeHttpsLink(uri)
          if (safe) Linking.openURL(safe).catch(() => undefined)
        }}
      >
        <Text variant="body" tone="primary" className="underline">
          {alt || uri}
        </Text>
      </Pressable>
    )
  }
  return (
    <View className="gap-1">
      <Image
        source={{ uri }}
        accessibilityLabel={alt || "Gambar artikel"}
        resizeMode="contain"
        style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 8 }}
        onError={() => setFailed(true)}
      />
      {alt ? (
        <Text variant="caption" tone="secondary">
          {alt}
        </Text>
      ) : null}
    </View>
  )
}

export type MarkdownProps = Omit<ViewProps, "children"> & {
  /** Sumber markdown mentah. */
  source: string
  className?: string
}

export function Markdown({ source, className, ...rest }: MarkdownProps) {
  const blocks = useMemo(() => parseMarkdown(source), [source])
  return (
    <View className={className} {...rest}>
      <View className="gap-3">
        {blocks.map((block, i) => {
          switch (block.kind) {
            case "heading":
              return (
                <Text
                  key={i}
                  variant={block.level === 1 ? "h2" : block.level === 2 ? "h3" : "bodyLarge"}
                  weight={700}
                >
                  <InlineText segments={block.segments} />
                </Text>
              )
            case "bullet":
              return (
                <View key={i} className="gap-1.5">
                  {block.items.map((item, j) => (
                    <View key={j} className="flex-row gap-2">
                      <Text variant="body" tone="secondary">
                        •
                      </Text>
                      <View className="flex-1">
                        <Text variant="body">
                          <InlineText segments={item} />
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )
            case "image":
              return <MarkdownImage key={i} uri={block.uri} alt={block.alt} />
            default:
              return (
                <Text key={i} variant="body">
                  <InlineText segments={block.segments} />
                </Text>
              )
          }
        })}
      </View>
    </View>
  )
}
