/**
 * Kahade — <Switch> / Toggle (§9.5).
 *
 * Track 44x24 `rounded-full` dengan border default; thumb 18px. Off: track
 * `bg-surface`, thumb `bg-text-tertiary`. On: track `bg-primary` (border ikut
 * primary), thumb `bg-primary-foreground` — invert otomatis di dark mode.
 * Transisi 300ms (§8 durasi standar, bukan 150ms).
 *
 * Kenapa TIDAK memakai <Switch> bawaan RN (non-obvious): komponen native
 * mengikuti gaya OS (hijau iOS, biru Material) dan tidak bisa dipaksa
 * monokrom secara konsisten di iOS/Android/web. Custom Pressable memberi
 * kontrol penuh atas token dan tetap mengumumkan role "switch" ke screen
 * reader.
 *
 * Posisi thumb dianimasikan lewat translateX (RN Animated, non-className).
 * Warna track/thumb diganti via className tanpa animasi — perubahan warna
 * bersamaan dengan gerak thumb sudah terasa halus, dan menghindari
 * interpolasi warna yang tidak jalan di native driver.
 *
 * Varian `row`: label + deskripsi di kiri, switch di kanan (pola Settings).
 *
 * Focus ring keyboard (web saja) via `focusRing` langsung di <Pressable> ini
 * (bukan PressableScale, jadi tidak ada container terpisah). Tanpa teks,
 * Pressable membungkus track pas -> `rounded-full` agar ring ikut bentuk pill.
 */
import { useEffect, useRef, type ReactNode } from "react"
import { Animated, Easing, Pressable, View, type PressableProps } from "react-native"

import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { hitSlopToReach } from "@/lib/hit-slop"
import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

export type SwitchProps = Omit<PressableProps, "children" | "onPress" | "style"> & {
  value: boolean
  onChange: (value: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  className?: string
}

const TRACK_W = 44
const TRACK_H = 24
const THUMB = 18
// Border 1px di kedua sisi + 2px inset = jarak thumb ke tepi track
const INSET = (TRACK_H - THUMB) / 2 - tokens.borderWidth.default
const TRAVEL = TRACK_W - THUMB - tokens.borderWidth.default * 2 - INSET * 2
// Audit #1: track 44x24 berdiri sendiri (tanpa label) -> slop vertikal 10
// membawa target ke 44x44. Sebelumnya space[2]=8 hanya sampai 40.
const STANDALONE_HIT_SLOP = hitSlopToReach(TRACK_W, TRACK_H)

export function Switch({
  value,
  onChange,
  label,
  description,
  disabled = false,
  className,
  ...rest
}: SwitchProps) {
  const x = useRef(new Animated.Value(value ? 1 : 0)).current
  // Reduce Motion (audit #2): thumb pindah instan.
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    Animated.timing(x, {
      toValue: value ? 1 : 0,
      duration: motionDuration(reducedMotion, tokens.motion.duration.base),
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: true,
    }).start()
  }, [value, x, reducedMotion])

  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] })

  const track = (
    <View
      className={cn(
        "justify-center rounded-full",
        value ? "border border-primary bg-primary" : "border border-border bg-surface",
      )}
      style={{ width: TRACK_W, height: TRACK_H, paddingHorizontal: INSET }}
    >
      <Animated.View style={{ transform: [{ translateX }] }}>
        <View
          className={cn("rounded-full", value ? "bg-primary-foreground" : "bg-text-tertiary")}
          style={{ width: THUMB, height: THUMB }}
        />
      </Animated.View>
    </View>
  )

  const hasText = label != null || description != null

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={hasText ? undefined : STANDALONE_HIT_SLOP}
      className={cn(
        hasText ? "min-h-11 w-full flex-row items-center gap-4 py-3 rounded-xs" : "self-start rounded-full",
        focusRing,
        disabled && "opacity-disabled",
        className,
      )}
      {...rest}
    >
      {hasText ? (
        <View className="flex-1 gap-1">
          {label != null ? (
            typeof label === "string" ? (
              <Text variant="body" tone="primary">
                {label}
              </Text>
            ) : (
              label
            )
          ) : null}
          {description != null ? (
            typeof description === "string" ? (
              <Text variant="caption" tone="secondary">
                {description}
              </Text>
            ) : (
              description
            )
          ) : null}
        </View>
      ) : null}
      {track}
    </Pressable>
  )
}
