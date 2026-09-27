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
      {segment.text}
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
      className={cn(segment.italic && "italic", segment.underline && "underline")}
      weight={segment.bold ? 700 : undefined}
      style={
        segment.mono
          ? {
              fontFamily: "monospace",
              backgroundColor: outgoing ? "rgba(0,0,0,0.18)" : "rgba(127,127,127,0.18)",
              borderRadius: tokens.radius.sm,
            }
          : segment.underline
            ? { textDecorationLine: "underline" }
            : undefined
      }
    >
      {segment.text}
    </Text>
  )
}

export const ChatFormattedText = memo(function ChatFormattedText({
  text,
  outgoing = false,
  deleted = false,
  selectable = true,
  className,
}: ChatFormattedTextProps) {
  const segments = useMemo(
    () => (hasChatMarkup(text) ? parseChatMarkup(text) : null),
    [text],
  )
  const interactive = segments?.some((s) => s.linkUrl || s.spoiler) ?? false
  const tone = deleted ? "secondary" : outgoing ? "inverse" : "primary"

  if (!segments) {
    return (
      <Text
        variant="body"
        tone={tone}
        selectable={selectable && !deleted}
        className={className}
      >
        {text}
      </Text>
    )
  }

  return (
    <Text
      variant="body"
      tone={tone}
      // Android: selectable menelan onPress segmen anak.
      selectable={selectable && !deleted && !interactive}
      className={className}
    >
      {segments.map((s, i) => (
        <ChatSegmentView key={i} segment={s} outgoing={outgoing && !deleted} />
      ))}
    </Text>
  )
})
