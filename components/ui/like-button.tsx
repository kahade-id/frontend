/**
 * Kahade — <LikeAction> (ikon + hitungan suka; revisi 2026-09-23).
 *
 * Permintaan produk: like di Etalase berwarna MERAH dengan motion yang
 * terasa. Anatomi barisnya sama dengan CountAction di <ShowcaseFeedItem>
 * (ikon · angka · label sejajar, min-h-11) sehingga bisa dipakai di feed,
 * di halaman detail, dan di tempat suka lain tanpa merusak irama list.
 *
 * Motion (§8 — ini memang momen ekspresif, bukan transisi rutin):
 *   1. Crossfade dua ikon bertumpuk — HeartStraight (garis) melebur menjadi
 *      Heart (penuh). Warna ikon Phosphor adalah prop (bukan style), jadi
 *      transisi warna+dalam-bentuk paling mulus adalah dua lapis opacity,
 *      pola yang sama dengan <SegmentGlyph> di ModeSwitcher.
 *   2. Pop dengan antisipasi: sekilas mengecil (90ms, ease-in) lalu spring
 *      meledak ke 1.35 dan menetap di 1 — springPlayful (overshoot halus),
 *      bukan spring utilitarian bottom sheet.
 *   3. Wiggle rotasi kecil (-10° → +9° → 0) berjalan sepop — jantung
 *      "berdebar" sesaat; transform saja, layout tidak tergeser.
 *   4. Ring merah mekar dari tengah ikon (scale 0.5→1.9, memudar) — satu
 *      denyut singkat sebagai aksen, bukan confetti yang menutupi feed.
 *   5. Angka hitungan ikut merah saat disukai (tone danger, §2.3).
 *
 * Reduced motion: seluruh koreografi dilewati — state akhir dipasang instan.
 * Gerakan like tidak pernah menjadi satu-satunya umpan balik (angka + warna
 * + label a11y tetap berubah).
 */
import { useEffect } from "react"
import { View } from "react-native"
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { Heart, HeartStraight } from "phosphor-react-native"

import { useTheme } from "@/components/theme-provider"
import { formatCountCompact } from "@/lib/format"
import { focusRing } from "@/lib/focus-ring"
import { tokens } from "@/lib/tokens"
import { translate } from "@/lib/i18n/translate"
import { cn } from "@/lib/cn"
import { useReducedMotion } from "@/lib/use-reduced-motion"

import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"

export type LikeActionProps = {
  liked: boolean
  count: number
  onPress?: () => void
  /** Label setelah angka (default "Suka"). */
  label?: string
  className?: string
}

const RING_BOX = 40
/** Ukuran ikon — sama dengan CountAction (Icon size="md"). */
const HEART_SIZE = tokens.icon.size.md

export function LikeAction({ liked, count, onPress, label = "Suka", className }: LikeActionProps) {
  const { mode } = useTheme()
  const reducedMotion = useReducedMotion()
  const dangerFill = tokens.colors.semantic.danger[mode].fill
  const dangerSoft = tokens.colors.semantic.danger[mode].bgSoft
  const textPrimary = tokens.colors[mode].textPrimary

  /** 0 = tidak disukai, 1 = disukai — menggerakkan crossfade ikon. */
  const progress = useSharedValue(liked ? 1 : 0)
  const scale = useSharedValue(1)
  const rotate = useSharedValue(0)
  /** 0→1 = ring mekar sampai habis. */
  const ring = useSharedValue(0)

  useEffect(() => {
    if (liked === (progress.value === 1)) return
    if (reducedMotion) {
      progress.value = liked ? 1 : 0
      scale.value = 1
      rotate.value = 0
      ring.value = 0
      return
    }
    if (liked) {
      progress.value = withSpring(1, tokens.motion.springPlayful)
      // Antisipasi mengecil → meledak → menetap. withSequence membuat pop
      // tetap mulus meski pengguna tap suka/batal dengan cepat beruntun.
      scale.value = withSequence(
        withTiming(0.55, { duration: 90, easing: Easing.bezier(...tokens.motion.easing.exit) }),
        withSpring(1.35, { damping: 9, stiffness: 260, mass: 0.7 }),
        withSpring(1, tokens.motion.springPlayful),
      )
      rotate.value = withSequence(
        withTiming(-10, { duration: 90 }),
        withSpring(9, { damping: 9, stiffness: 240 }),
        withSpring(0, tokens.motion.springPlayful),
      )
      ring.value = 0
      ring.value = withDelay(70, withTiming(1, { duration: 520 }))
    } else {
      progress.value = withTiming(0, { duration: 140 })
      scale.value = withSequence(
        withTiming(0.82, { duration: 110 }),
        withSpring(1, tokens.motion.springPlayful),
      )
      rotate.value = withTiming(0, { duration: 110 })
      ring.value = withTiming(0, { duration: 120 })
    }
  }, [liked, progress, scale, rotate, ring, reducedMotion])

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }))
  const likedOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }))
  const plainOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
  }))
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.05, 1], [0, 0.9, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.5, 1.9]) }],
  }))

  const content = (
    <>
      <View className="h-6 w-6 items-center justify-center">
        {/* Ring mekar — di belakang ikon, diperbolehkan keluar kotaknya.
            pointerEvents lewat style (prop RN/web deprecated, audit #5). */}
        <Animated.View
          style={[
            {
              position: "absolute",
              width: RING_BOX,
              height: RING_BOX,
              borderRadius: RING_BOX / 2,
              borderWidth: tokens.borderWidth.badge,
              borderColor: dangerFill,
              backgroundColor: dangerSoft,
              pointerEvents: "none",
            },
            ringStyle,
          ]}
        />
        <Animated.View style={heartStyle}>
          {/* Kotak ikon di dalam Animated.View — className di komponen
              Reanimated tidak pernah menjadi style (tidak di-interop
              NativeWind); geometri hidup di <View> biasa di dalamnya. */}
          <View className="h-6 w-6 items-center justify-center">
            {/* Lapis garis (belum disukai) — crossfade keluar saat disukai. */}
            <Animated.View style={plainOpacity}>
              <HeartStraight size={HEART_SIZE} color={textPrimary} weight="regular" />
            </Animated.View>
            {/* Lapis penuh merah (disukai) — menimpa di titik yang sama. */}
            <Animated.View style={[{ position: "absolute" }, likedOpacity]}>
              <Heart size={HEART_SIZE} color={dangerFill} weight="fill" />
            </Animated.View>
          </View>
        </Animated.View>
      </View>
      <Text
        variant="caption"
        weight={600}
        tone={liked ? "danger" : "primary"}
        className="tabular-nums"
      >
        {formatCountCompact(count)}
      </Text>
      <Text variant="caption" tone="secondary">
        {translate(label)}
      </Text>
    </>
  )

  if (!onPress) {
    return (
      <View className={cn("min-h-11 flex-row items-center gap-1.5 px-3", className)}>{content}</View>
    )
  }

  return (
    // B-04 (audit 2026-09-23): literal ternary dibungkus `translate` —
    // string di dalam `{}` atribut JSX tidak terbaca scanner i18n lama
    // (scanner-nya sudah diperbaiki; pemanggilan eksplisit menjamin lookup).
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={liked ? translate("Hapus suka") : translate("Sukai")}
      accessibilityHint={translate("{x} suka", { x: formatCountCompact(count) })}
      accessibilityState={{ selected: liked }}
      haptic
      onPress={onPress}
      containerClassName={cn("min-h-11 flex-row items-center rounded-md px-3", focusRing)}
      className={cn("flex-row items-center gap-1.5", className)}
    >
      {content}
    </PressableScale>
  )
}
