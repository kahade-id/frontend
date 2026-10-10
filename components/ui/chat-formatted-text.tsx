/**
 * Kahade — renderer teks berformat chat (batch 43 FE-CHAT, 2026-09-28).
 *
 * Merender segmen `parseChatMarkup`: **tebal** / *tebal* (gaya WhatsApp),
 * _miring_, `mono`, __garis bawah__, ~coret~, ||spoiler|| (ketuk untuk
 * membuka), dan tautan aman (hanya http/https lewat `safeHttpsLink` — anti
 * `javascript:`).
 *
 * Segmen nested memakai tone "inherit" — warna datang dari <Text> induk
 * (inverse di bubble keluar). Bug #6 2026-10-10: tanpa itu segmen memakai
 * tone default "primary" dan teks berformat hilang di bubble keluar.
 *
 * Keputusan non-obvious:
 *   - `selectable` dimatikan otomatis bila ada segmen interaktif (tautan /
 *     spoiler): di Android, Text induk yang selectable menelan onPress anak.
 *   - Spoiler: tiap segmen punya state buka/tutup sendiri (komponen kecil
 *     agar hooks tetap dalam urutan yang sama).
 *   - Tidak ada `dangerouslySetInnerHTML` / HTML parsing — sintaks hanya
 *     marker teks yang di-parse murni di `lib/chat-format`.
 */
import { memo, useMemo, useState, type ReactNode } from "react"
import { Linking } from "react-native"

import { parseChatMarkup, hasChatMarkup, stripChatHtml, type ChatSegment } from "@/lib/chat-format"
import { safeHttpsLink } from "@/lib/external-url"
import { logWarn } from "@/lib/telemetry"
import { truncateMiddle } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"

// 2026-10-02/03: strip tag HTML (copy-paste web) sambil mempertahankan
// formatting — kini di `stripChatHtml` (lib/chat-format, murni & teruji).
// Batch 3 2026-10-10: hanya tag sungguhan yang dibuang; "1<2 dan 3>2" utuh.

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
  /**
   * Bug #2 (2026-10-10): elemen inline yang ditempel di UJUNG teks — dipakai
   * bubble untuk menyisakan ruang meta (jam + centang) hanya di baris
   * terakhir, pola WhatsApp. Dirender di dalam <Text> induk sehingga ikut
   * mengalir bersama baris terakhir (atau turun bersama ke baris baru).
   */
  trailing?: ReactNode
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
      accessibilityLabel={translate("Buka tautan {x}", { x: segment.linkUrl ?? "" })}
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
  // Garis bawah + coret bisa bersamaan: RN hanya menerima SATU nilai
  // textDecorationLine, jadi kombinasinya dipetakan ke "underline line-through".
  const decoration =
    segment.underline && segment.strike
      ? "underline line-through"
      : segment.underline
        ? "underline"
        : segment.strike
          ? "line-through"
          : undefined
  return (
    <Text
      variant="inherit"
      // Bug #6 (audit Pesan 2026-10-10): tone WAJIB "inherit". Tanpa prop ini
      // <Text> memasang tone default "primary" (text-text-primary) pada SETIAP
      // segmen — di bubble KELUAR (bg-primary hitam/putih) teks jadi hitam di
      // atas hitam (atau putih di atas putih di dark mode) begitu pesan
      // mengandung markup apa pun. Itulah "format bold/underline/italic tidak
      // terlihat": seluruh teks berformat memang lenyap, bukan hanya gayanya.
      tone="inherit"
      italic={segment.italic}
      className={cn(segment.mono && "font-mono-500")}
      weight={segment.bold ? 700 : undefined}
      // CHT-003: segmen mono panjang tanpa spasi memakai proteksi yang sama
      // dengan tautan — teks penuh tetap di accessibilityLabel.
      accessibilityLabel={segment.mono ? segment.text : undefined}
      style={[
        segment.mono
          ? {
              backgroundColor: outgoing ? "rgba(0,0,0,0.18)" : "rgba(127,127,127,0.18)",
              borderRadius: tokens.radius.sm,
            }
          : null,
        decoration ? { textDecorationLine: decoration } : null,
      ]}
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
  trailing,
  className,
}: ChatFormattedTextProps) {
  // 2026-10-02: strip HTML dulu agar pesan ber-HTML tampil sebagai teks.
  const cleanText = useMemo(() => stripChatHtml(text), [text])
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
        {trailing}
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
      {trailing}
    </Text>
  )
})
