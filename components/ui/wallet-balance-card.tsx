/** A clear money hierarchy with explicit held funds and reachable wallet actions. */
import { useState } from "react"
import { ArrowCircleDown, ArrowCircleUp, Eye, EyeSlash, PaperPlaneTilt } from "phosphor-react-native"
import { View } from "react-native"
import { Amount } from "@/components/ui/amount"
import { Card, type CardProps, type CardVariant } from "@/components/ui/card"
import { Icon, type IconComponent, type IconTone } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Skeleton } from "@/components/ui/skeleton"
import { Text, type TextTone } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type WalletQuickAction = {
  key: "topup" | "withdraw" | "transfer" | (string & {})
  label: string
  icon: IconComponent
  onPress: () => void
  disabled?: boolean
}
export type WalletBalanceCardLabels = { available: string; held: string; hide: string; show: string }
const DEFAULT_LABELS: WalletBalanceCardLabels = {
  available: "Saldo tersedia", held: "Tertahan di escrow", hide: "Sembunyikan saldo", show: "Tampilkan saldo",
}
export type WalletBalanceCardProps = Omit<CardProps, "children" | "onPress" | "padded"> & {
  available?: number
  held?: number
  hidden?: boolean
  onToggleHidden?: () => void
  actions?: WalletQuickAction[]
  onTopUp?: () => void
  onWithdraw?: () => void
  onTransfer?: () => void
  loading?: boolean
  variant?: Extract<CardVariant, "inverted" | "default" | "elevated">
  labels?: Partial<WalletBalanceCardLabels>
}
export function WalletBalanceCard({ available, held, hidden, onToggleHidden, actions,
  onTopUp, onWithdraw, onTransfer, loading = false, variant = "inverted", labels, className, ...rest }: WalletBalanceCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  // Uncontrolled privacy is intentionally memory-only; callers may persist a controlled preference.
  const [localHidden, setLocalHidden] = useState(false)
  const concealed = hidden ?? localHidden
  const canToggle = onToggleHidden != null || hidden === undefined
  const toggle = () => {
    if (hidden === undefined) setLocalHidden((current) => !current)
    onToggleHidden?.()
  }
  const inverted = variant === "inverted"
  const textTone: TextTone = inverted ? "inverse" : "secondary"
  const valueTone = inverted ? "inverse" : "primary"
  const iconTone: IconTone = inverted ? "inverse" : "active"
  const resolvedActions: WalletQuickAction[] = actions ?? ([
    onTopUp && { key: "topup", label: "Isi saldo", icon: ArrowCircleDown, onPress: onTopUp },
    onWithdraw && { key: "withdraw", label: "Tarik", icon: ArrowCircleUp, onPress: onWithdraw },
    onTransfer && { key: "transfer", label: "Transfer", icon: PaperPlaneTilt, onPress: onTransfer },
  ] as Array<WalletQuickAction | undefined>).filter((action): action is WalletQuickAction => !!action)
  return (
    <Card variant={variant} className={cn("gap-4", className)} {...rest}>
      <View accessible={false} className="flex-row items-center justify-between gap-4">
        <Text variant="label" tone={textTone} className="min-w-0 flex-1">{t.available}</Text>
        {canToggle ? <PressableScale onPress={toggle} scaleOnPress={false} accessibilityRole="button"
          accessibilityLabel={concealed ? t.show : t.hide} accessibilityHint="Mengatur privasi nominal saldo"
          accessibilityState={{ checked: !concealed }} className="min-h-11 min-w-11 items-center justify-center rounded-sm">
          <Icon icon={concealed ? EyeSlash : Eye} size="sm" tone={iconTone} />
        </PressableScale> : null}
      </View>
      <View className="gap-4">
        {loading ? <Skeleton height={tokens.typography.monoLarge.lineHeight} className="w-3/5" />
          : <Amount value={available ?? Number.NaN} size="large" tone={valueTone} hidden={concealed} />}
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text variant="caption" tone={textTone}>{t.held}</Text>
          {loading ? <Skeleton height={tokens.typography.caption.lineHeight} className="w-20" />
            : <Amount value={held ?? Number.NaN} size="body" tone={valueTone} hidden={concealed} />}
        </View>
      </View>
      {resolvedActions.length > 0 ? <View className="flex-row gap-2 pt-4" accessibilityRole="toolbar">
        {resolvedActions.map((action) => <PressableScale key={action.key} accessibilityRole="button"
          accessibilityLabel={action.label} accessibilityHint={`Buka ${action.label}`}
          onPress={action.onPress} disabled={action.disabled} containerClassName="min-w-0 flex-1"
          className="min-h-16 items-center gap-2 py-2">
          <View className={cn("h-12 w-12 items-center justify-center rounded-sm border", inverted ? "border-primary-foreground bg-primary" : "border-border bg-surface-elevated")}>
            <Icon icon={action.icon} size="md" tone={iconTone} />
          </View>
          <Text variant="caption" weight={500} tone={inverted ? "inverse" : "primary"} className="w-full text-center">{action.label}</Text>
        </PressableScale>)}
      </View> : null}
    </Card>
  )
}
