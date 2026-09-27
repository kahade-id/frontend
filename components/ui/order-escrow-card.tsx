/**
 * Kahade — <OrderEscrowCard>.
 *
 * Penjelasan status dana escrow dengan bahasa yang menenangkan dan
 * profesional: dana ditahan PT Kawal Hak Dengan Aman. Copy disesuaikan
 * dengan status order dan peran user — murni presentasi dari data yang ada.
 */
import { View, type ViewProps } from "react-native"
import { ShieldCheck } from "phosphor-react-native"

import { Amount } from "@/components/ui/amount"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatDate } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"

const COMPANY = "PT Kawal Hak Dengan Aman"

export type OrderEscrowCardProps = Omit<ViewProps, "children"> & {
  status: string
  /** Nominal escrow yang ditampilkan — buyerPays bila ada, fallback orderValue. */
  amount: number
  myRole?: "BUYER" | "SELLER"
  completedAt?: string | null
  className?: string
}

function escrowCopy(
  status: string,
  myRole: "BUYER" | "SELLER" | undefined,
): { title: string; body: string } {
  switch (status) {
    case "COMPLETED":
      return {
        title: translate("Dana telah diteruskan"),
        body: translate(
          "Dana escrow telah diteruskan ke penjual oleh {x} setelah order dikonfirmasi selesai.",
          { x: COMPANY },
        ),
      }
    case "CANCELLED":
    case "REFUNDED":
      return {
        title: translate("Dana dikembalikan"),
        body: translate(
          "Order tidak berlanjut — dana escrow telah dikembalikan ke pembeli oleh {x}.",
          { x: COMPANY },
        ),
      }
    case "DISPUTED":
      return {
        title: translate("Dana dibekukan sementara"),
        body: translate(
          "Selama sengketa berjalan, dana escrow dibekukan oleh {x} dan hanya dilepas sesuai hasil penyelesaian. Tidak ada pihak yang bisa menariknya sepihak.",
          { x: COMPANY },
        ),
      }
    default:
      return myRole === "SELLER"
        ? {
            title: translate("Dana aman di escrow"),
            body: translate(
              "Pembayaran ditahan dengan aman oleh {x} dan akan diteruskan ke dompet Anda setelah pembeli mengonfirmasi penerimaan — atau otomatis setelah tenggat tanpa sengketa.",
              { x: COMPANY },
            ),
          }
        : {
            title: translate("Dana aman di escrow"),
            body: translate(
              "Uang Anda ditahan dengan aman oleh {x}. Dana hanya diteruskan ke penjual setelah Anda mengonfirmasi penerimaan barang/jasa — atau otomatis setelah tenggat tanpa sengketa.",
              { x: COMPANY },
            ),
          }
  }
}

export function OrderEscrowCard({
  status,
  amount,
  myRole,
  completedAt,
  className,
  ...rest
}: OrderEscrowCardProps) {
  const { title, body } = escrowCopy(status, myRole)
  return (
    <Card
      padded
      className={cn("gap-3 border-success bg-success-soft", className)}
      {...rest}
    >
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-background">
          <Icon icon={ShieldCheck} size={24} weight="fill" tone="success" />
        </View>
        <View className="flex-1 gap-0.5" accessible accessibilityRole="header">
          <Text variant="body" weight={700}>
            {title}
          </Text>
          <Amount value={amount} size="body" tone="primary" />
        </View>
      </View>
      <Text variant="caption" tone="secondary">
        {body}
      </Text>
      {status === "COMPLETED" && completedAt ? (
        <Text variant="caption" tone="secondary">
          {translate("Diselesaikan pada {x}", { x: formatDate(completedAt, { long: true }) })}
        </Text>
      ) : null}
    </Card>
  )
}
