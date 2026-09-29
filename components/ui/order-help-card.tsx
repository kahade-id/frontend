/**
 * Kahade — <OrderHelpCard>.
 *
 * "Butuh bantuan?" — pintu masuk CS yang mudah ditemukan di halaman detail
 * order. Mengarah ke live support; tidak mengubah alur apa pun.
 *
 * FE-030 (minimalisme): satu tombol "Hubungi Bantuan Langsung" sudah cukup —
 * header + description yang semuanya berkata "bantuan" dihapus.
 */
import { View, type ViewProps } from "react-native"
import { Headset } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/cn"
import { translate } from "@/lib/i18n/translate"

export type OrderHelpCardProps = Omit<ViewProps, "children"> & {
  onContactSupport: () => void
  className?: string
}

export function OrderHelpCard({ onContactSupport, className, ...rest }: OrderHelpCardProps) {
  return (
    <View className={cn("gap-4", className)} {...rest}>
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
