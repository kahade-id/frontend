/**
 * Kahade — <RangeSlider> (§9.5 kontrol; filter rentang nominal §9.25/§10).
 *
 * Dua thumb (min & max) di satu track. Visual identik dengan <Slider>: track
 * 4px `bg-border`, fill `bg-primary` HANYA di antara kedua thumb, thumb 24px
 * `bg-background` + border-focus 1.5px. Dipakai di sheet filter riwayat
 * transaksi ("Rp500.000 – Rp5.000.000").
 *
 * Kenapa file terpisah dari slider.tsx, bukan prop `range` (non-obvious):
 *   gesture-nya berbeda. Slider tunggal cukup memakai `locationX` di track
 *   (tap di mana pun = lompat ke sana). Dengan dua thumb, tap di track harus
 *   memutuskan thumb mana yang bergerak, dan drag harus dihitung dari
 *   POSISI AWAL thumb + `dx` (bukan locationX, karena locationX relatif ke
 *   thumb yang ikut berpindah). PanResponder dipasang per thumb, bukan di
 *   track — aturan "thumb yang disentuh yang bergerak" jadi eksplisit.
 *
 * Keputusan non-obvious:
 *   - `minDistance` (default = `step`) menjaga kedua thumb tidak saling
 *     melewati; thumb min tidak bisa > thumb max - minDistance, dan sebaliknya.
 *   - Thumb yang sedang di-drag dinaikkan z-index-nya (`z-sticky`) supaya
 *     saat kedua thumb berdekatan, yang aktif tetap di atas. Ini satu-satunya
 *     pemakaian z-index di komponen form, dan memakai token skala §6.2.
 *   - `hitSlop` 10px di tiap thumb memperlebar target sentuh ke 44px tanpa
 *     memperbesar visual thumb.
 *   - Dua elemen "adjustable" terpisah (min & max) untuk screen reader —
 *     satu kontrol dengan dua nilai tidak bisa dideskripsikan RN
 *     `accessibilityValue`.
 *   - Nilai runtime (px posisi, lebar fill) -> style. Sisanya className.
 */
import { useCallback, useMemo, useRef, useState } from "react"
import { PanResponder, View, type LayoutChangeEvent, type ViewProps } from "react-native"

import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

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

const THUMB = 24
const TRACK_H = 4
// Perluas hit area thumb 24 -> 44 (target sentuh minimum)
const THUMB_HIT_SLOP = (44 - THUMB) / 2

type ThumbIndex = 0 | 1

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
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<ThumbIndex | null>(null)

  const widthRef = useRef(0)
  const valueRef = useRef<RangeValue>(value)
  valueRef.current = value
  const startRef = useRef(0)

  const gap = minDistance ?? step

  const clamp = useCallback(
    (v: number) => {
      const stepped = Math.round((v - min) / step) * step + min
      return Math.min(max, Math.max(min, stepped))
    },
    [max, min, step],
  )

  /** Terapkan batas antar-thumb lalu emit bila berubah */
  const commit = useCallback(
    (which: ThumbIndex, raw: number) => {
      const [lo, hi] = valueRef.current
      let v = clamp(raw)
      if (which === 0) v = Math.min(v, hi - gap)
      else v = Math.max(v, lo + gap)
      v = Math.min(max, Math.max(min, v))
      const next: [number, number] = which === 0 ? [v, hi] : [lo, v]
      if (next[0] !== lo || next[1] !== hi) onChange(next)
    },
    [clamp, gap, max, min, onChange],
  )

  const makePan = useCallback(
    (which: ThumbIndex) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: () => {
          startRef.current = valueRef.current[which]
          setActive(which)
        },
        onPanResponderMove: (_, g) => {
          if (widthRef.current <= 0) return
          const delta = (g.dx / widthRef.current) * (max - min)
          commit(which, startRef.current + delta)
        },
        onPanResponderRelease: () => {
          setActive(null)
          onChangeEnd?.([valueRef.current[0], valueRef.current[1]])
        },
        onPanResponderTerminate: () => setActive(null),
      }),
    [commit, disabled, max, min, onChangeEnd],
  )

  const panLo = useMemo(() => makePan(0), [makePan])
  const panHi = useMemo(() => makePan(1), [makePan])

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width
    setWidth(e.nativeEvent.layout.width)
  }

  const toRatio = (v: number) => (max > min ? (v - min) / (max - min) : 0)
  const loX = toRatio(value[0]) * width
  const hiX = toRatio(value[1]) * width

  const renderThumb = (which: ThumbIndex) => {
    const x = which === 0 ? loX : hiX
    const v = value[which]
    const isActive = active === which
    const pan = which === 0 ? panLo : panHi

    return (
      <View
        key={which}
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabels[which]}
        accessibilityValue={{ min, max, now: v, text: formatValue?.(v) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "increment") commit(which, v + step)
          if (e.nativeEvent.actionName === "decrement") commit(which, v - step)
        }}
        hitSlop={THUMB_HIT_SLOP}
        className={cn(
          "absolute rounded-full border-focus border-border-focus bg-background",
          isActive && "z-sticky",
        )}
        style={{ width: THUMB, height: THUMB, left: x - THUMB / 2 }}
        {...pan.panHandlers}
      >
        {isActive && formatValue ? (
          <View
            pointerEvents="none"
            className="absolute -top-8 items-center rounded-xs border border-border bg-surface-elevated px-2 py-1"
            style={{ left: THUMB / 2 - (THUMB + 48) / 2, minWidth: THUMB + 48 }}
          >
            <Text variant="monoBody" tone="primary" numberOfLines={1}>
              {formatValue(v)}
            </Text>
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <View
      className={cn("w-full justify-center py-3", disabled && "opacity-disabled", className)}
      {...rest}
    >
      {/* Area setinggi thumb; track diberi margin agar thumb tidak keluar tepi */}
      <View onLayout={onLayout} style={{ height: THUMB }} className="justify-center">
        <View className="w-full rounded-full bg-border" style={{ height: TRACK_H }}>
          <View
            className="absolute h-full rounded-full bg-primary"
            style={{ left: loX, width: Math.max(0, hiX - loX) }}
          />
        </View>
        {/* Thumb non-aktif dirender dulu supaya yang aktif di atas */}
        {active === 0 ? [renderThumb(1), renderThumb(0)] : [renderThumb(0), renderThumb(1)]}
      </View>
    </View>
  )
}
