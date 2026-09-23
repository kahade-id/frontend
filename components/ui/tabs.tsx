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
 *   - GEOMETRI indikator (absolute/bottom/left/height/zIndex) ditulis sebagai
 *     style biasa, dan WARNA-nya lewat className pada <View> anak — BUKAN
 *     className pada Animated.View reanimated. Sebabnya nyata, bukan gaya:
 *     reanimated mengirim lib/module yang sudah ter-compile dengan
 *     `react/jsx-runtime` (bukan jsx-runtime NativeWind), jadi prop className
 *     pada Animated.View reanimated TIDAK PERNAH dikonversi menjadi style
 *     (react-native-css-interop hanya meng-interop komponen RN inti).
 *     Efek bug sebelumnya ganda: (1) `bg-primary` hilang → garis aktif tak
 *     terlihat sama sekali; (2) `absolute bottom-0 left-0` hilang → indikator
 *     jadi anak flex normal yang memakan lebar strip, sehingga `onLayout`
 *     mengukur x tiap tab tergeser sebesar lebar indikator (garis "ke kanan")
 *     dan lebar tab menyusut. `Animated.View` RN inti TIDAK kena masalah ini
 *     (file-nya masih JSX Flow → ikut ter-compile dengan jsxImportSource
 *     nativewind); hanya reanimated. Karena itu aturan repo tetap: className
 *     di <View> anak, Animated.View hanya membawa style/transform.
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
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ScrollView,
  View,
  type LayoutChangeEvent,
  type ViewProps,
  type ViewStyle,
} from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
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
  /** Opt-in feed treatment; default profile tabs stay unchanged. */
  activeIconOnly?: boolean
  largeLabels?: boolean
}

/** Ketebalan indikator (px). Nilai runtime → literal lokal. */
const INDICATOR_H = 2

/**
 * Kotak indikator: WAJIB style biasa, bukan className — lihat docblock di atas
 * (className pada Animated.View reanimated tidak pernah menjadi style).
 * `position: "absolute"` adalah yang membuat indikator keluar dari alur flex:
 * tanpa itu ia memakan lebar strip dan menggeser hasil onLayout setiap tab.
 * zIndex di sini (bukan class `z-10`) supaya indikator tetap di atas garis
 * dasar border walau NativeWind tidak memproses elemen ini.
 */
const INDICATOR_FRAME: ViewStyle = {
  position: "absolute",
  bottom: 0,
  left: 0,
  height: INDICATOR_H,
  zIndex: 10,
  // Web: jadi CSS `pointer-events`; native: prop style pointerEvents (new arch).
  pointerEvents: "none",
}

function ActiveTabIcon({ icon, active }: { icon: IconComponent; active: boolean }) {
  const reduced = useReducedMotion()
  const progress = useSharedValue(active ? 1 : 0)
  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: reduced ? 0 : 180 })
  }, [active, reduced, progress])
  const style = useAnimatedStyle(() => ({
    width: progress.value * 24,
    opacity: progress.value,
    transform: [{ translateX: (1 - progress.value) * -6 }],
    overflow: "hidden",
  }))
  return <Animated.View style={style}><Icon icon={icon} size="sm" active={active} /></Animated.View>
}

export function Tabs<V extends string = string>({
  items,
  value,
  onChange,
  scrollable = false,
  activeIconOnly = false,
  largeLabels = false,
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
  // onLayout datang per item dan bertahap setelah mount. Selama geometri belum
  // lengkap, indikator DIPASANG LANGSUNG (tanpa spring): kalau tidak, garis
  // aktif "tumbuh" dari lebar 0 setiap layar dibuka lalu bergetar mengikuti
  // pengukuran yang menyusul. Spring hanya untuk perpindahan tab sungguhan.
  const settledRef = useRef(false)

  useEffect(() => {
    const targetX = activeIndex >= 0 ? (offsets[activeIndex] ?? 0) : 0
    const targetW = activeIndex >= 0 ? (frames[activeIndex] ?? 0) : 0
    if (!settledRef.current) {
      settledRef.current = items.every((_, i) => (frames[i] ?? 0) > 0)
    }
    const spring = {
      ...tokens.motion.spring,
      velocity: 6,
    }
    if (reducedMotion || !settledRef.current) {
      dotX.value = targetX
      dotW.value = targetW
      return
    }
    dotX.value = withSpring(targetX, spring)
    dotW.value = withSpring(targetW, spring)
  }, [activeIndex, frames, offsets, reducedMotion, dotX, dotW, items])

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
      {/* Indikator aktif meluncur — feedback arah & posisi "sedang tab apa".
          Geometri lewat style biasa (INDICATOR_FRAME), warna & radius lewat
          className pada <View> anak: className pada Animated.View reanimated
          tidak diproses NativeWind (lihat docblock). */}
      <Animated.View style={[INDICATOR_FRAME, dotStyle]}>
        <View className="h-full w-full rounded-t-[2px] bg-primary" />
      </Animated.View>

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
              "h-12 flex-row items-center justify-center px-4",
              !activeIconOnly && "gap-2",
            )}
            onLayout={measure(index)}
          >
            {item.icon ? (activeIconOnly ? <ActiveTabIcon icon={item.icon} active={active} /> : <Icon icon={item.icon} size="sm" active={active} />) : null}
            <Text ellipsizeMode="tail"
              variant={largeLabels ? "bodyLarge" : "body"}
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