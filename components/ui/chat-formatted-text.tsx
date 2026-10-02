/**
 * Kahade — renderer teks berformat chat (batch 43 FE-CHAT, 2026-09-28).
 *
 * Merender segmen `parseChatMarkup`: **tebal**, _miring_, `mono`,
 * __garis bawah__, ||spoiler|| (ketuk untuk membuka), dan tautan aman
 * (hanya http/https lewat `safeHttpsLink` — anti `javascript:`).
 *
 * Keputusan non-obvious:
 *   - `selectable` dimatikan otomatis bila ada segmen interaktif (tautan /
 *     spoiler): di Android, Text induk yang selectable menelan onPress anak.
 *   - Spoiler: tiap segmen punya state buka/tutup sendiri (komponen kecil
 *     agar hooks tetap dalam urutan yang sama).
 *   - Tidak ada `dangerouslySetInnerHTML` / HTML parsing — sintaks hanya
 *     marker teks yang di-parse murni di `lib/chat-format`.
 */
import { memo, useMemo, useState } from "react"
import { Linking } from "react-native"

import { parseChatMarkup, hasChatMarkup, type ChatSegment } from "@/lib/chat-format"
import { safeHttpsLink } from "@/lib/external-url"
import { logWarn } from "@/lib/telemetry"
import { truncateMiddle } from "@/lib/format"

/**
 * 2026-10-02: Strip tag HTML dari teks pesan agar tampil sebagai teks polos.
 * Pesan yang mengandung HTML (mis. dari copy-paste web) sebelumnya tidak
 * tampil dengan benar — tag mentah terlihat atau teks hilang. Kita strip
 * tag-nya dan decode entity umum, lalu render sebagai teks biasa.
 *
 * 2026-10-03: PERTAHANKAN formatting — <b>/<strong> → **, <i>/<em> → _,
 * <u> → __, <code> → `. User yang copy-paste teks berformat dari aplikasi
 * lain tetap melihat bold/italic/underline di bubble chat.
 */
function stripHtmlTags(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    // Pertahankan formatting: konversi ke markdown SEBELUM strip.
    .replace(/<(b|strong)[^>]*>/gi, "**")
    .replace(/<\/(b|strong)>/gi, "**")
    .replace(/<(i|em)[^>]*>/gi, "_")
    .replace(/<\/(i|em)>/gi, "_")
    .replace(/<u[^>]*>/gi, "__")
    .replace(/<\/u>/gi, "__")
    .replace(/<code[^>]*>/gi, "`")
    .replace(/<\/code>/gi, "`")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

import { useTheme } from "@/components/theme-provider"
import { Text } from "@/components/ui/text"
import { tokens, modes } from "@/lib/tokens"
import { cn } from "@/lib/cn"

export type ChatFormattedTextProps = {
  text: string
  /** Gelembung keluar (teks inverse di atas bg-primary). */
  outgoing?: boolean
  /** Pesan terhapus — tone secondary (placeholder, bukan konten). */
  deleted?: boolean
  selectable?: boolean
  /** Miring ASLI (file italic) untuk seluruh teks — mis. placeholder terhapus. */
  italic?: boolean
  className?: string
}

function ChatSpoilerSegment({
  segment,
  outgoing,
}: {
  segment: ChatSegment
  outgoing: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const { mode } = useTheme()
  const palette = modes[mode]
  return (
    <Text
      variant="inherit"
      tone={outgoing ? "inverse" : "primary"}
      onPress={() => setRevealed((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={revealed ? "Sembunyikan spoiler" : "Buka spoiler"}
      style={
        revealed
          ? undefined
          : {
              backgroundColor: outgoing ? "rgba(0,0,0,0.25)" : palette.borderDefault,
              color: "transparent",
              borderRadius: tokens.radius.sm,
            }
      }
    >
      {segment.text}
    </Text>
  )
}

/**
 * CHT-003: React Native tidak bisa memutus baris pada string tanpa spasi —
 * URL 150+ karakter melebar melewati max-w bubble dan keluar layar. Label
 * yang tampil dipotong di tengah (kepala domain + ekor token tetap
 * dikenali); href PENUH tetap dipakai onPress & accessibilityLabel.
 * Hanya untuk string tanpa whitespace: kalimat normal tetap wrap utuh.
 */
const UNBROKEN_DISPLAY_MAX = 60
function unbrokenDisplay(text: string): string {
  if (text.length > UNBROKEN_DISPLAY_MAX && !/\s/.test(text)) {
    return truncateMiddle(text, 24, 12)
  }
  return text
}

function ChatLinkSegment({
  segment,
  outgoing,
}: {
  segment: ChatSegment
  outgoing: boolean
}) {
  const open = () => {
    const safe = safeHttpsLink(segment.linkUrl)
    if (!safe) return
    Linking.openURL(safe).catch((err: unknown) => logWarn("chat:open-link", err))
  }
  return (
    <Text
      variant="inherit"
      tone={outgoing ? "inverse" : "info"}
      weight={600}
      onPress={open}
      accessibilityRole="link"
      accessibilityLabel={`Buka tautan ${segment.linkUrl}`}
      className="underline"
    >
      {unbrokenDisplay(segment.text)}
    </Text>
  )
}

function ChatSegmentView({
  segment,
  outgoing,
}: {
  segment: ChatSegment
  outgoing: boolean
}) {
  if (segment.linkUrl) {
    return <ChatLinkSegment segment={segment} outgoing={outgoing} />
  }
  if (segment.spoiler) {
    return <ChatSpoilerSegment segment={segment} outgoing={outgoing} />
  }
  return (
    <Text
      variant="inherit"
      italic={segment.italic}
      className={cn(segment.underline && "underline", segment.mono && "font-mono-500")}
      weight={segment.bold ? 700 : undefined}
      // CHT-003: segmen mono panjang tanpa spasi memakai proteksi yang sama
      // dengan tautan — teks penuh tetap di accessibilityLabel.
      accessibilityLabel={segment.mono ? segment.text : undefined}
      style={
        segment.mono
          ? {
              backgroundColor: outgoing ? "rgba(0,0,0,0.18)" : "rgba(127,127,127,0.18)",
              borderRadius: tokens.radius.sm,
            }
          : segment.underline
            ? { textDecorationLine: "underline" }
            : undefined
      }
    >
      {segment.mono ? unbrokenDisplay(segment.text) : segment.text}
    </Text>
  )
}

export const ChatFormattedText = memo(function ChatFormattedText({
  text,
  outgoing = false,
  deleted = false,
  selectable = true,
  italic,
  className,
}: ChatFormattedTextProps) {
  // 2026-10-02: strip HTML dulu agar pesan ber-HTML tampil sebagai teks.
  const cleanText = useMemo(() => stripHtmlTags(text), [text])
  const segments = useMemo(
    () => (hasChatMarkup(cleanText) ? parseChatMarkup(cleanText) : null),
    [cleanText],
  )
  const interactive = segments?.some((s) => s.linkUrl || s.spoiler) ?? false
  const tone = deleted ? "secondary" : outgoing ? "inverse" : "primary"

  if (!segments) {
    return (
      <Text
        variant="body"
        tone={tone}
        selectable={selectable && !deleted}
        italic={italic}
        className={className}
      >
        {cleanText}
      </Text>
    )
  }

  return (
    <Text
      variant="body"
      tone={tone}
      // Android: selectable menelan onPress segmen anak.
      selectable={selectable && !deleted && !interactive}
      italic={italic}
      className={className}
    >
      {segments.map((s, i) => (
        <ChatSegmentView key={i} segment={s} outgoing={outgoing && !deleted} />
      ))}
    </Text>
  )
})
