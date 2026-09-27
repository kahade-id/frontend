/**
 * Kahade — <OrderHelpCard>.
 *
 * "Butuh bantuan?" — pintu masuk CS yang mudah ditemukan di halaman detail
 * order. Mengarah ke live support; tidak mengubah alur apa pun.
 */
import { View, type ViewProps } from "react-native"
import { Headset } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { translate } from "@/lib/i18n/translate"

export type OrderHelpCardProps = Omit<ViewProps, "children"> & {
  onContactSupport: () => void
  className?: string
}

export function OrderHelpCard({ onContactSupport, className, ...rest }: OrderHelpCardProps) {
  return (
    <Card padded className={cn("gap-3", className)} {...rest}>
      <View className="flex-row items-center gap-3">
        <View
          className="h-11 w-11 items-center justify-center rounded-full bg-info-soft"
          accessible
          accessibilityLabel={translate("Ikon bantuan")}
        >
          <Icon icon={Headset} size={22} weight="bold" tone="info" />
        </View>
        <View className="flex-1 gap-0.5" accessible accessibilityRole="header">
          <Text variant="body" weight={700}>
            {translate("Butuh bantuan?")}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {translate("Tim CS Kahade siap membantu kendala order Anda.")}
          </Text>
        </View>
      </View>
      <Button
        variant="secondary"
        leftIcon={Headset}
        onPress={onContactSupport}
        accessibilityLabel={translate("Hubungi CS Kahade")}
      >
        {translate("Hubungi CS")}
      </Button>
    </Card>
  )
}
