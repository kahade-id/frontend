/**
 * Kahade — <Slider> (§9.5 kontrol, pelengkap filter rentang nominal).
 *
 * Slider nilai tunggal: track 4px `bg-border` rounded-full, fill `bg-primary`,
 * thumb 24px `bg-background` + border-focus 1.5px (bukan solid hitam, supaya
 * thumb terlihat "di atas" fill tanpa shadow — hierarki dari border §6).
 *
 * Kenapa Reanimated + Gesture Handler, bukan PanResponder (non-obvious):
 *   Dengan PanResponder, setiap gerakan jari = setState -> re-render React ->
 *   thumb bergerak SETELAH JS thread selesai. Saat JS sibuk (fetch, parsing
 *   riwayat transaksi) thumb tertinggal dari jari. Sekarang posisi thumb &
 *   lebar fill adalah `useSharedValue` yang diubah langsung di UI thread oleh
 *   worklet `Gesture.Pan()`; React sama sekali tidak terlibat dalam gerakan
 *   visual. `onChange` ke parent tetap dipanggil (untuk label/format nilai)
 *   lewat `runOnJS`, dan HANYA saat nilai ter-step berubah — bukan setiap
 *   frame — sehingga label tidak membanjiri JS thread dan drag tidak pernah
 *   menunggu parent.
 *
 *   Konsekuensi arsitektural: parent `value` adalah "sumber kebenaran" hanya
 *   saat TIDAK sedang drag (mis. reset filter dari luar). Selama drag, shared
 *   value memimpin dan prop `value` yang datang balik dari onChange diabaikan
 *   — kalau tidak, thumb akan "snap" ke posisi step setiap frame dan terasa
 *   patah-patah.
 *
 * Gesture: `Gesture.Pan()` dengan `activeOffsetX` kecil supaya slider yang
 * hidup di dalam ScrollView vertikal (sheet filter) tidak merebut scroll:
 * gerakan dominan vertikal -> gagal -> ScrollView menang. Tap tanpa geser
 * tetap "lompat ke posisi" karena posisi di-set di `onBegin`, bukan
 * menunggu aktivasi.
 *
 * `step` membulatkan nilai; `formatValue` menampilkan label di atas thumb
 * saat drag (mis. formatRupiah) — Mono Body karena itu angka data (§3.1).
 * Aksesibilitas: role adjustable + accessibilityActions increment/decrement.
 *
 * `Animated.View` (reanimated) tidak di-interop NativeWind -> className ada
 * di <View> anak; Animated.View hanya membawa style runtime (left/width).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View, type LayoutChangeEvent, type ViewProps } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated"

import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type SliderProps = Omit<ViewProps, "children"> & {
  value: number
  onChange: (value: number) => void
  /** Dipanggil saat jari dilepas — cocok untuk trigger fetch */
  onChangeEnd?: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  /** Label nilai di atas thumb saat drag */
  formatValue?: (v: number) => string
  className?: string
}

const THUMB = 24
const TRACK_H = 4
const LABEL_MIN_W = THUMB + 48
/**
 * Gerakan horizontal (px) sebelum pan diklaim. Cukup kecil untuk terasa
 * instan, cukup besar agar scroll vertikal di parent tidak ikut tertahan.
 */
const ACTIVE_OFFSET_X = 4

/** Bulatkan ke step lalu clamp ke [min, max]. Worklet: dipanggil dari UI thread. */
function snap(v: number, min: number, max: number, step: number) {
  "worklet"
  const stepped = Math.round((v - min) / step) * step + min
  return Math.min(max, Math.max(min, stepped))
}

export function Slider({
  value,
  onChange,
  onChangeEnd,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  formatValue,
  className,
  ...rest
}: SliderProps) {
  const [dragging, setDragging] = useState(false)

  const range = max > min ? max - min : 1
  const toRatio = useCallback((v: number) => (v - min) / range, [min, range])

  // Shared values = state UI thread. `ratio` 0..1 (bukan px) supaya tidak
  // perlu dihitung ulang saat lebar track berubah (rotasi / resize web).
  const trackWidth = useSharedValue(0)
  const ratio = useSharedValue(toRatio(value))
  const isDragging = useSharedValue(false)
  const lastEmitted = useSharedValue(value)

  // Sinkron dari parent hanya saat tidak drag (lihat header file).
  useEffect(() => {
    if (!isDragging.value) {
      ratio.value = toRatio(value)
      lastEmitted.value = value
    }
  }, [value, toRatio, ratio, isDragging, lastEmitted])

  const clamp = useCallback((v: number) => snap(v, min, max, step), [max, min, step])

  const emitChange = useCallback((v: number) => onChange(v), [onChange])
  const emitEnd = useCallback((v: number) => onChangeEnd?.(v), [onChangeEnd])

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .activeOffsetX([-ACTIVE_OFFSET_X, ACTIVE_OFFSET_X])
        .shouldCancelWhenOutside(false)
        .onBegin((e) => {
          // Tap = lompat ke posisi; tidak menunggu aktivasi pan.
          isDragging.value = true
          runOnJS(setDragging)(true)
          const w = trackWidth.value
          if (w <= 0) return
          const r = Math.min(1, Math.max(0, e.x / w))
          ratio.value = r
          const v = snap(min + r * (max - min), min, max, step)
          if (v !== lastEmitted.value) {
            lastEmitted.value = v
            runOnJS(emitChange)(v)
          }
        })
        .onUpdate((e) => {
          const w = trackWidth.value
          if (w <= 0) return
          const r = Math.min(1, Math.max(0, e.x / w))
          // Visual mengikuti jari 1:1 (tanpa snap); parent menerima nilai ter-step.
          ratio.value = r
          const v = snap(min + r * (max - min), min, max, step)
          if (v !== lastEmitted.value) {
            lastEmitted.value = v
            runOnJS(emitChange)(v)
          }
        })
        .onFinalize(() => {
          // Saat lepas, thumb menetap di posisi step (sama seperti nilai parent).
          const v = lastEmitted.value
          ratio.value = max > min ? (v - min) / (max - min) : 0
          isDragging.value = false
          runOnJS(setDragging)(false)
          runOnJS(emitEnd)(v)
        }),
    [disabled, emitChange, emitEnd, isDragging, lastEmitted, max, min, ratio, step, trackWidth],
  )

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.value = e.nativeEvent.layout.width
  }

  const fillStyle = useAnimatedStyle(() => ({ width: ratio.value * trackWidth.value }))
  const thumbStyle = useAnimatedStyle(() => ({
    left: Math.max(0, ratio.value * trackWidth.value - THUMB / 2),
  }))
  const labelStyle = useAnimatedStyle(() => ({
    left: Math.max(0, ratio.value * trackWidth.value - THUMB / 2) - (LABEL_MIN_W - THUMB) / 2,
  }))

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value, text: formatValue?.(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "increment") onChange(clamp(value + step))
        if (e.nativeEvent.actionName === "decrement") onChange(clamp(value - step))
      }}
      className={cn("w-full justify-center py-3", disabled && "opacity-disabled", className)}
      {...rest}
    >
      <GestureDetector gesture={pan}>
        {/* Hit area penuh setinggi thumb */}
        <View onLayout={onLayout} style={{ height: THUMB }} className="justify-center">
          <View className="w-full rounded-full bg-border" style={{ height: TRACK_H }}>
            <Animated.View style={[{ height: "100%" }, fillStyle]}>
              <View className="h-full w-full rounded-full bg-primary" />
            </Animated.View>
          </View>

          <Animated.View
            pointerEvents="none"
            style={[{ position: "absolute", width: THUMB, height: THUMB }, thumbStyle]}
          >
            <View className="h-full w-full rounded-full border-focus border-border-focus bg-background" />
          </Animated.View>

          {dragging && formatValue ? (
            <Animated.View
              pointerEvents="none"
              style={[{ position: "absolute", top: -32, minWidth: LABEL_MIN_W }, labelStyle]}
            >
              <View className="items-center rounded-xs border border-border bg-surface-elevated px-2 py-1">
                <Text variant="monoBody" tone="primary" numberOfLines={1}>
                  {formatValue(value)}
                </Text>
              </View>
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  )
}
