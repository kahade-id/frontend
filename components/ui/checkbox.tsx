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
 */
import { Check, Minus } from "phosphor-react-native"
import { useEffect, useRef, type ReactNode } from "react"
import { Animated, Easing, View } from "react-native"

import { Icon } from "@/components/ui/icon"
import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

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

export function Checkbox({
  checked,
  onChange,
  indeterminate = false,
  label,
  description,
  error = false,
  disabled = false,
  className,
  ...rest
}: CheckboxProps) {
  const on = checked || indeterminate
  const fill = useRef(new Animated.Value(on ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(fill, {
      toValue: on ? 1 : 0,
      duration: tokens.motion.duration.fast,
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: true,
    }).start()
  }, [fill, on])

  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: indeterminate ? "mixed" : checked, disabled }}
      disabled={disabled}
      scaleOnPress={false}
      onPress={() => onChange(!checked)}
      containerClassName="self-start"
      className={cn("min-h-[44px] flex-row items-start gap-3 py-3", className)}
      {...rest}
    >
      {/* Kotak: border + layer fill animasi + ikon */}
      <View
        className={cn(
          "relative h-5 w-5 items-center justify-center overflow-hidden rounded-xs bg-background",
          error
            ? "border-error border-border-error"
            : on
              ? "border-focus border-border-focus"
              : "border border-border",
          // Naikkan sedikit agar sejajar dengan baseline label body (22px line)
          label != null && "mt-[1px]",
        )}
      >
        <Animated.View style={{ opacity: fill, position: "absolute", inset: 0 }}>
          <View className="h-full w-full bg-primary" />
        </Animated.View>
        {on ? (
          <Icon icon={indeterminate ? Minus : Check} size="xs" weight="bold" tone="inverse" />
        ) : null}
      </View>

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
