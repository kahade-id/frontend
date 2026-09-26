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
import { View, Pressable, Text } from "react-native"
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
import { formatRupiah } from "@/lib/format"
import { KAHADE_PLUS_BENEFITS } from "@/lib/kahade-plus-benefits"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"
import { useKahadePlus, invalidateKahadePlus } from "@/lib/use-kahade-plus"
import { useResultTimer } from "@/lib/use-result-timer"
import { translate } from "@/lib/i18n/translate"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { DataScreen } from "@/components/ui/data-screen"
import { PinInput } from "@/components/ui/pin-input"
import { QRCodeDisplay } from "@/components/ui/qr-code-display"
import { SectionHeader } from "@/components/ui/section"
import { SubscriptionBenefitList } from "@/components/ui/subscription-benefit-list"
import { SubscriptionPlanCard } from "@/components/ui/subscription-plan-card"
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
    [selected, toast.show, scheduleResult],
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
        {/* Pilihan metode pembayaran: Wallet/QRIS + PIN (keputusan produk 2026-09-26) */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {(["WALLET", "QRIS"] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setPaymentMethod(m)}
              disabled={submitting}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: paymentMethod === m ? "#7c3aed" : "#e5e7eb",
                backgroundColor: paymentMethod === m ? "#f5f3ff" : "#fff",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontWeight: "600",
                  color: paymentMethod === m ? "#7c3aed" : "#6b7280",
                }}
              >
                {m === "WALLET" ? "Saldo Wallet" : "QRIS"}
              </Text>
            </Pressable>
          ))}
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
  const expiredAt = useMemo(() => new Date(qris.expiredAt).getTime(), [qris.expiredAt])
  const expired = Date.now() > expiredAt

  useEffect(() => {
    if (expired) return
    let cancelled = false
    const poll = async () => {
      try {
        const res = await getQrisPaymentStatus(qris.subscriptionId)
        if (cancelled) return
        setStatus(res.status)
        if (res.status === "ACTIVE") {
          onSuccess()
        }
      } catch {
        // abaikan error polling sesaat
      }
    }
    const timer = setInterval(poll, 5000)
    void poll()
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [qris.subscriptionId, expired, onSuccess])

  return (
    <BottomSheet visible onRequestClose={onClose} title="Bayar dengan QRIS">
      <View style={{ alignItems: "center", paddingVertical: 16 }}>
        {qris.qrString ? (
          <QRCodeDisplay
            value={qris.qrString}
            size={240}
            title="Pindai QR ini dengan aplikasi pembayaran Anda"
            caption=""
          />
        ) : (
          <Text>Menyiapkan kode QR…</Text>
        )}
        <Text style={{ marginTop: 12, color: "#6b7280" }}>
          {expired
            ? "Kode QR kedaluwarsa. Silakan ulangi pemesanan."
            : status === "PENDING"
              ? "Menunggu pembayaran…"
              : "Memproses…"}
        </Text>
      </View>
    </BottomSheet>
  )
}
