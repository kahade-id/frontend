/**
 * Kahade — <Slider> (§9.5 kontrol, pelengkap filter rentang nominal).
 *
 * Slider nilai tunggal: track 4px `bg-border` rounded-full, fill `bg-primary`,
 * thumb 24px `bg-background` + border-focus 1.5px (bukan solid hitam, supaya
 * thumb terlihat "di atas" fill tanpa shadow — hierarki dari border §6).
 *
 * Kenapa PanResponder RN dan bukan reanimated/gesture-handler (non-obvious):
 *   Slider tidak butuh spring physics; PanResponder sudah cukup di ketiga
 *   platform dan menjaga komponen ini bebas dependensi berat. Bottom sheet &
 *   pull-to-refresh yang butuh gesture kompleks tetap pakai reanimated.
 *   Posisi thumb adalah nilai runtime (px dari lebar track) -> style, bukan
 *   className.
 *
 * `step` membulatkan nilai; `formatValue` menampilkan label di atas thumb
 * saat drag (mis. formatRupiah) — Mono Body karena itu angka data (§3.1).
 * Aksesibilitas: role adjustable + accessibilityActions increment/decrement.
 */
import { useCallback, useMemo, useRef, useState } from "react"
import { PanResponder, View, type LayoutChangeEvent, type ViewProps } from "react-native"

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
  const [width, setWidth] = useState(0)
  const [dragging, setDragging] = useState(false)
  const widthRef = useRef(0)
  const valueRef = useRef(value)
  valueRef.current = value

  const clamp = useCallback(
    (v: number) => {
      const stepped = Math.round((v - min) / step) * step + min
      return Math.min(max, Math.max(min, stepped))
    },
    [max, min, step],
  )

  const fromX = useCallback(
    (x: number) => clamp(min + (Math.min(Math.max(x, 0), widthRef.current) / widthRef.current) * (max - min)),
    [clamp, max, min],
  )

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (e) => {
          setDragging(true)
          onChange(fromX(e.nativeEvent.locationX))
        },
        onPanResponderMove: (e) => onChange(fromX(e.nativeEvent.locationX)),
        onPanResponderRelease: () => {
          setDragging(false)
          onChangeEnd?.(valueRef.current)
        },
        onPanResponderTerminate: () => setDragging(false),
      }),
    [disabled, fromX, onChange, onChangeEnd],
  )

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width
    setWidth(e.nativeEvent.layout.width)
  }

  const ratio = max > min ? (value - min) / (max - min) : 0
  const thumbX = Math.max(0, ratio * width - THUMB / 2)

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
      {/* Hit area penuh setinggi thumb */}
      <View onLayout={onLayout} style={{ height: THUMB }} className="justify-center" {...pan.panHandlers}>
        <View className="w-full rounded-full bg-border" style={{ height: TRACK_H }}>
          <View className="h-full rounded-full bg-primary" style={{ width: ratio * width }} />
        </View>
        <View
          pointerEvents="none"
          className="absolute rounded-full border-focus border-border-focus bg-background"
          style={{ width: THUMB, height: THUMB, left: thumbX }}
        />
        {dragging && formatValue ? (
          <View
            pointerEvents="none"
            className="absolute -top-8 items-center rounded-xs border border-border bg-surface-elevated px-2 py-1"
            style={{ left: thumbX - 24, minWidth: THUMB + 48 }}
          >
            <Text variant="monoBody" tone="primary" numberOfLines={1}>
              {formatValue(value)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
