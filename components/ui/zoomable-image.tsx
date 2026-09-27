/**
 * Kahade — <ZoomableImage>: gambar dengan pinch-to-zoom + ketuk-ganda.
 *
 * Dipakai viewer lampiran sengketa (GAP-B3, G137): bukti foto (mis. kerusakan
 * barang) perlu diperbesar untuk diperiksa. Dibangun di atas
 * react-native-gesture-handler (Pinch + Tap) + reanimated shared values —
 * keduanya sudah ada di dependensi.
 *
 * Perilaku:
 * - Cubit: skala 1–4× (dijepit; di bawah 1× tidak boleh — gambar tidak boleh
 *   lebih kecil dari bingkai).
 * - Ketuk ganda: toggle 1× ↔ 2.5×.
 * - Saat diperbesar, geser satu jari menggeser gambar (dijepit agar tidak
 *   lepas dari bingkai).
 * - Reset saat `source` berganti (navigasi antar lampiran).
 */
import { useEffect, useRef } from "react"
import { StyleSheet } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

import { Picture } from "@/components/ui/picture"

const MIN_SCALE = 1
const MAX_SCALE = 4
const DOUBLE_TAP_SCALE = 2.5

export function ZoomableImage({
  source,
  alt = "",
  width,
  height,
  onZoomChange,
  resizeMode = "cover",
}: {
  source: string
  alt?: string
  width: number
  height: number
  /**
   * Dipanggil saat status zoom berubah (melewati 1×). Dipakai pager induk
   * untuk menonaktifkan swipe antar foto selama gambar diperbesar — kalau
   * tidak, geser satu jari berebut antara pan gambar vs pindah slide.
   */
  onZoomChange?: (zoomed: boolean) => void
  /** "contain" untuk viewer layar penuh; default "cover" (perilaku lama). */
  resizeMode?: "cover" | "contain"
}) {
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedX = useSharedValue(0)
  const savedY = useSharedValue(0)
  const onZoomChangeRef = useRef(onZoomChange)
  onZoomChangeRef.current = onZoomChange
  const zoomedRef = useRef(false)
  /** Hanya panggil JS saat status zoom benar-benar berubah (hindari spam). */
  const notifyZoom = (s: number) => {
    const zoomed = s > MIN_SCALE + 0.01
    if (zoomed !== zoomedRef.current) {
      zoomedRef.current = zoomed
      onZoomChangeRef.current?.(zoomed)
    }
  }

  // Ganti lampiran → reset zoom.
  useEffect(() => {
    scale.value = MIN_SCALE
    savedScale.value = MIN_SCALE
    translateX.value = 0
    translateY.value = 0
    savedX.value = 0
    savedY.value = 0
    zoomedRef.current = false
    onZoomChangeRef.current?.(false)
  }, [source, scale, savedScale, translateX, translateY, savedX, savedY])

  const clampPan = (s: number, tx: number, ty: number) => {
    // Batas geser: tepi gambar tidak boleh masuk ke dalam bingkai.
    const boundX = Math.max(0, ((s - 1) * width) / 2)
    const boundY = Math.max(0, ((s - 1) * height) / 2)
    return {
      x: Math.min(boundX, Math.max(-boundX, tx)),
      y: Math.min(boundY, Math.max(-boundY, ty)),
    }
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * e.scale))
      scale.value = next
      const clamped = clampPan(next, translateX.value, translateY.value)
      translateX.value = clamped.x
      translateY.value = clamped.y
    })
    .onEnd(() => {
      savedScale.value = scale.value
      savedX.value = translateX.value
      savedY.value = translateY.value
      if (scale.value <= MIN_SCALE + 0.01) {
        scale.value = withTiming(MIN_SCALE)
        translateX.value = withTiming(0)
        translateY.value = withTiming(0)
        savedScale.value = MIN_SCALE
        savedX.value = 0
        savedY.value = 0
      }
      runOnJS(notifyZoom)(scale.value)
    })

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value <= MIN_SCALE) return
      const clamped = clampPan(scale.value, savedX.value + e.translationX, savedY.value + e.translationY)
      translateX.value = clamped.x
      translateY.value = clamped.y
    })
    .onEnd(() => {
      savedX.value = translateX.value
      savedY.value = translateY.value
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomed = scale.value > MIN_SCALE + 0.01
      const target = zoomed ? MIN_SCALE : DOUBLE_TAP_SCALE
      scale.value = withTiming(target)
      savedScale.value = target
      translateX.value = withTiming(0)
      translateY.value = withTiming(0)
      savedX.value = 0
      savedY.value = 0
      runOnJS(notifyZoom)(target)
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <Animated.View
        style={[styles.frame, { width, height }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={alt || "Gambar lampiran — cubit untuk memperbesar"}
      >
        <Animated.View style={animatedStyle}>
          <Picture source={source} alt={alt} width={width} height={height} radius="none" bordered={false} resizeMode={resizeMode} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
})
