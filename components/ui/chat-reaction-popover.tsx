/**
 * Kahade — <ChatReactionPopover>: pemilih emoji MENGAMBANG (popover).
 *
 * Revisi 2026-09-27 (keluhan pemakaian nyata, TIM CHAT): pemilih reaksi
 * sebelumnya adalah satu BARIS PENUH di header mode-pilih (SelectionBar) —
 * jauh dari bubble yang ditekan dan menutupi/menggeser konten di atas.
 * Kini ia pil kecil yang mengambang TEPAT DI DEKAT bubble (di atasnya bila
 * muat, else di bawahnya — `placeReactionPopover` di `@/lib/chat-bubble`),
 * dengan backdrop TRANSPARAN tanpa dim: layar di belakangnya tetap terlihat
 * penuh ("tidak menutupi layar"); ketukan di luar pil menutupnya.
 *
 * Pemakaian: layar ruang chat mengisinya saat tekan lama pada bubble
 * (`onLongPressAt` → jangkar `measureInWindow`). Pilihan emoji → `onPick`
 * (layar yang memutuskan: bereaksi + keluar mode pilih).
 */
import { useState } from "react"
import { Modal, Pressable, useWindowDimensions, View } from "react-native"

import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n"
import {
  REACTION_POPOVER_EST_WIDTH,
  placeReactionPopover,
  type ChatBubbleAnchor,
} from "@/lib/chat-bubble"

export type ChatReactionPopoverProps = {
  /**
   * Target aktif: jangkar bubble yang ditekan lama. `null` = popover
   * tertutup (Modal tidak di-mount).
   */
  target: { anchor: ChatBubbleAnchor } | null
  /** Deretan emoji — `QUICK_REACTIONS` dari `@/lib/api/chat`. */
  emojis: readonly string[]
  /** Emoji dipilih — backdrop tetap transparan sampai pemanggil menutup. */
  onPick: (emoji: string) => void
  /** Ketuk di luar pil / tombol kembali — tutup popover. */
  onDismiss: () => void
}

export function ChatReactionPopover({
  target,
  emojis,
  onPick,
  onDismiss,
}: ChatReactionPopoverProps) {
  const { width: winW, height: winH } = useWindowDimensions()
  // Lebar pil diukur setelah mount (jumlah emoji bisa berubah); estimasi
  // dipakai untuk frame pertama supaya tidak berkedip di pojok.
  const [measuredW, setMeasuredW] = useState(REACTION_POPOVER_EST_WIDTH)

  if (!target) return null

  const { top, left } = placeReactionPopover(target.anchor, winW, winH, measuredW)

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={onDismiss}
      // Android: koordinat Modal = window penuh (di bawah status bar) —
      // cocok dengan `measureInWindow` yang dipakai untuk jangkar.
      statusBarTranslucent
    >
      {/* Backdrop transparan TANPA dim — layar tetap terlihat penuh;
          ketukan di luar pil menutup popover (tanpa mengubah pilihan). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tutup pemilih reaksi"
        onPress={onDismiss}
        className="flex-1"
      />
      <View
        testID="reaction-popover"
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width
          if (w > 0 && Math.abs(w - measuredW) > 1) setMeasuredW(w)
        }}
        style={{ position: "absolute", top, left }}
        className="flex-row items-center gap-0.5 rounded-full border border-border bg-surface-elevated px-2 py-1.5 shadow-lg"
      >
        {emojis.map((emoji) => (
          <PressableScale
            key={emoji}
            accessibilityRole="button"
            // translate(): template literal di atribut JSX tidak terbaca
            // generator katalog i18n — label dinamis wajib dibungkus.
            accessibilityLabel={translate(`Reaksi ${emoji}`)}
            scaleOnPress={false}
            onPress={() => onPick(emoji)}
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <Text variant="h3">{emoji}</Text>
          </PressableScale>
        ))}
      </View>
    </Modal>
  )
}
