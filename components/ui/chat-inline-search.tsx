/**
 * Kahade — bar pencarian keyword di dalam thread chat (client-side).
 *
 * Dipasang di bawah <ChatRoomHeader> saat ikon cari diketuk. Mencari HANYA di
 * pesan yang sudah dimuat (`lib/chat-search.ts`), tanpa endpoint baru:
 * - Kolom kata kunci (min. 2 karakter).
 * - Chip "3 dari 12" + tombol atas/bawah untuk melompat antar hasil.
 * - Semua hasil di-highlight di thread; hasil aktif ditandai lebih tegas.
 *
 * Berbeda peran dengan <ChatSearchSheet> (mencari SELURUH riwayat via
 * server): ini untuk "cari cepat di yang terlihat", ala Ctrl+F browser.
 */
import { CaretDown, CaretUp, MagnifyingGlass, X } from "phosphor-react-native"
import { useEffect, useRef } from "react"
import { TextInput, View } from "react-native"

import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { useTheme } from "@/components/theme-provider"
import { matchCounterLabel } from "@/lib/chat-search"
import { translate, useLanguage } from "@/lib/i18n"
import { tokens } from "@/lib/tokens"

export type ChatInlineSearchBarProps = {
  query: string
  onQueryChange: (query: string) => void
  /** Id pesan yang cocok, dalam urutan thread. */
  matches: string[]
  /** Posisi hasil aktif (0-based); -1 bila tidak ada. */
  activeIndex: number
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}

export function ChatInlineSearchBar({
  query,
  onQueryChange,
  matches,
  activeIndex,
  onPrev,
  onNext,
  onClose,
}: ChatInlineSearchBarProps) {
  // Placeholder dibaca TextInput native → langganan bahasa.
  useLanguage()
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const inputRef = useRef<TextInput>(null)
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const hasQuery = query.trim().length >= 2
  const counter = matchCounterLabel(activeIndex, matches.length)
  const stepDisabled = matches.length === 0

  const stepLabel = (dir: "prev" | "next") =>
    translate(dir === "prev" ? "Hasil sebelumnya" : "Hasil berikutnya")

  return (
    <View
      className="flex-row items-center gap-1 border-b border-border bg-surface px-3 py-2"
      accessibilityRole="search"
      accessibilityLabel={translate("Cari di percakapan")}
    >
      <Icon icon={MagnifyingGlass} tone="default" size="sm" />
      <TextInput
        ref={inputRef}
        value={query}
        onChangeText={onQueryChange}
        placeholder={translate("Cari di percakapan")}
        placeholderTextColor={palette.textSecondary}
        selectionColor={palette.primary}
        cursorColor={palette.primary}
        allowFontScaling={false}
        returnKeyType="search"
        accessibilityLabel={translate("Kata kunci pencarian")}
        className="min-h-10 flex-1 font-sans-400 text-bodyLarge text-text-primary"
      />
      {hasQuery ? (
        <Text
          variant="caption"
          tone={matches.length > 0 ? "secondary" : "danger"}
          className="tabular-nums"
          accessibilityLiveRegion="polite"
        >
          {matches.length > 0 ? counter : translate("Tidak ada hasil")}
        </Text>
      ) : null}
      <IconButton
        icon={CaretUp}
        variant="ghost"
        size="sm"
        accessibilityLabel={stepLabel("prev")}
        onPress={onPrev}
        disabled={stepDisabled}
      />
      <IconButton
        icon={CaretDown}
        variant="ghost"
        size="sm"
        accessibilityLabel={stepLabel("next")}
        onPress={onNext}
        disabled={stepDisabled}
      />
      <IconButton
        icon={X}
        variant="ghost"
        size="sm"
        accessibilityLabel={translate("Tutup pencarian")}
        onPress={onClose}
      />
    </View>
  )
}
