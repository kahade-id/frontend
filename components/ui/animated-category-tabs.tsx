/**
 * Kahade — <AnimatedCategoryTabs> (§9.16 Tabs + ikon).
 *
 * Tab kategori DENGAN IKON di atas label — pola tab profil publik /
 * community bar. Dipakai di layar Notifikasi (Transaksi · Promosi ·
 * Informasi) supaya tab-tabnya terbaca sebagai empat bagian halaman, bukan
 * deretan chip filter yang bisa "digeser-lenyap".
 *
 * Perbedaan dengan <Tabs> umum:
 *   - Tiap tab = ikon (xs aktif-fill / default) + label, bertumpuk vertikal,
 *     tinggi 60px — target sentuh nyaman untuk tiga tab sejajar rata (flex-1).
 *   - Indikator aktif meluncur spring utilitarian: bar 2px `bg-primary` yang
 *     posisi/lebar-nya dianimasikan ke frame tab aktif. Layout & tekanan
 *     identik dengan slide pada <Tabs> rework, supaya satu kosakata gerak.
 *   - Role a11y "tablist"/"tab" (memang mengganti panel konten), bukan radio.
 *
 * Hanya layout non-scroll (3 kategori) — pecahan dari <Tabs> karena itu
 * komponen dipakai UI terpusat; tab pendek tidak butuh ScrollView.
 */
import { useEffect, useState } from "react"
import { View, type LayoutChangeEvent, type ViewProps } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRingInset } from "@/lib/focus-ring"
import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"

export type CategoryTabItem<V extends string = string> = {
  value: V
  label: string
  icon: IconComponent
  count?: number
  disabled?: boolean
}

export type AnimatedCategoryTabsProps<V extends string = string> = Omit<
  ViewProps,
  "children"
> & {
  items: readonly CategoryTabItem<V>[]
  value: V
  onChange: (value: V) => void
  className?: string
}

/** Ketebalan indikator aktif (px). */
const INDICATOR_H = 2

export function AnimatedCategoryTabs<V extends string = string>({
  items,
  value,
  onChange,
  className,
  ...rest
}: AnimatedCategoryTabsProps<V>) {
  const reducedMotion = useReducedMotion()
  // Geometri tiap tab relatif strip (x + lebar), diukur via onLayout.
  const [frames, setFrames] = useState<number[]>(() => items.map(() => 0))
  const [offsets, setOffsets] = useState<number[]>(() => items.map(() => 0))

  const measure = (i: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout
    setFrames((prev) => {
      const next = [...prev]
      next[i] = width
      return next
    })
    setOffsets((prev) => {
      const next = [...prev]
      next[i] = x
      return next
    })
  }

  const activeIndex = items.findIndex((item) => item.value === value)
  const dotX = useSharedValue(0)
  const dotW = useSharedValue(0)

  useEffect(() => {
    const targetX = offsets[activeIndex] ?? 0
    const targetW = frames[activeIndex] ?? 0
    if (reducedMotion) {
      dotX.value = targetX
      dotW.value = targetW
      return
    }
    dotX.value = withSpring(targetX, tokens.motion.spring)
    dotW.value = withSpring(targetW, tokens.motion.spring)
  }, [activeIndex, frames, offsets, reducedMotion, dotX, dotW])

  const dotStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: dotX.value }],
      width: dotW.value,
    }),
    [],
  )

  return (
    <View
      accessibilityRole="tablist"
      className={cn("relative w-full flex-row border-b border-border bg-background", className)}
      {...rest}
    >
      {/* Indikator aktif meluncur — feedback arah & posisi "sedang tab apa". */}
      <Animated.View
        style={[dotStyle, { height: INDICATOR_H, pointerEvents: "none" }]}
        className="absolute bottom-0 left-0 z-10 rounded-t-[2px] bg-primary"
      />

      {items.map((item, index) => {
        const active = item.value === value
        return (
          <PressableScale
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: !!item.disabled }}
            accessibilityLabel={item.count != null ? `${item.label}, ${item.count}` : item.label}
            scaleOnPress={false}
            disabled={item.disabled}
            onPress={() => onChange(item.value)}
            onLayout={measure(index)}
            containerClassName={cn("flex-1 rounded-xs", focusRingInset)}
            className="h-[60px] flex-1 items-center justify-center gap-1 px-2"
          >
            <Icon
              icon={item.icon}
              size="sm"
              active={active}
              weight={active ? "fill" : undefined}
            />
            <Text
              ellipsizeMode="tail"
              variant="caption"
              weight={active ? 600 : 400}
              tone={active ? "primary" : "secondary"}
              numberOfLines={1}
              className="text-center"
            >
              {item.label}
            </Text>
          </PressableScale>
        )
      })}
    </View>
  )
}
