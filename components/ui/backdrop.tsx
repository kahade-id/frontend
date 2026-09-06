/**
 * Kahade — <Backdrop> + useOverlayPresence() (§6.2 layer "Backdrop" = 40).
 *
 * Dua primitif yang dipakai bersama oleh Modal, BottomSheet, ActionSheet:
 *   1. useOverlayPresence(visible)
 *      Mengubah boolean `visible` menjadi { mounted, progress }:
 *      - `mounted`  : true selama overlay harus ada di tree — tetap true
 *                     SETELAH visible=false sampai animasi keluar selesai,
 *                     supaya exit animation sempat jalan (RN tidak punya
 *                     "unmount transition" bawaan).
 *      - `progress` : Animated.Value 0..1 untuk di-interpolate ke opacity /
 *                     translateY / scale oleh pemanggil.
 *   2. <Backdrop>
 *      Scrim gelap semi-transparan yang fade mengikuti `progress`, dan
 *      menangkap tap untuk menutup overlay (`onPress`).
 *
 * Keputusan non-obvious:
 *   - Warna scrim = token mode `overlay` (§2.4, class `bg-overlay`) yang sudah
 *     berbeda alpha per mode; jadi TIDAK perlu `dark:` di sini.
 *   - Durasi masuk/keluar dari `motion.overlay` (§8): keluar lebih singkat
 *     dari masuk supaya dismiss terasa segera.
 *   - RN `Animated`, bukan reanimated: keputusan project-wide (lihat
 *     pressable-scale/fade-in/toast) — animasi opacity/transform dengan native
 *     driver sudah cukup; reanimated + gesture-handler disisakan untuk gesture
 *     kompleks (pull-to-refresh, shared element).
 *   - `Animated.View` tidak di-interop NativeWind, jadi className diletakkan
 *     pada <Pressable> di dalamnya; Animated.View hanya membawa opacity.
 *   - Tidak ada hover/tint saat pointer di web (§11).
 */
import { useEffect, useRef, useState } from "react"
import { Animated, BackHandler, Easing, Platform, Pressable, StyleSheet } from "react-native"

import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

export type OverlayPresence = {
  /** Overlay harus ada di tree (termasuk selama animasi keluar) */
  mounted: boolean
  /** 0 = tertutup, 1 = terbuka penuh */
  progress: Animated.Value
}

export type OverlayPresenceOptions = {
  /** Durasi masuk (default motion.overlay.enterDuration) */
  durationIn?: number
  /** Durasi keluar (default motion.overlay.exitDuration — lebih singkat dari masuk) */
  durationOut?: number
  /** Dipanggil setelah animasi keluar selesai & overlay unmount */
  onHidden?: () => void
}

export function useOverlayPresence(
  visible: boolean,
  { durationIn, durationOut, onHidden }: OverlayPresenceOptions = {},
): OverlayPresence {
  const progress = useRef(new Animated.Value(0)).current
  const [mounted, setMounted] = useState(visible)
  const onHiddenRef = useRef(onHidden)
  onHiddenRef.current = onHidden
  // Reduce Motion (audit #2): overlay tampil/hilang instan. `progress` tetap
  // 0->1 (timing 0ms) sehingga interpolasi translate/scale di Modal & fade
  // Backdrop langsung di posisi akhir, dan `onHidden` tetap terpanggil.
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (visible) {
      setMounted(true)
      const anim = Animated.timing(progress, {
        toValue: 1,
        duration: motionDuration(reducedMotion, durationIn ?? tokens.motion.overlay.enterDuration),
        easing: Easing.bezier(...tokens.motion.easing.standard),
        useNativeDriver: true,
      })
      anim.start()
      return () => anim.stop()
    }

    // Belum pernah tampil (mount dengan visible=false): tidak ada yang perlu
    // di-exit. Tanpa guard ini, timing 0->0 selesai instan dan `onHidden`
    // terpanggil palsu saat mount — parent yang reset form / navigasi di
    // onHidden akan salah bertindak.
    if (!mounted) return

    const anim = Animated.timing(progress, {
      toValue: 0,
      duration: motionDuration(reducedMotion, durationOut ?? tokens.motion.overlay.exitDuration),
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: true,
    })
    anim.start(({ finished }) => {
      if (!finished) return
      setMounted(false)
      onHiddenRef.current?.()
    })
    return () => anim.stop()
    // `mounted` sengaja TIDAK di deps: saat exit selesai mounted -> false,
    // efek tidak boleh berjalan ulang (akan memulai timing 0->0 kedua).
    // `reducedMotion` juga tidak di deps: nilainya hanya dibaca saat animasi
    // dimulai; perubahan setelan di tengah animasi tidak perlu restart.

  }, [visible, progress, durationIn, durationOut])

  return { mounted, progress }
}

/**
 * Tutup overlay lewat tombol Back (Android) atau Escape (web) selama `active`.
 * Handler Android mengembalikan true agar back TIDAK meneruskan ke router
 * (pop layar) saat overlay terbuka — overlay yang harus tutup lebih dulu.
 */
export function useOverlayDismissKeys(active: boolean, onDismiss?: () => void) {
  useEffect(() => {
    if (!active || !onDismiss) return

    if (Platform.OS === "web") {
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") onDismiss()
      }
      window.addEventListener("keydown", handler)
      return () => window.removeEventListener("keydown", handler)
    }

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onDismiss()
      return true
    })
    return () => sub.remove()
  }, [active, onDismiss])
}

export type BackdropProps = {
  progress: Animated.Value
  /** Tap di scrim (biasanya = tutup overlay). Undefined = scrim tidak bisa di-tap */
  onPress?: () => void
  /** Label a11y untuk aksi tap (default "Tutup") */
  accessibilityLabel?: string
  /** Scrim transparan (untuk Tooltip: tangkap tap di luar tanpa meredupkan layar) */
  transparent?: boolean
  className?: string
}

export function Backdrop({
  progress,
  onPress,
  accessibilityLabel = "Tutup",
  transparent = false,
  className,
}: BackdropProps) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
      <Pressable
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={onPress ? accessibilityLabel : undefined}
        // Backdrop tidak perlu masuk urutan fokus screen reader kalau tak ada aksi
        importantForAccessibility={onPress ? "yes" : "no-hide-descendants"}
        onPress={onPress}
        disabled={!onPress}
        className={cn(
          "flex-1 z-backdrop",
          transparent ? "bg-transparent" : "bg-overlay",
          className,
        )}
      />
    </Animated.View>
  )
}
