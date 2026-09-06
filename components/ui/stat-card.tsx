/** Scan-friendly activity metrics; labels wrap rather than losing their meaning. */
import type { ReactNode } from "react"
import { ArrowDownRight, ArrowUpRight } from "phosphor-react-native"
import { View } from "react-native"
import { Card, type CardProps } from "@/components/ui/card"
import { Icon, type IconTone } from "@/components/ui/icon"
import { Skeleton } from "@/components/ui/skeleton"
import { Text, type TextTone } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
export type StatDelta = { label: string; direction: "up" | "down" | "flat" }
export type StatCardProps = Omit<CardProps, "children"> & {
  label: string
  value: ReactNode
  hint?: string
  delta?: StatDelta
  icon?: ReactNode
  loading?: boolean
  mono?: boolean
}
const DELTA_PREFIX: Record<StatDelta["direction"], string> = { up: "naik ", down: "turun ", flat: "" }
function isPrimitive(value: unknown): value is string | number { return typeof value === "string" || typeof value === "number" }
export function StatCard({ label, value, hint, delta, icon, loading = false, mono = false,
  className, variant = "default", accessibilityLabel, ...cardProps }: StatCardProps) {
  const inverted = variant === "inverted"
  const labelTone: TextTone = inverted ? "inverse" : "secondary"
  const valueTone: TextTone = inverted ? "inverse" : "primary"
  const deltaTone: TextTone = inverted ? "inverse" : delta?.direction === "up" ? "success" : delta?.direction === "down" ? "danger" : "secondary"
  const deltaIconTone: IconTone = inverted ? "inverse" : delta?.direction === "up" ? "success" : "danger"
  const labelForReader = loading ? `Memuat ${label}` : isPrimitive(value)
    ? summarize([label, String(value), delta?.label && `${DELTA_PREFIX[delta.direction]}${delta.label}`, hint]) : undefined
  return (
    <Card variant={variant} accessibilityLabel={accessibilityLabel ?? labelForReader} className={cn("gap-4", className)} {...cardProps}>
      <View className="min-h-10 flex-row items-start justify-between gap-2">
        <Text variant="caption" weight={500} tone={labelTone} className="min-w-0 flex-1">{label}</Text>
        {icon ? <View>{icon}</View> : null}
      </View>
      {loading ? <Skeleton className="h-10 w-3/5" /> : isPrimitive(value)
        ? <Text variant={mono ? "monoLarge" : "h2"} tone={valueTone} numberOfLines={1}>{value}</Text> : value}
      {delta || hint ? <View className="flex-row flex-wrap items-center gap-2">
        {delta ? <View className="flex-row items-center gap-1">
          {delta.direction === "up" ? <Icon icon={ArrowUpRight} size="xs" tone={deltaIconTone} />
            : delta.direction === "down" ? <Icon icon={ArrowDownRight} size="xs" tone={deltaIconTone} /> : null}
          <Text variant="caption" weight={500} tone={deltaTone}>{delta.label}</Text>
        </View> : null}
        {hint ? <Text variant="caption" tone={labelTone} className="min-w-0 flex-1">{hint}</Text> : null}
      </View> : null}
    </Card>
  )
}
