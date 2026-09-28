/**
 * Kahade — pratinjau hasil aktif pencarian dalam percakapan (B12).
 *
 * Bar pencarian inline hanya menampilkan chip "3 dari 12" + navigasi —
 * pengguna tidak tahu isi tiap hasil tanpa melompatinya satu per satu.
 * Komponen ini menampilkan SATU hasil aktif sebagai kartu ringkas di bawah
 * bar cari: nama pengirim + waktu, lalu cuplikan teks dengan potongan
 * SEBELUM & SESUDAH keyword (`buildSearchSnippet`, 40 karakter tiap sisi)
 * dengan keyword di-highlight. Ketuk kartu = lompat ke pesannya di thread.
 */
import { Pressable, View } from "react-native"

import { useTheme } from "@/components/theme-provider"
import { Text } from "@/components/ui/text"
import { buildSearchSnippet, type HighlightSpan } from "@/lib/chat-search"
import { translate } from "@/lib/i18n"
import { semantic } from "@/lib/tokens"

export type ChatSearchSnippetProps = {
  /** Pesan hasil aktif (undefined = tidak ada hasil). */
  message?: { id: string; text?: string | null; fromUser: boolean; createdAt: string } | null
  /** Kata kunci pencarian. */
  query: string
  /** Nama lawan bicara (untuk pesan masuk). */
  counterpartName?: string | null
  /** Waktu ringkas pesan ("12:30"). */
  timeLabel?: string
  /** Lompat ke pesan di thread. */
  onPress: () => void
}

function SnippetText({ spans }: { spans: HighlightSpan[] }) {
  const { mode } = useTheme()
  const hitBg = semantic.warning[mode].bgSoft
  return (
    <Text variant="caption" tone="secondary" numberOfLines={3} ellipsizeMode="tail">
      {spans.map((span, i) =>
        span.hit ? (
          <Text key={i} weight={700} tone="primary" style={{ backgroundColor: hitBg }}>
            {span.text}
          </Text>
        ) : (
          <Text key={i}>{span.text}</Text>
        ),
      )}
    </Text>
  )
}

export function ChatSearchSnippet({
  message,
  query,
  counterpartName,
  timeLabel,
  onPress,
}: ChatSearchSnippetProps) {
  if (!message || !query.trim()) return null
  const spans = buildSearchSnippet(message.text ?? "", query)
  if (spans.length === 0) return null
  const sender = message.fromUser ? translate("Anda") : (counterpartName ?? translate("Lawan bicara"))
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={translate("Lihat pesan hasil pencarian")}
      accessibilityHint={translate("Melompat ke pesan di percakapan")}
      className="border-b border-border bg-surface px-5 py-2"
    >
      <View className="flex-row items-center gap-1">
        <Text variant="caption" weight={600} tone="primary" numberOfLines={1} className="flex-1">
          {sender}
        </Text>
        {timeLabel ? (
          <Text variant="caption" tone="tertiary" className="tabular-nums">
            {timeLabel}
          </Text>
        ) : null}
      </View>
      <SnippetText spans={spans} />
    </Pressable>
  )
}
