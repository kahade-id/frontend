/** Consistent section rhythm; headings and actions remain separate reader targets. */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
export type SectionLevel = "h2" | "h3"
export type SectionHeaderProps = Omit<ViewProps, "children"> & {
  title: string
  subtitle?: string
  action?: ReactNode
  level?: SectionLevel
  inset?: boolean
  className?: string
}
export function SectionHeader({ title, subtitle, action, level = "h2", inset = false, className, ...rest }: SectionHeaderProps) {
  return (
    <View accessible={false} className={cn("flex-row flex-wrap items-center justify-between gap-4", inset && "px-6", className)} {...rest}>
      <View className="min-w-0 flex-1 gap-2">
        <Text variant={level} tone="primary" accessibilityRole="header">{title}</Text>
        {subtitle ? <Text variant="body" tone="secondary">{subtitle}</Text> : null}
      </View>
      {action ? <View className="shrink-0">{action}</View> : null}
    </View>
  )
}
export type SectionProps = Omit<SectionHeaderProps, "title"> & { title?: string; children?: ReactNode; gap?: "sm" | "md" }
export function Section({ title, subtitle, action, level = "h2", inset = false, gap = "md", children, className, ...rest }: SectionProps) {
  return <View className={cn("w-full", gap === "sm" ? "gap-2" : "gap-4", className)} {...rest}>
    {title ? <SectionHeader title={title} subtitle={subtitle} action={action} level={level} inset={inset} /> : null}
    {children}
  </View>
}
