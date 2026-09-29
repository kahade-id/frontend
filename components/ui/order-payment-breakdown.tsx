/**
 * Kahade — <OrderPaymentBreakdown>.
 *
 * Rincian pembayaran collapsible (2026-09-30, permintaan produk): header
 * selalu menampilkan TOTAL (bayar untuk pembeli, terima untuk penjual) +
 * caret buka/tutup; isi <FeeBreakdown> tampil saat dibuka. Total tetap
 * terlihat saat tertutup — informasi terpenting tidak pernah disembunyikan.
 */
import { useState } from "react"
import { View, type ViewProps } from "react-native"
import { CaretDown, CaretUp } from "phosphor-react-native"

import { FeeBreakdown, type FeeResponsibility, type FeeRole } from "@/components/ui/fee-breakdown"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { formatRupiah } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { cn } from "@/lib/cn"

export type OrderPaymentBreakdownProps = Omit<ViewProps, "children" | "role"> & {
  orderValue: number
  feeAmount: number
  feeResponsibility: FeeResponsibility
  /** Peran user — total yang ditampilkan = bayar (pembeli) / terima (penjual). */
  role: FeeRole
  /** Potongan voucher (positif); dirender negatif. */
  discountAmount?: number
  voucherCode?: string
  /** Angka akhir dari server. */
  buyerPays?: number
  sellerGets?: number
  /** Tampilkan baris "Ongkir" untuk barang fisik (tanpa mengubah total). */
  showShippingNote?: boolean
  /** Terbuka saat pertama dirender (default true). */
  defaultOpen?: boolean
  className?: string
}

export function OrderPaymentBreakdown({
  defaultOpen = true,
  role,
  buyerPays,
  sellerGets,
  className,
  ...feeProps
}: OrderPaymentBreakdownProps) {
  const [open, setOpen] = useState(defaultOpen)
  // Total yang penting: pembeli = yang dibayar, penjual = yang diterima.
  const total = role === "BUYER" ? buyerPays : sellerGets
  const totalText = total != null ? formatRupiah(total) : "—"
  return (
    <View className={cn("gap-3", className)}>
      <PressableScale
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={translate("Rincian pembayaran, total {x}", { x: totalText })}
        accessibilityHint={
          open ? translate("Tutup rincian pembayaran") : translate("Buka rincian pembayaran")
        }
      >
        <SectionHeader
          title={translate("Rincian pembayaran")}
          action={
            <View className="flex-row items-center gap-2">
              <Text variant="body" weight={700} className="tabular-nums">
                {totalText}
              </Text>
              <Icon icon={open ? CaretUp : CaretDown} size={18} />
            </View>
          }
        />
      </PressableScale>
      {open ? (
        <FeeBreakdown
          bare
          role={role}
          buyerPays={buyerPays}
          sellerGets={sellerGets}
          {...feeProps}
        />
      ) : null}
    </View>
  )
}
