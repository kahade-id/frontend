/**
 * Kahade — toolbar pemformatan teks chat (batch 43 FE-CHAT, 2026-09-28).
 *
 * Baris ikon B / I / mono / underline / spoiler / tautan di atas composer.
 * Murni tampilan: tap → `onFormat(format)`; parent (composer) yang
 * menerapkan `applyChatFormat` ke draft + seleksi via TextInput ref.
 */
import { memo } from "react"
import { Pressable, View } from "react-native"

import type { ChatTextFormat } from "@/lib/chat-format"

import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import {
  TextB,
  TextItalic,
  Code,
  TextUnderline,
  EyeSlash,
  Link as LinkIcon,
} from "phosphor-react-native"

const ITEMS: { format: ChatTextFormat; label: string; icon: typeof TextB }[] = [
  { format: "bold", label: "Tebal", icon: TextB },
  { format: "italic", label: "Miring", icon: TextItalic },
  { format: "mono", label: "Kode", icon: Code },
  { format: "underline", label: "Garis bawah", icon: TextUnderline },
  { format: "spoiler", label: "Spoiler", icon: EyeSlash },
  { format: "link", label: "Tautan", icon: LinkIcon },
]

export type ChatFormatBarProps = {
  onFormat: (format: ChatTextFormat) => void
}

export const ChatFormatBar = memo(function ChatFormatBar({ onFormat }: ChatFormatBarProps) {
  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Format teks"
      className="flex-row items-center border-t border-border bg-surface px-2 py-1"
    >
      {ITEMS.map((item) => (
        <Pressable
          key={item.format}
          onPress={() => onFormat(item.format)}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          accessibilityHint={`Terapkan format ${item.label} pada teks yang dipilih`}
          className="rounded-sm p-2"
        >
          <Icon icon={item.icon} size={18} tone="default" />
        </Pressable>
      ))}
      <Text variant="caption" tone="tertiary" className="ml-auto px-2">
        Pilih teks dulu
      </Text>
    </View>
  )
})
