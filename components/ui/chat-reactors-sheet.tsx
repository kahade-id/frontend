/**
 * Kahade — <ChatReactorsSheet> daftar "siapa memberi reaksi apa" (audit chat E13).
 *
 * Dibuka dengan mengetuk chip reaksi di bubble. Tab "Semua" + satu tab per
 * emoji; tiap baris = nama + emoji. Reaksi SAYA berbaris "Anda" dan bisa
 * ditarik dengan ketukan (hint di bawah daftar) — jalan menarik reaksi
 * setelah chip tidak lagi mengubah reaksi saat diketuk (ketuk chip = lihat
 * siapa; mengubah reaksi lewat tekan lama bubble atau baris "Anda" di sini).
 *
 * Daftar dibangun `buildReactorRows` (lib/chat-reactions): nama dari server
 * bila ada, "Anda", nama lawan bicara di DM 1:1, atau baris "Pengguna lain"
 * dengan jumlah yang jujur — nama tidak pernah dikarang. Pesan dibaca LIVE
 * dari thread (props), jadi reaksi baru dari lawan bicara tampil tanpa
 * menutup-buka sheet.
 */
import { Smiley } from "phosphor-react-native"
import { useEffect, useMemo, useState } from "react"
import { View } from "react-native"

import type { ChatMessage } from "@/lib/api/chat"
import { buildReactorRows, totalReactions } from "@/lib/chat-reactions"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { translate, useLanguage } from "@/lib/i18n"

import { Avatar } from "@/components/ui/avatar"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { EmptyState } from "@/components/ui/empty-state"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"

/** Nilai tab "Semua". */
const ALL = "__all__"

export type ChatReactorsSheetProps = {
  /** Pesan yang reaksinya dilihat; null = sheet tertutup. */
  message: ChatMessage | null
  /** Emoji yang diketuk — menjadi tab awal. */
  initialEmoji?: string | null
  /** Id milik saya (publik + internal) — penanda baris "Anda". */
  selfIds: readonly string[]
  counterpartName?: string | null
  /** Ruang 1:1 → sisa reaksi tanpa nama pasti milik lawan bicara. */
  isDirect: boolean
  onClose: () => void
  /** Tarik reaksi saya (ketuk baris "Anda"). */
  onRemoveMine: (message: ChatMessage, emoji: string) => void
}

export function ChatReactorsSheet({
  message,
  initialEmoji,
  selfIds,
  counterpartName,
  isDirect,
  onClose,
  onRemoveMine,
}: ChatReactorsSheetProps) {
  useLanguage()
  const reactions = useMemo(() => message?.reactions ?? [], [message?.reactions])
  const [tab, setTab] = useState<string>(initialEmoji ?? ALL)

  // Pesan baru dibuka → tab awal mengikuti chip yang diketuk.
  const messageId = message?.id
  useEffect(() => {
    setTab(initialEmoji ?? ALL)
  }, [messageId, initialEmoji])

  const rows = useMemo(
    () =>
      buildReactorRows(reactions, {
        selfIds,
        counterpartName,
        isDirect,
        labels: { you: translate("Anda"), someone: translate("Pengguna lain") },
      }),
    [reactions, selfIds, counterpartName, isDirect],
  )

  // Tab emoji yang reaksinya sudah habis (ditarik) kembali ke "Semua".
  const activeTab = tab === ALL || reactions.some((r) => r.emoji === tab && r.count > 0) ? tab : ALL
  const visibleRows = activeTab === ALL ? rows : rows.filter((r) => r.emoji === activeTab)
  const total = totalReactions(reactions)

  return (
    <BottomSheet
      visible={message != null}
      onRequestClose={onClose}
      title={translate("Reaksi")}
      description={translate("Siapa memberi reaksi apa pada pesan ini.")}
    >
      {total === 0 ? (
        <EmptyState icon={Smiley} title={translate("Belum ada reaksi")} />
      ) : (
        <View className="gap-3 pb-2">
          {/* Tab: Semua + satu per emoji. */}
          <View className="flex-row flex-wrap gap-2" accessibilityRole="tablist">
            <TabPill
              label={translate("Semua {x}", { x: total })}
              selected={activeTab === ALL}
              onPress={() => setTab(ALL)}
            />
            {reactions
              .filter((r) => r.count > 0)
              .map((r) => (
                <TabPill
                  key={r.emoji}
                  label={`${r.emoji} ${r.count}`}
                  selected={activeTab === r.emoji}
                  onPress={() => setTab(r.emoji)}
                />
              ))}
          </View>

          <View>
            {visibleRows.map((row) => {
              const content = (
                <View className="min-h-12 flex-row items-center gap-3 py-2">
                  <Avatar name={row.anonymous ? undefined : row.name} size="sm" />
                  <View className="min-w-0 flex-1">
                    <Text variant="body" weight={row.mine ? 600 : 400} tone="primary" numberOfLines={1}>
                      {row.name}
                    </Text>
                    {row.mine ? (
                      <Text variant="caption" tone="secondary" numberOfLines={1}>
                        {translate("Ketuk untuk menarik reaksi")}
                      </Text>
                    ) : null}
                  </View>
                  <Text variant="h3">{row.emoji}</Text>
                </View>
              )
              return row.mine && message ? (
                <PressableScale
                  key={row.key}
                  accessibilityRole="button"
                  accessibilityLabel={translate("Tarik reaksi {x}", { x: row.emoji })}
                  onPress={() => {
                    onRemoveMine(message, row.emoji)
                    // Reaksi terakhir ditarik → sheet menutup sendiri lewat total === 0.
                  }}
                  containerClassName={cn("rounded-md", focusRing)}
                >
                  {content}
                </PressableScale>
              ) : (
                <View
                  key={row.key}
                  accessible
                  accessibilityLabel={translate("{x} bereaksi {y}", { x: row.name, y: row.emoji })}
                >
                  {content}
                </View>
              )
            })}
          </View>
        </View>
      )}
    </BottomSheet>
  )
}

function TabPill({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      containerClassName={cn("rounded-full", focusRing)}
      className={cn(
        "min-h-9 flex-row items-center rounded-full border px-3",
        selected ? "border-primary bg-primary" : "border-border bg-surface",
      )}
    >
      <Text variant="caption" weight={600} tone={selected ? "inverse" : "primary"}>
        {label}
      </Text>
    </PressableScale>
  )
}
