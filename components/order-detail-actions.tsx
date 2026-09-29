/**
 * Kahade — <OrderDetailActions>.
 *
 * Tombol aksi KONTEKSTUAL halaman detail order — diekstrak dari
 * app/order/[id].tsx agar layar tidak menjadi god-component (plafon Q-25).
 *
 * GERBANG TAMPIL 100% milik pemanggil (canPay/canConfirm/…): komponen ini
 * TIDAK memutuskan kapan tombol muncul — hanya me-render yang diminta.
 * Seluruh handler (runAction, sheet, navigasi) diteruskan sebagai props.
 */
import { View, type ViewProps } from "react-native"
import { ArrowUDownLeft, Package, Truck } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Text } from "@/components/ui/text"
import { formatRupiah } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { orderNextStepHint, type OrderActorRole } from "@/lib/order-next-step"
import { ctaUnavailableReasons } from "@/lib/wallet-batch139"
import { OrderRoleBadge } from "@/components/ui/order-role-badge"
import {
  AutoReleaseCountdownBox,
  ShippingCountdownBox,
} from "@/components/order-countdown"
import type { ShippingCountdownInput } from "@/lib/order-shipping-countdown"

export type OrderDetailActionsProps = Omit<ViewProps, "children"> & {
  /** Gerbang tampil — dihitung di layar dari status × peran. */
  canPay: boolean
  canConfirm: boolean
  canShip: boolean
  canReviewDelivery: boolean
  canRate: boolean
  /** Penjual melihat bukti pengiriman saat order dalam pengiriman. */
  canViewProof: boolean
  /** Item 46: "Ajukan retur" sebagai aksi PRIMER selama jendela retur berlaku. */
  canReturnPrimary: boolean
  /** Nominal bayar terverifikasi; null = tombol Bayar terkunci. */
  buyerPays: number | null | undefined
  shippingRequired: boolean
  submitting: boolean
  /** Status order mentah — untuk label countdown & hint langkah berikut. */
  status: string
  /** Peran user — untuk hint langkah berikut. */
  myRole?: OrderActorRole
  /**
   * FE-001: tenggat auto-release dana (IN_DELIVERY + autoCompleteAt) —
   * hanya string `at` yang stabil; detik hitung mundur dihitung di dalam
   * <AutoReleaseCountdownBox> yang ter-memo per tick.
   */
  autoReleaseAt: string | null
  /**
   * FE-001: input mentah countdown batas kirim penjual — gerbang tampil
   * milik layar; resolve per-tick di dalam <ShippingCountdownBox>.
   */
  shippingCountdownInput: ShippingCountdownInput | null
  onPay: () => void
  onAccept: () => void
  onReject: () => void
  onShipping: () => void
  onDeliveryProof: () => void
  onComplete: () => void
  /** T2-009: dibuka dari kartu "Batas kirim" saat penjual melewati tenggat
      (sheet sengketa yang sama dipakai aksi sekunder). */
  onDispute?: () => void
  onRate: () => void
  onReturn: () => void
  onReload: () => void
  className?: string
}

export type OrderRatingReminderProps = Omit<ViewProps, "children"> & {
  visible: boolean
  onRate: () => void
  onSnooze: () => void
  className?: string
}

/**
 * Pengingat ulasan pasca-COMPLETED (jendela 7 hari backend, bisa ditunda).
 * Murni presentasi — keputusan tampil (`visible`) milik layar.
 */
export function OrderRatingReminder({
  visible,
  onRate,
  onSnooze,
  className,
  ...rest
}: OrderRatingReminderProps) {
  if (!visible) return null
  return (
    <View className={className} {...rest}>
      <View className="gap-3 rounded-lg bg-info-soft p-3">
        <View className="gap-1">
          {/* FE-029: satu caption jendela ulasan (RATING_WINDOW_DAYS backend),
              bukan dua kalimat persuasif+informatif. */}
          <Text variant="caption" tone="secondary">
            {translate("Maksimal 7 hari setelah transaksi selesai.")}
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" onPress={onRate}>
            {translate("Beri ulasan")}
          </Button>
          <Button size="sm" variant="ghost" onPress={onSnooze}>
            Ingatkan nanti
          </Button>
        </View>
      </View>
    </View>
  )
}

export function OrderDetailActions({
  canPay,
  canConfirm,
  canShip,
  canReviewDelivery,
  canRate,
  canViewProof,
  canReturnPrimary,
  buyerPays,
  shippingRequired,
  submitting,
  status,
  myRole,
  autoReleaseAt,
  shippingCountdownInput,
  onPay,
  onAccept,
  onReject,
  onShipping,
  onDeliveryProof,
  onComplete,
  onDispute,
  onRate,
  onReturn,
  onReload,
  className,
  ...rest
}: OrderDetailActionsProps) {
  // Item 34: area aksi kosong → tampilkan "langkah berikutnya" per status × peran.
  const hasAnyAction =
    canPay || canConfirm || canShip || canReviewDelivery || canRate || canViewProof || canReturnPrimary
  const nextStepHint = !hasAnyAction ? orderNextStepHint(status, myRole) : null
  /**
   * D15 (batch 139): alasan eksplisit mengapa TIDAK ADA tombol yang bisa
   * ditekan — per status × peran. Diutamakan di atas hint umum bila ada.
   */
  const unavailableReasons = !hasAnyAction ? ctaUnavailableReasons(status, myRole) : []
  return (
    <View className={className} {...rest}>
      {/*
       * D14 (batch 139): peran konsisten — badge "Pembeli"/"Penjual" yang
       * SAMA dengan header & timeline, tepat di atas tombol aksi.
       */}
      {myRole ? (
        <View className="mb-2 flex-row items-center gap-2">
          <Text variant="caption" tone="secondary">
            {translate("Anda bertindak sebagai")}
          </Text>
          <OrderRoleBadge role={myRole} />
        </View>
      ) : null}
      <View className="gap-2">
        {/*
         * FE-001: countdown auto-release dana — detak 1-Hz terisolasi di
         * dalam <AutoReleaseCountdownBox> (ter-memo), layar tidak ikut
         * me-render ulang tiap detik.
         * Item 35: label kontekstual "Batas konfirmasi".
         */}
        {autoReleaseAt ? <AutoReleaseCountdownBox at={autoReleaseAt} /> : null}
        {/*
         * FE-001: countdown batas waktu kirim penjual — detak terisolasi di
         * dalam <ShippingCountdownBox> (ter-memo).
         * Item 35: label kontekstual "Batas kirim".
         */}
        {shippingCountdownInput ? (
          <ShippingCountdownBox input={shippingCountdownInput} onDispute={onDispute} />
        ) : null}
        {/* Item 46: "Ajukan retur" sebagai aksi PRIMER selama jendela retur berlaku. */}
        {canReturnPrimary ? (
          <Button leftIcon={ArrowUDownLeft} onPress={onReturn}>
            Ajukan retur
          </Button>
        ) : null}
        {unavailableReasons.length > 0 ? (
          <View className="gap-1.5 rounded-lg bg-info-soft p-3">
            {unavailableReasons.map((reason) => (
              <Text key={reason} variant="body" tone="secondary">
                {reason}
              </Text>
            ))}
          </View>
        ) : nextStepHint ? (
          <View className="gap-1 rounded-lg bg-info-soft p-3">
            <Text variant="body" tone="secondary">
              {nextStepHint}
            </Text>
          </View>
        ) : null}
        {canPay ? (
          <>
            {buyerPays == null ? (
              <ErrorState
                compact
                title="Rincian biaya belum tersedia"
                description="Muat ulang untuk menampilkan jumlah yang harus dibayar."
                onRetry={onReload}
              />
            ) : null}
            {/* M-30: tombol Bayar terkunci SELAMA nominal belum terlihat —
                label "Bayar —" = membayar tanpa nominal terlihat. */}
            <Button disabled={buyerPays == null} onPress={onPay}>
              {/* B-05: label tidak pernah mencetak `orderValue` sebagai total
                  bayar (tanpa fee/diskon) — saat fee belum terhitung tampil
                  "—", bukan angka yang lebih kecil. */}
              Bayar ke Escrow · {buyerPays != null ? formatRupiah(buyerPays) : "—"}
            </Button>
          </>
        ) : null}
        {canConfirm ? (
          <>
            <Button onPress={onAccept}>Terima pesanan</Button>
            <Button variant="secondary" onPress={onReject}>
              Tolak pesanan
            </Button>
          </>
        ) : null}
        {canShip ? (
          <>
            <Button leftIcon={Truck} onPress={onShipping}>
              {shippingRequired ? "Isi resi pengiriman" : "Tandai dikirim"}
            </Button>
            <Button variant="secondary" leftIcon={Package} onPress={onDeliveryProof}>
              Unggah bukti pengiriman
            </Button>
          </>
        ) : null}
        {canReviewDelivery ? (
          <>
            {/* T2-003: "Konfirmasi terima" MELEPAS dana escrow ke penjual —
                aksi penggerak uang harus jadi tombol PRIMER (dulu sekunder,
                sehingga dana penjual tertahan sampai auto-release). */}
            <Button loading={submitting} onPress={onComplete}>
              Konfirmasi terima
            </Button>
            <Text variant="caption" tone="secondary" className="text-center">
              Dana cair ke penjual
            </Text>
            <Button variant="secondary" leftIcon={Package} onPress={onDeliveryProof}>
              Periksa bukti pengiriman
            </Button>
            {/* Item 31: satu nama untuk rilis escrow — "Konfirmasi terima"
                (selaras label di notifikasi/push, item #24). */}
          </>
        ) : null}
        {canViewProof ? (
          <Button variant="secondary" leftIcon={Package} onPress={onDeliveryProof}>
            Bukti pengiriman
          </Button>
        ) : null}
        {canRate ? (
          <Button variant="secondary" onPress={onRate}>
            Beri ulasan
          </Button>
        ) : null}
      </View>
    </View>
  )
}
