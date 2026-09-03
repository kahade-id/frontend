/**
 * Kahade — <PageIndicator> titik halaman (onboarding, carousel banner).
 *
 * Deretan dot `rounded-full` (§5: dot indicator = radius.full): aktif
 * `bg-primary` dan memanjang jadi pill 16px (w-4), inaktif `bg-border` 8px
 * (w-2). Pemanjangan — bukan pembesaran/warna semantik — memberi arah
 * "posisi" tanpa menambah warna (§2 monokrom).
 *
 * Lebar dianimasikan 300ms easing standar (layout prop → useNativeDriver
 * false, elemen sangat kecil, sama pengecualiannya dengan ProgressBar).
 * Tidak ada tap pada dot: di mobile menyentuh titik 8px tidak realistis;
 * navigasi lewat swipe/tombol. Posisi disampaikan ke screen reader lewat
 * accessibilityLabel "Halaman 2 dari 4".
 */
import { useEffect, useRef } from "react"
import { Animated, Easing, View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

const DOT = tokens.space[2] // 8px
const ACTIVE_DOT = tokens.space[4] // 16px

export type PageIndicatorProps = Omit<ViewProps, "children"> & {
  count: number
  /** 0-based */
  index: number
  /** Dot di atas bg-primary (hero inverted) */
  inverse?: boolean
  className?: string
}

function Dot({ active, inverse }: { active: boolean; inverse: boolean }) {
  const width = useRef(new Animated.Value(active ? ACTIVE_DOT : DOT)).current

  useEffect(() => {
    Animated.timing(width, {
      toValue: active ? ACTIVE_DOT : DOT,
      duration: tokens.motion.duration.base,
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: false,
    }).start()
  }, [active, width])

  return (
    <Animated.View style={{ width, height: DOT }}>
      <View
        className={cn(
          "h-full w-full rounded-full",
          active
            ? inverse
              ? "bg-primary-foreground"
              : "bg-primary"
            : inverse
              ? "bg-primary-foreground opacity-disabled"
              : "bg-border",
        )}
      />
    </Animated.View>
  )
}

export function PageIndicator({ count, index, inverse = false, className, ...rest }: PageIndicatorProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Halaman ${index + 1} dari ${count}`}
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
      className={cn("flex-row items-center justify-center gap-2", className)}
      {...rest}
    >
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} active={i === index} inverse={inverse} />
      ))}
    </View>
  )
}
