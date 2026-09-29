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
import { ArrowUDownLeft, Package, ShieldWarning, Truck } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Text } from "@/components/ui/text"
import { formatDurationWords, formatDateTimeWIB, formatRupiah } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { orderNextStepHint, type OrderActorRole } from "@/lib/order-next-step"
import { ctaUnavailableReasons } from "@/lib/wallet-batch139"
import { OrderRoleBadge } from "@/components/ui/order-role-badge"
import type { ShippingCountdown } from "@/lib/order-shipping-countdown"
import type { ConfirmCountdown } from "@/lib/order-confirm-countdown"

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
  /**
   * FE-110: countdown batas konfirmasi penjual — tampil hanya di
   * WAITING_CONFIRMATION dengan `confirmationDeadlineAt` dari backend.
   * Gerbang milik layar (via `resolveConfirmCountdown`).
   */
  confirmCountdown: ConfirmCountdown | null
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
  confirmCountdown,
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
  const autoReleaseTone = countdownTone(
    autoRelease?.secondsLeft ?? null,
    (autoRelease?.secondsLeft ?? 1) <= 0,
  )
  const shippingTone = countdownTone(
    shippingCountdown?.kind === "countdown" ? shippingCountdown.secondsLeft : null,
    shippingCountdown?.kind === "overdue",
  )
  // FE-110: tone kartu "Batas konfirmasi" — pola sama seperti kartu kirim.
  const confirmTone = countdownTone(
    confirmCountdown?.kind === "countdown" ? confirmCountdown.secondsLeft : null,
    confirmCountdown?.kind === "overdue",
  )
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
            {/* T2-009: jelaskan hubungan batas konfirmasi dengan sengketa. */}
            <Text variant="caption" tone="secondary">
              {translate("Batas ini berhenti bila Anda membuka sengketa.")}
            </Text>
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
                  {translate(
                    "Penjual melewati batas kirim — dana TIDAK akan cair otomatis sampai masalah ini selesai.",
                  )}
                </Text>
                {/* T2-009: jalur bantuan langsung dari kartu tenggat. */}
                {onDispute ? (
                  // FE-046: label jujur — tombol ini MEMBUKA sengketa (dana
                  // dibekukan), bukan sekadar "melaporkan".
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={ShieldWarning}
                    onPress={onDispute}
                    className="mt-1"
                  >
                    Ajukan sengketa
                  </Button>
                ) : null}
              </>
            )}
          </View>
        ) : null}
        {/*
         * FE-110: kartu "Batas konfirmasi" — pembeli (dan penjual) melihat
         * tenggat konfirmasi + apa yang terjadi bila lewat (batal otomatis).
         * Satu-satunya sumber tenggat = `confirmationDeadlineAt` backend.
         */}
        {confirmCountdown ? (
          <View className={`gap-1 rounded-lg p-3 ${COUNTDOWN_BOX_BG[confirmTone]}`}>
            <Text variant="label" tone="secondary">
              {translate("Batas konfirmasi")}
            </Text>
            {confirmCountdown.kind === "countdown" ? (
              <Text variant="body" weight={600} tone={COUNTDOWN_TITLE_TONE[confirmTone]}>
                {translate("Penjual harus mengonfirmasi dalam {x}.", {
                  x: formatDurationWords(confirmCountdown.secondsLeft),
                })}
              </Text>
            ) : (
              <Text variant="body" weight={600} tone={COUNTDOWN_TITLE_TONE[confirmTone]}>
                {translate("Penjual melewati batas konfirmasi — pesanan akan dibatalkan otomatis.")}
              </Text>
            )}
            <Text variant="caption" tone="secondary">
              {translate("Lewat batas waktu, pesanan dibatalkan otomatis — belum ada dana yang ditahan.")}
            </Text>
          </View>
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
