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
  /**
   * TRX-013: kapan order dibayar (null = belum pernah dibayar). Menentukan
   * apakah copy "dana dikembalikan" jujur untuk CANCELLED — order yang batal
   * sebelum bayar tidak punya dana escrow yang bergerak.
   */
  paidAt?: string | null
  className?: string
}

function escrowCopy(
  status: string,
  myRole: "BUYER" | "SELLER" | undefined,
  paidAt?: string | null,
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
    // TRX-013: CANCELLED tanpa pembayaran = tidak ada dana yang bergerak.
    case "CANCELLED":
      if (!paidAt) {
        return {
          title: translate("Order dibatalkan"),
          body: translate(
            "Order dibatalkan sebelum pembayaran — tidak ada dana yang sempat ditahan di escrow.",
          ),
        }
      }
      return {
        title: translate("Dana dikembalikan"),
        body: translate(
          "Order tidak berlanjut — dana escrow telah dikembalikan ke pembeli oleh {x}.",
          { x: COMPANY },
        ),
      }
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
    // Item 33: pra-bayar — dana BELUM ditahan. Copy lama ("Uang Anda
    // ditahan…") berbohong untuk order yang belum dibayar.
    case "WAITING_CONFIRMATION":
    case "WAITING_PAYMENT":
    case "PENDING_PAYMENT":
      return myRole === "SELLER"
        ? {
            title: translate("Dana akan ditahan di escrow"),
            body: translate(
              "Dana akan ditahan setelah pembeli membayar. Anda dapat memproses order setelah pembayaran masuk ke escrow {x}.",
              { x: COMPANY },
            ),
          }
        : {
            title: translate("Dana akan ditahan di escrow"),
            body: translate(
              "Dana akan ditahan setelah Anda membayar. {x} menahan dana dengan aman sampai Anda mengonfirmasi penerimaan.",
              { x: COMPANY },
            ),
          }
    // U5-012 (UX-deep 2026-09-29, keputusan produk): saat PROCESSING,
    // pembeli diberi tahu tenggat kirim 2 hari + jaminan auto-refund —
    // "2 hari" boleh hardcode. Dibuat case eksplisit supaya status lain
    // yang jatuh ke default (mis. SHIPPED) tidak ikut dapat copy ini.
    case "PROCESSING":
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
              "Uang Anda ditahan dengan aman oleh {x}. Dana hanya diteruskan ke penjual setelah Anda mengonfirmasi penerimaan barang/jasa — atau otomatis setelah tenggat tanpa sengketa. {deadline}",
              {
                x: COMPANY,
                deadline: translate(
                  "Penjual punya waktu 2 hari untuk mengirim. Lewat dari itu, dana kembali otomatis.",
                ),
              },
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
  paidAt,
  className,
  ...rest
}: OrderEscrowCardProps) {
  const { title, body } = escrowCopy(status, myRole, paidAt)
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
