/**
 * Kahade — <SaveAction> (ikon simpan/bookmark; audit Etalase 2026-10-08).
 *
 * Satu tombol simpan untuk kartu feed dan baris aksi detail. Dulu keduanya
 * merender <Icon weight={saved ? "fill" : "regular"}> mentah — berpindah
 * state tanpa gerakan sama sekali, timpang di samping <LikeAction> yang
 * berdenyut. Instagram/Threads memberi bookmark "pop" kecil; pengguna membaca
 * itu sebagai konfirmasi bahwa ketukannya diterima.
 *
 * Motion (§8 — ekspresif tapi lebih tenang dari suka; simpan adalah aksi
 * privat, bukan sosial):
 *   1. Crossfade dua ikon bertumpuk — BookmarkSimple garis melebur menjadi
 *      penuh. Warna ikon Phosphor adalah prop (bukan style), jadi dua lapis
 *      opacity adalah satu-satunya cara transisi mulus (pola <LikeAction>).
 *   2. Pop dengan antisipasi: mengecil sejenak lalu spring ke 1.2 dan menetap
 *      di 1 — springPlayful, tanpa wiggle dan tanpa ring (itu bahasa suka).
 *   3. "Tuck": ikon bergeser 2px ke bawah lalu kembali — bookmark terasa
 *      diselipkan, bukan sekadar berganti warna. Transform saja; layout diam.
 *
 * Warna: text-primary di kedua state (accent == primary di DS ini, §2.3b),
 * sama dengan ikon lama — hanya bobot garis→penuh yang berubah.
 *
 * Reduced motion: state akhir dipasang instan. Gerakan tidak pernah menjadi
 * satu-satunya umpan balik (label a11y + `selected` tetap berubah).
 *
 * Long press adalah gesture tersendiri (daftar penyimpan di detail) dan tidak
 * boleh jatuh ke toggle simpan — guard ref yang sama dengan <LikeAction>.
 */
import { useEffect, useRef } from "react"
import { View } from "react-native"
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { BookmarkSimple } from "phosphor-react-native"

import { useTheme } from "@/components/theme-provider"
import { focusRing } from "@/lib/focus-ring"
import { tokens } from "@/lib/tokens"
import { translate } from "@/lib/i18n/translate"
import { cn } from "@/lib/cn"
import { useReducedMotion } from "@/lib/use-reduced-motion"

import { PressableScale } from "@/components/ui/pressable-scale"

export type SaveActionProps = {
  saved: boolean
  onPress: () => void
  /** Long press membuka daftar penyimpan (hanya detail milik sendiri). */
  onLongPress?: () => void
  /** S-02: request simpan sedang berjalan — a11y `busy` + visual diredupkan. */
  busy?: boolean
  accessibilityHint?: string
  className?: string
}

/** Ukuran ikon — sama dengan tombol bagikan di baris aksi (Icon size="md"). */
const ICON_SIZE = tokens.icon.size.md

export function SaveAction({
  saved,
  onPress,
  onLongPress,
  busy = false,
  accessibilityHint,
  className,
}: SaveActionProps) {
  const { mode } = useTheme()
  const reducedMotion = useReducedMotion()
  const textPrimary = tokens.colors[mode].textPrimary

  /** 0 = belum disimpan, 1 = tersimpan — menggerakkan crossfade ikon. */
  const progress = useSharedValue(saved ? 1 : 0)
  const scale = useSharedValue(1)
  const translateY = useSharedValue(0)
  const longPressTriggered = useRef(false)

  useEffect(() => {
    if (saved === (progress.value === 1)) return
    if (reducedMotion) {
      progress.value = saved ? 1 : 0
      scale.value = 1
      translateY.value = 0
      return
    }
    if (saved) {
      progress.value = withSpring(1, tokens.motion.springPlayful)
      scale.value = withSequence(
        withTiming(0.7, { duration: 80, easing: Easing.bezier(...tokens.motion.easing.exit) }),
        withSpring(1.2, { damping: 10, stiffness: 260, mass: 0.7 }),
        withSpring(1, tokens.motion.springPlayful),
      )
      translateY.value = withSequence(
        withTiming(2, { duration: 80 }),
        withSpring(0, tokens.motion.springPlayful),
      )
    } else {
      progress.value = withTiming(0, { duration: 140 })
      scale.value = withSequence(
        withTiming(0.85, { duration: 100 }),
        withSpring(1, tokens.motion.springPlayful),
      )
      translateY.value = withTiming(0, { duration: 100 })
    }
  }, [saved, progress, scale, translateY, reducedMotion])

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }))
  const savedOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }))
  const plainOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
  }))

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={saved ? translate("Hapus dari tersimpan") : translate("Simpan")}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: saved, busy }}
      haptic
      onPressIn={() => {
        longPressTriggered.current = false
      }}
      onPress={() => {
        if (longPressTriggered.current) {
          longPressTriggered.current = false
          return
        }
        onPress()
      }}
      onLongPress={() => {
        // Long press tidak boleh jatuh ke toggle simpan, juga saat pemanggil
        // tidak punya daftar penyimpan (perilaku tombol detail lama).
        longPressTriggered.current = true
        onLongPress?.()
      }}
      containerClassName={cn("min-h-11 min-w-11 items-center justify-center rounded-md", focusRing)}
      className={cn(busy && "opacity-60", className)}
    >
      <Animated.View style={iconStyle}>
        {/* Kotak ikon di dalam Animated.View — className di komponen Reanimated
            tidak di-interop NativeWind; geometri hidup di <View> biasa. */}
        <View className="h-6 w-6 items-center justify-center">
          <Animated.View style={plainOpacity}>
            <BookmarkSimple size={ICON_SIZE} color={textPrimary} weight="regular" />
          </Animated.View>
          <Animated.View style={[{ position: "absolute" }, savedOpacity]}>
            <BookmarkSimple size={ICON_SIZE} color={textPrimary} weight="fill" />
          </Animated.View>
        </View>
      </Animated.View>
    </PressableScale>
  )
}
