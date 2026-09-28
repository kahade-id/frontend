/**
 * Kahade — <OrderHelpCard>.
 *
 * "Butuh bantuan?" — pintu masuk CS yang mudah ditemukan di halaman detail
 * order. Mengarah ke live support; tidak mengubah alur apa pun.
 */
import { View, type ViewProps } from "react-native"
import { Headset } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { translate } from "@/lib/i18n/translate"

export type OrderHelpCardProps = Omit<ViewProps, "children"> & {
  onContactSupport: () => void
  className?: string
}

export function OrderHelpCard({ onContactSupport, className, ...rest }: OrderHelpCardProps) {
  // Iterasi de-card 2026-09-27: pintu CS sebagai section polos — tanpa <Card>.
  return (
    <View className={cn("gap-4", className)} {...rest}>
      <SectionHeader title={translate("Butuh bantuan?")} />
      <View className="flex-row items-center gap-3">
        <View
          className="h-11 w-11 items-center justify-center rounded-full bg-info-soft"
          accessible
          accessibilityLabel={translate("Ikon bantuan")}
        >
          <Icon icon={Headset} size={22} weight="bold" tone="info" />
        </View>
        <Text variant="body" tone="secondary" numberOfLines={2} className="flex-1">
          {translate("Tim Bantuan Langsung Kahade siap membantu kendala pesanan Anda.")}
        </Text>
      </View>
      <Button
        variant="secondary"
        leftIcon={Headset}
        onPress={onContactSupport}
        accessibilityLabel={translate("Hubungi Bantuan Langsung Kahade")}
      >
        {translate("Hubungi Bantuan Langsung")}
      </Button>
    </View>
  )
}
