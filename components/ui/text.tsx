/** One accessible type scale for all screens; bundled sans for every heading. */
import { forwardRef } from "react"
import { Text as RNText, type TextProps as RNTextProps } from "react-native"
import { cn } from "@/lib/cn"
import type { TypographyKey } from "@/lib/tokens"

export type TextVariant = TypographyKey
export type TextVariantProp = TextVariant | "inherit"
export type TextTone = "primary" | "secondary" | "tertiary" | "disabled" | "inverse" | "success" | "danger" | "warning" | "info" | "inherit"
export type TextProps = RNTextProps & {
  variant?: TextVariantProp
  tone?: TextTone
  weight?: 400 | 500 | 600 | 700
  className?: string
}
const sizeClass: Record<TextVariant, string> = {
  display: "text-display", h1: "text-h1", h2: "text-h2", h3: "text-h3",
  bodyLarge: "text-bodyLarge", body: "text-body", caption: "text-caption",
  label: "text-label", monoLarge: "text-monoLarge", monoBody: "text-monoBody",
}
const faceClass: Record<TextVariant, string> = {
  display: "font-sans-600",
  // Keep the softer heading weight in dark mode without synthetic font weights.
  h1: "font-sans-700 dark:font-sans-600 tabular-nums",
  h2: "font-sans-700 dark:font-sans-600 tabular-nums",
  h3: "font-sans-600 tabular-nums", bodyLarge: "font-sans-400 tabular-nums",
  body: "font-sans-400 tabular-nums", caption: "font-sans-400 tabular-nums",
  label: "font-sans-600 tabular-nums", monoLarge: "font-mono-600", monoBody: "font-mono-500",
}
const weightClass = {
  sans: { 400: "font-sans-400", 500: "font-sans-500", 600: "font-sans-600", 700: "font-sans-700" },
  mono: { 500: "font-mono-500", 600: "font-mono-600" },
} as const
const toneClass: Record<TextTone, string> = {
  primary: "text-text-primary", secondary: "text-text-secondary", tertiary: "text-text-tertiary",
  disabled: "text-text-disabled", inverse: "text-primary-foreground", success: "text-success-text",
  danger: "text-danger-text", warning: "text-warning-text", info: "text-info-text", inherit: "",
}
const largeVariants = new Set<TextVariantProp>(["display", "h1", "h2", "h3", "monoLarge"])
export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = "body", tone = "primary", weight, className, ...rest }, ref,
) {
  const role = variant === "monoLarge" || variant === "monoBody" ? "mono" : "sans"
  const forced = weight != null ? (weightClass[role] as Partial<Record<number, string>>)[weight] : undefined
  const inherit = variant === "inherit"
  const resolvedTone = tone === "tertiary" && !largeVariants.has(variant) ? "secondary" : tone
  return (
    <RNText
      ref={ref}
      allowFontScaling
      maxFontSizeMultiplier={2}
      className={cn(
        !inherit && sizeClass[variant],
        forced ? cn(forced, role === "sans" && "tabular-nums") : !inherit && faceClass[variant],
        toneClass[resolvedTone], className,
      )}
      {...rest}
    />
  )
})
