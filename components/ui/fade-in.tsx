/**
 * Kahade — <FadeIn> + <Stagger> primitif motion masuk (§8).
 *
 * Reveal halus untuk konten yang baru datang (hasil fetch, section yang
 * muncul setelah kondisi terpenuhi). Durasi & easing HANYA dari tokens.motion
 * (fast 250 / base 300 / slow 350, cubic-bezier standar). Pergeseran vertikal
 * opsional = space.2 (8px) — cukup terasa "naik", tidak teatrikal (§1.6 satu
 * titik kejutan per layar: FadeIn adalah motion latar, bukan kejutan).
 *
 * Kenapa RN `Animated`, bukan reanimated (non-obvious): mengikuti keputusan
 * pressable-scale.tsx & animated-splash.tsx — opacity/translate sederhana
 * dengan native driver sudah 60fps, dan reanimated disisakan untuk gesture
 * (bottom sheet, pull-to-refresh). Transform/opacity animasi adalah "hal yang
 * tidak bisa di-className", maka `style` diizinkan di sini.
 *
 * `visible` bisa di-toggle: false -> fade-out ke opacity 0 (tetap di-mount,
 * `pointerEvents="none"` agar tidak menangkap tap). Kalau perlu unmount
 * setelah keluar, dengarkan `onHidden`.
 *
 * <Stagger> memberi `delay` bertingkat ke tiap anak FadeIn — untuk list
 * pendek (<= 6 item, mis. kartu ringkasan). Jangan untuk FlatList panjang:
 * item yang masuk saat scroll tidak butuh reveal (§8 loading inline = tenang).
 *
 * Struktur dua lapis (non-obvious): `Animated.View` TIDAK di-interop
 * NativeWind (konvensi repo — lihat backdrop, modal, stepper, bottom-sheet),
 * jadi `className`/props View diletakkan di <View> pembungkus dan
 * Animated.View di dalamnya hanya memegang opacity/transform. Animated.View
 * diberi `flex: 1` agar ikut mengisi pembungkus bila pemanggil memberi
 * `flex-1` (mis. carousel onboarding); saat pembungkus auto-height, flex 1
 * dengan basis 0 di parent tak-terdefinisi jatuh ke ukuran konten (Yoga &
 * CSS sama), sehingga pemakaian lama tidak berubah.
 */
import { Children, useEffect, useRef, type ReactNode } from "react"
import { Animated, Easing, View, type ViewProps } from "react-native"

import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

export type FadeDuration = "fast" | "base" | "slow"

export type FadeInProps = Omit<ViewProps, "children" | "style"> & {
  children?: ReactNode
  duration?: FadeDuration
  /** ms sebelum animasi mulai (dipakai Stagger) */
  delay?: number
  /** Geser dari bawah 8px saat masuk (default true) */
  translate?: boolean
  /** false = fade-out (tetap mounted, tidak menerima tap) */
  visible?: boolean
  onShown?: () => void
  onHidden?: () => void
  className?: string
}

export function FadeIn({
  children,
  duration = "base",
  delay = 0,
  translate = true,
  visible = true,
  onShown,
  onHidden,
  ...rest
}: FadeInProps) {
  const progress = useRef(new Animated.Value(visible ? 0 : 0)).current
  const first = useRef(true)
  // Reduce Motion (audit #2): tampil instan (durasi & delay 0) dan tanpa
  // geser. Stagger otomatis ikut karena hanya meneruskan `delay`.
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: motionDuration(reducedMotion, tokens.motion.duration[duration]),
      delay: first.current ? motionDuration(reducedMotion, delay) : 0,
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: true,
    })
    first.current = false
    anim.start(({ finished }) => {
      if (!finished) return
      if (visible) onShown?.()
      else onHidden?.()
    })
    return () => anim.stop()
  }, [visible, duration, delay, progress, onShown, onHidden, reducedMotion])

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [translate && !reducedMotion ? tokens.space[2] : 0, 0],
  })

  return (
    <View accessible={false} pointerEvents={visible ? "auto" : "none"} {...rest}>
      <Animated.View style={{ flex: 1, opacity: progress, transform: [{ translateY }] }}>{children}</Animated.View>
    </View>
  )
}

export type StaggerProps = Pick<FadeInProps, "duration" | "translate"> & {
  children: ReactNode
  /** Selisih delay antar anak (ms). Default 50 — total <= ~300ms untuk 6 item */
  step?: number
  /** Delay anak pertama */
  initialDelay?: number
}

export function Stagger({
  children,
  step = 50,
  initialDelay = 0,
  duration = "base",
  translate = true,
}: StaggerProps) {
  return (
    <>
      {Children.map(children, (child, i) =>
        child == null ? null : (
          <FadeIn duration={duration} translate={translate} delay={initialDelay + i * step}>
            {child}
          </FadeIn>
        ),
      )}
    </>
  )
}
