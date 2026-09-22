/**
 * Kahade — <PressableScale> primitif interaksi (§8 "Button press").
 *
 * Dasar untuk Button, IconButton, Chip, ListItem, Card interaktif, dst.
 * Menangani TIGA hal yang harus seragam di seluruh app:
 *   1. Pressed  : scale -> tokens.motion.scale.press (0.97), 150ms, easing standar.
 *   2. Disabled : opacity tokens.motion.opacity.disabled (0.4) via class
 *                 `opacity-disabled` — BUKAN warna solid terpisah (§9.1).
 *   3. Web      : tidak ada hover state (§11) — cursor pointer saja (default
 *                 RN Web untuk Pressable dengan onPress).
 *
 * KEPUTUSAN PRODUK DISENGAJA & DIKONFIRMASI TIM (bukan default yang belum dipikirkan): scale seragam 0.97, tanpa hover web — JANGAN "diperbaiki" tanpa keputusan tim baru.
 *
 * Ripple (revisi 2026-09-21, permintaan pemilik produk): permukaan yang
 * DISAPU JARI — baris list (chat, notifikasi) dan item bottom navigation —
 * kini memakai umpan balik ripple lewat prop opt-in `ripple`. Keputusan lama
 * "tanpa ripple Android" diganti untuk kategori permukaan itu saja; Button,
 * IconButton, Chip, Card, dan kontrol form TETAP tanpa ripple (scale/underlay
 * mereka sudah cukup, dan ripple di dalam kartu beradius kecil terlihat
 * berminyak). Jangan menyalakan `ripple` di luar kategori yang disebut di
 * atas tanpa keputusan produk baru.
 *
 * Dua mekanisme, satu token (`tokens.colors[mode].pressed`):
 *   - Android : `android_ripple` native (Material), digambar di belakang isi
 *     baris sehingga teks tetap tajam, dan otomatis terpotong mengikuti
 *     radius kontainer.
 *   - iOS/web : tidak ada ripple native → underlay `bg-pressed` (lapisan
 *     absolut seukuran kontainer) yang menyala saat ditekan, persis pola
 *     TouchableHighlight. Kontainer diberi `overflow-hidden` supaya lapisan
 *     itu mengikuti radius (chip/pill) alih-alih menonjol keluar.
 *
 * Kenapa transform lewat RN `Animated` + inner View (non-obvious):
 *   - Transform yang dianimasikan adalah "hal yang tidak bisa di-className",
 *     jadi StyleSheet/Animated diizinkan di sini saja. Komponen di atasnya
 *     cukup memberi className.
 *   - `Animated.View` bukan komponen yang di-interop NativeWind, maka
 *     className diletakkan pada <View> di dalamnya, bukan pada Animated.View.
 *   - RN `Animated` (bukan reanimated) mengikuti keputusan animated-splash.tsx
 *     agar tidak menambah dependensi untuk animasi sesederhana ini. Bottom
 *     sheet memakai reanimated; pull-to-refresh memakai RN Animated +
 *     PanResponder supaya jalur scroll tidak bergantung pada UI worklet.
 *
 * Haptic (`haptic` prop, default OFF — §8 "tidak dipakai di interaksi ringan"):
 *   - `haptic={true}` = "light" saat pressIn; atau kirim `HapticKind` spesifik.
 *   - Dipicu di pressIn (bukan onPress) supaya getaran sinkron dengan scale
 *     down — feedback fisik dan visual satu momen, seperti tombol asli.
 *   - Opsional & opt-in agar Button/IconButton/ListItem biasa tetap sunyi;
 *     hanya aksi penting (konfirmasi PIN, kirim dana) yang menyalakannya.
 */
import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import {
  Animated,
  Easing,
  Platform,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type View as RNView,
} from "react-native"
import { useColorScheme } from "nativewind"

import { cn } from "@/lib/cn"
import { useTransformAwarePressable } from "@/components/ui/gesture-pressable"
import { translateProp, useLanguage } from "@/lib/i18n"
import { haptic as fireHaptic, type HapticKind } from "@/lib/haptics"
import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"

export type PressableScaleProps = Omit<PressableProps, "style" | "children"> & {
  /** className untuk kotak visual (border, bg, padding, radius) */
  className?: string
  /** className untuk hit area luar (mis. "w-full" / "self-start") */
  containerClassName?: string
  /** Matikan animasi scale (mis. untuk list item panjang) */
  scaleOnPress?: boolean
  /** Getaran saat ditekan. `true` = "light". Default OFF (§8). */
  haptic?: boolean | HapticKind
  /**
   * Umpan balik sentuh "ripple" untuk permukaan yang disapu jari (baris list,
   * item tab bar). Android memakai `android_ripple` native; iOS/web memakai
   * underlay `bg-pressed` (lihat docblock di atas). Default OFF.
   */
  ripple?: boolean
  children?: React.ReactNode
}

export const PressableScale = forwardRef<RNView, PressableScaleProps>(function PressableScale(
  {
    className,
    containerClassName,
    scaleOnPress = true,
    haptic = false,
    ripple = false,
    disabled,
    onPressIn,
    onPressOut,
    accessibilityState,
    accessibilityLabel,
    children,
    ...rest
  },
  ref,
) {
  // E-02 (audit): label aksesibilitas ikut diterjemahkan di primitif —
  // VoiceOver/TalkBack EN sebelumnya mendengar campuran ID/EN di SEMUA
  // tombol/baris (Button, IconButton, Chip, Card menekan PressableScale).
  // useLanguage: label ikut ter-render ulang saat pengguna berpindah bahasa.
  useLanguage()
  const localizedLabel = translateProp(accessibilityLabel)
  // Di dalam BottomSheet (overlay Reanimated di Fabric native), Pressable
  // bawaan bisa tidak memanggil onPress karena responder region-nya diukur
  // dari shadow tree yang basi pasca-animasi (RN #51621); hook ini menukarnya
  // dengan GesturePressable (target dari view native). Web tidak berubah.
  const PressableComponent = useTransformAwarePressable()

  const scale = useRef(new Animated.Value(1)).current
  const activeAnimation = useRef<Animated.CompositeAnimation | null>(null)
  // Reduce Motion (audit #2): scale press adalah gerakan non-esensial ->
  // dimatikan total. Feedback pressed tetap ada lewat haptic (bila opt-in)
  // dan state a11y; komponen turunan (Button, Chip, Card) otomatis ikut.
  const reducedMotion = useReducedMotion()
  const shouldScale = scaleOnPress && !reducedMotion

  // ── Ripple (opt-in) ────────────────────────────────────────────────────
  // Warna satu token untuk dua mekanisme: `android_ripple` (Android) dan
  // underlay `bg-pressed` (iOS/web). Mode dibaca dari nativewind langsung
  // (bukan useTheme()) supaya primitif ini tetap bisa dirender di luar
  // ThemeProvider — nilainya identik, ThemeProvider hanya menyimpan preferensi.
  const { colorScheme } = useColorScheme()
  const rippleColor = tokens.colors[colorScheme === "dark" ? "dark" : "light"].pressed
  /** Underlay hanya dibutuhkan platform tanpa ripple native. */
  const useUnderlay = ripple && Platform.OS !== "android"
  const [pressed, setPressed] = useState(false)
  useEffect(() => {
    // Prop ripple mati saat sedang ditekan (mis. masuk mode pilih) → jangan
    // tinggalkan underlay menyala.
    if (!useUnderlay) setPressed(false)
  }, [useUnderlay])

  const animateTo = useCallback(
    (to: number) => {
      // Rapid tap/press cancellation must not leave two native animations
      // fighting over the same value (which could strand a button at 0.97).
      activeAnimation.current?.stop()
      const anim = Animated.timing(scale, {
        toValue: to,
        duration: tokens.motion.duration.press,
        easing: Easing.bezier(...tokens.motion.easing.standard),
        useNativeDriver: true,
      })
      activeAnimation.current = anim
      anim.start(({ finished }) => {
        if (finished && activeAnimation.current === anim) activeAnimation.current = null
      })
    },
    [scale],
  )

  useEffect(() => {
    if (reducedMotion) {
      activeAnimation.current?.stop()
      activeAnimation.current = null
      scale.setValue(1)
    }
    return () => {
      activeAnimation.current?.stop()
      activeAnimation.current = null
    }
  }, [reducedMotion, scale])

  /**
   * H-03 (audit 2026-09-22): callback PEMANGGIL dijalankan LEBIH DULU, baru
   * efek internal (animasi scale + haptic). Versi sebelumnya menunggu
   * `animateTo` + `fireHaptic` selesai, sehingga pemanggil yang mengukur
   * durasi dari `onPressIn` (mis. long-press "hapus semua" di
   * `amount-keypad.tsx`) mendapat titik awal yang tergeser di perangkat
   * lambat — ambangnya jadi tidak deterministik. Efek visual/haptic tidak
   * bergantung pada nilai balik pemanggil, jadi urutan ini aman.
   */
  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      onPressIn?.(e)
      if (shouldScale) animateTo(tokens.motion.scale.press)
      if (useUnderlay) setPressed(true)
      if (haptic) fireHaptic(haptic === true ? "light" : haptic)
    },
    [animateTo, haptic, onPressIn, shouldScale, useUnderlay],
  )

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      onPressOut?.(e)
      if (shouldScale) animateTo(1)
      if (useUnderlay) setPressed(false)
    },
    [animateTo, onPressOut, shouldScale, useUnderlay],
  )

  // Cleanup anim on unmount: prevent warning if component unmounts mid-press (150ms)
  // Animated.timing with native driver will auto-stop on unmount, but we keep ref for safety.

  return (
    <PressableComponent
      ref={ref}
      disabled={disabled}
      unstable_pressDelay={Platform.OS === "android" ? 50 : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      className={cn(containerClassName, useUnderlay && "overflow-hidden")}
      accessibilityLabel={localizedLabel}
      {...rest}
      android_ripple={ripple ? { color: rippleColor } : rest.android_ripple}
    >
      {useUnderlay ? (
        /* Underlay tekan iOS/web: lapisan absolut seukuran kontainer, di
           BELAKANG isi (dirender lebih dulu) supaya teks/ikon tetap tajam.
           `pointerEvents: "none"` agar tidak mencuri ketukan dari Pressable. */
        <View
          accessibilityRole="none"
          importantForAccessibility="no"
          style={{ pointerEvents: "none" }}
          className={cn(
            "absolute inset-0 bg-pressed",
            pressed && !disabled ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
      <Animated.View style={{ transform: [{ scale }] }}>
        <View className={cn(className, disabled && "opacity-disabled")}>{children}</View>
      </Animated.View>
    </PressableComponent>
  )
})
