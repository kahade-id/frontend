/**
 * Screen — Kahade+ : daftar paket (kontrak API baru).
 *
 * GET  /v1/subscriptions/plans (publik)
 * POST /v1/subscriptions/subscribe { plan, pin }
 *
 * Status langganan dibaca dari `useKahadePlus()` — SATU-SATUNYA sumber status
 * di UI. Anggota aktif dialihkan ke /kahade-plus/manage.
 *
 * Alur berlangganan: pilih paket → BottomSheet PIN dompet (6 digit) →
 * overlay progres → sukses → snapshot global di-invalidate → kelola.
 * Pesan galat backend ditampilkan APA ADANYA via `userMessage(err)` (S2).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import { Redirect, router } from "expo-router"
import { CrownSimple } from "phosphor-react-native"

import { isApiError, userMessage } from "@/lib/api/errors"
import {
  getKahadePlusPlans,
  subscribeKahadePlus,
  subscribeQrisKahadePlus,
  getQrisPaymentStatus,
  type KahadePlusPlan,
  type QrisSubscribeResult,
} from "@/lib/api/subscriptions"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { formatRupiah } from "@/lib/format"
import { KAHADE_PLUS_BENEFITS } from "@/lib/kahade-plus-benefits"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"
import { usePolling } from "@/lib/use-polling"
import { useKahadePlus, invalidateKahadePlus } from "@/lib/use-kahade-plus"
import { useResultTimer } from "@/lib/use-result-timer"
import { isQrisExpired } from "@/lib/wallet-ui"
import { translate } from "@/lib/i18n/translate"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Countdown } from "@/components/ui/countdown"
import { DataScreen } from "@/components/ui/data-screen"
import { PinInput } from "@/components/ui/pin-input"
import { PressableScale } from "@/components/ui/pressable-scale"
import { QRCodeDisplay } from "@/components/ui/qr-code-display"
import { SectionHeader } from "@/components/ui/section"
import { SubscriptionBenefitList } from "@/components/ui/subscription-benefit-list"
import { SubscriptionPlanCard } from "@/components/ui/subscription-plan-card"
import { Text } from "@/components/ui/text"
import { TransactionProgressOverlay } from "@/components/ui/transaction-progress-overlay"
import { useToast } from "@/components/ui/toast"

type ProgressState = "PROCESSING" | "SUCCESS" | "FAILURE"

const PLAN_LABEL: Record<KahadePlusPlan["plan"], string> = {
  MONTHLY: "Bulanan",
  YEARLY: "Tahunan",
}

/** "~Rp74.917/bulan · hemat ~24%" untuk kartu tahunan — dihitung dari data server. */
function yearlySummary(plan: KahadePlusPlan, monthlyPrice: number | null): string | undefined {
  const months = Math.max(1, Math.round(plan.durationDays / 30.44))
  const perMonth = plan.price / months
  const perMonthText = formatRupiah(perMonth)
  if (perMonthText === "—") return undefined
  if (monthlyPrice && monthlyPrice > 0 && perMonth < monthlyPrice) {
    const savePct = Math.round((1 - perMonth / monthlyPrice) * 100)
    if (savePct > 0)
      return translate("~{x}/bulan · hemat ~{y}%", { x: perMonthText, y: savePct })
  }
  return translate("~{x}/bulan", { x: perMonthText })
}

export default function KahadePlusPlansScreen() {
  const plus = useKahadePlus()
  const toast = useToast()
  const scheduleResult = useResultTimer()
  const submitLock = useRef(false)

  const plansQuery = useApiQuery<KahadePlusPlan[]>("kahade-plus-plans", (signal) =>
    getKahadePlusPlans(signal),
  )
  const plans = useMemo(
    () =>
      [...(plansQuery.data ?? [])].sort((a, b) =>
        a.plan === b.plan ? 0 : a.plan === "MONTHLY" ? -1 : 1,
      ),
    [plansQuery.data],
  )
  const monthlyPrice = useMemo(
    () => plans.find((p) => p.plan === "MONTHLY")?.price ?? null,
    [plans],
  )

  const [selected, setSelected] = useState<KahadePlusPlan | null>(null)
  const [pinOpen, setPinOpen] = useState(false)
  const [pinError, setPinError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [progressError, setProgressError] = useState<string | undefined>()
  /** Metode pembayaran: WALLET (saldo) atau QRIS (Flash Mobile). Keputusan produk 2026-09-26. */
  const [paymentMethod, setPaymentMethod] = useState<"WALLET" | "QRIS">("WALLET")
  const [qrisData, setQrisData] = useState<QrisSubscribeResult | null>(null)

  const startSubscribe = useCallback((plan: KahadePlusPlan) => {
    setSelected(plan)
    setPinError(undefined)
    setPinOpen(true)
  }, [])

  const closePin = useCallback(() => {
    if (submitting) return
    setPinOpen(false)
    setPinError(undefined)
  }, [submitting])

  const handlePin = useCallback(
    async (pin: string) => {
      if (submitLock.current || !selected) return
      submitLock.current = true
      setSubmitting(true)
      setPinError(undefined)
      setProgressError(undefined)
      setProgress("PROCESSING")
      try {
        if (paymentMethod === "QRIS") {
          // QRIS via Flash Mobile — terima qrString untuk dirender.
          const qris = await subscribeQrisKahadePlus({ plan: selected.plan, pin })
          setQrisData(qris)
          setProgress(null)
          setPinOpen(false)
          return
        }
        const next = await subscribeKahadePlus({ plan: selected.plan, pin })
        await invalidateKahadePlus()
        setProgress("SUCCESS")
        toast.show({
          title: next.isActive ? "Selamat datang di Kahade+" : "Permintaan langganan diterima",
          tone: next.isActive ? "success" : "info",
          duration: 3000,
        })
        scheduleResult(() => {
          setProgress(null)
          setPinOpen(false)
          setSelected(null)
          router.replace(ROUTES.kahadePlusManage)
        })
      } catch (err) {
        // S2: pesan backend tampil apa adanya — jangan diganti copy generik.
        const msg = isApiError(err) ? userMessage(err) : "Pembayaran gagal. Coba lagi."
        setProgressError(msg)
        setProgress("FAILURE")
        scheduleResult(() => {
          setProgress(null)
          setPinError(msg)
        })
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [selected, paymentMethod, toast.show, scheduleResult],
  )

  // Anggota aktif tidak memilih paket di sini — kelola di layar manage.
  if (!plus.loading && !plus.error && plus.isActive) {
    return <Redirect href={ROUTES.kahadePlusManage} />
  }

  const loading = plus.loading || plansQuery.loading
  const error = plus.error ?? plansQuery.error

  return (
    <>
      <DataScreen
        title="Kahade+"
        state={{
          loading,
          error,
          refresh: () => {
            void plansQuery.refresh()
            void plus.refetch()
          },
          reload: () => {
            void plansQuery.reload()
            void plus.refetch()
          },
        }}
        loadingMessage="Memuat paket Kahade+…"
        errorTitle="Gagal memuat paket"
        empty={
          plans.length === 0 && {
            icon: CrownSimple,
            title: "Belum ada paket tersedia",
          }
        }
      >
        <SectionHeader
          title="Pilih paket"
          subtitle="Batalkan kapan saja — akses premium tetap sampai periode berakhir."
        />
        <View className="gap-3">
          {plans.map((plan) => (
            <SubscriptionPlanCard
              key={plan.plan}
              name={plan.label || PLAN_LABEL[plan.plan]}
              description={
                plan.plan === "YEARLY"
                  ? (yearlySummary(plan, monthlyPrice) ?? "Bayar sekali untuk setahun")
                  : "Ditagih setiap bulan"
              }
              price={plan.price}
              period={plan.plan === "YEARLY" ? "/tahun" : "/bulan"}
              benefits={KAHADE_PLUS_BENEFITS.map((b) => ({
                id: `${plan.plan}-${b.key}`,
                label: b.title,
                included: true,
              }))}
              highlighted={plan.plan === "YEARLY"}
              selected={selected?.plan === plan.plan && pinOpen}
              onPress={() => setSelected(plan)}
              onSubscribe={() => startSubscribe(plan)}
              subscribing={submitting && selected?.plan === plan.plan}
            />
          ))}
        </View>

        <SectionHeader title="7 keuntungan Kahade+" />
        <SubscriptionBenefitList
          items={KAHADE_PLUS_BENEFITS.map((b) => ({
            id: b.key,
            label: b.title,
            description: b.description,
          }))}
        />
      </DataScreen>

      <BottomSheet
        visible={pinOpen}
        onRequestClose={closePin}
        title="Verifikasi PIN"
        description={
          selected
            ? translate("Masukkan PIN dompet Anda untuk berlangganan {x} sebesar {y}.", {
                x: selected.label || PLAN_LABEL[selected.plan],
                y: formatRupiah(selected.price),
              })
            : translate("Masukkan PIN dompet Anda untuk berlangganan.")
        }
        avoidKeyboard
      >
        {/* Pilihan metode pembayaran: Wallet/QRIS + PIN (keputusan produk 2026-09-26).
            UI-W007: dulu hex literal + RN Text — kini token design system. */}
        <View className="mb-4 flex-row gap-2">
          {(["WALLET", "QRIS"] as const).map((m) => {
            const active = paymentMethod === m
            return (
              <PressableScale
                key={m}
                onPress={() => setPaymentMethod(m)}
                disabled={submitting}
                containerClassName={cn("flex-1", focusRing)}
                className={cn(
                  "items-center rounded-md border px-4 py-3",
                  active ? "border-primary bg-primary" : "border-border-control bg-surface",
                )}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled: submitting }}
                accessibilityLabel={m === "WALLET" ? "Bayar dengan saldo dompet" : "Bayar dengan QRIS"}
              >
                <Text variant="body" weight={600} tone={active ? "inverse" : "secondary"}>
                  {m === "WALLET" ? "Saldo Wallet" : "QRIS"}
                </Text>
              </PressableScale>
            )
          })}
        </View>
        <PinInput
          mode="enter"
          onComplete={(pin) => void handlePin(pin)}
          errorText={pinError}
          disabled={submitting}
        />
      </BottomSheet>

      <TransactionProgressOverlay
        visible={progress !== null}
        state={progress ?? "PROCESSING"}
        processingMessage={translate("Memproses langganan…")}
        successMessage="Berlangganan berhasil"
        failureMessage={progressError ?? "Pembayaran gagal. Coba lagi."}
      />

      {/* Modal QRIS — tampilkan QR Flash untuk dipindai, polling status */}
      {qrisData && (
        <QrisPaymentSheet
          qris={qrisData}
          onClose={() => {
            setQrisData(null)
            setSelected(null)
          }}
          onSuccess={() => {
            setQrisData(null)
            setSelected(null)
            void invalidateKahadePlus()
            toast.show({ title: "Selamat datang di Kahade+", tone: "success", duration: 3000 })
            router.replace(ROUTES.kahadePlusManage)
          }}
        />
      )}
    </>
  )
}

/** Sheet pembayaran QRIS: tampilkan QR + polling status tiap 5 detik sampai ACTIVE/kedaluwarsa. */
function QrisPaymentSheet({
  qris,
  onClose,
  onSuccess,
}: {
  qris: QrisSubscribeResult
  onClose: () => void
  onSuccess: () => void
}) {
  const [status, setStatus] = useState<string>("PENDING")
  // UI-W008: `expired` dulu dihitung dari Date.now() sekali per-render —
  // tanpa tick, teks "kedaluwarsa" tak pernah muncul tepat waktu dan polling
  // jalan terus. Kini state + <Countdown> yang memicu render saat tenggat lewat.
  const [expired, setExpired] = useState(() => isQrisExpired(qris.expiredAt))
  /**
   * NS-002 (audit performa): backstop jumlah poll — pola `MAX_POLLS` dari
   * `lib/use-qris-payment.ts`. `expired` (countdown QR) menghentikan polling
   * lebih dulu pada kasus normal; ini jaring pengaman bila countdown tidak
   * pernah selesai (mis. jam perangkat kacau). 360 × 5 dtk = 30 menit.
   */
  const pollCount = useRef(0)
  const QRIS_SHEET_MAX_POLLS = 360
  // true setelah backstop tercapai → `enabled` usePolling mati total
  // (bukan sekadar tick no-op tiap 5 detik).
  const [pollCapped, setPollCapped] = useState(false)

  const pollQrisStatus = useCallback(async () => {
    try {
      const res = await getQrisPaymentStatus(qris.subscriptionId)
      setStatus(res.status)
      if (res.status === "ACTIVE") {
        onSuccess()
      }
    } catch {
      // abaikan error polling sesaat
    }
  }, [qris.subscriptionId, onSuccess])

  // Poll pertama langsung (perilaku lama), tick berikutnya via usePolling.
  useEffect(() => {
    if (!expired) void pollQrisStatus()
  }, [expired, pollQrisStatus])

  /**
   * NS-002 (audit performa): `setInterval` mentah → `usePolling` — berhenti
   * saat app pindah ke background / sheet tidak fokus (dulu polling 5-detik
   * jalan terus, mis. user mengunci HP dengan sheet terbuka) + anti-overlap.
   */
  usePolling(
    async () => {
      if (pollCount.current >= QRIS_SHEET_MAX_POLLS) {
        setPollCapped(true)
        return
      }
      pollCount.current += 1
      await pollQrisStatus()
    },
    5000,
    !expired && !pollCapped,
  )

  return (
    <BottomSheet visible onRequestClose={onClose} title="Bayar dengan QRIS">
      <View className="items-center gap-3 py-4">
        {qris.qrString ? (
          <QRCodeDisplay
            value={qris.qrString}
            size={240}
            title="Pindai QR ini dengan aplikasi pembayaran Anda"
            caption=""
          />
        ) : (
          <Text variant="body" tone="secondary">
            Menyiapkan kode QR…
          </Text>
        )}
        {expired ? (
          <Text variant="body" tone="danger" className="text-center">
            Kode QR kedaluwarsa. Silakan ulangi pemesanan.
          </Text>
        ) : (
          <>
            <Countdown
              until={new Date(qris.expiredAt)}
              prefix="Berlaku hingga"
              onComplete={() => setExpired(true)}
            />
            <Text variant="caption" tone="secondary" className="text-center">
              {status === "PENDING" ? "Menunggu pembayaran…" : "Memproses…"}
            </Text>
          </>
        )}
      </View>
    </BottomSheet>
  )
}
