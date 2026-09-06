/**
 * Kahade — <ReadMore> teks panjang yang bisa dibuka (§9.15 List/Detail).
 *
 * Deskripsi barang, klaim sengketa, jawaban Q&A profil, isi tiket support:
 * teks user bisa sangat panjang. Kita potong ke N baris + link
 * "Baca selengkapnya" (TextLink §2.3: primary + underline), bukan memotong
 * diam-diam dengan ellipsis — user harus tahu ada sisa teks.
 *
 * Deteksi "apakah teks melebihi N baris" (non-obvious, ini bagian sulitnya):
 *   - Native: `onTextLayout` memberi jumlah baris hasil render sebenarnya.
 *     Kita render sekali TANPA numberOfLines (tak terlihat, absolute,
 *     opacity 0) untuk mengukur, lalu memutuskan perlu toggle atau tidak.
 *   - Web: react-native-web TIDAK mengimplementasikan onTextLayout. Fallback
 *     heuristik: perkirakan karakter per baris (`charsPerLine`, default 44
 *     untuk body 14px di lebar konten 520px web / ~330px mobile) — kalau
 *     panjang teks > lines * charsPerLine, toggle ditampilkan. Meleset
 *     sedikit tidak fatal: kasus terburuk link "Baca selengkapnya" muncul
 *     untuk teks yang sebenarnya pas, dan menekannya tidak mengubah apa pun.
 *     Lebih baik false-positive daripada teks terpotong tanpa jalan keluar.
 *   - Kalau `onTextLayout` SUDAH memberi jawaban, heuristik diabaikan.
 *
 * State expanded controlled (`expanded`/`onToggle`) atau uncontrolled.
 * Label i18n-ready lewat `labels` (§12), default Bahasa Indonesia.
 */
import { useCallback, useState } from "react"
import { View, type NativeSyntheticEvent, type TextLayoutEventData, type ViewProps } from "react-native"

import { Text, type TextProps } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { cn } from "@/lib/cn"

export type ReadMoreLabels = {
  more: string
  less: string
}

const DEFAULT_LABELS: ReadMoreLabels = {
  more: "Baca selengkapnya",
  less: "Tampilkan lebih sedikit",
}

export type ReadMoreProps = Omit<ViewProps, "children"> & {
  text: string
  /** Baris yang ditampilkan saat tertutup. Default 3. */
  lines?: number
  variant?: Extract<TextProps["variant"], "bodyLarge" | "body" | "caption">
  tone?: Extract<TextProps["tone"], "primary" | "secondary">
  /** Heuristik web: karakter per baris untuk menebak overflow. Default 44. */
  charsPerLine?: number
  expanded?: boolean
  onToggle?: (expanded: boolean) => void
  labels?: Partial<ReadMoreLabels>
  className?: string
}

export function ReadMore({
  text,
  lines = 3,
  variant = "body",
  tone = "primary",
  charsPerLine = 44,
  expanded: expandedProp,
  onToggle,
  labels,
  className,
  ...rest
}: ReadMoreProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const [internal, setInternal] = useState(false)
  const expanded = expandedProp ?? internal

  // null = belum terukur (web tidak pernah mengukur -> tetap null -> heuristik)
  const [measuredLines, setMeasuredLines] = useState<number | null>(null)

  const onLayout = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
    setMeasuredLines(e.nativeEvent.lines.length)
  }, [])

  const overflows =
    measuredLines != null ? measuredLines > lines : text.length > lines * charsPerLine

  const toggle = useCallback(() => {
    const next = !expanded
    if (expandedProp == null) setInternal(next)
    onToggle?.(next)
  }, [expanded, expandedProp, onToggle])

  return (
    <View accessible={false} className={cn("w-full gap-1", className)} {...rest}>
      {/* Pengukur: render penuh tak terlihat, hanya sekali saat belum terukur */}
      {measuredLines == null ? (
        <Text accessibilityHint="Ketuk untuk detail"
          variant={variant}
          tone={tone}
          onTextLayout={onLayout}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute left-0 right-0 top-0 opacity-0"
        >
          {text}
        </Text>
      ) : null}

      <Text ellipsizeMode="tail" variant={variant} tone={tone} numberOfLines={expanded ? undefined : lines}>
        {text}
      </Text>

      {overflows ? (
        <TextLink
          variant={variant === "caption" ? "caption" : "body"}
          onPress={toggle}
          accessibilityLabel={expanded ? t.less : t.more}
        >
          {expanded ? t.less : t.more}
        </TextLink>
      ) : null}
    </View>
  )
}