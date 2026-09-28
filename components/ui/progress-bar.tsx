/**
 * ProgressBar — indikator progres linear (determinate & indeterminate).
 *
 * Keputusan:
 *   1. Track `bg-surface border border-border`, fill `bg-primary` (monokrom).
 *      Tone semantik hanya untuk konteks yang benar-benar berarti status
 *      (mis. dana escrow "danger" saat sengketa) — default tetap primary.
 *      Tone "accent" (v2) untuk progres trust (skor trust, kelengkapan KYC).
 *   2. Tinggi: `sm` 4px (inline di list), `md` 8px (default). Radius pill
 *      (rounded-full) — track tipis adalah pengecualian pill yang diizinkan §5.
 *   3. Determinate dianimasikan lewat Animated width persen (native driver
 *      tidak mendukung width, jadi useNativeDriver=false — ini satu-satunya
 *      pengecualian yang diterima karena elemen kecil & jarang update).
 *   4. Indeterminate = blok 40% yang bergeser bolak-balik dengan translateX,
 *      native driver aktif. Lebar track diukur via onLayout.
 *   5. `label`/`showValue` opsional: teks caption text-secondary di atas bar,
 *      angka mono (mono = angka finansial/persen, §3).
 */
import { useEffect, useRef, useState } from "react"
import { Animated, Easing, View, type ViewProps } from "react-native"

import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/cn"
import { accent, modes, semantic, tokens, type ColorMode } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"
import { Text } from "./text"

export type ProgressTone = "primary" | "success" | "danger" | "warning" | "info" | "accent"
export type ProgressSize = "sm" | "md"

export type ProgressBarProps = Omit<ViewProps, "children"> & {
  /** 0–100. Abaikan (undefined) untuk mode indeterminate. */
  value?: number
  tone?: ProgressTone
  size?: ProgressSize
  label?: string
  /** Tampilkan "42%" di kanan label (determinate saja) */
  showValue?: boolean
  className?: string
}

/**
 * Warna fill per tone, mode-aware — dipakai sebagai `backgroundColor` INLINE
 * di <Animated.View>.
 *
 * ATURAN KERAS (insiden 2026-09-27, dipertegas audit web 2026-09-28):
 * `className` di <Animated.View>/<Reanimated.View> DIABAIKAN TOTAL di web —
 * bukan cuma `bg-*`. Interop className NativeWind (react-native-css-interop)
 * hanya terdaftar untuk komponen dasar (View/Text/Pressable/dsb); identity
 * Animated.View tidak ada di map, dan react-native-web tidak meneruskan
 * prop `className` ke DOM. Jadi SEMUA visual di sini harus inline `style`.
 */
function fillColorFor(tone: ProgressTone, mode: ColorMode): string {
  switch (tone) {
    case "success":
      return semantic.success[mode].fill
    case "danger":
      return semantic.danger[mode].fill
    case "warning":
      return semantic.warning[mode].fill
    case "info":
      return semantic.info[mode].fill
    case "accent":
      return accent[mode].fill
    default:
      return modes[mode].primary
  }
}

const trackHeight: Record<ProgressSize, string> = {
  sm: "h-1.5",
  md: "h-2",
}

/** NaN-safe: `Math.max(0, NaN)` stays NaN and becomes an invalid animated width. */
const clamp = (n: number) => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0)

export function ProgressBar({
  value,
  tone = "primary",
  size = "md",
  label,
  showValue = false,
  className,
  ...rest
}: ProgressBarProps) {
  const { mode: themeMode } = useTheme()
  const indeterminate = value === undefined
  const pct = indeterminate ? 0 : clamp(value)
  const fill = fillColorFor(tone, themeMode)

  const width = useRef(new Animated.Value(pct)).current
  const shift = useRef(new Animated.Value(0)).current
  const [trackW, setTrackW] = useState(0)
  // Reduce Motion (audit #2): progress adalah informasi ESENSIAL, jadi tetap
  // tampil — determinate langsung lompat ke nilai baru (tanpa tween);
  // indeterminate menjadi segmen statis selebar track dengan opacity
  // `disabled` (tanpa bolak-balik), masih terbaca "sedang berjalan" lewat
  // role progressbar tanpa nilai.
  const reducedMotion = useReducedMotion()

  // Determinate: animasikan perubahan value
  useEffect(() => {
    if (indeterminate) return
    Animated.timing(width, {
      toValue: pct,
      duration: motionDuration(reducedMotion, tokens.motion.duration.base),
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: false,
    }).start()
  }, [pct, indeterminate, width, reducedMotion])

  // Indeterminate: loop bolak-balik
  useEffect(() => {
    if (!indeterminate || trackW === 0) return
    if (reducedMotion) {
      shift.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shift, {
          toValue: 1,
          duration: tokens.motion.duration.slow * 3,
          easing: Easing.bezier(...tokens.motion.easing.standard),
          useNativeDriver: true,
        }),
        Animated.timing(shift, {
          toValue: 0,
          duration: tokens.motion.duration.slow * 3,
          easing: Easing.bezier(...tokens.motion.easing.standard),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [indeterminate, trackW, shift, reducedMotion])

  const segment = reducedMotion ? trackW : trackW * 0.4
  const translateX = shift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, trackW - segment)],
  })

  return (
    <View className={cn("w-full gap-2", className)} {...rest}>
      {label || (showValue && !indeterminate) ? (
        <View className="flex-row items-center justify-between gap-2">
          {label ? (
            <Text variant="caption" tone="secondary" className="flex-1">
              {label}
            </Text>
          ) : (
            <View className="flex-1" />
          )}
          {showValue && !indeterminate ? (
            <Text variant="monoBody" tone="primary">
              {Math.round(pct)}%
            </Text>
          ) : null}
        </View>
      ) : null}

      <View
        accessibilityRole="progressbar"
        accessibilityValue={indeterminate ? undefined : { min: 0, max: 100, now: pct }}
        accessibilityLabel={label}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        className={cn(
          "w-full overflow-hidden rounded-full border border-border bg-surface",
          trackHeight[size],
        )}
      >
        {indeterminate ? (
          <Animated.View
            style={{
              width: segment,
              height: "100%",
              borderRadius: tokens.radius.full,
              backgroundColor: fill,
              opacity: reducedMotion ? tokens.motion.opacity.disabled : 1,
              transform: [{ translateX }],
            }}
          />
        ) : (
          <Animated.View
            style={{
              height: "100%",
              borderRadius: tokens.radius.full,
              backgroundColor: fill,
              width: width.interpolate({
                inputRange: [0, 100],
                outputRange: ["0%", "100%"],
              }),
            }}
          />
        )}
      </View>
    </View>
  )
}
