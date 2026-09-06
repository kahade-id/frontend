/** Calm, adaptive navigation chrome. Back behavior and progress remain unchanged. */
import { useContext, useState, type ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ArrowLeft, X } from "phosphor-react-native"
import { useRouter } from "expo-router"
import { IconButton } from "@/components/ui/icon-button"
import { StepProgress } from "@/components/ui/stepper"
import { Text } from "@/components/ui/text"
import { ScreenInsetsContext } from "@/components/ui/screen"
import { tokens } from "@/lib/tokens"
import { ROUTES } from "@/lib/routes"
import { cn } from "@/lib/cn"

export const HEADER_BAR_HEIGHT = tokens.space[16]
export type HeaderProps = Omit<ViewProps, "children"> & {
  title?: string
  largeTitle?: string
  showBack?: boolean
  backKind?: "back" | "close"
  onBack?: () => void
  left?: ReactNode
  right?: ReactNode
  progress?: number
  transparent?: boolean
  safeArea?: boolean
  className?: string
}
export function Header({ title, largeTitle, showBack, backKind = "back", onBack,
  left, right, progress, transparent = false, safeArea, className, ...rest }: HeaderProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const providedInsets = useContext(ScreenInsetsContext)
  const [leftWidth, setLeftWidth] = useState(0)
  const [rightWidth, setRightWidth] = useState(0)
  const sideWidth = Math.max(tokens.space[12], leftWidth, rightWidth)
  const canBack = showBack ?? true
  const handleBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace(ROUTES.home)))
  const leftNode = left ?? (canBack ? (
    <IconButton icon={backKind === "close" ? X : ArrowLeft} variant="ghost"
      accessibilityLabel={backKind === "close" ? "Tutup" : "Kembali"}
      accessibilityHint={backKind === "close" ? "Menutup layar ini" : "Kembali ke layar sebelumnya"}
      onPress={handleBack} />
  ) : null)
  const progressValue = Math.round(Math.max(0, Math.min(1, progress ?? 0)) * 100)
  return (
    <View accessible={false}
      className={cn("z-sticky w-full items-center", transparent ? "bg-transparent" : "border-b border-border bg-background", className)}
      style={(safeArea ?? !providedInsets.top) ? { paddingTop: insets.top } : undefined} {...rest}>
      <View className="w-full md:max-w-content">
        <View className="min-h-16 w-full flex-row items-center px-4 py-2">
          <View style={{ width: sideWidth }} className="items-start justify-center">
            <View onLayout={(e) => setLeftWidth(e.nativeEvent.layout.width)}>{leftNode}</View>
          </View>
          <View className="min-w-0 flex-1 items-center justify-center px-2">
            {title ? <Text accessibilityRole="header" variant="body" weight={600} numberOfLines={2} className="text-center">{title}</Text> : null}
          </View>
          <View style={{ width: sideWidth }} className="items-end justify-center">
            <View onLayout={(e) => setRightWidth(e.nativeEvent.layout.width)} className="flex-row items-center gap-1">{right}</View>
          </View>
        </View>
        {largeTitle ? <View className="px-6 pb-6 pt-2"><Text variant="h1" accessibilityRole="header">{largeTitle}</Text></View> : null}
      </View>
      {progress != null ? (
        <View accessible accessibilityRole="progressbar" accessibilityValue={{ now: progressValue, min: 0, max: 100 }}
          accessibilityLabel={`Progres ${progressValue} persen`} className="w-full">
          <StepProgress value={progressValue / 100} className="w-full" />
        </View>
      ) : null}
    </View>
  )
}
