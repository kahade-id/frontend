/**
 * Kahade — <FadeIn> + <Stagger> primitif motion masuk (§8).
 *
 * Reveal halus untuk konten yang baru datang (hasil fetch, section yang
 * muncul setelah kondisi terpenuhi). Durasi HANYA dari tokens.motion
 * (fast 250 / base 300 / slow 350). Kurva default "enter" (soft-decelerate v2)
 * — reveal adalah gerakan MASUK; "standard" untuk yang rutin, "exit" untuk
 * fade-out yang harus terasa segera. Pergeseran vertikal default space.2 (8px)
 * — cukup terasa "naik", tidak teatrikal; variasikan `distance` + durasi +
 * `step` Stagger sesuai densitas konten tiap layar (v2: jangan tempel FadeIn
 * identik ke semua layar — monoton versi baru).
 *
 * Kenapa RN `Animated`, bukan reanimated (non-obvious): mengikuti keputusan
 * pressable-scale.tsx & animated-splash.tsx — opacity/translate sederhana
 * dengan native driver sudah 60fps, dan reanimated disisakan untuk gesture
 * kompleks seperti bottom sheet. Pull-to-refresh juga memakai RN Animated,
 * tetapi dengan PanResponder JS yang terisolasi. Transform/opacity adalah "hal yang
 * tidak bisa di-className", maka `style` diizinkan di sini.
 *
 * `visible` bisa di-toggle: false -> fade-out ke opacity 0 (tetap di-mount,
 * `style.pointerEvents: "none"` agar tidak menangkap tap). Kalau perlu unmount
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
export type FadeEasing = "standard" | "enter" | "exit"

const easingCurve: Record<FadeEasing, readonly [number, number, number, number]> = {
  standard: tokens.motion.easing.standard,
  enter: tokens.motion.easing.enter,
  exit: tokens.motion.easing.exit,
}

export type FadeInProps = Omit<ViewProps, "children" | "style"> & {
  children?: ReactNode
  duration?: FadeDuration
  /** Kurva v2 — "enter" untuk reveal masuk (default), "exit" untuk keluar. */
  easing?: FadeEasing
  /** ms sebelum animasi mulai (dipakai Stagger) */
  delay?: number
  /** Geser dari bawah saat masuk (default true) */
  translate?: boolean
  /** Jarak geser px (default space.2 = 8) — variasikan per densitas layar. */
  distance?: number
  /** false = fade-out (tetap mounted, tidak menerima tap) */
  visible?: boolean
  onShown?: () => void
  onHidden?: () => void
  className?: string
}

export function FadeIn({
  children,
  duration = "base",
  easing = "enter",
  delay = 0,
  translate = true,
  distance = tokens.space[2],
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
    const curve = easingCurve[easing]
    const anim = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: motionDuration(reducedMotion, tokens.motion.duration[duration]),
      delay: first.current ? motionDuration(reducedMotion, delay) : 0,
      easing: Easing.bezier(curve[0], curve[1], curve[2], curve[3]),
      useNativeDriver: true,
    })
    first.current = false
    anim.start(({ finished }) => {
      if (!finished) return
      if (visible) onShown?.()
      else onHidden?.()
    })
    return () => anim.stop()
  }, [visible, duration, easing, delay, progress, onShown, onHidden, reducedMotion])

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [translate && !reducedMotion ? distance : 0, 0],
  })

  return (
    <View style={{ pointerEvents: visible ? "auto" : "none" }} {...rest}>
      <Animated.View style={{ flex: 1, opacity: progress, transform: [{ translateY }] }}>{children}</Animated.View>
    </View>
  )
}

export type StaggerProps = Pick<FadeInProps, "duration" | "easing" | "translate" | "distance"> & {
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
  easing = "enter",
  translate = true,
  distance,
}: StaggerProps) {
  return (
    <>
      {Children.map(children, (child, i) =>
        child == null ? null : (
          <FadeIn duration={duration} easing={easing} translate={translate} distance={distance} delay={initialDelay + i * step}>
            {child}
          </FadeIn>
        ),
      )}
    </>
  )
}

/**
 * <Crossfade> — skeleton → konten tanpa swap keras (v2 signature moment).
 *
 * Saat `loading`, skeleton tampil apa adanya; saat data tiba, konten masuk
 * lewat FadeIn (fade + naik 8px, kurva enter). `contentKey` me-remount FadeIn
 * tiap muatan baru (mis. id transaksi) supaya reveal terulang — kirim string
 * stabil (bukan objek) agar tidak me-remount tiap render.
 *
 * Bukan untuk skeleton yang BERGANTI ISI saat loading (pakai key di skeleton
 * itu sendiri); khusus transisi loading → loaded di layar data.
 */
export function Crossfade({
  loading,
  skeleton,
  contentKey,
  children,
  duration = "fast",
}: {
  loading: boolean
  skeleton: ReactNode
  contentKey?: string
  children: ReactNode
  duration?: FadeDuration
}) {
  if (loading) return <>{skeleton}</>
  return (
    <FadeIn key={contentKey} duration={duration}>
      {children}
    </FadeIn>
  )
}
