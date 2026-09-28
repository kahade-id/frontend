/**
 * Kahade — renderer isi artikel bantuan (item mega-batch 121).
 *
 * Markdown RINGAN yang aman: paragraf, heading (#–###), bullet list,
 * numbered list, bold, italic, inline code, link, dan gambar.
 *
 * TIDAK memakai WebView / injeksi HTML mentah — semua node di-render sebagai
 * komponen RN. URL gambar & link wajib lolos `safeHttpsLink` (hanya https);
 * selain itu node diabaikan diam-diam (fail-closed).
 */
import { Fragment, useMemo } from "react"
import { Linking, View, type ViewProps } from "react-native"

import { Picture } from "@/components/ui/picture"
import { Text } from "@/components/ui/text"
import { safeHttpsLink } from "@/lib/external-url"
import { logWarn } from "@/lib/telemetry"

type InlineNode =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "code"; value: string }
  | { kind: "link"; label: string; url: string }

const HEADING_RE = /^(#{1,3})\s+(.+)$/
const BULLET_RE = /^[-*]\s+(.+)$/
const ORDERED_RE = /^\d{1,3}[.)]\s+(.+)$/
const IMAGE_RE = /^!\[([^\]]*)\]\(\s*(https?:\/\/[^\s)]+)\s*\)$/

/** Pecah satu baris menjadi node inline (bold/italic/code/link). */
function parseInline(line: string): InlineNode[] {
  const nodes: InlineNode[] = []
  // Link dulu (label boleh mengandung * atau ` — ditangani sebagai teks).
  const re =
    /(\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|\[([^\]]+)\]\(\s*(https?:\/\/[^\s)]+)\s*\))/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) nodes.push({ kind: "text", value: line.slice(last, m.index) })
    const [, whole, bold, italicStar, italicUnder, code, label, url] = m
    if (bold) nodes.push({ kind: "bold", value: bold })
    else if (italicStar || italicUnder) nodes.push({ kind: "italic", value: italicStar ?? italicUnder })
    else if (code) nodes.push({ kind: "code", value: code })
    else if (label && url && safeHttpsLink(url)) nodes.push({ kind: "link", label, url })
    else nodes.push({ kind: "text", value: whole })
    last = m.index + whole.length
  }
  if (last < line.length) nodes.push({ kind: "text", value: line.slice(last) })
  return nodes
}

function InlineText({ nodes }: { nodes: InlineNode[] }) {
  return (
    <Text variant="body" tone="secondary">
      {nodes.map((n, i) => {
        switch (n.kind) {
          case "bold":
            return (
              <Text key={i} variant="body" weight={700} tone="secondary">
                {n.value}
              </Text>
            )
          case "italic":
            return (
              <Text key={i} variant="body" style={{ fontStyle: "italic" }} tone="secondary">
                {n.value}
              </Text>
            )
          case "code":
            return (
              <Text key={i} variant="body" tone="primary" style={{ fontFamily: "monospace" }}>
                {n.value}
              </Text>
            )
          case "link":
            return (
              <Text
                key={i}
                variant="body"
                tone="primary"
                style={{ textDecorationLine: "underline" }}
                onPress={() => {
                  Linking.openURL(n.url).catch((err) => logWarn("help:open-link", err))
                }}
                accessibilityRole="link"
              >
                {n.label}
              </Text>
            )
          default:
            return <Fragment key={i}>{n.value}</Fragment>
        }
      })}
    </Text>
  )
}

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "para"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "ordered"; text: string }
  | { kind: "image"; alt: string; url: string }

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = []
  // Baris bullet/numbered yang berurutan digabung jadi satu list di render.
  const lines = content.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) {
      i++
      continue
    }
    const heading = HEADING_RE.exec(line)
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] })
      i++
      continue
    }
    const image = IMAGE_RE.exec(line)
    if (image) {
      const url = safeHttpsLink(image[2])
      // D-01: skema non-https / URL tak valid → node dibuang, bukan di-render.
      if (url) blocks.push({ kind: "image", alt: image[1], url })
      i++
      continue
    }
    const bullet = BULLET_RE.exec(line)
    if (bullet) {
      blocks.push({ kind: "bullet", text: bullet[1] })
      i++
      continue
    }
    const ordered = ORDERED_RE.exec(line)
    if (ordered) {
      blocks.push({ kind: "ordered", text: ordered[1] })
      i++
      continue
    }
    // Paragraf: gabungkan baris non-kosong berurutan (soft line break).
    const para: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|[-*]\s|\d{1,3}[.)]\s|!\[)/.test(lines[i].trim())) {
      para.push(lines[i].trim())
      i++
    }
    blocks.push({ kind: "para", text: para.join(" ") })
  }
  return blocks
}

export function HelpArticleContent({
  content,
  className,
  /**
   * Batch 139 (F03): dipanggil tiap heading di-render dengan
   * (headingIndex, y) — posisi Y relatif terhadap konten scroll. Pemanggil
   * (detail artikel) memakainya untuk daftar isi → lompat ke anchor.
   * headingIndex selaras dengan `parseArticleHeadings(content)`.
   */
  onHeadingLayout,
  ...rest
}: {
  content: string
  onHeadingLayout?: (headingIndex: number, y: number) => void
} & Omit<ViewProps, "children">) {
  const blocks = useMemo(() => parseBlocks(content ?? ""), [content])
  // Penomoran list: me-reset setiap blok non-ordered (dua list terpisah
  // tidak boleh menyambung nomornya).
  let orderedCounter = 0
  let headingCounter = 0
  return (
    <View className={className} {...rest}>
      <View className="gap-3">
        {blocks.map((b, i) => {
          if (b.kind !== "ordered") orderedCounter = 0
          switch (b.kind) {
            case "heading": {
              const headingIndex = headingCounter
              headingCounter += 1
              return (
                <View
                  key={i}
                  className={i === 0 ? "" : "mt-2"}
                  onLayout={
                    onHeadingLayout
                      ? (e) => onHeadingLayout(headingIndex, e.nativeEvent.layout.y)
                      : undefined
                  }
                >
                  <Text variant={b.level === 1 ? "h2" : "h3"} weight={700}>
                    {b.text}
                  </Text>
                </View>
              )
            }
            case "bullet":
              return (
                <View key={i} className="flex-row gap-2">
                  <Text variant="body" tone="secondary">
                    •
                  </Text>
                  <View className="flex-1">
                    <InlineText nodes={parseInline(b.text)} />
                  </View>
                </View>
              )
            case "ordered":
              orderedCounter += 1
              return (
                <View key={i} className="flex-row gap-2">
                  <Text variant="body" tone="secondary">
                    {orderedCounter}.
                  </Text>
                  <View className="flex-1">
                    <InlineText nodes={parseInline(b.text)} />
                  </View>
                </View>
              )
            case "image":
              return (
                <Picture
                  key={i}
                  source={b.url}
                  alt={b.alt || "Gambar artikel"}
                  aspectRatio={16 / 9}
                  radius="md"
                  className="w-full"
                />
              )
            default:
              return <InlineText key={i} nodes={parseInline(b.text)} />
          }
        })}
      </View>
    </View>
  )
}
