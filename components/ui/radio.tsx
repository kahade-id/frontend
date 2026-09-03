/**
 * Kahade — <RadioGroup> + <Radio> (§9.5).
 *
 * Lingkaran 20px `rounded-full`, border default. Selected: border-focus +
 * dot 10px `bg-primary` di tengah (dot mengecil/membesar 250ms via Animated
 * scale). Tidak ada fill penuh — membedakan secara visual dari Checkbox.
 *
 * RadioGroup memakai Context supaya tiap <Radio> hanya perlu `value`,
 * bukan `checked` + `onChange` masing-masing. Value generik string agar
 * cocok dengan enum domain (mis. metode pembayaran, jenis escrow).
 *
 * Kenapa orientasi "card" disediakan (non-obvious): alur escrow sering
 * memilih satu dari 2–3 opsi kaya (judul + deskripsi + ikon). Varian `card`
 * membungkus tiap opsi dalam border rounded-md yang menebal ke border-focus
 * saat dipilih — hierarki dari border, bukan shadow/fill (§6).
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react"
import { Animated, Easing, View, type ViewProps } from "react-native"

import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

type RadioContextValue = {
  value: string | undefined
  onChange: (v: string) => void
  disabled: boolean
  variant: "plain" | "card"
}

const RadioContext = createContext<RadioContextValue | null>(null)

export type RadioGroupProps = ViewProps & {
  value: string | undefined
  onChange: (value: string) => void
  disabled?: boolean
  /** "card": tiap opsi dibungkus border rounded-md */
  variant?: "plain" | "card"
  children: ReactNode
  className?: string
}

export function RadioGroup({
  value,
  onChange,
  disabled = false,
  variant = "plain",
  children,
  className,
  ...rest
}: RadioGroupProps) {
  return (
    <RadioContext.Provider value={{ value, onChange, disabled, variant }}>
      <View
        accessibilityRole="radiogroup"
        className={cn("w-full", variant === "card" ? "gap-3" : "gap-0", className)}
        {...rest}
      >
        {children}
      </View>
    </RadioContext.Provider>
  )
}

export type RadioProps = Omit<PressableScaleProps, "children" | "onPress"> & {
  value: string
  label: ReactNode
  description?: ReactNode
  /** Slot kiri opsional (mis. <Icon>) untuk varian card */
  leading?: ReactNode
  disabled?: boolean
  className?: string
}

export function Radio({
  value,
  label,
  description,
  leading,
  disabled: ownDisabled = false,
  className,
  ...rest
}: RadioProps) {
  const ctx = useContext(RadioContext)
  if (!ctx) throw new Error("<Radio> harus berada di dalam <RadioGroup>")

  const selected = ctx.value === value
  const disabled = ctx.disabled || ownDisabled
  const isCard = ctx.variant === "card"

  const dot = useRef(new Animated.Value(selected ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(dot, {
      toValue: selected ? 1 : 0,
      duration: tokens.motion.duration.fast,
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: true,
    }).start()
  }, [dot, selected])

  const circle = (
    <View
      className={cn(
        "h-5 w-5 items-center justify-center rounded-full bg-background",
        selected ? "border-focus border-border-focus" : "border border-border",
        !isCard && "mt-[1px]",
      )}
    >
      <Animated.View style={{ transform: [{ scale: dot }] }}>
        <View className="h-[10px] w-[10px] rounded-full bg-primary" />
      </Animated.View>
    </View>
  )

  const content = (
    <View className="flex-1 gap-1">
      {typeof label === "string" ? (
        <Text variant="body" tone="primary" weight={isCard ? 600 : 400}>
          {label}
        </Text>
      ) : (
        label
      )}
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
  )

  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      scaleOnPress={isCard}
      onPress={() => ctx.onChange(value)}
      containerClassName="w-full"
      className={cn(
        "flex-row items-start gap-3",
        isCard
          ? cn(
              "rounded-md bg-surface p-5",
              selected ? "border-focus border-border-focus" : "border border-border",
            )
          : "min-h-[44px] py-3",
        className,
      )}
      {...rest}
    >
      {isCard ? (
        <>
          {leading ? <View className="mt-[1px]">{leading}</View> : null}
          {content}
          {circle}
        </>
      ) : (
        <>
          {circle}
          {content}
        </>
      )}
    </PressableScale>
  )
}
