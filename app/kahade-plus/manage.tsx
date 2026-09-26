/**
 * Screen — Kahade+ : status & kelola (kontrak API baru).
 *
 * GET  /v1/subscriptions/me  (via `useKahadePlus()` — satu-satunya sumber)
 * POST /v1/subscriptions/cancel
 *
 * Menampilkan paket aktif, periode (WIB), sisa kuota bebas biaya layanan,
 * dan tombol batalkan. Bukan anggota → ajakan melihat paket.
 */
import { useCallback, useMemo, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { CrownSimple, Palette } from "phosphor-react-native"

import { cancelKahadePlus, reactivateKahadePlus, type KahadePlusPlanKey } from "@/lib/api/subscriptions"
import { userMessage } from "@/lib/api/errors"
import { formatDateTimeWIB, formatRupiah } from "@/lib/format"
import { invalidateKahadePlus, useKahadePlus } from "@/lib/use-kahade-plus"
import { ROUTES } from "@/lib/routes"
import { translate } from "@/lib/i18n/translate"

import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { GreyCheckBadge } from "@/components/ui/grey-check-badge"
import { ListGroup, ListItem } from "@/components/ui/list-item"
import { ProgressBar } from "@/components/ui/progress-bar"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const PLAN_LABEL: Record<KahadePlusPlanKey, string> = {
  MONTHLY: "Bulanan",
  YEARLY: "Tahunan",
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktif",
  CANCELLED: "Dibatalkan",
  EXPIRED: "Kedaluwarsa",
  PAST_DUE: "Menunggak",
}

export default function KahadePlusManageScreen() {
  const plus = useKahadePlus()
  const toast = useToast()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [reactivating, setReactivating] = useState(false)

  const quota = useMemo(() => {
    const remaining = Math.max(0, plus.feeWaiverLimit - plus.feeWaivedThisPeriod)
    const usedPct =
      plus.feeWaiverLimit > 0
        ? Math.min(100, (plus.feeWaivedThisPeriod / plus.feeWaiverLimit) * 100)
        : 0
    return { remaining, usedPct }
  }, [plus.feeWaiverLimit, plus.feeWaivedThisPeriod])

  const handleCancel = useCallback(async () => {
    setCancelling(true)
    try {
      await cancelKahadePlus()
      await invalidateKahadePlus()
      setCancelOpen(false)
      toast.show({ title: "Langganan dibatalkan", description: "Akses premium tetap berlaku sampai akhir periode.", tone: "success", duration: 3000 })
    } catch (err: unknown) {
      // S2: pesan backend tampil apa adanya.
      toast.show({
        title: "Gagal membatalkan langganan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setCancelling(false)
    }
  }, [toast.show])

  const handleReactivate = useCallback(async () => {
    setReactivating(true)
    try {
      await reactivateKahadePlus()
      await invalidateKahadePlus()
      toast.show({ title: "Langganan dilanjutkan", tone: "success", duration: 3000 })
    } catch (err: unknown) {
      toast.show({
        title: "Gagal melanjutkan langganan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setReactivating(false)
    }
  }, [toast.show])

  const periodText = useMemo(() => {
    if (!plus.currentPeriodStart || !plus.currentPeriodEnd) return null
    return `${formatDateTimeWIB(plus.currentPeriodStart)} – ${formatDateTimeWIB(plus.currentPeriodEnd)}`
  }, [plus.currentPeriodStart, plus.currentPeriodEnd])

  return (
    <>
      <DataScreen
        title="Kahade+ saya"
        state={{
          loading: plus.loading,
          error: plus.error,
          refresh: () => void plus.refetch(),
          reload: () => void plus.refetch(),
        }}
        loadingMessage="Memuat status langganan…"
        errorTitle="Gagal memuat status"
      >
        {!plus.isActive ? (
          <EmptyState
            icon={CrownSimple}
            title="Belum berlangganan"
            description="Aktifkan Kahade+ untuk membuka 7 keuntungan premium."
            action={
              <Button fullWidth={false} onPress={() => router.push(ROUTES.kahadePlusPlans)}>
                Lihat paket
              </Button>
            }
          />
        ) : (
          <View className="gap-4">
            <ListGroup>
              <ListItem
                title="Paket"
                trailing={
                  <Text variant="body" weight={600} tone="primary">
                    {plus.plan ? PLAN_LABEL[plus.plan] : "—"}
                  </Text>
                }
              />
              <ListItem
                title="Status"
                trailing={
                  <Text variant="body" weight={600} tone="primary">
                    {plus.status ? (STATUS_LABEL[plus.status] ?? plus.status) : "Aktif"}
                  </Text>
                }
                divider={false}
              />
            </ListGroup>

            <View className="gap-2">
              <SectionHeader title="Periode berjalan" />
              <Text variant="body" tone="secondary">
                {periodText ?? "—"}
              </Text>
            </View>

            <View className="gap-2">
              <SectionHeader
                title="Kuota bebas biaya layanan"
                subtitle={translate("Sisa {x} dari {y} periode ini", {
                  x: formatRupiah(quota.remaining),
                  y: formatRupiah(plus.feeWaiverLimit),
                })}
              />
              <ProgressBar value={quota.usedPct} showValue />
            </View>

            <ListGroup>
              <ListItem
                title="Centang abu-abu"
                subtitle="Lencana verifikasi penuh di profil"
                trailing={<GreyCheckBadge />}
                divider={false}
              />
            </ListGroup>

            <Button
              fullWidth
              variant="secondary"
              leftIcon={Palette}
              onPress={() => router.push(ROUTES.kahadePlusTheme)}
            >
              Tema eksklusif
            </Button>

            {plus.cancelAtPeriodEnd ? (
              <>
                <Button
                  fullWidth
                  onPress={() => void handleReactivate()}
                  loading={reactivating}
                  disabled={reactivating}
                >
                  Lanjutkan langganan
                </Button>
                <Text variant="caption" tone="tertiary">
                  Langganan Anda dijadwalkan berakhir pada akhir periode. Lanjutkan sebelum periode berakhir agar tidak terputus.
                </Text>
              </>
            ) : (
              <>
                <Button
                  fullWidth
                  variant="ghost"
                  onPress={() => setCancelOpen(true)}
                >
                  Batalkan langganan
                </Button>
                <Text variant="caption" tone="tertiary">
                  Akses premium tetap berlaku sampai periode berjalan berakhir.
                </Text>
              </>
            )}
          </View>
        )}
      </DataScreen>

      <Dialog
        title="Batalkan langganan?"
        description="Anda tetap dapat mengakses semua fitur premium sampai periode berakhir. Langganan tidak akan diperpanjang otomatis."
        visible={cancelOpen}
        destructive
        loading={cancelling}
        confirmLabel="Batalkan"
        cancelLabel="Tutup"
        onConfirm={() => void handleCancel()}
        onCancel={() => setCancelOpen(false)}
        onRequestClose={() => setCancelOpen(false)}
      />
    </>
  )
}
