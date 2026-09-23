/**
 * Kahade — pemilih mode E-Commerce ⇄ E-Wallet (KOMPAK, revisi 2026-09-23).
 *
 * Pil kecil dua segmen IKON yang hidup DI DALAM bar header halaman mode
 * (Etalase & Dompet):
 *
 *      [ ▦ CardsThree | 👛 Wallet ]
 *
 *   - Lebar pil mengikuti isi (~86px di ponsel) — BUKAN lagi baris penuh
 *     h-10 di bawah header. "Kecil dan satu saja": satu kontrol, satu tempat
 *     per layar, bukan teriakan setiap kali layar dibuka.
 *   - Ikon mengikuti kosakata ikon app: CardsThree = etalase (sama dengan
 *     slot primer mode commerce di navbar bawah), Wallet = dompet. Ikon
 *     dipilih agar switcher terbaca sebagai bagian keluarga ikon lain, bukan
 *     sistem sendiri.
 *   - Label teks hanya muncul di breakpoint md+ (web/tablet): di ponsel pil
 *     ikon-saja cukup — konteks halaman (Etalase/Dompet) sudah menjelaskan
 *     sisi mana yang aktif; di layar lebar label membuat kontrol baru
 *     langsung terbaca tanpa belajar ikon.
 *   - Thumb `bg-primary` tetap MELUNCUR (spring) di antara dua segmen —
 *     pergantian mode harus terasa di kedua arah. Warna label mengikuti
 *     posisi thumb (bukan state terpilih yang meloncat); ikon di-crossfade
 *     dua lapis (inverse/secondary) karena warna ikon Phosphor adalah prop,
 *     bukan style yang bisa di-interpolate.
 *   - A11y tetap radiogroup "Mode aplikasi" dengan label penuh per segmen
 *     ("E-Commerce"/"E-Wallet") — pengguna pembaca layar tidak bergantung
 *     pada ikon.
 *
 * `Animated.View` Reanimated tidak di-interop NativeWind — fill thumb ada di
 * <View> anak. Geser konten layar memakai RN Animated (pola FadeIn), bukan
 * Reanimated, karena yang digerakkan hanya opacity + translateX.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from "react-native"
import { usePathname, useRouter, type Href } from "expo-router"
import Reanimated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated"
import { CardsThree, Wallet } from "phosphor-react-native"

import { useTheme } from "@/components/theme-provider"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { cn } from "@/lib/cn"
import { focusRingInset } from "@/lib/focus-ring"
import { haptic } from "@/lib/haptics"
import { hitSlopToReach } from "@/lib/hit-slop"
import { translate, translateProp, useLanguage } from "@/lib/i18n"
import {
  applyModeNavigation,
  getModeShift,
  getModeShiftGeneration,
  markModeShift,
  modeShiftIsFresh,
  normalizeShellPath,
  pathMatchesBase,
  planModeChange,
  setAppMode,
  subscribeModeShift,
  useAppMode,
  type AppMode,
  type ModeNavigator,
} from "@/lib/app-mode"
import { modes, tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

const MODES = [
  {
    value: "commerce",
    /** Label singkat yang terlihat (md+) — nama TUJUAN, bukan jargon mode. */
    label: "Etalase",
    /** Label a11y — nama MODE; pembaca layar tidak melihat ikon. */
    accessibilityLabel: "E-Commerce",
    icon: CardsThree,
  },
  {
    value: "wallet",
    label: "Dompet",
    accessibilityLabel: "E-Wallet",
    icon: Wallet,
  },
] as const satisfies readonly {
  value: AppMode
  label: string
  accessibilityLabel: string
  icon: IconComponent
}[]

/**
 * Tinggi pil 32px (`h-8`) — sekecil kontrol header boleh: label ikon-saja,
 * tidak ada teks yang harus muat. Target sentuh 44pt tetap terpenuhi lewat
 * hitSlop vertikal 6px (pola yang sama dengan <SegmentedControl>).
 */
const CONTAINER_H = tokens.space[8]
const SEGMENT_PAD = 2
const SEGMENT_H = CONTAINER_H - SEGMENT_PAD * 2
const CONTAINER_HIT_SLOP = hitSlopToReach(0, CONTAINER_H)
const SEGMENT_HIT_SLOP = hitSlopToReach(0, SEGMENT_H)

const PILL_FRAME: ViewStyle = {
  position: "absolute",
  top: SEGMENT_PAD,
  bottom: SEGMENT_PAD,
  left: 0,
  zIndex: 0,
  pointerEvents: "none",
}

type Frame = { x: number; width: number }

function useModeNavigator(): ModeNavigator {
  const router = useRouter()
  return useMemo(
    () => ({
      push: (href) => router.push(href as Href),
      replace: (href) => router.replace(href as Href),
      navigate: (href) => router.navigate(href as Href),
      dismissTo:
        typeof router.dismissTo === "function"
          ? (href) => router.dismissTo(href as Href)
          : undefined,
    }),
    [router],
  )
}

/** Ganti mode: simpan preferensi, tandai shift, lalu jalankan rencana navigasi. */
export function useSwitchAppMode() {
  const mode = useAppMode()
  const pathname = usePathname()
  const nav = useModeNavigator()
  return useCallback(
    (next: AppMode) => {
      if (next === mode) return
      const plan = planModeChange(pathname, next)
      haptic("select")
      markModeShift(mode, next, plan.kind === "go" ? plan.href : null)
      setAppMode(next)
      applyModeNavigation(plan, nav)
    },
    [mode, pathname, nav],
  )
}

/**
 * Ikon segmen — dua lapis saling-crossfade mengikuti progress thumb.
 * Warna ikon Phosphor adalah PROP (bukan style), jadi interpolasi warna
 * langsung tidak mungkin; dua <Icon> bertumpuk dengan opacity teranimasi
 * memberi transisi yang sama mulusnya tanpa mengubah API ikon.
 */
function SegmentGlyph({
  icon,
  index,
  progress,
  inverseColor,
  ghostColor,
}: {
  icon: IconComponent
  index: number
  progress: SharedValue<number>
  inverseColor: string
  ghostColor: string
}) {
  const inverseStyle = useAnimatedStyle(() => ({
    // CLAMP wajib: spring bisa overshoot melewati [0,1] — tanpa clamp ikon
    // inverse bisa "menyala" balik di ujung pantulan.
    opacity: interpolate(progress.value, [0, 1], index === 0 ? [1, 0] : [0, 1], Extrapolation.CLAMP),
  }))
  const ghostStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], index === 0 ? [0, 1] : [1, 0], Extrapolation.CLAMP),
  }))
  return (
    <View className="h-5 w-5 items-center justify-center">
      {/* className sengaja tidak dipakai di lapisan Reanimated (tidak pernah
          menjadi style) — geometri dijamin absoluteFill + ikon 20×20. */}
      <Reanimated.View style={[StyleSheet.absoluteFill, inverseStyle]}>
        <Icon icon={icon} size="sm" weight="fill" color={inverseColor} />
      </Reanimated.View>
      <Reanimated.View style={[StyleSheet.absoluteFill, ghostStyle]}>
        <Icon icon={icon} size="sm" color={ghostColor} />
      </Reanimated.View>
    </View>
  )
}

function PillLabel({
  label,
  index,
  progress,
  inverse,
  secondary,
}: {
  label: string
  index: number
  progress: SharedValue<number>
  inverse: SharedValue<string>
  secondary: SharedValue<string>
}) {
  useLanguage()
  const style = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      index === 0
        ? [inverse.value, secondary.value]
        : [secondary.value, inverse.value],
    ),
  }))
  return (
    // Visibility class ada di <View> biasa, BUKAN di Reanimated.Text: lib
    // Reanimated tidak di-interop NativeWind, className di komponennya tidak
    // pernah menjadi style (pola yang sama dengan thumb). Label hanya tampil
    // di layar md+ (web/tablet); di ponsel pil tetap ikon-saja.
    <View className="hidden md:flex">
      <Reanimated.Text
        style={[
          {
            // §3 + interop NativeWind: <Reanimated.Text> tidak meng-hydrate
            // className (jsx-runtime Reanimated bukan NativeWind), jadi varian
            // <Text> tidak bisa dipakai — nilai di bawah PERSIS tokens.
            // typography.label (varian "label") dan tercatat di
            // INLINE_TYPO_ALLOWLIST check-tokens.
            fontFamily: tokens.fontFamilyByWeight.sans[600],
            fontSize: tokens.typography.label.fontSize,
            lineHeight: tokens.typography.label.lineHeight,
          },
          style,
        ]}
        numberOfLines={1}
        allowFontScaling
        maxFontSizeMultiplier={2}
      >
        {translate(label)}
      </Reanimated.Text>
    </View>
  )
}

export function ModeSwitcher({ className }: { className?: string }) {
  useLanguage()
  const mode = useAppMode()
  const switchMode = useSwitchAppMode()
  const reducedMotion = useReducedMotion()
  const { mode: themeMode } = useTheme()
  const activeIndex = mode === "wallet" ? 1 : 0
  const [frames, setFrames] = useState<Frame[]>([
    { x: 0, width: 0 },
    { x: 0, width: 0 },
  ])
  const progress = useSharedValue(activeIndex)
  const pillX = useSharedValue(0)
  const pillW = useSharedValue(0)
  const inverse = useSharedValue(modes[themeMode].primaryForeground)
  const secondary = useSharedValue(modes[themeMode].textSecondary)
  // Warna ikon statis per mode tema (re-render saat tema berubah) — ikon
  // Phosphor tidak bisa diinterpolate warnanya lewat shared value.
  const inverseColor = modes[themeMode].primaryForeground
  const ghostColor = modes[themeMode].textSecondary
  const played = useRef(false)
  const settled = useRef(false)

  useEffect(() => {
    inverse.value = modes[themeMode].primaryForeground
    secondary.value = modes[themeMode].textSecondary
  }, [themeMode, inverse, secondary])

  const measured = frames[0].width > 0 && frames[1].width > 0

  useEffect(() => {
    if (!measured) return
    const shift = getModeShift()
    const fresh = shift != null && modeShiftIsFresh()
    const from = shift?.from === "wallet" ? 1 : 0
    const toX = frames[activeIndex]?.x ?? 0
    const toW = frames[activeIndex]?.width ?? 0
    if (reducedMotion) {
      // Preferensi belum diketahui (default reduced) atau pengguna memang
      // mematikan gerak: thumb langsung di tujuan. Spring menyusul bila
      // preferensi berubah ke "gerak boleh" selagi shift masih segar.
      progress.value = activeIndex
      pillX.value = toX
      pillW.value = toW
      return
    }
    if (fresh && !played.current && from !== activeIndex) {
      played.current = true
      settled.current = true
      const fromX = frames[from]?.x ?? toX
      const fromW = frames[from]?.width ?? toW
      progress.value = from
      pillX.value = fromX
      pillW.value = fromW
      progress.value = withSpring(activeIndex, tokens.motion.spring)
      pillX.value = withSpring(toX, tokens.motion.spring)
      pillW.value = withSpring(toW, tokens.motion.spring)
      return
    }
    if (!settled.current) {
      settled.current = true
      played.current = true
      progress.value = activeIndex
      pillX.value = toX
      pillW.value = toW
      return
    }
    progress.value = withSpring(activeIndex, tokens.motion.spring)
    pillX.value = withSpring(toX, tokens.motion.spring)
    pillW.value = withSpring(toW, tokens.motion.spring)
  }, [activeIndex, frames, measured, reducedMotion, pillW, pillX, progress])

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillW.value,
  }))

  const onLayout = (index: number) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout
    setFrames((prev) => {
      const next = [...prev]
      const current = next[index]
      if (current && current.x === x && current.width === width) return prev
      next[index] = { x, width }
      return next
    })
  }

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={translateProp("Mode aplikasi")}
      hitSlop={{ top: CONTAINER_HIT_SLOP.top, bottom: CONTAINER_HIT_SLOP.bottom }}
      className={cn(
        "h-8 flex-row items-stretch rounded-full border border-border-control bg-surface p-[2px]",
        className,
      )}
    >
      <Reanimated.View style={[PILL_FRAME, pillStyle]}>
        <View className="h-full w-full rounded-full bg-primary" />
      </Reanimated.View>
      {MODES.map((item, index) => {
        const active = item.value === mode
        return (
          <PressableScale
            key={item.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            aria-checked={active}
            accessibilityLabel={translate(item.accessibilityLabel)}
            accessibilityHint={translate("Ganti mode aplikasi ke {x}", {
              x: translate(item.accessibilityLabel),
            })}
            scaleOnPress={false}
            onPress={() => switchMode(item.value)}
            onLayout={onLayout(index)}
            hitSlop={{ top: SEGMENT_HIT_SLOP.top, bottom: SEGMENT_HIT_SLOP.bottom }}
            containerClassName={cn("z-sticky min-w-10 flex-1 overflow-hidden rounded-full", focusRingInset)}
            className="h-full flex-row flex-1 items-center justify-center gap-1 rounded-full px-2"
          >
            <SegmentGlyph
              icon={item.icon}
              index={index}
              progress={progress}
              inverseColor={inverseColor}
              ghostColor={ghostColor}
            />
            <PillLabel
              label={item.label}
              index={index}
              progress={progress}
              inverse={inverse}
              secondary={secondary}
            />
          </PressableScale>
        )
      })}
    </View>
  )
}

/**
 * Reveal horizontal konten layar tujuan. Hanya berjalan selagi shift masih
 * segar DAN path ini adalah tujuan shift — layar yang tetap ter-mount di
 * bawah tidak me-remount anaknya.
 */
export function ModeShiftFade({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const pathname = usePathname()
  const reducedMotion = useReducedMotion()
  const generation = useModeShiftGeneration()
  const opacity = useRef(new Animated.Value(1)).current
  const translateX = useRef(new Animated.Value(0)).current
  const played = useRef(0)

  useEffect(() => {
    const shift = getModeShift()
    const current = normalizeShellPath(pathname)
    const landing =
      shift?.href != null && pathMatchesBase(current, shift.href) && modeShiftIsFresh()
    if (!landing || played.current === generation) {
      opacity.setValue(1)
      translateX.setValue(0)
      return
    }
    played.current = generation
    if (reducedMotion) {
      opacity.setValue(1)
      translateX.setValue(0)
      return
    }
    const distance = tokens.space[4]
    opacity.setValue(0)
    translateX.setValue((shift?.dir ?? 1) * distance)
    const enter = tokens.motion.easing.enter
    const duration = motionDuration(reducedMotion, tokens.motion.duration.fast)
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.bezier(enter[0], enter[1], enter[2], enter[3]),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration,
        easing: Easing.bezier(enter[0], enter[1], enter[2], enter[3]),
        useNativeDriver: true,
      }),
    ])
    anim.start()
    return () => anim.stop()
  }, [generation, pathname, reducedMotion, opacity, translateX])

  return (
    <View className={cn("flex-1", className)}>
      <Animated.View style={{ flex: 1, opacity, transform: [{ translateX }] }}>{children}</Animated.View>
    </View>
  )
}

function useModeShiftGeneration(): number {
  return useSyncExternalStore(subscribeModeShift, getModeShiftGeneration, getModeShiftGeneration)
}
