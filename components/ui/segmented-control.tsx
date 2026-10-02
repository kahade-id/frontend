/**
 * Kahade — <SegmentedControl> (§9.16 Segmented Control).
 *
 * Toggle 2–4 opsi setara yang mengubah TAMPILAN data di tempat (mis.
 * "Sebagai Pembeli / Sebagai Penjual", "Bulan / Tahun"). Bukan untuk
 * navigasi konten panjang (pakai <Tabs>) dan bukan pilihan form yang
 * disimpan (pakai <RadioGroup>/<ChipGroup>).
 *
 * Keputusan non-obvious:
 *   - Container `rounded-md border border-border-control bg-surface p-[2px]`
 *     (outline kontrol, >= 3:1 — WCAG 1.4.11); satu indikator aktif bergerak
 *     dengan shared value Reanimated di UI thread, bukan berpindah background
 *     antar-segmen lewat render React.
 *   - Radius segmen `rounded-sm` (6px) di dalam container 8px: selisih 2px =
 *     padding, sehingga sudut dalam tampak konsentris.
 *   - Tinggi container 44px (parent `min-h-11`); isi segmen 38px setelah
 *     border 1px + padding 2px di tiap sisi. Angka layout dan kelas sekarang
 *     cocok di Yoga Android/iOS, tanpa parent yang tumbuh diam-diam.
 *   - Semantik a11y `radiogroup`/`radio` tetap dipertahankan; target sentuh
 *     vertikal minimal 44px memakai hitSlop tanpa mengubah geometri visual.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { I18nManager, View, type LayoutChangeEvent, type ViewProps } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRingInset } from "@/lib/focus-ring"
import { translateProp } from "@/lib/i18n"
import { hitSlopToReach } from "@/lib/hit-slop"
import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"

const CONTAINER_H = tokens.space[10] + tokens.space["0.5"] * 2
const CONTAINER_BORDER = tokens.borderWidth.control
const SEGMENT_PAD = tokens.radius.md - tokens.radius.sm
const SEGMENT_INSET = CONTAINER_BORDER + SEGMENT_PAD
const SEGMENT_H = CONTAINER_H - SEGMENT_INSET * 2
const CONTAINER_HIT_SLOP = hitSlopToReach(0, CONTAINER_H)
const SEGMENT_HIT_SLOP = hitSlopToReach(0, SEGMENT_H)
const INDICATOR_DURATION = tokens.motion.duration.fast

export type SegmentItem<V extends string = string> = {
  value: V
  label: string
  icon?: IconComponent
  disabled?: boolean
}

export type SegmentedControlProps<V extends string = string> = Omit<ViewProps, "children"> & {
  items: readonly SegmentItem<V>[]
  value: V
  onChange: (value: V) => void
  disabled?: boolean
  /** F-08: nama grup ("Metode bayar") supaya pilihan dibacakan sebagai satu grup. */
  accessibilityLabel?: string
  className?: string
}

export function SegmentedControl<V extends string = string>({
  items,
  value,
  onChange,
  disabled = false,
  accessibilityLabel,
  className,
  onLayout,
  ...rest
}: SegmentedControlProps<V>) {
  const reducedMotion = useReducedMotion()
  const [containerWidth, setContainerWidth] = useState(0)
  const activeIndex = items.findIndex((item) => item.value === value)
  const visualIndex =
    activeIndex < 0 ? 0 : I18nManager.isRTL ? items.length - activeIndex - 1 : activeIndex
  const segmentWidth =
    items.length > 0
      ? Math.max(0, (containerWidth - SEGMENT_INSET * 2) / items.length)
      : 0
  const indicatorX = useSharedValue(0)
  const indicatorInitialized = useRef(false)

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width
      setContainerWidth((previous) => (previous === width ? previous : width))
      onLayout?.(event)
    },
    [onLayout],
  )

  useEffect(() => {
    const nextX = visualIndex * segmentWidth
    if (reducedMotion || containerWidth === 0 || !indicatorInitialized.current) {
      indicatorX.value = nextX
      if (containerWidth > 0) indicatorInitialized.current = true
      return
    }
    indicatorX.value = withTiming(nextX, { duration: INDICATOR_DURATION })
  }, [indicatorX, visualIndex, segmentWidth, containerWidth, reducedMotion])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }))

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={translateProp(accessibilityLabel)}
      hitSlop={{ top: CONTAINER_HIT_SLOP.top, bottom: CONTAINER_HIT_SLOP.bottom }}
      className={cn(
        "relative min-h-11 w-full flex-row rounded-md border border-border-control bg-surface p-[2px]",
        disabled && "opacity-disabled",
        className,
      )}
      onLayout={handleLayout}
      {...rest}
    >
      {items.length > 0 ? (
        <Animated.View
          accessible={false}
          importantForAccessibility="no"
          testID="segmented-control-indicator"
          style={[
            indicatorStyle,
            {
              position: "absolute",
              pointerEvents: "none",
              left: SEGMENT_INSET,
              top: SEGMENT_INSET,
              bottom: SEGMENT_INSET,
              width: segmentWidth,
              opacity: containerWidth > 0 && activeIndex >= 0 ? 1 : 0,
            },
          ]}
        >
          <View className="h-full w-full rounded-sm bg-primary" />
        </Animated.View>
      ) : null}
      {items.map((item) => {
        const active = item.value === value
        const isDisabled = disabled || item.disabled
        return (
          <PressableScale
            key={item.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, disabled: !!isDisabled }}
            // F-10: lihat catatan di components/ui/radio.tsx — rn-web tidak
            // mengubah accessibilityState.checked menjadi aria-checked.
            aria-checked={active}
            accessibilityLabel={translateProp(item.label)}
            scaleOnPress={false}
            disabled={isDisabled}
            onPress={() => onChange(item.value)}
            hitSlop={{ top: SEGMENT_HIT_SLOP.top, bottom: SEGMENT_HIT_SLOP.bottom }}
            containerClassName={cn("min-w-0 flex-1 overflow-hidden rounded-sm", focusRingInset)}
            className="min-h-[38px] min-w-0 flex-1 flex-row items-center justify-center gap-1 rounded-sm px-2 py-2"
          >
            {item.icon ? (
              <Icon
                icon={item.icon}
                size="xs"
                tone={active ? "inverse" : "default"}
                weight={active ? "fill" : "regular"}
              />
            ) : null}
            <Text
              variant="label"
              tone={active ? "inverse" : "secondary"}
              numberOfLines={1}
              ellipsizeMode="tail"
              className="min-w-0 flex-shrink text-center"
            >
              {item.label}
            </Text>
          </PressableScale>
        )
      })}
    </View>
  )
}
