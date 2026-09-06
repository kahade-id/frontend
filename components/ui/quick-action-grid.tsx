/** Quiet shortcuts; adapt density instead of shrinking labels on narrow screens. */
import { View, useWindowDimensions, type ViewProps } from "react-native"
import { Badge } from "@/components/ui/badge"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type QuickAction = {
  key: string
  icon: IconComponent
  label: string
  onPress: () => void
  badge?: number
  disabled?: boolean
  accessibilityHint?: string
}
export type QuickActionGridProps = Omit<ViewProps, "children"> & {
  actions: readonly QuickAction[]
  className?: string
}
export function QuickActionGrid({ actions, className, ...rest }: QuickActionGridProps) {
  const { width, fontScale } = useWindowDimensions()
  const columnClass = fontScale > 1.3 ? "w-1/2" : width < 360 ? "w-1/3" : "w-1/4"
  return (
    <View accessible={false} className={cn("-mx-2 flex-row flex-wrap", className)} {...rest}>
      {actions.map((a) => (
        <PressableScale key={a.key} accessibilityRole="button"
          accessibilityLabel={a.badge ? `${a.label}, ${a.badge} notifikasi baru` : a.label}
          accessibilityHint={a.accessibilityHint ?? `Buka ${a.label}`}
          accessibilityState={{ disabled: a.disabled }} disabled={a.disabled} onPress={a.onPress}
          containerClassName={columnClass} className="items-center gap-2 px-2 py-4">
          <View className="relative h-14 w-14 items-center justify-center rounded-md border border-border bg-surface">
            <Icon icon={a.icon} size="md" tone="active" />
            {a.badge ? <View className="absolute -right-1 -top-1"><Badge tone="danger" variant="soft">{a.badge > 99 ? "99+" : String(a.badge)}</Badge></View> : null}
          </View>
          <Text variant="caption" weight={500} tone="primary" className="w-full text-center">{a.label}</Text>
        </PressableScale>
      ))}
    </View>
  )
}
