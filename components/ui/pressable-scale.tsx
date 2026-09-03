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
 * Kenapa transform lewat RN `Animated` + inner View (non-obvious):
 *   - Transform yang dianimasikan adalah "hal yang tidak bisa di-className",
 *     jadi StyleSheet/Animated diizinkan di sini saja. Komponen di atasnya
 *     cukup memberi className.
 *   - `Animated.View` bukan komponen yang di-interop NativeWind, maka
 *     className diletakkan pada <View> di dalamnya, bukan pada Animated.View.
 *   - RN `Animated` (bukan reanimated) mengikuti keputusan animated-splash.tsx
 *     agar tidak menambah dependensi untuk animasi sesederhana ini. Bottom
 *     sheet/pull-to-refresh yang butuh spring gesture tetap pakai reanimated.
 *
 * Haptic (`haptic` prop, default OFF — §8 "tidak dipakai di interaksi ringan"):
 *   - `haptic={true}` = "light" saat pressIn; atau kirim `HapticKind` spesifik.
 *   - Dipicu di pressIn (bukan onPress) supaya getaran sinkron dengan scale
 *     down — feedback fisik dan visual satu momen, seperti tombol asli.
 *   - Opsional & opt-in agar Button/IconButton/ListItem biasa tetap sunyi;
 *     hanya aksi penting (konfirmasi PIN, kirim dana) yang menyalakannya.
 */
import { forwardRef, useCallback, useRef } from "react"
import {
  Animated,
  Easing,
  Pressable,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type View as RNView,
} from "react-native"

import { cn } from "@/lib/cn"
import { haptic as fireHaptic, type HapticKind } from "@/lib/haptics"
import { tokens } from "@/lib/tokens"

export type PressableScaleProps = Omit<PressableProps, "style" | "children"> & {
  /** className untuk kotak visual (border, bg, padding, radius) */
  className?: string
  /** className untuk hit area luar (mis. "w-full" / "self-start") */
  containerClassName?: string
  /** Matikan animasi scale (mis. untuk list item panjang) */
  scaleOnPress?: boolean
  /** Getaran saat ditekan. `true` = "light". Default OFF (§8). */
  haptic?: boolean | HapticKind
  children?: React.ReactNode
}

export const PressableScale = forwardRef<RNView, PressableScaleProps>(function PressableScale(
  {
    className,
    containerClassName,
    scaleOnPress = true,
    haptic = false,
    disabled,
    onPressIn,
    onPressOut,
    accessibilityState,
    children,
    ...rest
  },
  ref,
) {
  const scale = useRef(new Animated.Value(1)).current

  const animateTo = useCallback(
    (to: number) => {
      Animated.timing(scale, {
        toValue: to,
        duration: tokens.motion.duration.press,
        easing: Easing.bezier(...tokens.motion.easing.standard),
        useNativeDriver: true,
      }).start()
    },
    [scale],
  )

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      if (scaleOnPress) animateTo(tokens.motion.scale.press)
      if (haptic) fireHaptic(haptic === true ? "light" : haptic)
      onPressIn?.(e)
    },
    [animateTo, haptic, onPressIn, scaleOnPress],
  )

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      if (scaleOnPress) animateTo(1)
      onPressOut?.(e)
    },
    [animateTo, onPressOut, scaleOnPress],
  )

  return (
    <Pressable
      ref={ref}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      className={containerClassName}
      {...rest}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View className={cn(className, disabled && "opacity-disabled")}>{children}</View>
      </Animated.View>
    </Pressable>
  )
})
