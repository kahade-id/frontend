/**
 * Kahade — <Checkbox> (§9.5).
 *
 * Kotak 20px, radius `xs` (4px), border default. Checked: fill `primary`
 * + ikon Check bold tone inverse — otomatis invert di dark mode lewat token.
 * Indeterminate: fill primary + ikon Minus. Transisi 250ms (§8: kontrol kecil
 * mengikuti durasi standar, bukan 150ms button).
 *
 * Keputusan non-obvious:
 *   - Seluruh baris (kotak + label + deskripsi) adalah satu hit area dengan
 *     PressableScale — target sentuh >= 44px walau kotaknya 20px. Scale
 *     dimatikan (`scaleOnPress={false}`) karena baris teks panjang yang
 *     mengecil terasa aneh; feedback cukup dari perubahan fill.
 *   - Fill checked dianimasikan lewat opacity layer `bg-primary` di atas kotak
 *     (RN Animated — transform/opacity saja), bukan mengganti className,
 *     supaya ada transisi tanpa bergantung pada `transition-*` yang tidak
 *     tersedia di native.
 *   - Error hanya mengubah border kotak ke `border-error`; teks label tidak
 *     berubah — helper error ditangani <Field> di level grup.
 *   - Target sentuh: baris berlabel sudah 44px tinggi (py-3 + 20), tapi
 *     Android menuntut 48dp dan kotak TANPA label hanya 20px lebar. `hitSlop`
 *     (tak terlihat) melengkapinya: +space[1] atas/bawah -> 52px tinggi;
 *     tanpa label +space[4] kiri/kanan -> 52px lebar. Pola sama dengan
 *     <Switch>; nilai dari tokens.space, bukan angka lepas.
 *   - Focus ring keyboard (web saja) lewat `focusRing` di containerClassName —
 *     lihat lib/focus-ring.ts untuk alasan penempatan di container.
 */
import { Check, Minus } from "phosphor-react-native"
import { useEffect, useRef, type ReactNode } from "react"
import { Animated, Easing, View, type PressableProps } from "react-native"

import { Icon } from "@/components/ui/icon"
import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

export type CheckboxProps = Omit<PressableScaleProps, "children" | "onPress"> & {
  checked: boolean
  onChange: (checked: boolean) => void
  indeterminate?: boolean
  label?: ReactNode
  description?: ReactNode
  error?: boolean
  disabled?: boolean
  className?: string
}

export type CheckboxIndicatorProps = {
  checked: boolean
  indeterminate?: boolean
  error?: boolean
  className?: string
}

/**
 * <CheckboxIndicator> — HANYA kotak visual (border + fill animasi + ikon),
 * tanpa Pressable. Dipakai <Checkbox> dan <CheckboxGroupItem variant="card">
 * yang punya hit area sendiri (Pressable di dalam Pressable = bug sentuh di
 * Android/web), jadi kotaknya harus bisa dirender polos.
 */
export function CheckboxIndicator({
  checked,
  indeterminate = false,
  error = false,
  className,
}: CheckboxIndicatorProps) {
  const on = checked || indeterminate
  const fill = useRef(new Animated.Value(on ? 1 : 0)).current
  // Reduce Motion (audit #2): fill kontrol kecil -> instan.
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    Animated.timing(fill, {
      toValue: on ? 1 : 0,
      duration: motionDuration(reducedMotion, tokens.motion.duration.fast),
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: true,
    }).start()
  }, [fill, on, reducedMotion])

  return (
    <View
      className={cn(
        "relative h-5 w-5 items-center justify-center overflow-hidden rounded-xs bg-background",
        error
          ? "border-error border-border-error"
          : on
            ? "border-focus border-border-focus"
            : "border border-border-control",
        className,
      )}
    >
      <Animated.View style={{ opacity: fill, position: "absolute", inset: 0 }}>
        <View className="h-full w-full bg-primary" />
      </Animated.View>
      {on ? (
        <Icon icon={indeterminate ? Minus : Check} size="xs" weight="bold" tone="inverse" />
      ) : null}
    </View>
  )
}

export function Checkbox({
  checked,
  onChange,
  indeterminate = false,
  label,
  description,
  error = false,
  disabled = false,
  className,
  containerClassName,
  ...rest
}: CheckboxProps) {
  const hasText = label != null || description != null

  // 20x44 (tanpa label) / Wx44 (berlabel) -> minimal 52x52 di kedua platform.
  const hitSlop: PressableProps["hitSlop"] = hasText
    ? { top: tokens.space[1], bottom: tokens.space[1] }
    : {
        top: tokens.space[1],
        bottom: tokens.space[1],
        left: tokens.space[4],
        right: tokens.space[4],
      }

  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: indeterminate ? "mixed" : checked, disabled }}
      disabled={disabled}
      scaleOnPress={false}
      onPress={() => onChange(!checked)}
      hitSlop={hitSlop}
      // rounded-xs di container hanya untuk bentuk ring (container tak punya bg/border)
      containerClassName={cn("self-start rounded-xs", focusRing, containerClassName)}
      className={cn("min-h-[44px] flex-row items-start gap-3 py-3", className)}
      {...rest}
    >
      {/* Naikkan sedikit agar sejajar dengan baseline label body (22px line) */}
      <CheckboxIndicator
        checked={checked}
        indeterminate={indeterminate}
        error={error}
        className={cn(label != null && "mt-[1px]")}
      />

      {label != null || description != null ? (
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
    </PressableScale>
  )
}
