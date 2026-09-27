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
import { formatDurationWords, formatDateTimeWIB, formatRupiah } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { orderNextStepHint, type OrderActorRole } from "@/lib/order-next-step"
import type { ShippingCountdown } from "@/lib/order-shipping-countdown"

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
  /** Peran user — untuk hint langkah berikut & copy auto-release. */
  myRole?: OrderActorRole
  /** Countdown auto-release dana (IN_DELIVERY + autoCompleteAt). */
  autoRelease: { secondsLeft: number; at: string } | null
  /**
   * Countdown batas waktu kirim penjual — tampil hanya bila order sudah
   * dibayar & belum dikirim. Gerbang milik layar (via
   * `resolveShippingCountdown`); komponen hanya me-render yang diminta.
   */
  shippingCountdown: ShippingCountdown | null
  onPay: () => void
  onAccept: () => void
  onReject: () => void
  onShipping: () => void
  onDeliveryProof: () => void
  onComplete: () => void
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
          {/* Item 39: copy formal "Anda" (dulu "ulasanmu"). */}
          <Text variant="caption" tone="secondary">
            Transaksi selesai — ulasan Anda membantu pengguna lain memutuskan.
          </Text>
          {/* F9: komunikasikan jendela ulasan 7 hari (RATING_WINDOW_DAYS
              backend) agar user tidak mengira tombol "Ulas sekarang"
              tersedia selamanya. */}
          <Text variant="caption" tone="secondary">
            {translate("Ulasan dapat diberikan dalam 7 hari setelah transaksi selesai.")}
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" onPress={onRate}>
            Ulas sekarang
          </Button>
          <Button size="sm" variant="ghost" onPress={onSnooze}>
            Ingatkan nanti
          </Button>
        </View>
      </View>
    </View>
  )
}

/**
 * Item 36: tone countdown naik mengikuti kedekatan tenggat —
 * kedaluwarsa → danger, < 24 jam → warning, selebihnya info.
 */
type CountdownTone = "danger" | "warning" | "info"
function countdownTone(secondsLeft: number | null, expired: boolean): CountdownTone {
  if (expired) return "danger"
  if (secondsLeft != null && secondsLeft < 24 * 3600) return "warning"
  return "info"
}
const COUNTDOWN_BOX_BG: Record<CountdownTone, string> = {
  danger: "bg-danger-soft",
  warning: "bg-warning-soft",
  info: "bg-info-soft",
}
const COUNTDOWN_TITLE_TONE: Record<CountdownTone, "danger" | "primary"> = {
  danger: "danger",
  warning: "primary",
  info: "primary",
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
  autoRelease,
  shippingCountdown,
  onPay,
  onAccept,
  onReject,
  onShipping,
  onDeliveryProof,
  onComplete,
  onRate,
  onReturn,
  onReload,
  className,
  ...rest
}: OrderDetailActionsProps) {
  const autoReleaseTone = countdownTone(
    autoRelease?.secondsLeft ?? null,
    (autoRelease?.secondsLeft ?? 1) <= 0,
  )
  const shippingTone = countdownTone(
    shippingCountdown?.kind === "countdown" ? shippingCountdown.secondsLeft : null,
    shippingCountdown?.kind === "overdue",
  )
  // Item 34: area aksi kosong → tampilkan "langkah berikutnya" per status × peran.
  const hasAnyAction =
    canPay || canConfirm || canShip || canReviewDelivery || canRate || canViewProof || canReturnPrimary
  const nextStepHint = !hasAnyAction ? orderNextStepHint(status, myRole) : null
  return (
    <View className={className} {...rest}>
      <View className="gap-2">
        {/*
         * Countdown auto-release dana: IN_DELIVERY + `autoCompleteAt` dari
         * backend (= deliveryDeadlineAt). Dana cair otomatis bila tidak
         * ada konfirmasi/sengketa sebelum tanggal tersebut.
         * Item 35: label kontekstual "Batas konfirmasi".
         */}
        {autoRelease ? (
          <View className={`gap-1 rounded-lg p-3 ${COUNTDOWN_BOX_BG[autoReleaseTone]}`}>
            <Text variant="label" tone="secondary">
              {translate("Batas konfirmasi")}
            </Text>
            <Text variant="body" weight={600} tone={COUNTDOWN_TITLE_TONE[autoReleaseTone]}>
              {autoRelease.secondsLeft > 0
                ? translate("Dana akan cair otomatis dalam {x}.", {
                    x: formatDurationWords(autoRelease.secondsLeft),
                  })
                : translate("Dana akan segera diteruskan ke penjual.")}
            </Text>
            <Text variant="caption" tone="secondary">
              {translate(
                "Jika tidak ada konfirmasi atau sengketa sebelum {x}, dana otomatis diteruskan ke penjual.",
                { x: formatDateTimeWIB(autoRelease.at) },
              )}
            </Text>
            {/* Item 45: tegaskan hak pembeli sampai detik terakhir. */}
            {myRole === "BUYER" && autoRelease.secondsLeft > 0 ? (
              <Text variant="caption" tone="secondary">
                {translate("Anda masih bisa memeriksa barang & mengajukan sengketa sampai {x}.", {
                  x: formatDateTimeWIB(autoRelease.at),
                })}
              </Text>
            ) : null}
          </View>
        ) : null}
        {/*
         * Countdown batas waktu kirim penjual — order sudah dibayar & belum
         * dikirim. Deadline lewat: tampilkan status jujur ("melewati batas"),
         * bukan disembunyikan — pola sama seperti kartu auto-release di atas
         * yang saat habis menampilkan teks alternatif.
         * Item 35: label kontekstual "Batas kirim".
         */}
        {shippingCountdown ? (
          <View className={`gap-1 rounded-lg p-3 ${COUNTDOWN_BOX_BG[shippingTone]}`}>
            <Text variant="label" tone="secondary">
              {translate("Batas kirim")}
            </Text>
            {shippingCountdown.kind === "countdown" ? (
              <>
                <Text variant="body" weight={600} tone={COUNTDOWN_TITLE_TONE[shippingTone]}>
                  {translate("Penjual harus mengirim dalam {x}.", {
                    x: formatDurationWords(shippingCountdown.secondsLeft),
                  })}
                </Text>
                <Text variant="caption" tone="secondary">
                  {translate("Tenggat kirim: {x}.", {
                    x: formatDateTimeWIB(shippingCountdown.at),
                  })}
                </Text>
              </>
            ) : (
              <>
                <Text variant="body" weight={600} tone={COUNTDOWN_TITLE_TONE[shippingTone]}>
                  {translate("Penjual melewati batas waktu kirim.")}
                </Text>
                <Text variant="caption" tone="secondary">
                  {translate("Tenggat kirim adalah {x}.", {
                    x: formatDateTimeWIB(shippingCountdown.at),
                  })}
                </Text>
              </>
            )}
          </View>
        ) : null}
        {/* Item 46: "Ajukan retur" sebagai aksi PRIMER selama jendela retur berlaku. */}
        {canReturnPrimary ? (
          <Button leftIcon={ArrowUDownLeft} onPress={onReturn}>
            Ajukan retur
          </Button>
        ) : null}
        {nextStepHint ? (
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
              Bayar {buyerPays != null ? formatRupiah(buyerPays) : "—"}
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
            <Button leftIcon={Package} onPress={onDeliveryProof}>
              Periksa bukti pengiriman
            </Button>
            {/* Item 31: satu nama untuk rilis escrow — "Konfirmasi terima"
                (selaras label di notifikasi/push, item #24). */}
            <Button variant="secondary" loading={submitting} onPress={onComplete}>
              Konfirmasi terima
            </Button>
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
