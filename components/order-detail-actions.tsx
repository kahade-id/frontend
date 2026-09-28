/**
 * Kahade — <OrderDetailActions>.
 *
 * Tombol aksi KONTEKSTUAL halaman detail order — diekstrak dari
 * app/order/[id].tsx agar layar tidak menjadi god-component (plafon Q-25).
 *
 * GERBANG TAMPIL 100% milik pemanggil (canPay/canConfirm/…): komponen ini
 * TIDAK memutuskan kapan tombol muncul — hanya me-render yang diminta.
 * Seluruh handler (runAction, sheet, navigasi) diteruskan sebagai props.
 *
 * Mega-batch FE-IMP-5:
 * - Item 31: label rilis escrow disatukan menjadi "Konfirmasi terima"
 *   (sebelumnya "Tandai selesai" di sini vs "Konfirmasi terima" di
 *   notifikasi/push).
 * - Item 32: dialog konfirmasi sebelum dana escrow dilepas — "Dana akan
 *   diteruskan ke penjual dan tidak bisa dibatalkan".
 * - Item 34: bila TIDAK ADA aksi primer (menunggu pihak lain), tampilkan box
 *   "Langkah berikutnya" dari prop `nextStepHint`.
 * - Item 35: label countdown kontekstual ("Batas kirim"/"Batas konfirmasi"
 *   dari lib/order-countdown) menggantikan "Batas waktu kirim penjual".
 * - Item 36: countdown < 24 jam naik ke tone danger (bg-danger-soft).
 * - Item 45: box auto-release menegaskan hak memeriksa & sengketa sampai
 *   waktu rilis otomatis.
 * - Item 46: "Ajukan retur" sebagai aksi PRIMER selama window retur berlaku
 *   (prop `canReturn` + `returnDeadlineAt`).
 */
import { useState } from "react"
import { View, type ViewProps } from "react-native"
import { ArrowUDownLeft, Package, Truck } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { ErrorState } from "@/components/ui/error-state"
import { Text } from "@/components/ui/text"
import { formatDurationWords, formatDateTimeWIB, formatRupiah } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import {
  countdownDeadlineLabel,
  isCountdownUrgent,
} from "@/lib/order-countdown"
import { nextStepTitle } from "@/lib/order-next-step"
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
  /** Item 46: pembeli + window retur backend masih berlaku → aksi primer. */
  canReturn: boolean
  /** Tenggat window retur (ISO) — tampil sebagai info di tombol retur. */
  returnDeadlineAt?: string | null
  /** Nominal bayar terverifikasi; null = tombol Bayar terkunci. */
  buyerPays: number | null | undefined
  shippingRequired: boolean
  submitting: boolean
  /** Countdown auto-release dana (IN_DELIVERY + autoCompleteAt). */
  autoRelease: { secondsLeft: number; at: string } | null
  /**
   * Countdown batas waktu kirim penjual — tampil hanya bila order sudah
   * dibayar & belum dikirim. Gerbang milik layar (via
   * `resolveShippingCountdown`); komponen hanya me-render yang diminta.
   */
  shippingCountdown: ShippingCountdown | null
  /**
   * Item 34: panduan satu kalimat bila area aksi kosong (menunggu pihak
   * lain). Diturunkan layar dari status × peran (lib/order-next-step).
   */
  nextStepHint?: string | null
  /**
   * Item 35: status order saat ini — dipakai label countdown kontekstual
   * ("Batas kirim"/"Batas konfirmasi"). Opsional; tanpa status, label
   * generik "Batas waktu" dipakai (fallback aman).
   */
  status?: string
  onPay: () => void
  onAccept: () => void
  onReject: () => void
  onShipping: () => void
  onDeliveryProof: () => void
  onComplete: () => void
  onRate: () => void
  /** Item 46: buka form retur (layar /returns/new). */
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
 *
 * Item 39: copy diseragamkan ke formal "Anda" ("ulasanmu" → "ulasan Anda").
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
export function OrderDetailActions({
  canPay,
  canConfirm,
  canShip,
  canReviewDelivery,
  canRate,
  canViewProof,
  canReturn,
  returnDeadlineAt,
  buyerPays,
  shippingRequired,
  submitting,
  autoRelease,
  shippingCountdown,
  nextStepHint,
  status,
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
  // Item 32: konfirmasi eksplisit sebelum dana escrow dilepas. Dialog hidup
  // di dalam komponen (presentasi), aksi pelepasannya tetap milik pemanggil.
  const [confirmReleaseOpen, setConfirmReleaseOpen] = useState(false)

  // Item 34: area aksi dianggap "kosong" bila tidak ada SATU PUN aksi primer
  // yang dirender — countdown bukan aksi, jadi tidak ikut dihitung.
  const hasPrimaryAction =
    canPay || canConfirm || canShip || canReviewDelivery || canRate || canViewProof || canReturn

  const autoReleaseUrgent = autoRelease ? isCountdownUrgent(autoRelease.secondsLeft) : false
  const shippingUrgent =
    shippingCountdown?.kind === "countdown" ? isCountdownUrgent(shippingCountdown.secondsLeft) : false

  return (
    <View className={className} {...rest}>
      <View className="gap-2">
        {/*
         * Countdown auto-release dana: IN_DELIVERY + `autoCompleteAt` dari
         * backend (= deliveryDeadlineAt). Dana cair otomatis bila tidak
         * ada konfirmasi/sengketa sebelum tanggal tersebut.
         *
         * Item 35: label kontekstual "Batas konfirmasi". Item 36: < 24 jam
         * naik ke tone danger. Item 45: tegaskan hak memeriksa barang &
         * mengajukan sengketa sampai waktu rilis otomatis.
         */}
        {autoRelease ? (
          <View className={`gap-1 rounded-lg p-3 ${autoReleaseUrgent ? "bg-danger-soft" : "bg-warning-soft"}`}>
            <Text variant="body" weight={600}>
              {autoRelease.secondsLeft > 0
                ? translate("{label}: {x}.", {
                    label: countdownDeadlineLabel(status ?? "IN_DELIVERY"),
                    x: formatDurationWords(autoRelease.secondsLeft),
                  })
                : translate("Dana akan segera diteruskan ke penjual.")}
            </Text>
            <Text variant="caption" tone="secondary">
              {translate(
                "Anda masih bisa memeriksa barang & mengajukan sengketa sampai {x}.",
                { x: formatDateTimeWIB(autoRelease.at) },
              )}
            </Text>
            <Text variant="caption" tone="secondary">
              {translate(
                "Jika tidak ada konfirmasi atau sengketa sebelum {x}, dana otomatis diteruskan ke penjual.",
                { x: formatDateTimeWIB(autoRelease.at) },
              )}
            </Text>
          </View>
        ) : null}
        {/*
         * Countdown batas waktu kirim penjual — order sudah dibayar & belum
         * dikirim. Deadline lewat: tampilkan status jujur ("melewati batas"),
         * bukan disembunyikan — pola sama seperti kartu auto-release di atas
         * yang saat habis menampilkan teks alternatif.
         *
         * Item 35: "Batas kirim". Item 36: < 24 jam → tone danger.
         */}
        {shippingCountdown ? (
          <View className={`gap-1 rounded-lg p-3 ${shippingUrgent ? "bg-danger-soft" : "bg-warning-soft"}`}>
            {shippingCountdown.kind === "countdown" ? (
              <>
                <Text variant="body" weight={600}>
                  {translate("{label}: {x}.", {
                    label: countdownDeadlineLabel(status ?? "PROCESSING"),
                    x: formatDurationWords(shippingCountdown.secondsLeft),
                  })}
                </Text>
                <Text variant="caption" tone="secondary">
                  {translate("Penjual harus mengirim sebelum {x}.", {
                    x: formatDateTimeWIB(shippingCountdown.at),
                  })}
                </Text>
              </>
            ) : (
              <>
                <Text variant="body" weight={600} tone={shippingUrgent ? "danger" : "primary"}>
                  {translate("Penjual melewati {label}.", {
                    label: countdownDeadlineLabel(status ?? "PROCESSING").toLowerCase(),
                  })}
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
            {/* Item 31: label disatukan menjadi "Konfirmasi terima" (dulu
                "Tandai selesai" — tidak konsisten dengan notifikasi/push).
                Item 32: ketuk → dialog konfirmasi dulu, baru dana dilepas. */}
            <Button variant="secondary" loading={submitting} onPress={() => setConfirmReleaseOpen(true)}>
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
        {/* Item 46: "Ajukan retur" sebagai aksi PRIMER selama window retur
            berlaku — bukan lagi tombol sekunder di "Lainnya". */}
        {canReturn ? (
          <>
            <Button leftIcon={ArrowUDownLeft} onPress={onReturn}>
              Ajukan retur
            </Button>
            {returnDeadlineAt ? (
              <Text variant="caption" tone="secondary">
                {translate("Window retur berlaku sampai {x}.", {
                  x: formatDateTimeWIB(returnDeadlineAt),
                })}
              </Text>
            ) : null}
          </>
        ) : null}
        {/* Item 34: tidak ada aksi primer → tampilkan "langkah berikutnya"
            per status × peran, supaya area tidak kosong membingungkan. */}
        {!hasPrimaryAction && nextStepHint ? (
          <View className="gap-1 rounded-lg bg-info-soft p-3">
            <Text variant="body" weight={600}>
              {nextStepTitle()}
            </Text>
            <Text variant="caption" tone="secondary">
              {nextStepHint}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Item 32: dialog konfirmasi pelepasan dana escrow. */}
      <Dialog
        title="Konfirmasi terima barang?"
        description="Dana akan diteruskan ke penjual dan tidak bisa dibatalkan. Pastikan barang/jasa sudah Anda terima dan sesuai dengan kesepakatan."
        visible={confirmReleaseOpen}
        loading={submitting}
        confirmLabel="Ya, konfirmasi"
        cancelLabel="Periksa dulu"
        onConfirm={() => {
          setConfirmReleaseOpen(false)
          onComplete()
        }}
        onCancel={() => setConfirmReleaseOpen(false)}
        onRequestClose={() => setConfirmReleaseOpen(false)}
      />
    </View>
  )
}
