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
 *     tab mana". Slide memberi affordance arah & posisi; offset dihitung dari
 *     posisi tombol, sedangkan garis hanya mencakup teks + ikon (bila ada).
 *     Chip count dan aksi sibling seperti filter tidak ikut digarisbawahi.
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
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
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
import { CountBadge } from "@/components/ui/count-badge"
import { cn } from "@/lib/cn"
import { focusRingInset } from "@/lib/focus-ring"
import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"

export type TabItem<V extends string = string> = {
  value: V
  label: string
  icon?: IconComponent
  count?: number
  disabled?: boolean
  /** A separate action (not part of the tab target), aligned beside this tab. */
  trailingAction?: {
    icon: IconComponent
    accessibilityLabel: string
    accessibilityHint?: string
    onPress: () => void
    badgeCount?: number
  }
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

type LayoutFrame = { x: number; width: number }

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
  // Ukur grup item dan tombol tab (termasuk tab dengan aksi sibling), lalu
  // sejajarkan indikator dengan isi aktual — bukan seluruh area sentuh.
  const [groupFrames, setGroupFrames] = useState<(LayoutFrame | undefined)[]>(() =>
    items.map(() => undefined),
  )
  const [buttonFrames, setButtonFrames] = useState<(LayoutFrame | undefined)[]>(() =>
    items.map(() => undefined),
  )
  const [contentFrames, setContentFrames] = useState<(LayoutFrame | undefined)[]>(() =>
    items.map(() => undefined),
  )
  const [countWidths, setCountWidths] = useState<number[]>(() => items.map(() => 0))

  const measureFrame = (
    setter: Dispatch<SetStateAction<(LayoutFrame | undefined)[]>>,
    index: number,
  ) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout
    setter((previous) => {
      const current = previous[index]
      if (current?.x === x && current.width === width) return previous
      const next = [...previous]
      next[index] = { x, width }
      return next
    })
  }

  const measureWidth = (setter: Dispatch<SetStateAction<number[]>>, index: number) =>
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width
      setter((previous) => {
        if (previous[index] === width) return previous
        const next = [...previous]
        next[index] = width
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
    const group = activeIndex >= 0 ? groupFrames[activeIndex] : undefined
    const button = activeIndex >= 0 ? buttonFrames[activeIndex] : undefined
    const content = activeIndex >= 0 ? contentFrames[activeIndex] : undefined
    // Ukur langsung wrapper label + ikon di dalam target tab. Karena itu
    // offset otomatis mencerminkan padding/penjajaran tombol dan tidak
    // memasukkan chip count atau aksi trailing seperti filter.
    const targetX = group && button && content ? group.x + button.x + content.x : 0
    const targetW = content?.width ?? 0
    const geometryReady = items.every(
      (tab, index) =>
        (groupFrames[index]?.width ?? 0) > 0 &&
        (buttonFrames[index]?.width ?? 0) > 0 &&
        (contentFrames[index]?.width ?? 0) > 0 &&
        (tab.count == null || (countWidths[index] ?? 0) > 0),
    )
    if (!settledRef.current) settledRef.current = geometryReady

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
  }, [
    activeIndex,
    buttonFrames,
    contentFrames,
    countWidths,
    dotW,
    dotX,
    groupFrames,
    items,
    reducedMotion,
  ])

  const dotStyle = useAnimatedStyle(
    // PERF-FIX (P1): animasikan scaleX, bukan width — perubahan width memicu
    // layout pass native tiap frame (jank); scaleX murni composite. View
    // di-layout selebar 1px; anchor kiri dijaga via kompensasi translateX
    // (scaleX berpusat di tengah → geser sebesar -0.5 + w/2).
    () => {
      const w = dotW.value
      return {
        width: 1,
        transform: [{ translateX: dotX.value - 0.5 + w / 2 }, { scaleX: Math.max(w, 0.001) }],
      }
    },
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
        const trailingAction = item.trailingAction
        return (
          <View
            key={item.value}
            className={cn("flex-row items-center", !scrollable && "flex-1")}
            onLayout={measureFrame(setGroupFrames, index)}
          >
            <PressableScale
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled: !!item.disabled }}
              accessibilityLabel={item.count != null ? `${item.label}, ${item.count}` : item.label}
              scaleOnPress={false}
              disabled={item.disabled}
              onPress={() => {
                // Schedule UI-thread feedback before the parent mounts heavy content.
                const group = groupFrames[index]
                const button = buttonFrames[index]
                const content = contentFrames[index]
                if (group && button && content) {
                  const x = group.x + button.x + content.x
                  dotX.value = reducedMotion ? x : withSpring(x, tokens.motion.spring)
                  dotW.value = reducedMotion ? content.width : withSpring(content.width, tokens.motion.spring)
                }
                onChange(item.value)
              }}
              containerClassName={cn(scrollable ? "rounded-xs" : "flex-1 rounded-xs", focusRingInset)}
              className={cn(
                "h-12 flex-row items-center justify-center pl-4",
                trailingAction ? "pr-1" : "pr-4",
                !activeIconOnly && "gap-2",
              )}
              onLayout={measureFrame(setButtonFrames, index)}
            >
              <View
                className={cn("flex-row items-center", !activeIconOnly && "gap-2")}
                onLayout={measureFrame(setContentFrames, index)}
              >
                {item.icon ? (
                  activeIconOnly ? (
                    <ActiveTabIcon icon={item.icon} active={active} />
                  ) : (
                    <Icon icon={item.icon} size="sm" active={active} />
                  )
                ) : null}
                <Text
                  ellipsizeMode="tail"
                  variant={largeLabels ? "bodyLarge" : "body"}
                  weight={active ? 600 : 400}
                  tone={active ? "primary" : "secondary"}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </View>
              {item.count != null ? (
                <CountBadge
                  count={item.count}
                  max={Number.MAX_SAFE_INTEGER}
                  showZero
                  tone={active ? "inverted" : "neutral"}
                  accessible={false}
                  onLayout={measureWidth(setCountWidths, index)}
                />
              ) : null}
            </PressableScale>

            {trailingAction ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={trailingAction.accessibilityLabel}
                accessibilityHint={trailingAction.accessibilityHint}
                haptic
                onPress={trailingAction.onPress}
                containerClassName="shrink-0 rounded-full"
                className="relative h-11 w-11 items-center justify-center rounded-full"
              >
                <Icon
                  icon={trailingAction.icon}
                  size="md"
                  active={(trailingAction.badgeCount ?? 0) > 0}
                  weight={(trailingAction.badgeCount ?? 0) > 0 ? "fill" : "regular"}
                />
                {(trailingAction.badgeCount ?? 0) > 0 ? (
                  <View className="absolute -right-1 -top-1 h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1">
                    <Text variant="caption" tone="inverse" className="tabular-nums">
                      {trailingAction.badgeCount}
                    </Text>
                  </View>
                ) : null}
              </PressableScale>
            ) : null}
          </View>
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