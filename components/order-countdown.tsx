/**
 * Kahade — kotak countdown terisolasi untuk detail order (FE-001).
 *
 * `useClockTick` dulu dipanggil di layar `app/order/[id].tsx`, sehingga
 * `nowMs` yang berubah tiap detik me-render ulang SELURUH layar (±1300
 * baris). Ketiga komponen di file ini masing-masing berlangganan detak 1-Hz
 * sendiri dan di-`memo`, sehingga tick hanya me-render ulang label
 * waktunya — layar induk tidak ikut me-render ulang.
 *
 * Layar hanya meneruskan data STABIL (`at` / input mentah); detik hitung
 * mundur dihitung di dalam komponen ini per tick.
 */
import { memo } from "react"
import { View } from "react-native"
import { ShieldWarning } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { useClockTick } from "@/lib/use-clock-tick"
import { formatDateTimeWIB, formatDurationWords } from "@/lib/format"
import {
  resolveShippingCountdown,
  type ShippingCountdownInput,
} from "@/lib/order-shipping-countdown"
import {
  resolveConfirmCountdown,
  type ConfirmCountdownInput,
} from "@/lib/order-confirm-countdown"
import { translate } from "@/lib/i18n/translate"

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

/**
 * Countdown auto-release dana (IN_DELIVERY + `autoCompleteAt` dari backend).
 *
 * FE-003: copy dipadatkan jadi maks 2 baris —
 * "Dana cair otomatis {x}." + "Ajukan sengketa sebelum itu bila ada masalah."
 */
export const AutoReleaseCountdownBox = memo(function AutoReleaseCountdownBox({
  at,
}: {
  /** ISO datetime tenggat auto-release — dijamin valid oleh pemanggil. */
  at: string
}) {
  const target = new Date(at).getTime()
  const nowMs = useClockTick(true)
  const secondsLeft = Math.max(0, Math.floor((target - nowMs) / 1000))
  const expired = secondsLeft <= 0
  const tone = countdownTone(secondsLeft, expired)
  return (
    <View className={`gap-1 rounded-lg p-3 ${COUNTDOWN_BOX_BG[tone]}`}>
      {/* Item 35: label kontekstual "Batas konfirmasi". */}
      <Text variant="label" tone="secondary">
        {translate("Batas konfirmasi")}
      </Text>
      <Text variant="body" weight={600} tone={COUNTDOWN_TITLE_TONE[tone]}>
        {expired
          ? translate("Dana akan segera diteruskan ke penjual.")
          : translate("Dana cair otomatis {x}.", {
              x: formatDurationWords(secondsLeft),
            })}
      </Text>
      {!expired ? (
        <Text variant="caption" tone="secondary">
          {translate("Ajukan sengketa sebelum itu bila ada masalah.")}
        </Text>
      ) : null}
    </View>
  )
})

/**
 * Countdown "Batas waktu kirim penjual" — order sudah dibayar & belum
 * dikirim. Deadline lewat: tampilkan status jujur ("melewati batas"),
 * bukan disembunyikan — pola sama seperti kartu auto-release di atas
 * yang saat habis menampilkan teks alternatif.
 */
export const ShippingCountdownBox = memo(function ShippingCountdownBox({
  input,
  onDispute,
}: {
  /** Input mentah untuk `resolveShippingCountdown` (stabil per data order). */
  input: ShippingCountdownInput
  /** T2-009: dibuka dari kartu "Batas kirim" saat penjual melewati tenggat. */
  onDispute?: () => void
}) {
  const nowMs = useClockTick(true)
  const countdown = resolveShippingCountdown(input, nowMs)
  if (!countdown) return null
  const tone = countdownTone(
    countdown.kind === "countdown" ? countdown.secondsLeft : null,
    countdown.kind === "overdue",
  )
  return (
    <View className={`gap-1 rounded-lg p-3 ${COUNTDOWN_BOX_BG[tone]}`}>
      {/* Item 35: label kontekstual "Batas kirim". */}
      <Text variant="label" tone="secondary">
        {translate("Batas kirim")}
      </Text>
      {countdown.kind === "countdown" ? (
        <>
          <Text variant="body" weight={600} tone={COUNTDOWN_TITLE_TONE[tone]}>
            {translate("Penjual harus mengirim dalam {x}.", {
              x: formatDurationWords(countdown.secondsLeft),
            })}
          </Text>
          <Text variant="caption" tone="secondary">
            {translate("Tenggat kirim: {x}.", {
              x: formatDateTimeWIB(countdown.at),
            })}
          </Text>
        </>
      ) : (
        <>
          <Text variant="body" weight={600} tone={COUNTDOWN_TITLE_TONE[tone]}>
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
  )
})

/**
 * T2-006: banner proaktif "Penjual melewati batas kirim" di area aksi
 * sekunder — tick diisolasi di sini agar layar tidak me-render ulang
 * tiap detik hanya untuk mengejar momen tenggat terlewati.
 */
export const ShippingOverdueBanner = memo(function ShippingOverdueBanner({
  input,
  visible,
  onOpenDispute,
}: {
  /** null = tidak ada tenggat kirim yang perlu dipantau. */
  input: ShippingCountdownInput | null
  /** Gerbang tampil milik layar (pembeli + bisa sengketa + belum sengketa). */
  visible: boolean
  onOpenDispute: () => void
}) {
  const nowMs = useClockTick(visible && !!input)
  const overdue = !!input && resolveShippingCountdown(input, nowMs)?.kind === "overdue"
  if (!visible || !overdue) return null
  return (
    <View className="mb-2 gap-2 rounded-lg bg-warning-soft p-3">
      <Text variant="body" weight={600} tone="primary">
        Penjual melewati batas kirim
      </Text>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={ShieldWarning}
        onPress={onOpenDispute}
      >
        {/* FE-046: label jujur — membuka sengketa formal, bukan sekadar "melaporkan". */}
        Ajukan sengketa
      </Button>
    </View>
  )
})

/**
 * FE-110 (audit 2026-09-29): countdown "Batas konfirmasi penjual" —
 * tampil HANYA di WAITING_CONFIRMATION dengan `confirmationDeadlineAt`
 * dari backend. Deadline lewat → status jujur "melewati batas" (backend
 * membatalkan otomatis; klien hanya menampilkan, bukan berasumsi).
 *
 * Tick diisolasi di sini (memo) — layar tidak me-render ulang tiap detik.
 */
export const ConfirmCountdownBox = memo(function ConfirmCountdownBox({
  input,
}: {
  /** Input mentah untuk `resolveConfirmCountdown` (stabil per data order). */
  input: ConfirmCountdownInput
}) {
  const nowMs = useClockTick(true)
  const countdown = resolveConfirmCountdown(input, nowMs)
  if (!countdown) return null
  const tone = countdownTone(
    countdown.kind === "countdown" ? countdown.secondsLeft : null,
    countdown.kind === "overdue",
  )
  return (
    <View className={`gap-1 rounded-lg p-3 ${COUNTDOWN_BOX_BG[tone]}`}>
      <Text variant="label" tone="secondary">
        {translate("Batas konfirmasi")}
      </Text>
      {countdown.kind === "countdown" ? (
        <Text variant="body" weight={600} tone={COUNTDOWN_TITLE_TONE[tone]}>
          {translate("Penjual harus mengonfirmasi dalam {x}.", {
            x: formatDurationWords(countdown.secondsLeft),
          })}
        </Text>
      ) : (
        <Text variant="body" weight={600} tone={COUNTDOWN_TITLE_TONE[tone]}>
          {translate("Penjual melewati batas konfirmasi — pesanan akan dibatalkan otomatis.")}
        </Text>
      )}
      <Text variant="caption" tone="secondary">
        {translate("Lewat batas waktu, pesanan dibatalkan otomatis — belum ada dana yang ditahan.")}
      </Text>
    </View>
  )
})
