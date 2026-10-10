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
  /**
   * Mode Tanpa Wallet Internal: false → copy "diteruskan ke dompet"
   * diganti "dicairkan ke rekening bank" / "kembali ke metode pembayaran".
   * Default true (perilaku lama) agar pemanggil lama tidak berubah.
   */
  walletEnabled?: boolean
  className?: string
}

function escrowCopy(
  status: string,
  myRole: "BUYER" | "SELLER" | undefined,
  paidAt?: string | null,
  walletEnabled = true,
): { title: string; body: string } {
  switch (status) {
    case "COMPLETED":
      return {
        title: translate("Dana telah diteruskan"),
        body: translate(
          walletEnabled
            ? "Dana telah diteruskan ke penjual oleh {x} setelah order dikonfirmasi selesai."
            : "Dana telah dicairkan ke rekening bank penjual oleh {x} setelah order dikonfirmasi selesai.",
          { x: COMPANY },
        ),
      }
    // TRX-013: CANCELLED tanpa pembayaran = tidak ada dana yang bergerak.
    case "CANCELLED":
      if (!paidAt) {
        return {
          title: translate("Order dibatalkan"),
          body: translate(
            "Order dibatalkan sebelum pembayaran — tidak ada dana yang sempat dibayarkan.",
          ),
        }
      }
      return {
        title: translate("Dana dikembalikan"),
        body: translate(
          walletEnabled
            ? "Order tidak berlanjut — dana telah dikembalikan ke pembeli oleh {x}."
            : "Order tidak berlanjut — dana telah dikembalikan ke metode pembayaran pembeli oleh {x}.",
          { x: COMPANY },
        ),
      }
    case "REFUNDED":
      return {
        title: translate("Dana dikembalikan"),
        body: translate(
          walletEnabled
            ? "Order tidak berlanjut — dana telah dikembalikan ke pembeli oleh {x}."
            : "Order tidak berlanjut — dana telah dikembalikan ke metode pembayaran pembeli oleh {x}.",
          { x: COMPANY },
        ),
      }
    case "DISPUTED":
      return {
        title: translate("Dana dibekukan sementara"),
        // FE-090: satu kalimat — "Tidak ada pihak yang bisa menariknya
        // sepihak" sudah tercakup "hanya dilepas sesuai hasil penyelesaian".
        body: translate(
          "Selama sengketa, dana dibekukan oleh {x} dan hanya dilepas sesuai hasil penyelesaian.",
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
            title: translate("Dana akan disimpan aman oleh Kahade"),
            // FE-090: satu kalimat — gabungkan "setelah pembeli membayar"
            // dengan "setelah pembayaran masuk".
            body: translate(
              "Dana disimpan aman oleh Kahade setelah pembeli membayar — Anda dapat memproses order setelah pembayaran masuk.",
            ),
          }
        : {
            title: translate("Dana akan disimpan aman oleh Kahade"),
            // FE-090: satu kalimat; istilah baku "Ditahan di escrow" (§9).
            body: translate(
              "Dana disimpan aman oleh Kahade setelah Anda membayar, sampai Anda mengonfirmasi penerimaan.",
            ),
          }
    // U5-012 (UX-deep 2026-09-29, keputusan produk): saat PROCESSING,
    // pembeli diberi tahu tenggat kirim 2 hari + jaminan auto-refund —
    // "2 hari" boleh hardcode. Dibuat case eksplisit supaya status lain
    // yang jatuh ke default (mis. SHIPPED) tidak ikut dapat copy ini.
    case "PROCESSING":
      return myRole === "SELLER"
        ? {
            title: translate("Dana aman di Kahade"),
            body: translate(
              walletEnabled
                ? "Pembayaran disimpan aman oleh {x} dan akan diteruskan ke dompet Anda setelah pembeli mengonfirmasi penerimaan — atau otomatis setelah tenggat tanpa sengketa."
                : "Pembayaran disimpan aman oleh {x} dan akan dicairkan ke rekening bank Anda setelah pembeli mengonfirmasi penerimaan — atau otomatis setelah tenggat tanpa sengketa.",
              { x: COMPANY },
            ),
          }
        : {
            title: translate("Dana aman di Kahade"),
            // FE-090: satu kalimat — jaminan auto-refund 2 hari (U5-012,
            // keputusan produk) digabung dengan em-dash, bukan kalimat terpisah.
            body: translate(
              "Dana Anda disimpan aman oleh {x} sampai Anda mengonfirmasi penerimaan — cair otomatis setelah tenggat tanpa sengketa, atau kembali otomatis bila penjual tidak kirim dalam 2 hari.",
              { x: COMPANY },
            ),
          }
    default:
      return myRole === "SELLER"
        ? {
            title: translate("Dana aman di Kahade"),
            body: translate(
              walletEnabled
                ? "Pembayaran disimpan aman oleh {x} dan akan diteruskan ke dompet Anda setelah pembeli mengonfirmasi penerimaan — atau otomatis setelah tenggat tanpa sengketa."
                : "Pembayaran disimpan aman oleh {x} dan akan dicairkan ke rekening bank Anda setelah pembeli mengonfirmasi penerimaan — atau otomatis setelah tenggat tanpa sengketa.",
              { x: COMPANY },
            ),
          }
        : {
            title: translate("Dana aman di Kahade"),
            // FE-090: satu kalimat; istilah baku "Ditahan di escrow" (§9).
            body: translate(
              "Dana Anda disimpan aman oleh {x} — hanya diteruskan ke penjual setelah Anda mengonfirmasi penerimaan, atau otomatis setelah tenggat tanpa sengketa.",
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
  walletEnabled = true,
  className,
  ...rest
}: OrderEscrowCardProps) {
  const { title, body } = escrowCopy(status, myRole, paidAt, walletEnabled)
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
