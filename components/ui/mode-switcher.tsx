/**
 * Kahade — pemilih mode E-Commerce ⇄ E-Wallet.
 *
 * Dua pil bersebelahan di bawah bar atas. Bentuk mengikuti <SegmentedControl>
 * (rounded-md, border-control, tinggi 40, thumb rounded-sm bg-primary) tetapi
 * thumb-nya MELUNCUR — segmented control sengaja tanpa geser, sedangkan
 * pergantian mode harus terasa di kedua arah.
 *
 * Warna label mengikuti posisi thumb (bukan state terpilih yang meloncat):
 * teks di atas thumb selalu inverse, teks di luar selalu secondary, supaya
 * kontras tidak pecah di tengah spring.
 *
 * `Animated.View` Reanimated tidak di-interop NativeWind — fill thumb ada di
 * <View> anak. Geser konten layar memakai RN Animated (pola FadeIn), bukan
 * Reanimated, karena yang digerakkan hanya opacity + translateX.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { Animated, Easing, View, type LayoutChangeEvent, type ViewStyle } from "react-native"
import { usePathname, useRouter, type Href } from "expo-router"
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated"

import { useTheme } from "@/components/theme-provider"
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
  { value: "commerce", label: "E-Commerce" },
  { value: "wallet", label: "E-Wallet" },
] as const satisfies readonly { value: AppMode; label: string }[]

/** Tinggi container = Button sm (h-10). Thumb = container − 2×padding. */
const CONTAINER_H = tokens.space[10]
const SEGMENT_PAD = tokens.radius.md - tokens.radius.sm
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
    <Reanimated.Text
      style={[
        {
          fontFamily: tokens.fontFamilyByWeight.sans[600],
          fontSize: tokens.typography.label.fontSize,
          lineHeight: tokens.typography.label.lineHeight,
          textAlign: "center",
        },
        style,
      ]}
      numberOfLines={1}
      allowFontScaling
      maxFontSizeMultiplier={2}
    >
      {translate(label)}
    </Reanimated.Text>
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
        "h-10 w-full flex-row items-stretch rounded-md border border-border-control bg-surface p-[2px]",
        className,
      )}
    >
      <Reanimated.View style={[PILL_FRAME, pillStyle]}>
        <View className="h-full w-full rounded-sm bg-primary" />
      </Reanimated.View>
      {MODES.map((item, index) => {
        const active = item.value === mode
        return (
          <PressableScale
            key={item.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            aria-checked={active}
            accessibilityLabel={item.label}
            scaleOnPress={false}
            onPress={() => switchMode(item.value)}
            onLayout={onLayout(index)}
            hitSlop={{ top: SEGMENT_HIT_SLOP.top, bottom: SEGMENT_HIT_SLOP.bottom }}
            containerClassName={cn("z-sticky flex-1 overflow-hidden rounded-sm", focusRingInset)}
            className="h-full flex-1 items-center justify-center rounded-sm px-2"
          >
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

/** Switcher dengan gutter layar — untuk chrome yang bukan <Header>. */
export function ModeSwitcherBar({ className }: { className?: string }) {
  return (
    <View className={cn("w-full items-center bg-background px-5 pb-3 pt-2", className)}>
      <View className="w-full md:max-w-content">
        <ModeSwitcher />
      </View>
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
