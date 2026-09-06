/** Clear action hierarchy with 48/56pt targets and stable loading geometry. */
import type { ReactNode } from "react"
import { View } from "react-native"
import { cn } from "@/lib/cn"
import { Icon, type IconComponent, type IconTone } from "@/components/ui/icon"
import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive"
export type ButtonSize = "sm" | "md"
export type ButtonProps = Omit<PressableScaleProps, "children" | "className"> & {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: IconComponent
  rightIcon?: IconComponent
  className?: string
}
const variantBox: Record<ButtonVariant, string> = {
  primary: "bg-primary", secondary: "bg-surface border border-border",
  ghost: "bg-transparent", destructive: "bg-danger",
}
const variantText: Record<ButtonVariant, string> = {
  primary: "text-primary-foreground", secondary: "text-text-primary", ghost: "text-text-primary",
  // Danger's dark fill is light; dark text is necessary for AA contrast.
  destructive: "text-white dark:text-gray-950",
}
const variantIconTone: Record<ButtonVariant, IconTone> = {
  primary: "inverse", secondary: "active", ghost: "active", destructive: "inverse",
}
const sizeBox: Record<ButtonSize, string> = {
  sm: "min-h-12 px-4 py-3", md: "min-h-14 px-6 py-4",
}
export function Button({ children, variant = "primary", size = "md", loading = false,
  fullWidth = true, leftIcon, rightIcon, disabled, className, containerClassName, ...rest }: ButtonProps) {
  const isDisabled = !!disabled || loading
  const iconTone = variantIconTone[variant]
  return (
    <PressableScale
      accessibilityHint="Ketuk untuk berinteraksi"
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      containerClassName={cn(fullWidth ? "w-full" : "self-start", containerClassName)}
      className={cn("flex-row items-center justify-center rounded-sm", sizeBox[size], variantBox[variant], className)}
      {...rest}
    >
      <View accessible={false} className={cn("min-w-0 flex-shrink flex-row items-center justify-center gap-2", loading && "opacity-0")}>
        {leftIcon ? <Icon icon={leftIcon} size="sm" tone={iconTone} /> : null}
        <Text variant={size === "sm" ? "label" : "body"} weight={600} tone="inherit" className={cn("shrink text-center", variantText[variant])}>
          {children}
        </Text>
        {rightIcon ? <Icon icon={rightIcon} size="sm" tone={iconTone} /> : null}
      </View>
      {loading ? (
        <View className="absolute inset-0 items-center justify-center">
          <Spinner size={size === "sm" ? "sm" : "md"} tone={variant === "primary" || variant === "destructive" ? "inverse" : "active"} />
        </View>
      ) : null}
    </PressableScale>
  )
}
