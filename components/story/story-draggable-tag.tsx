/**
 * Kahade — tag produk yang bisa digeser di pratinjau story.
 *
 * Gesture pan memindahkan tag secara visual di UI thread (shared value). Saat
 * jari diangkat, posisi ternormalisasi (0..1) dikirim ke JS lewat `runOnJS` dan
 * disimpan di draft. Tombol × di dalam tag menghapusnya.
 *
 * Aturan worklet: `useAnimatedStyle` hanya membaca shared value; `onMove` hanya
 * dipanggil dari callback gesture via `runOnJS`.
 */
import { X } from "phosphor-react-native"
import { useCallback, useState } from "react"
import { Pressable, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated"

import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { clamp01 } from "@/lib/story/compose"
import { useT } from "@/lib/i18n"

export type DraggableTagProps = {
  productId: string
  title: string
  x: number
  y: number
  /** Lebar & tinggi pratinjau (px) — untuk normalisasi posisi. */
  width: number
  height: number
  onMove: (productId: string, x: number, y: number) => void
  onRemove: (productId: string) => void
}

export function StoryDraggableTag({ productId, title, x, y, width, height, onMove, onRemove }: DraggableTagProps) {
  const t = useT()
  const [dragging, setDragging] = useState(false)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }))

  const commit = useCallback(
    (nx: number, ny: number) => {
      setDragging(false)
      onMove(productId, clamp01(nx), clamp01(ny))
    },
    [onMove, productId],
  )

  const pan = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      runOnJS(setDragging)(true)
    })
    .onUpdate((e) => {
      tx.value = e.translationX
      ty.value = e.translationY
    })
    .onEnd((e) => {
      // Posisi awal (x/y ternormalisasi) + pergeseran jari, dinormalisasi lagi.
      const nx = (x * width + e.translationX) / Math.max(1, width)
      const ny = (y * height + e.translationY) / Math.max(1, height)
      tx.value = 0
      ty.value = 0
      runOnJS(commit)(nx, ny)
    })

  const left = x * width
  const top = y * height

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[{ position: "absolute", left, top, opacity: dragging ? 0.85 : 1 }, style]}
        accessibilityRole="adjustable"
        accessibilityLabel={t("Produk {name}, geser untuk memindahkan", { name: title || t("produk") })}
      >
        <View className="flex-row items-center gap-1 rounded-full bg-black/70 py-1.5 pl-3 pr-1">
          <Text variant="caption" weight={600} className="max-w-[140px] text-white" numberOfLines={1}>
            {title || t("Produk")}
          </Text>
          <Pressable
            onPress={() => onRemove(productId)}
            accessibilityRole="button"
            accessibilityLabel={t("Hapus tag {name}", { name: title || t("produk") })}
            hitSlop={8}
            className="h-6 w-6 items-center justify-center rounded-full"
          >
            <Icon icon={X} size="xs" tone="inverse" />
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  )
}
