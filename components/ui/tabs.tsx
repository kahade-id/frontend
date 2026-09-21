/**
 * Kahade — <Tabs> underline (§9.16 Tabs).
 *
 * Tab konten dalam satu layar (mis. Riwayat: "Semua / Berjalan / Selesai").
 * Untuk 2–3 opsi yang bersifat toggle tampilan pakai <SegmentedControl>;
 * untuk navigasi antar layar pakai <BottomTabBar>.
 *
 * Keputusan non-obvious:
 *   - Indikator aktif = `border-b-[2px]` `bg-primary` yang MELUNCUR dengan
 *     spring utilitarian (v2 2026-09). Sebelumnya indikator adalah border
 *     per-item yang muncul instan — user tidak bisa melacak "dari tab mana ke
 *     tab mana". Slide memberi affordance arah & posisi; ukuran & offset
 *     diukur via `onLayout` tiap item (label dapat berbeda panjang, ikon,
 *     count), BUKAN lebar rata yang salah untuk label pendek/panjang.
 *   - Indikator duduk di atas garis dasar `border-b border-border`
 *     container (bukan mengganti border item): satu View absolute yang
 *     posisinya dianimasikan, jadi tidak ada dua border yang saling menimpa.
 *   - `reduceMotion`: slide instan (langsung set value), konsisten dengan
 *     aturan §8 — gerakan posisi besar diredam, bukan dihilangkan fungsinya.
 *   - Label aktif text-primary 600, inaktif text-secondary 400 — mengikuti
 *     pemisahan eksplisit §9.14 (label inaktif = text-secondary, bukan
 *     tertiary, agar AA).
 *   - `count` opsional dirender pill kecil `rounded-full border-border` dengan
 *     angka Sofia tabular (bukan Mono — angka jumlah di UI, bukan data
 *     finansial §3.1). Pill adalah pengecualian radius.full yang diizinkan.
 *   - `scrollable` untuk > 4 tab: ScrollView horizontal dengan padding layar;
 *     default flex-1 rata lebar.
 *   - Tidak ada scale press: area tab lebar & bersentuhan; scale membuat
 *     tetangganya tampak bergeser.
 *   - Focus ring keyboard (web saja) `focusRingInset`: tab saling
 *     bersentuhan dan duduk di atas garis dasar, ring luar akan menabrak
 *     tetangga/garis; inset menjaga ring di dalam kotak tab.
 */
import { useEffect, useMemo, useState } from "react"
import { ScrollView, View, type LayoutChangeEvent, type ViewProps } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
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
import { formatNumber } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"

export type TabItem<V extends string = string> = {
  value: V
  label: string
  icon?: IconComponent
  count?: number
  disabled?: boolean
}

export type TabsProps<V extends string = string> = Omit<ViewProps, "children"> & {
  items: readonly TabItem<V>[]
  value: V
  onChange: (value: V) => void
  /** Scroll horizontal untuk banyak tab (> 4) */
  scrollable?: boolean
  className?: string
}

/** Ketebalan indikator (px). Nilai runtime → literal lokal. */
const INDICATOR_H = 2

export function Tabs<V extends string = string>({
  items,
  value,
  onChange,
  scrollable = false,
  className,
  ...rest
}: TabsProps<V>) {
  const reducedMotion = useReducedMotion()
  // Geometri tiap tab (x + lebar) relatif terhadap strip — diukur via onLayout.
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
    const spring = {
      ...tokens.motion.spring,
      velocity: 6,
    }
    if (reducedMotion) {
      dotX.value = targetX
      dotW.value = targetW
      return
    }
    dotX.value = withSpring(targetX, spring)
    dotW.value = withSpring(targetW, spring)
  }, [activeIndex, frames, offsets, reducedMotion, dotX, dotW])

  const dotStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: dotX.value }],
      width: dotW.value,
    }),
    [],
  )

  // Tab strip scrollable bisa berada di dalam PullToRefresh (profil user):
  // daftarkan ke RNGH agar geser horizontal tidak dikunci induk vertikal.
  const nativeGesture = useMemo(() => Gesture.Native(), [])
  const row = (
    <View
      accessibilityRole="tablist"
      className={cn(
        "relative flex-row border-b border-border bg-background",
        scrollable ? "px-5" : "w-full",
        className,
      )}
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
            containerClassName={cn(scrollable ? "rounded-xs" : "flex-1 rounded-xs", focusRingInset)}
            className={cn(
              "h-12 flex-row items-center justify-center gap-2 px-4",
            )}
            onLayout={measure(index)}
          >
            {item.icon ? <Icon icon={item.icon} size="sm" active={active} /> : null}
            <Text ellipsizeMode="tail"
              variant="body"
              weight={active ? 600 : 400}
              tone={active ? "primary" : "secondary"}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            {item.count != null ? (
              <View
                className={cn(
                  "min-w-5 items-center justify-center rounded-full border px-[6px] py-[1px]",
                  active ? "border-primary bg-primary" : "border-border bg-transparent",
                )}
              >
                <Text variant="caption" weight={500} tone={active ? "inverse" : "secondary"}>
                  {formatNumber(item.count)}
                </Text>
              </View>
            ) : null}
          </PressableScale>
        )
      })}
    </View>
  )

  if (!scrollable) return row

  return (
    <GestureDetector gesture={nativeGesture} touchAction="pan-x">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="w-full">
        {row}
      </ScrollView>
    </GestureDetector>
  )
}