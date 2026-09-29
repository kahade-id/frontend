/**
 * Kahade — baris pesan terpin di atas thread percakapan.
 *
 * Kenapa SATU baris (bukan deretan chip horizontal yang bisa digulir):
 *   - Chip scroll tidak terlihat bisa digulir, jadi pin ke-2 dan seterusnya
 *     praktis tidak pernah ditemukan; satu baris dengan penghitung "2" lebih
 *     jujur.
 *   - Tinggi baris yang KONSTAN penting untuk jangkar scroll: baris ini
 *     dirender di atas FlatList, jadi setiap perubahan tingginya menggeser
 *     seluruh thread (bug "pin membuat chat turun"). Tinggi diukur lewat
 *     `onLayout` dan dilaporkan ke layar untuk dikompensasi.
 *
 * Interaksi: ketuk = lompat ke pesannya; tekan lama = lepas pin (jalan keluar
 * yang sama dengan aksi "Lepas pin" di baris mode pilih).
 */
import { memo, useCallback } from "react"
import { View, type LayoutChangeEvent } from "react-native"
import { translate } from "@/lib/i18n/translate"

import { CaretDown, PushPin } from "phosphor-react-native"

import type { ChatMessage } from "@/lib/api/chat"
import { nonTextMessageLabel } from "@/lib/api/chat"
import { cn } from "@/lib/cn"
import { focusRingInset } from "@/lib/focus-ring"

import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"

export type ChatPinnedBarProps = {
  /** Pesan terpin terbaru — yang ditampilkan baris ini. */
  message: ChatMessage
  /** Jumlah seluruh pesan terpin di ruang (badge bila > 1). */
  count: number
  /** Lompat ke pesan terpin di thread. */
  onPress: (message: ChatMessage) => void
  /** Tekan lama: lepas pin. */
  onUnpin: (message: ChatMessage) => void
  /** Tinggi baris terukur — dipakai layar menjaga jangkar scroll. */
  onLayout?: (event: LayoutChangeEvent) => void
}

// FE-059 (audit 2026-09-29): di-memo — layar menstabilkan onPress/onUnpin/onLayout.
export const ChatPinnedBar = memo(function ChatPinnedBar({
  message,
  count,
  onPress,
  onUnpin,
  onLayout,
}: ChatPinnedBarProps) {
  // UI-C009: label "(lampiran)" ikut katalog i18n — sheet pencarian sudah
  // menerjemahkannya; baris pin tidak boleh memakai string mentah.
  // CHT-011: label konsisten antar permukaan via nonTextMessageLabel
  // (lampiran → "(lampiran)"; lokasi/kartu → label spesifiknya).
  const preview = message.text?.trim() || translate(nonTextMessageLabel(message.messageType))
  // FE-059: closure stabil — bukan inline per render.
  const handlePress = useCallback(() => onPress(message), [onPress, message])
  const handleLongPress = useCallback(() => onUnpin(message), [onUnpin, message])

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={translate("Pesan terpin: {x}", { x: preview })}
      accessibilityHint="Membuka pesan terpin di percakapan, atau tekan lama untuk melepas pin"
      scaleOnPress={false}
      ripple
      onPress={handlePress}
      onLongPress={handleLongPress}
      onLayout={onLayout}
      containerClassName={cn("w-full border-b border-border bg-surface", focusRingInset)}
      // min-h-11: tinggi minimum = target sentuh; isi 2 baris caption tetap
      // muat tanpa mengubah tinggi saat hanya ada satu pesan terpin.
      className="min-h-11 w-full flex-row items-center gap-2 px-4 py-2"
    >
      <Icon icon={PushPin} size="xs" tone="active" weight="fill" />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1">
          <Text variant="caption" weight={600} tone="primary" numberOfLines={1}>
            Pesan terpin
          </Text>
          {count > 1 ? (
            <Text variant="caption" tone="secondary" className="tabular-nums">
              {count}
            </Text>
          ) : null}
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {preview}
        </Text>
      </View>
      <Icon icon={CaretDown} size="xs" tone="default" />
    </PressableScale>
  )
})
