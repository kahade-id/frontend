/**
 * Kahade — <RangeSlider> (§9.5 kontrol; filter rentang nominal §9.25/§10).
 *
 * Dua thumb (min & max) di satu track. Visual identik dengan <Slider>: track
 * 4px `bg-border-control` (>= 3:1, WCAG 1.4.11 — lihat slider.tsx), fill
 * `bg-primary` HANYA di antara kedua thumb, thumb 24px
 * `bg-background` + border-focus 1.5px. Dipakai di sheet filter riwayat
 * transaksi ("Rp500.000 – Rp5.000.000").
 *
 * Kenapa file terpisah dari slider.tsx, bukan prop `range` (non-obvious):
 *   gesture-nya berbeda. Slider tunggal cukup memakai posisi jari di track
 *   (tap di mana pun = lompat ke sana). Dengan dua thumb, drag harus dihitung
 *   dari POSISI AWAL thumb + `translationX` (bukan posisi absolut, karena
 *   posisi relatif ke thumb yang ikut berpindah). Satu `Gesture.Pan()`
 *   dipasang per thumb, bukan di track — aturan "thumb yang disentuh yang
 *   bergerak" jadi eksplisit.
 *
 * Kenapa Reanimated + Gesture Handler, bukan PanResponder: alasan yang sama
 *   dengan <Slider> — posisi kedua thumb & fill adalah `useSharedValue` yang
 *   digerakkan worklet di UI thread, tidak menunggu re-render React. Parent
 *   menerima `onChange` lewat `runOnJS` hanya saat pasangan nilai ter-step
 *   berubah. Selama drag, shared value memimpin dan prop `value` yang datang
 *   balik dari onChange diabaikan (kalau tidak, thumb snap per frame).
 *
 * Keputusan non-obvious:
 *   - `minDistance` (default = `step`) menjaga kedua thumb tidak saling
 *     melewati; thumb min tidak bisa > thumb max - minDistance, dan sebaliknya.
 *     Dihitung di worklet dari nilai thumb LAIN yang juga shared value —
 *     jadi batas selalu memakai posisi terkini, bukan snapshot React.
 *   - Thumb yang sedang di-drag dinaikkan zIndex-nya (tokens.zIndex.sticky)
 *     lewat animated style supaya saat kedua thumb berdekatan, yang aktif
 *     tetap di atas. Sebelumnya ini dilakukan dengan menukar urutan render
 *     (re-render React); sekarang murni UI thread. Ini satu-satunya pemakaian
 *     z-index di komponen form, dan memakai skala §6.2.
 *   - `hitSlop` 10px di tiap thumb memperlebar target sentuh ke 44px tanpa
 *     memperbesar visual thumb (audit #1). Dipasang DUA kali dengan nilai
 *     sama: di `Gesture.Pan().hitSlop` (RNGH melakukan hit-test sendiri dan
 *     tidak membaca prop RN) dan di prop `hitSlop` Animated.View (web +
 *     fokus aksesibilitas).
 *   - `activeOffsetX` kecil: gerakan vertikal dominan gagal -> ScrollView
 *     parent (sheet filter) tetap bisa di-scroll dari atas thumb.
 *   - Dua elemen "adjustable" terpisah (min & max) untuk screen reader —
 *     satu kontrol dengan dua nilai tidak bisa dideskripsikan RN
 *     `accessibilityValue`.
 *   - Nilai runtime (px posisi, lebar fill) -> style. Sisanya className.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View, type LayoutChangeEvent, type ViewProps } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated"

import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { hitSlopToReach } from "@/lib/hit-slop"
import { tokens } from "@/lib/tokens"

export type RangeValue = readonly [number, number]

export type RangeSliderProps = Omit<ViewProps, "children"> & {
  value: RangeValue
  onChange: (value: [number, number]) => void
  /** Dipanggil saat jari dilepas — cocok untuk trigger fetch */
  onChangeEnd?: (value: [number, number]) => void
  min?: number
  max?: number
  step?: number
  /** Jarak minimum antar thumb (default = step) */
  minDistance?: number
  disabled?: boolean
  /** Label nilai di atas thumb saat drag (mis. formatRupiah) */
  formatValue?: (v: number) => string
  /** Label aksesibilitas kedua thumb */
  accessibilityLabels?: readonly [string, string]
  className?: string
}

// Geometri statis dari skala token (audit #10) — identik dengan slider.tsx.
const THUMB = tokens.space[6]
const TRACK_H = tokens.space[1]
const LABEL_MIN_W = THUMB + tokens.space[12]
// Perluas hit area thumb 24 -> 44 (tokens.a11y.minHitTarget)
const THUMB_HIT_SLOP = hitSlopToReach(THUMB)
const ACTIVE_OFFSET_X = 4

type ThumbIndex = 0 | 1

function snap(v: number, min: number, max: number, step: number) {
  "worklet"
  const stepped = Math.round((v - min) / step) * step + min
  return Math.min(max, Math.max(min, stepped))
}

export function RangeSlider({
  value,
  onChange,
  onChangeEnd,
  min = 0,
  max = 100,
  step = 1,
  minDistance,
  disabled = false,
  formatValue,
  accessibilityLabels = ["Nilai minimum", "Nilai maksimum"],
  className,
  ...rest
}: RangeSliderProps) {
  // `active` React state hanya untuk merender label nilai; posisi tidak.
  const [active, setActive] = useState<ThumbIndex | null>(null)
  const gap = minDistance ?? step
  const range = max > min ? max - min : 1

  const trackWidth = useSharedValue(0)
  // Nilai thumb (satuan domain, bukan ratio) — memudahkan aturan gap.
  const lo = useSharedValue(value[0])
  const hi = useSharedValue(value[1])
  const activeSV = useSharedValue<ThumbIndex | -1>(-1)
  const start = useSharedValue(0)
  const lastLo = useSharedValue(value[0])
  const lastHi = useSharedValue(value[1])

  useEffect(() => {
    if (activeSV.value === -1) {
      lo.value = value[0]
      hi.value = value[1]
      lastLo.value = value[0]
      lastHi.value = value[1]
    }
  }, [value, lo, hi, lastLo, lastHi, activeSV])

  const emitChange = useCallback((a: number, b: number) => onChange([a, b]), [onChange])
  const emitEnd = useCallback((a: number, b: number) => onChangeEnd?.([a, b]), [onChangeEnd])

  /** Versi JS untuk aksi aksesibilitas (increment/decrement). */
  const commitJS = useCallback(
    (which: ThumbIndex, raw: number) => {
      const [curLo, curHi] = value
      let v = snap(raw, min, max, step)
      v = which === 0 ? Math.min(v, curHi - gap) : Math.max(v, curLo + gap)
      v = Math.min(max, Math.max(min, v))
      const next: [number, number] = which === 0 ? [v, curHi] : [curLo, v]
      if (next[0] !== curLo || next[1] !== curHi) onChange(next)
    },
    [gap, max, min, onChange, step, value],
  )

  const makePan = useCallback(
    (which: ThumbIndex) =>
      Gesture.Pan()
        .enabled(!disabled)
        .activeOffsetX([-ACTIVE_OFFSET_X, ACTIVE_OFFSET_X])
        .hitSlop(THUMB_HIT_SLOP)
        .shouldCancelWhenOutside(false)
        .onBegin(() => {
          activeSV.value = which
          start.value = which === 0 ? lo.value : hi.value
          runOnJS(setActive)(which)
        })
        .onUpdate((e) => {
          const w = trackWidth.value
          if (w <= 0) return
          const raw = start.value + (e.translationX / w) * range
          // Visual: clamp ke gap & range, TANPA snap ke step (1:1 dengan jari).
          let visual: number
          if (which === 0) visual = Math.min(Math.max(min, raw), hi.value - gap)
          else visual = Math.max(Math.min(max, raw), lo.value + gap)
          if (which === 0) lo.value = visual
          else hi.value = visual

          // Parent: nilai ter-step, emit hanya bila berubah.
          const v = snap(visual, min, max, step)
          const nextLo = which === 0 ? v : lastLo.value
          const nextHi = which === 0 ? lastHi.value : v
          if (nextLo !== lastLo.value || nextHi !== lastHi.value) {
            lastLo.value = nextLo
            lastHi.value = nextHi
            runOnJS(emitChange)(nextLo, nextHi)
          }
        })
        .onFinalize(() => {
          // Menetap di posisi step yang sama dengan nilai parent.
          lo.value = lastLo.value
          hi.value = lastHi.value
          activeSV.value = -1
          runOnJS(setActive)(null)
          runOnJS(emitEnd)(lastLo.value, lastHi.value)
        }),
    [activeSV, disabled, emitChange, emitEnd, gap, hi, lastHi, lastLo, lo, max, min, range, start, step, trackWidth],
  )

  const panLo = useMemo(() => makePan(0), [makePan])
  const panHi = useMemo(() => makePan(1), [makePan])

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.value = e.nativeEvent.layout.width
  }

  const fillStyle = useAnimatedStyle(() => {
    const w = trackWidth.value
    const x0 = ((lo.value - min) / range) * w
    const x1 = ((hi.value - min) / range) * w
    return { left: x0, width: Math.max(0, x1 - x0) }
  })

  return (
    <View
      className={cn("w-full justify-center py-3", disabled && "opacity-disabled", className)}
      {...rest}
    >
      {/* Area setinggi thumb; track diberi margin agar thumb tidak keluar tepi */}
      <View onLayout={onLayout} style={{ height: THUMB }} className="justify-center">
        <View className="w-full rounded-full bg-border-control" style={{ height: TRACK_H }}>
          <Animated.View style={[{ position: "absolute", height: "100%" }, fillStyle]}>
            <View className="h-full w-full rounded-full bg-primary" />
          </Animated.View>
        </View>

        <Thumb
          which={0}
          sv={lo}
          activeSV={activeSV}
          trackWidth={trackWidth}
          min={min}
          range={range}
          gesture={panLo}
          value={value[0]}
          showLabel={active === 0}
          formatValue={formatValue}
          accessibilityLabel={accessibilityLabels[0]}
          accessibilityRange={{ min, max }}
          step={step}
          onCommit={commitJS}
        />
        <Thumb
          which={1}
          sv={hi}
          activeSV={activeSV}
          trackWidth={trackWidth}
          min={min}
          range={range}
          gesture={panHi}
          value={value[1]}
          showLabel={active === 1}
          formatValue={formatValue}
          accessibilityLabel={accessibilityLabels[1]}
          accessibilityRange={{ min, max }}
          step={step}
          onCommit={commitJS}
        />
      </View>
    </View>
  )
}

// --- Thumb ------------------------------------------------------------------

type ThumbProps = {
  which: ThumbIndex
  sv: SharedValue<number>
  activeSV: SharedValue<ThumbIndex | -1>
  trackWidth: SharedValue<number>
  min: number
  range: number
  gesture: ReturnType<typeof Gesture.Pan>
  value: number
  showLabel: boolean
  formatValue?: (v: number) => string
  accessibilityLabel: string
  accessibilityRange: { min: number; max: number }
  step: number
  onCommit: (which: ThumbIndex, raw: number) => void
}

function Thumb({
  which,
  sv,
  activeSV,
  trackWidth,
  min,
  range,
  gesture,
  value,
  showLabel,
  formatValue,
  accessibilityLabel,
  accessibilityRange,
  step,
  onCommit,
}: ThumbProps) {
  const style = useAnimatedStyle(() => ({
    left: ((sv.value - min) / range) * trackWidth.value - THUMB / 2,
    zIndex: activeSV.value === which ? tokens.zIndex.sticky : tokens.zIndex.base,
  }))

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ ...accessibilityRange, now: value, text: formatValue?.(value) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "increment") onCommit(which, value + step)
          if (e.nativeEvent.actionName === "decrement") onCommit(which, value - step)
        }}
        hitSlop={THUMB_HIT_SLOP}
        style={[{ position: "absolute", width: THUMB, height: THUMB }, style]}
      >
        <View className="h-full w-full rounded-full border-focus border-border-focus bg-background" />
        {showLabel && formatValue ? (
          <View
            pointerEvents="none"
            className="absolute -top-8 items-center rounded-xs border border-border bg-surface-elevated px-2 py-1"
            style={{ left: THUMB / 2 - LABEL_MIN_W / 2, minWidth: LABEL_MIN_W }}
          >
            <Text variant="monoBody" tone="primary" numberOfLines={1}>
              {formatValue(value)}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  )
}
