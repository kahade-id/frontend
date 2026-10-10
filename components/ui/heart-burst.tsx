/**
 * UX-06 (audit etalase 2026-10-10): semburan hati ketuk-ganda yang DIBAGI —
 * kartu feed, galeri layar detail, dan viewer layar penuh memakai animasi
 * yang sama (dulu hanya kartu feed; di detail tidak ada umpan balik, dan di
 * viewer hati meledak di kartu yang tertutup modal).
 */
import { useCallback, useState, type ComponentProps } from "react"
import { View } from "react-native"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import { Heart } from "phosphor-react-native"

import { Icon } from "@/components/ui/icon"
import { useReducedMotion } from "@/lib/use-reduced-motion"

/** Tipe style yang diterima Animated.View (hasil useAnimatedStyle). */
export type HeartBurstStyle = ComponentProps<typeof Animated.View>["style"]

export type HeartBurstState = {
  visible: boolean
  style: HeartBurstStyle
  /** Mainkan semburan (no-op saat reduced motion). Identitas stabil. */
  play: () => void
}

export function useHeartBurst(): HeartBurstState {
  const reducedMotion = useReducedMotion()
  const [visible, setVisible] = useState(false)
  const scale = useSharedValue(0)
  const opacity = useSharedValue(0)
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))
  const play = useCallback(() => {
    if (reducedMotion) return
    setVisible(true)
    scale.value = 0
    opacity.value = 1
    scale.value = withSequence(withTiming(1.25, { duration: 160 }), withTiming(1, { duration: 120 }))
    // Tahan sekejap lalu memudar; unmount via JS agar state konsisten.
    opacity.value = withDelay(
      450,
      withTiming(0, { duration: 220 }, (finished) => {
        if (finished) runOnJS(setVisible)(false)
      }),
    )
  }, [reducedMotion, scale, opacity])
  return { visible, style, play }
}

/** Overlay hati di tengah kontainer induk (induk harus punya ukuran). */
export function HeartBurst({ visible, style, size = 84 }: { visible: boolean; style: HeartBurstStyle; size?: number }) {
  if (!visible) return null
  return (
    <View
      style={{ pointerEvents: "none" }}
      className="absolute inset-0 items-center justify-center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={style}>
        {/* Hati merah = bahasa suka aplikasi (LikeAction); merah cukup
            terbaca di atas foto tanpa scrim tambahan. */}
        <Icon icon={Heart} weight="fill" tone="danger" size={size} />
      </Animated.View>
    </View>
  )
}
