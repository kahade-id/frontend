/**
 * Admin — Subscription: daftar subscription + pembatalan paksa.
 *
 * - Filter status & plan (chip).
 * - Tap baris → BottomSheet detail: pengguna, periode, harga, pembayaran.
 * - Tombol "Batalkan paksa": konfirmasi GANDA — BottomSheet wajib isi
 *   alasan (min 10 karakter) lalu dialog Alert. Backend hanya mengizinkan
 *   status ACTIVE/PENDING; alasan saat ini dicatat backend sebagai
 *   "Force cancelled by admin".
 */
import { useCallback, useEffect, useState } from "react"
import { Alert, View } from "react-native"
import { useIsFocused } from "@react-navigation/native"
import { Crown } from "phosphor-react-native"

import { translate } from "@/lib/i18n/translate"
import { formatDateTimeWIB, formatRupiah } from "@/lib/format"
import { userMessage } from "@/lib/api/errors"
import { handleAdminApiError } from "@/lib/admin-session"
import {
  cancelSubscription,
  getSubscriptionDetail,
  listSubscriptions,
  type SubscriptionDetail,
  type SubscriptionItem,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "@/lib/api/admin/subscriptions"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DataScreen } from "@/components/ui/data-screen"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const PAGE_SIZE = 20

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktif",
  CANCELLED: "Dibatalkan",
  EXPIRED: "Kedaluwarsa",
  PENDING: "Menunggu",
  SUSPENDED: "Ditangguhkan",
}

const STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: "success",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
  PENDING: "warning",
  SUSPENDED: "danger",
}

const PLAN_LABEL: Record<string, string> = {
  MONTHLY: "Bulanan",
  ANNUAL: "Tahunan",
}

const STATUS_FILTERS: Array<{ value?: SubscriptionStatus; label: string }> = [
  { label: "Semua" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PENDING", label: "Menunggu" },
  { value: "EXPIRED", label: "Kedaluwarsa" },
  { value: "CANCELLED", label: "Dibatalkan" },
]

const PLAN_FILTERS: Array<{ value?: SubscriptionPlan; label: string }> = [
  { label: "Semua plan" },
  { value: "MONTHLY", label: "Bulanan" },
  { value: "ANNUAL", label: "Tahunan" },
]

const CANCELLABLE: string[] = ["ACTIVE", "PENDING"]

export default function AdminSubscriptionsScreen() {
  const toast = useToast()
  const isFocused = useIsFocused()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subs, setSubs] = useState<SubscriptionItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | undefined>(
    undefined,
  )
  const [planFilter, setPlanFilter] = useState<SubscriptionPlan | undefined>(
    undefined,
  )

  const [detail, setDetail] = useState<SubscriptionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const res = await listSubscriptions({
          page: 1,
          limit: PAGE_SIZE,
          status: statusFilter,
          plan: planFilter,
        })
        setSubs(res.data)
        setTotal(res.total ?? res.meta?.total ?? res.data.length)
        setPage(1)
      } catch (err) {
        if (!handleAdminApiError(err)) setError(userMessage(err))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [statusFilter, planFilter],
  )

  useEffect(() => {
    if (isFocused) void load("initial")
  }, [isFocused, load])

  const openDetail = useCallback(async (sub: SubscriptionItem) => {
    setSheetOpen(true)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    setCancelling(false)
    setReason("")
    setReasonError(null)
    try {
      const d = await getSubscriptionDetail(sub.id)
      setDetail(d)
    } catch (err) {
      if (!handleAdminApiError(err)) setDetailError(userMessage(err))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const closeDetail = useCallback(() => {
    if (submitting) return
    setSheetOpen(false)
    setDetail(null)
    setCancelling(false)
    setReason("")
    setReasonError(null)
  }, [submitting])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || subs.length >= total) return
    setLoadingMore(true)
    try {
      const res = await listSubscriptions({
        page: page + 1,
        limit: PAGE_SIZE,
        status: statusFilter,
        plan: planFilter,
      })
      setSubs((prev) => [...prev, ...res.data])
      setTotal(res.total ?? res.meta?.total ?? total)
      setPage((p) => p + 1)
    } catch (err) {
      toast.show({
        title: translate("Gagal memuat subscription"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, subs.length, total, page, statusFilter, planFilter, toast])

  /** Konfirmasi ganda: BottomSheet (alasan) → Alert native. */
  const confirmCancel = useCallback(() => {
    if (!detail || submitting) return
    const trimmed = reason.trim()
    if (trimmed.length < 10) {
      setReasonError(translate("Alasan minimal 10 karakter."))
      return
    }
    Alert.alert(
      translate("Batalkan subscription?"),
      translate(
        "Subscription akan dibatalkan segera oleh admin. Tindakan ini tidak bisa dibatalkan.",
      ),
      [
        { text: translate("Batal"), style: "cancel" },
        {
          text: translate("Ya, batalkan"),
          style: "destructive",
          onPress: () =>
            void (async () => {
              setSubmitting(true)
              try {
                await cancelSubscription(detail.id, trimmed)
                toast.show({
                  title: translate("Subscription dibatalkan"),
                  description:
                    detail.user?.fullName ?? detail.user?.username ?? detail.id,
                  tone: "success",
                })
                closeDetail()
                await load("refresh")
              } catch (err) {
                if (!handleAdminApiError(err))
                  toast.show({
                    title: translate("Gagal membatalkan subscription"),
                    description: userMessage(err),
                    tone: "danger",
                  })
              } finally {
                setSubmitting(false)
              }
            })(),
        },
      ],
    )
  }, [detail, submitting, reason, toast, load, closeDetail])

  const canCancel =
    detail != null && CANCELLABLE.includes(String(detail.status))
  const statusKey = detail ? String(detail.status) : ""

  return (
    <>
      <DataScreen
        title={translate("Subscription")}
        state={{
          loading,
          refreshing,
          error,
          refresh: () => load("refresh"),
          reload: () => load("initial"),
        }}
        loadingMessage={translate("Memuat subscription…")}
        errorTitle={translate("Gagal memuat subscription")}
        empty={
          subs.length === 0
            ? {
                icon: Crown,
                title: translate("Belum ada subscription"),
                description: translate(
                  "Tidak ada subscription pada filter ini.",
                ),
                compact: true,
              }
            : undefined
        }
      >
        <View className="gap-4">
          <View className="gap-2">
            <View className="flex-row flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <Chip
                  key={f.label}
                  selected={statusFilter === f.value}
                  onPress={() => setStatusFilter(f.value)}
                  accessibilityLabel={translate("Filter status {x}", {
                    x: f.label,
                  })}
                >
                  {translate(f.label)}
                </Chip>
              ))}
            </View>
            <View className="flex-row flex-wrap gap-2">
              {PLAN_FILTERS.map((f) => (
                <Chip
                  key={f.label}
                  selected={planFilter === f.value}
                  onPress={() => setPlanFilter(f.value)}
                  accessibilityLabel={translate("Filter plan {x}", {
                    x: f.label,
                  })}
                >
                  {translate(f.label)}
                </Chip>
              ))}
            </View>
          </View>
          {subs.length > 0 ? (
            <View className="gap-2">
              {subs.map((s) => (
                <Card
                  key={s.id}
                  padded={false}
                  className="px-4 py-3"
                  onPress={() => void openDetail(s)}
                  accessibilityLabel={translate("Lihat detail subscription")}
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <View className="flex-1">
                      <Text variant="body" weight={600} numberOfLines={1}>
                        {s.user?.fullName ?? s.user?.username ?? "—"}
                      </Text>
                      <Text variant="caption" tone="secondary" className="mt-0.5">
                        {translate(PLAN_LABEL[String(s.plan)] ?? String(s.plan ?? "—"))}
                        {" • "}
                        {formatDateTimeWIB(s.createdAt ?? "")}
                      </Text>
                    </View>
                    <View className="items-end gap-1">
                      <Text variant="body" weight={700}>
                        {formatRupiah(typeof s.price === "number" ? s.price : 0)}
                      </Text>
                      <Badge tone={STATUS_TONE[String(s.status)] ?? "neutral"}>
                        {translate(STATUS_LABEL[String(s.status)] ?? String(s.status))}
                      </Badge>
                    </View>
                  </View>
                </Card>
              ))}
              {subs.length < total ? (
                <Button
                  variant="secondary"
                  loading={loadingMore}
                  onPress={() => void handleLoadMore()}
                >
                  {translate("Muat lebih banyak")}
                </Button>
              ) : null}
            </View>
          ) : null}
        </View>
      </DataScreen>

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={closeDetail}
        title={translate("Detail subscription")}
        description={detail?.user?.fullName ?? detail?.user?.username ?? undefined}
        footer={
          detail && !detailLoading && !detailError && cancelling ? (
            <View className="flex-row gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={submitting}
                onPress={() => {
                  setCancelling(false)
                  setReason("")
                  setReasonError(null)
                }}
              >
                {translate("Batal")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                loading={submitting}
                onPress={confirmCancel}
              >
                {translate("Lanjut")}
              </Button>
            </View>
          ) : undefined
        }
      >
        {detailLoading ? (
          <LoadingScreen message={translate("Memuat detail subscription…")} />
        ) : detailError ? (
          <ErrorState
            title={translate("Gagal memuat detail")}
            description={detailError}
            compact
          />
        ) : detail ? (
          <View className="gap-4">
            <View className="flex-row flex-wrap gap-2">
              <Badge tone={STATUS_TONE[statusKey] ?? "neutral"}>
                {translate(STATUS_LABEL[statusKey] ?? statusKey)}
              </Badge>
              <Badge tone="info">
                {translate(PLAN_LABEL[String(detail.plan)] ?? String(detail.plan ?? "—"))}
              </Badge>
            </View>

            <View className="gap-1">
              <Text variant="h3">
                {formatRupiah(typeof detail.price === "number" ? detail.price : 0)}
              </Text>
              {detail.currentPeriodEnd ? (
                <Text variant="caption" tone="secondary">
                  {translate("Periode berakhir")}:{" "}
                  {formatDateTimeWIB(detail.currentPeriodEnd)}
                </Text>
              ) : null}
            </View>

            <View className="gap-2">
              <InfoRow
                label={translate("Pengguna")}
                value={detail.user?.fullName ?? detail.user?.username ?? "—"}
              />
              <InfoRow label={translate("Email")} value={detail.user?.email ?? "—"} />
              <InfoRow
                label={translate("Dibuat")}
                value={detail.createdAt ? formatDateTimeWIB(detail.createdAt) : "—"}
              />
              {detail.cancelledAt ? (
                <InfoRow
                  label={translate("Dibatalkan")}
                  value={formatDateTimeWIB(detail.cancelledAt)}
                />
              ) : null}
              {detail.paymentTx ? (
                <InfoRow
                  label={translate("Pembayaran")}
                  value={[
                    detail.paymentTx.txId ?? "",
                    detail.paymentTx.status ?? "",
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                />
              ) : null}
            </View>

            {!cancelling ? (
              <View className="gap-2 mt-1">
                <Text variant="label" tone="danger">
                  {translate("INTERVENSI DARURAT").toUpperCase()}
                </Text>
                <Text variant="caption" tone="secondary">
                  {translate(
                    "Hanya untuk status Aktif/Menunggu. Tercatat di audit log.",
                  )}
                </Text>
                <Button
                  variant="secondary"
                  disabled={!canCancel}
                  onPress={() => setCancelling(true)}
                  accessibilityLabel={translate("Batalkan paksa subscription")}
                >
                  {translate("Batalkan paksa")}
                </Button>
                {!canCancel ? (
                  <Text variant="caption" tone="secondary">
                    {translate(
                      "Subscription pada status ini tidak bisa dibatalkan paksa.",
                    )}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View className="gap-2 mt-1">
                <Text variant="body" weight={600} tone="danger">
                  {translate("Batalkan paksa — tulis alasan")}
                </Text>
                <Input
                  label={translate("Alasan pembatalan")}
                  required
                  multiline
                  numberOfLines={3}
                  value={reason}
                  onChangeText={(v) => {
                    setReason(v)
                    if (reasonError) setReasonError(null)
                  }}
                  errorText={reasonError ?? undefined}
                  placeholder={translate(
                    "Minimal 10 karakter, contoh: penipuan terkonfirmasi tim…",
                  )}
                  accessibilityLabel={translate("Alasan pembatalan subscription")}
                />
                <Text variant="caption" tone="secondary">
                  {translate("Setelah lanjut, akan ada dialog konfirmasi kedua.")}
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </BottomSheet>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="body" weight={500} className="text-right flex-1" numberOfLines={1}>
        {value || "—"}
      </Text>
    </View>
  )
}
