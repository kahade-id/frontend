/** Reusable surfaces with a 24pt interior and restrained 12pt corners. */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { Divider } from "@/components/ui/divider"
import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type CardVariant = "default" | "elevated" | "inverted" | "outline"
export type CardProps = Omit<ViewProps, "children"> &
  Pick<PressableScaleProps, "onPress" | "onLongPress" | "accessibilityLabel" | "accessibilityHint"> & {
    children?: ReactNode
    variant?: CardVariant
    padded?: boolean
    selected?: boolean
    disabled?: boolean
    className?: string
  }
const variantClass: Record<CardVariant, string> = {
  default: "bg-surface", elevated: "bg-surface-elevated", inverted: "bg-primary", outline: "bg-transparent",
}
export function Card({ children, variant = "default", padded = true, selected = false,
  disabled = false, onPress, onLongPress, accessibilityLabel, accessibilityHint, className, ...rest }: CardProps) {
  const box = cn(
    "w-full min-w-0 overflow-hidden rounded-md", variantClass[variant],
    selected ? "border-focus border-border-focus" : variant === "inverted" ? "border border-primary" : "border border-border",
    padded && (selected ? "p-[23px]" : "p-6"), className,
  )
  if (onPress || onLongPress) return (
    <PressableScale
      accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} onLongPress={onLongPress}
      containerClassName="w-full" className={box} {...rest}
    >{children}</PressableScale>
  )
  return (
    <View accessible={accessibilityLabel ? true : undefined} accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint} className={cn(box, disabled && "opacity-disabled")} {...rest}>
      {children}
    </View>
  )
}
export type CardSectionProps = ViewProps & { children?: ReactNode; className?: string }
/** Group only the summary, not any buttons inside a non-interactive card. */
export function CardSummary({ label, children, className, ...rest }: CardSectionProps & { label: string }) {
  return <View accessible accessibilityLabel={label} className={className} {...rest}>{children}</View>
}
export function CardHeader({ title, subtitle, action, children, divider = true, className, ...rest }: CardSectionProps & {
  title?: string; subtitle?: string; action?: ReactNode; divider?: boolean
}) {
  return <>
    <View className={cn("flex-row items-center gap-4 px-6 py-4", className)} {...rest}>
      <View className="min-w-0 flex-1 gap-2">
        {title ? <Text variant="h3" accessibilityRole="header">{title}</Text> : null}
        {subtitle ? <Text variant="caption" tone="secondary">{subtitle}</Text> : null}
        {children}
      </View>
      {action}
    </View>
    {divider ? <Divider /> : null}
  </>
}
export function CardBody({ children, className, ...rest }: CardSectionProps) {
  return <View className={cn("p-6", className)} {...rest}>{children}</View>
}
export function CardFooter({ children, divider = true, className, ...rest }: CardSectionProps & { divider?: boolean }) {
  return <>
    {divider ? <Divider /> : null}
    <View className={cn("flex-row flex-wrap items-center gap-4 px-6 py-4", className)} {...rest}>{children}</View>
  </>
}
