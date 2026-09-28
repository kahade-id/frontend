/**
 * Kahade — sisa <mode-switcher.tsx>: HANYA <ModeShiftFade>.
 *
 * REVISI 2026-09-28 (NAV-011): <ModeSwitcher> (pemilih mode E-Commerce ⇄
 * E-Wallet) sudah MATI total sejak redesign navigasi 2026-09-27 — tidak
 * di-render di mana pun, hook `useSwitchAppMode()` tidak dikonsumsi siapa
 * pun. Komponen + hook + mesin navigasinya dihapus dari file ini dan dari
 * lib/app-mode.ts. Yang tersisa hanyalah <ModeShiftFade>: wrapper animasi
 * reveal horizontal yang MASIH di-render di 6+ layar (transactions, chat,
 * wallet, wallet-history, data-screen, showcase-feed-tab).
 */
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react"
import { Animated, Easing, View } from "react-native"
import { usePathname } from "expo-router"

import { cn } from "@/lib/cn"
import {
  getModeShift,
  getModeShiftGeneration,
  modeShiftIsFresh,
  normalizeShellPath,
  pathMatchesBase,
  subscribeModeShift,
} from "@/lib/app-mode"
import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

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
