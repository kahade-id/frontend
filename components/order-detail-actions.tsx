/**
 * Kahade — <OrderDetailInfo>.
 *
 * Info KONTEKSTUAL halaman detail order — diekstrak dari
 * app/order/[id].tsx agar layar tidak menjadi god-component (plafon Q-25).
 *
 * Tombol aksi utama + Chat tinggal di <OrderFooterActions> (bottom navbar
 * via prop `footer` milik <Screen>); komponen ini hanya me-render info:
 * badge peran, countdown, hint langkah berikut, dan galat kesiapan nominal.
 * GERBANG TAMPIL 100% milik pemanggil: komponen ini TIDAK memutuskan kapan
 * sesuatu muncul — hanya me-render yang diminta.
 */
import { View, type ViewProps } from "react-native"

import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n/translate"
import { orderNextStepHint, type OrderActorRole } from "@/lib/order-next-step"
import { ctaUnavailableReasons } from "@/lib/wallet-batch139"
import { OrderRoleBadge } from "@/components/ui/order-role-badge"
import {
  AutoReleaseCountdownBox,
  ConfirmCountdownBox,
  ShippingCountdownBox,
} from "@/components/order-countdown"
import type { ShippingCountdownInput } from "@/lib/order-shipping-countdown"
import type { ConfirmCountdownInput } from "@/lib/order-confirm-countdown"

export type OrderDetailInfoProps = Omit<ViewProps, "children"> & {
  /** Status order mentah — untuk label countdown & hint langkah berikut. */
  status: string
  /** Peran user — untuk hint langkah berikut. */
  myRole?: OrderActorRole
  /** true bila footer menampilkan >=1 aksi utama (hint langkah disembunyikan). */
  hasPrimaryAction: boolean
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
  /**
   * FE-110: input mentah countdown batas konfirmasi penjual — gerbang
   * tampil milik layar; resolve per-tick di dalam <ConfirmCountdownBox>.
   */
  confirmCountdownInput: ConfirmCountdownInput | null
  /** T2-009: dibuka dari kartu "Batas kirim" saat penjual melewati tenggat. */
  onDispute?: () => void
  /**
   * M-30: tombol Bayar (di footer) butuh nominal terverifikasi yang belum
   * tersedia — tampilkan galat ringkas + tombol muat ulang di sini.
   */
  payAmountMissing?: boolean
  onReloadPayAmount?: () => void
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
          <Button fullWidth={false} size="sm" onPress={onRate}>
            {translate("Beri ulasan")}
          </Button>
          <Button fullWidth={false} size="sm" variant="ghost" onPress={onSnooze}>
            Ingatkan nanti
          </Button>
        </View>
      </View>
    </View>
  )
}

export function OrderDetailInfo({
  status,
  myRole,
  hasPrimaryAction,
  autoReleaseAt,
  shippingCountdownInput,
  confirmCountdownInput,
  onDispute,
  payAmountMissing,
  onReloadPayAmount,
  className,
  ...rest
}: OrderDetailInfoProps) {
  // Item 34: tidak ada aksi utama di footer → tampilkan "langkah
  // berikutnya" per status × peran.
  const nextStepHint = !hasPrimaryAction ? orderNextStepHint(status, myRole) : null
  /**
   * D15 (batch 139): alasan eksplisit mengapa TIDAK ADA tombol yang bisa
   * ditekan — per status × peran. Diutamakan di atas hint umum bila ada.
   */
  const unavailableReasons = !hasPrimaryAction ? ctaUnavailableReasons(status, myRole) : []
  return (
    <View className={className} {...rest}>
      {/*
       * D14 (batch 139): peran konsisten — badge "Pembeli"/"Penjual" yang
       * SAMA dengan header & timeline, tepat di atas area aksi.
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
        {/*
         * FE-110: kartu "Batas konfirmasi" — pembeli (dan penjual) melihat
         * tenggat konfirmasi + apa yang terjadi bila lewat (batal otomatis).
         * Detak terisolasi di dalam <ConfirmCountdownBox> (ter-memo).
         * Satu-satunya sumber tenggat = `confirmationDeadlineAt` backend.
         */}
        {confirmCountdownInput ? <ConfirmCountdownBox input={confirmCountdownInput} /> : null}
        {payAmountMissing ? (
          <ErrorState
            compact
            title="Rincian biaya belum tersedia"
            description="Muat ulang untuk menampilkan jumlah yang harus dibayar."
            onRetry={onReloadPayAmount}
          />
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
      </View>
    </View>
  )
}
