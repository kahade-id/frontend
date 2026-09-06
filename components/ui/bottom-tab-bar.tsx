/** Five persistent destinations with an unmistakable, labeled active state. */
import type { ReactNode } from "react"
import { View, useWindowDimensions, type ViewProps } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { BottomTabBarProps as RNNBottomTabBarProps } from "@react-navigation/bottom-tabs"
import { NotificationDot } from "@/components/ui/badge"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRingInset } from "@/lib/focus-ring"
import { tokens } from "@/lib/tokens"

export type BottomTabItem<K extends string = string> = {
  key: K
  label: string
  icon: IconComponent
  badge?: boolean
  accessibilityLabel?: string
}
export type BottomTabBarProps<K extends string = string> = Omit<ViewProps, "children"> & {
  items: readonly BottomTabItem<K>[]
  value: K
  onChange: (key: K) => void
  onLongPress?: (key: K) => void
  className?: string
}
export const TAB_BAR_HEIGHT = tokens.space[20]
export function BottomTabBar<K extends string = string>({ items, value, onChange, onLongPress, className, ...rest }: BottomTabBarProps<K>) {
  const insets = useSafeAreaInsets()
  const { width, fontScale } = useWindowDimensions()
  const comfortableLabels = width >= 360 && fontScale <= 1.3
  return (
    <View accessible={false} accessibilityRole="tablist"
      className={cn("z-sticky w-full items-center border-t border-border bg-background", className)}
      style={{ paddingBottom: insets.bottom }} {...rest}>
      <View className="w-full flex-row items-stretch px-2 py-2 md:max-w-content">
        {items.map((item) => {
          const active = item.key === value
          return (
            <PressableScale key={item.key} accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.accessibilityLabel ?? item.label}
              accessibilityHint={item.badge ? `Buka ${item.label}, ada notifikasi baru` : `Buka ${item.label}`}
              scaleOnPress={false} onPress={() => onChange(item.key)}
              onLongPress={onLongPress ? () => onLongPress(item.key) : undefined}
              containerClassName={cn("min-w-0 flex-1", focusRingInset)}
              className="min-h-16 items-center justify-center gap-1 px-1 py-1">
              <View className={cn("relative h-8 w-12 items-center justify-center rounded-sm", active && "bg-accent-soft")}>
                <Icon icon={item.icon} size="md" active={active} />
                <NotificationDot visible={!!item.badge} />
              </View>
              <Text variant="caption" weight={active ? 600 : 500} tone={active ? "info" : "secondary"}
                numberOfLines={comfortableLabels ? 1 : undefined} className="w-full text-center">
                {item.label}
              </Text>
            </PressableScale>
          )
        })}
      </View>
    </View>
  )
}
export type RouterTabBarState = Pick<RNNBottomTabBarProps["state"], "index" | "routes">
export type RouterTabBarNavigation = Pick<RNNBottomTabBarProps["navigation"], "emit" | "navigate">
export type RouterBottomTabBarProps = {
  state: RouterTabBarState
  navigation: RouterTabBarNavigation
  items: Readonly<Record<string, Omit<BottomTabItem, "key">>>
  className?: string
}
export function RouterBottomTabBar({ state, navigation, items, className }: RouterBottomTabBarProps): ReactNode {
  const visible = state.routes.filter((r) => items[r.name])
  const current = state.routes[state.index]?.name ?? ""
  return (
    <BottomTabBar className={className} value={current}
      items={visible.map((r) => ({ key: r.name, ...items[r.name]! }))}
      onChange={(name) => {
        const route = state.routes.find((r) => r.name === name)
        if (!route) return
        const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true })
        if (name !== current && !event.defaultPrevented) navigation.navigate(name)
      }}
      onLongPress={(name) => {
        const route = state.routes.find((r) => r.name === name)
        if (route) navigation.emit({ type: "tabLongPress", target: route.key })
      }}
    />
  )
}
