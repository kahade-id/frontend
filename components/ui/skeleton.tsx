/**
 * Kahade — <Skeleton> + <SkeletonText> (§8 loading).
 *
 * Placeholder konten saat data belum tiba — untuk list/kartu yang tahu
 * bentuknya (transaksi, saldo). Loading FULL-SCREEN tetap memakai logo
 * brand (<LoadingScreen>), skeleton hanya untuk konten parsial.
 *
 * Visual: blok `bg-surface` (light) / `bg-surface-elevated` (dark) dengan
 * pulse opacity 1 -> 0.5 loop 700ms (slow*2 — mengikuti pola AnimatedSplash).
 * Tidak ada shimmer gradient: gradient bertentangan dengan flat monokrom
 * (§1), dan pulse cukup menyampaikan "sedang memuat".
 *
 * Keputusan non-obvious:
 *   - Radius default `xs` (4px) untuk baris teks, `md` untuk card, `full`
 *     untuk avatar — pemanggil pilih via `shape`. Tidak ada radius lain (§5).
 *   - Satu Animated.Value dibagikan lewat Context oleh <SkeletonGroup> supaya
 *     semua blok di satu layar berdenyut serempak (kalau tiap blok punya
 *     timer sendiri, fase-nya bergeser dan terlihat "berkedip acak").
 *   - `accessibilityLabel="Memuat"` + role progressbar sekali di group agar
 *     screen reader tidak membaca puluhan blok kosong.
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react"
import { Animated, Easing, View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

const PulseContext = createContext<Animated.Value | null>(null)

function usePulse(): Animated.Value {
  const shared = useContext(PulseContext)
  const own = useRef(new Animated.Value(1)).current
  const value = shared ?? own

  useEffect(() => {
    if (shared) return // group yang mengelola loop
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 0.5,
          duration: tokens.motion.duration.slow * 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 1,
          duration: tokens.motion.duration.slow * 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [shared, value])

  return value
}

export type SkeletonShape = "rect" | "card" | "circle"

export type SkeletonProps = Omit<ViewProps, "children"> & {
  /** Lebar: class Tailwind (w-24, w-full) lewat className, atau angka px */
  width?: number
  height?: number
  shape?: SkeletonShape
  className?: string
}

const shapeClass: Record<SkeletonShape, string> = {
  rect: "rounded-xs",
  card: "rounded-md",
  circle: "rounded-full",
}

export function Skeleton({ width, height, shape = "rect", className, style, ...rest }: SkeletonProps) {
  const opacity = usePulse()
  return (
    <Animated.View style={[{ opacity }, style]} {...rest}>
      <View
        className={cn("bg-surface dark:bg-surface-elevated", shapeClass[shape], className)}
        // Dimensi numerik eksplisit (mis. avatar 40x40) — className untuk yang berbasis skala
        style={{ width, height }}
      />
    </Animated.View>
  )
}

/** Beberapa baris teks; baris terakhir 60% agar terlihat seperti paragraf */
export function SkeletonText({
  lines = 3,
  lineHeight = tokens.typography.body.lineHeight,
  className,
}: {
  lines?: number
  lineHeight?: number
  className?: string
}) {
  return (
    <View className={cn("w-full gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          height={lineHeight - tokens.space[2]}
          className={i === lines - 1 && lines > 1 ? "w-3/5" : "w-full"}
        />
      ))}
    </View>
  )
}

/** Bagikan satu pulse ke semua Skeleton di dalamnya */
export function SkeletonGroup({ children, className }: { children: ReactNode; className?: string }) {
  const value = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 0.5,
          duration: tokens.motion.duration.slow * 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 1,
          duration: tokens.motion.duration.slow * 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [value])

  return (
    <PulseContext.Provider value={value}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Memuat"
        accessibilityElementsHidden={false}
        className={className}
      >
        {children}
      </View>
    </PulseContext.Provider>
  )
}
