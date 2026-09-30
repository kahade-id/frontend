/**
 * Kahade — <OrderFooterActions>.
 *
 * Bottom navbar halaman detail order (2026-09-30, permintaan produk):
 * tindakan UTAMA kontekstual (per status × peran) + Chat, sticky di bawah
 * via prop `footer` milik <Screen>. Hanya aksi yang relevan untuk peran
 * user saat itu yang tampil (user-to-user).
 *
 * GERBANG TAMPIL 100% milik pemanggil (canPay/canConfirm/…): komponen ini
 * TIDAK memutuskan kapan tombol muncul — hanya me-render yang diminta.
 * Aksi sekunder (bantuan, invoice, sengketa, batal, dsb.) tinggal di menu
 * titik-tiga header, bukan di sini.
 */
import { View, type ViewProps } from "react-native"
import { ArrowUDownLeft, ChatCircleDots, Truck } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { formatRupiah } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"

export type OrderFooterActionsProps = Omit<ViewProps, "children"> & {
  /** Gerbang tampil — dihitung di layar dari status × peran. */
  canPay: boolean
  canConfirm: boolean
  canShip: boolean
  canReviewDelivery: boolean
  canRate: boolean
  /** Item 46: "Ajukan retur" sebagai aksi PRIMER selama jendela retur berlaku. */
  canReturnPrimary: boolean
  /** Nominal bayar terverifikasi; null = tombol Bayar terkunci. */
  buyerPays: number | null | undefined
  shippingRequired: boolean
  submitting: boolean
  chatBusy: boolean
  onPay: () => void
  onAccept: () => void
  onReject: () => void
  onShipping: () => void
  onComplete: () => void
  onRate: () => void
  onReturn: () => void
  onOpenChat: () => void
  className?: string
}

export function OrderFooterActions({
  canPay,
  canConfirm,
  canShip,
  canReviewDelivery,
  canRate,
  canReturnPrimary,
  buyerPays,
  shippingRequired,
  submitting,
  chatBusy,
  onPay,
  onAccept,
  onReject,
  onShipping,
  onComplete,
  onRate,
  onReturn,
  onOpenChat,
  className,
  ...rest
}: OrderFooterActionsProps) {
  return (
    <View className={className} {...rest}>
      <View className="flex-row items-center gap-2">
        <IconButton
          icon={ChatCircleDots}
          variant="secondary"
          accessibilityLabel={translate("Chat dengan lawan transaksi")}
          onPress={onOpenChat}
          loading={chatBusy}
        />
        {canPay ? (
          <Button containerClassName="flex-1" disabled={buyerPays == null} onPress={onPay}>
            {/* B-05: label tidak pernah mencetak `orderValue` sebagai total
                bayar (tanpa fee/diskon) — saat fee belum terhitung tampil
                "—", bukan angka yang lebih kecil. Label ringkas untuk
                bottom navbar; konteks escrow sudah dijelaskan di kartu
                escrow di badan layar. */}
            {buyerPays != null
              ? `${translate("Bayar")} · ${formatRupiah(buyerPays)}`
              : translate("Bayar —")}
          </Button>
        ) : null}
        {canConfirm ? (
          <>
            <Button variant="secondary" containerClassName="flex-1" onPress={onReject}>
              {translate("Tolak pesanan")}
            </Button>
            <Button containerClassName="flex-1" onPress={onAccept}>
              {translate("Terima pesanan")}
            </Button>
          </>
        ) : null}
        {canShip ? (
          <Button containerClassName="flex-1" leftIcon={Truck} onPress={onShipping}>
            {shippingRequired ? translate("Isi resi pengiriman") : translate("Tandai dikirim")}
          </Button>
        ) : null}
        {canReviewDelivery ? (
          // T2-003: "Konfirmasi terima" MELEPAS dana escrow ke penjual —
          // aksi penggerak uang harus jadi tombol PRIMER.
          <Button containerClassName="flex-1" loading={submitting} onPress={onComplete}>
            {translate("Konfirmasi terima")}
          </Button>
        ) : null}
        {canReturnPrimary ? (
          <Button containerClassName="flex-1" leftIcon={ArrowUDownLeft} onPress={onReturn}>
            {translate("Ajukan retur")}
          </Button>
        ) : null}
        {canRate ? (
          <Button variant="secondary" containerClassName="flex-1" onPress={onRate}>
            {translate("Beri ulasan")}
          </Button>
        ) : null}
      </View>
    </View>
  )
}
