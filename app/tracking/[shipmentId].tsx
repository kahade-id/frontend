/**
 * Screen — Lacak Pengiriman (GAP-D G236–G240, G246).
 * GET /v1/courier/shipments/[id] + /tracking · refresh manual (G239).
 * Lokasi termasking, tanpa alamat lengkap (G238).
 *
 * Audit alamat & kurir (2026-10-10):
 *   - E01: ongkir dalam RUPIAH — tidak lagi dibagi 100.
 *   - E02: hasil refresh (`timeout`, jumlah event baru) disampaikan ke user.
 *   - E03: tombol muat ulang disembunyikan untuk resi manual (selalu 400).
 *   - E04: timeline terbaru di atas, urut `occurredAt`.
 *   - E05/E06/E07: nama layanan, ETA, keterlambatan SLA, salin resi, tone badge.
 */
import { useMemo, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"

import { api } from "@/lib/api"
import { goBackOrNavigate } from "@/lib/navigation"
import type { Shipment, TrackingEvent } from "@/lib/api/courier"
import {
  courierCostToNumber,
  formatEtaDays,
  shipmentStatusText,
  shipmentStatusTone,
  sortTrackingEventsLatestFirst,
} from "@/lib/api/courier"
import { useCopy } from "@/lib/clipboard"
import { formatDateTime } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { shortId } from "@/lib/short-id"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { showMutationError } from "@/lib/mutation-toast"
import { useTheme } from "@/components/theme-provider"
import { useToast } from "@/components/ui/toast"

import { Amount } from "@/components/ui/amount"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CopyableField } from "@/components/ui/copyable-field"
import { DataScreen } from "@/components/ui/data-screen"
import { OrderStatusBadge } from "@/components/ui/order-status-badge"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"

export default function TrackingScreen() {
  const { shipmentId } = useLocalSearchParams<{ shipmentId: string }>()
  const { mode } = useTheme()
  const toast = useToast()
  const { copied, copy } = useCopy()
  const c = tokens.colors[mode]
  const [refreshing, setRefreshing] = useState(false)
  const shipmentQuery = useApiQuery<Shipment>(
    `shipment:${String(shipmentId)}`,
    (signal) => api.courier.getShipment(String(shipmentId), signal),
    !!shipmentId,
    // NC-003 (audit performa ronde-3): skip refetch fokus bila data <30 dtk.
    { refreshOnFocus: true, refreshOnFocusStaleMs: 30_000 },
  )
  const timelineQuery = useApiQuery<TrackingEvent[]>(
    `shipment-timeline:${String(shipmentId)}`,
    (signal) => api.courier.getTrackingTimeline(String(shipmentId), signal),
    !!shipmentId,
    // NC-003 (audit performa ronde-3): skip refetch fokus bila data <30 dtk.
    { refreshOnFocus: true, refreshOnFocusStaleMs: 30_000 },
  )
  const shipment = shipmentQuery.data
  // E04: terbaru di atas, berdasar waktu kejadian provider.
  const events = useMemo(() => sortTrackingEventsLatestFirst(timelineQuery.data ?? []), [timelineQuery.data])
  /**
   * D17 (batch 139): status ORDER selalu terlihat — query independen dari
   * query tracking. Kegagalan timeline tracking TIDAK PERNAH menutupi
   * status order: kartu order di bawah dirender dari query-nya sendiri dan
   * punya retry sendiri. (A05: `shipment.orderId` kini orderId publik.)
   */
  const orderQuery = useApiQuery(
    `tracking-order:${shipment?.orderId ?? "none"}`,
    (signal) => api.orders.getOrder(String(shipment?.orderId), signal),
    !!shipment?.orderId,
    // NC-003 (audit performa ronde-3): skip refetch fokus bila data <30 dtk.
    { refreshOnFocus: true, refreshOnFocusStaleMs: 30_000 },
  )
  const trackedOrder = orderQuery.data

  const trackingNumber = shipment?.trackingNumber ?? shipment?.manualTrackingNumber ?? null
  // E03: refresh hanya bermakna untuk resi provider (bukan manual).
  const canRefresh = !!shipment && !shipment.isManual && !!shipment.trackingNumber
  const estimatedCost = courierCostToNumber(shipment?.estimatedCost)
  const actualCost = courierCostToNumber(shipment?.actualCost)
  const eta = formatEtaDays(shipment?.etaMinDays, shipment?.etaMaxDays)
  const isTerminal = shipment?.status === "DELIVERED" || shipment?.status === "RETURNED"

  async function refresh() {
    if (!shipmentId || refreshing) return
    setRefreshing(true)
    try {
      const result = await api.courier.refreshTracking(String(shipmentId))
      await Promise.all([shipmentQuery.reload(), timelineQuery.reload()])
      // E02: jujur soal hasil — timeout provider bukan "berhasil".
      if (result.timeout) {
        toast.show({
          title: translate("Kurir tidak merespons"),
          description: translate("Status belum bisa diperbarui. Coba lagi beberapa saat."),
          tone: "warning",
        })
      } else if (result.events === 0) {
        toast.show({ title: translate("Belum ada update baru dari kurir"), tone: "info" })
      } else {
        toast.show({ title: translate("Tracking diperbarui"), tone: "success" })
      }
    } catch (e) {
      if (
        showMutationError(toast.show, {
          failTitle: translate("Gagal memuat ulang tracking"),
          uncertainHint: translate("Refresh mungkin sudah diproses — memuat ulang…"),
          err: e,
          scope: "tracking:refresh",
        })
      ) {
        await Promise.all([shipmentQuery.reload(), timelineQuery.reload()])
      }
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <DataScreen title={translate("Lacak Pengiriman")} state={shipmentQuery} loadingMessage={translate("Memuat pengiriman…")}>
      {shipment ? (
        <View style={{ paddingVertical: tokens.space[4], gap: tokens.space[4] }}>
          {/*
           * D17 (batch 139): kartu status order — SELALU terlihat selama
           * query order-nya sukses, apa pun yang terjadi pada tracking.
           * Retry khusus order; tombol kembali ke detail order.
           */}
          {trackedOrder ? (
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyLarge" weight={700} numberOfLines={2}>
                    {trackedOrder.title}
                  </Text>
                  <Text variant="body" tone="secondary" style={{ marginTop: tokens.space[1] }}>
                    Order #<Text variant="monoBody" tone="secondary">{shortId(trackedOrder.id)}</Text>
                  </Text>
                </View>
                <OrderStatusBadge status={trackedOrder.status} size="sm" />
              </View>
              <View style={{ marginTop: tokens.space[3] }}>
                <Button
                  variant="secondary"
                  // P2-T7: pakai back (bukan push) agar tidak menumpuk
                  // order → tracking → order.
                  onPress={() => goBackOrNavigate(ROUTES.orderDetail(trackedOrder.id))}
                >
                  {translate("Lihat detail order")}
                </Button>
              </View>
            </Card>
          ) : orderQuery.error ? (
            <Card>
              <Text tone="secondary">
                {translate("Status order tidak dapat dimuat: {x}", { x: orderQuery.error })}
              </Text>
              <View style={{ marginTop: tokens.space[2] }}>
                <Button variant="secondary" onPress={() => void orderQuery.reload()}>
                  {translate("Muat ulang status order")}
                </Button>
              </View>
            </Card>
          ) : null}
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: tokens.space[2] }}>
              <Text variant="body" weight={600} style={{ flex: 1 }} numberOfLines={1}>
                {/* E15: resi manual → nama kurir dari penjual, bukan "MANUAL · JNE". */}
                {shipment.isManual
                  ? shipment.manualCourierName ?? translate("Resi manual")
                  : shipment.serviceName ?? shipment.providerCode.toUpperCase()}
              </Text>
              {/* UI-T009 + E07: status asing tetap tampil; tone semantik. */}
              <Badge tone={shipmentStatusTone(shipment.status)}>{shipmentStatusText(shipment.status)}</Badge>
            </View>
            {/* E06: resi bisa disalin — pembeli melacak di aplikasi kurir. */}
            {trackingNumber ? (
              <View style={{ marginTop: tokens.space[3] }}>
                <CopyableField
                  label={shipment.isManual ? translate("Nomor resi (manual)") : translate("Nomor resi")}
                  value={trackingNumber}
                  mono
                  onCopy={(v) => void copy(v)}
                  copied={copied}
                />
              </View>
            ) : (
              <Text variant="body" tone="secondary" style={{ marginTop: tokens.space[1] }}>
                {translate("Nomor resi belum tersedia.")}
              </Text>
            )}
            {shipment.status === "UNKNOWN" ? (
              <Text tone="warning" style={{ marginTop: tokens.space[2] }}>
                {translate("Status belum diketahui — provider tidak merespons atau timeout. Bukan berarti gagal.")}
              </Text>
            ) : null}
            {/* E05: keterlambatan dari hitungan server; jangan hitung ulang di klien. */}
            {shipment.slaBreached && !isTerminal ? (
              <Text tone="danger" style={{ marginTop: tokens.space[2] }}>
                {translate("Melewati estimasi tiba. Hubungi kurir atau penjual bila paket belum sampai.")}
              </Text>
            ) : null}
            {eta && !isTerminal ? (
              <Text variant="caption" tone="secondary" style={{ marginTop: tokens.space[2] }}>
                {translate("Estimasi tiba: {x}", { x: eta })}
              </Text>
            ) : null}
            {estimatedCost != null || actualCost != null ? (
              <View style={{ flexDirection: "row", gap: tokens.space[4], marginTop: tokens.space[3] }}>
                <View>
                  <Text variant="caption" tone="secondary">{translate("Estimasi ongkir")}</Text>
                  {/* E01: nilai sudah RUPIAH — jangan dibagi 100. */}
                  {estimatedCost == null ? <Text variant="monoBody">—</Text> : <Amount value={estimatedCost} size="body" />}
                </View>
                <View>
                  <Text variant="caption" tone="secondary">{translate("Ongkir aktual")}</Text>
                  {actualCost == null ? <Text variant="monoBody">—</Text> : <Amount value={actualCost} size="body" />}
                </View>
              </View>
            ) : null}
            {canRefresh ? (
              <View style={{ marginTop: tokens.space[3] }}>
                {/* UI-T012 (audit UI/UX 2026-09-27): gunakan prop loading Button
                    (spinner + anti double-tap), bukan ganti label teks. */}
                <Button variant="secondary" loading={refreshing} onPress={refresh}>
                  {translate("Muat Ulang Tracking")}
                </Button>
              </View>
            ) : shipment.isManual ? (
              <Text variant="caption" tone="secondary" style={{ marginTop: tokens.space[3] }}>
                {translate("Resi manual dari penjual — lacak di situs atau aplikasi kurir.")}
              </Text>
            ) : null}
          </Card>

          <Card>
            <SectionHeader title={translate("Perjalanan paket")} />
            {timelineQuery.loading && events.length === 0 ? (
              <Text tone="secondary">{translate("Memuat perjalanan paket…")}</Text>
            ) : timelineQuery.error ? (
              <View style={{ gap: tokens.space[2] }}>
                <Text tone="secondary">{timelineQuery.error}</Text>
                <Button variant="secondary" onPress={() => void timelineQuery.reload()}>
                  {translate("Coba lagi")}
                </Button>
              </View>
            ) : events.length === 0 ? (
              <Text tone="secondary">{translate("Belum ada event tracking.")}</Text>
            ) : (
              <View style={{ gap: tokens.space[3] }}>
                {events.map((ev, index) => (
                  <View key={ev.id} style={{ flexDirection: "row", gap: tokens.space[2] }}>
                    <View
                      className="mt-1.5 h-2 w-2 rounded-full"
                      style={{ backgroundColor: index === 0 ? c.primary : c.borderDefault }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight={index === 0 ? 700 : 600}>{shipmentStatusText(ev.status)}</Text>
                      {ev.locationMasked ? <Text tone="secondary">{ev.locationMasked}</Text> : null}
                      {ev.description ? <Text variant="body">{ev.description}</Text> : null}
                      <Text variant="caption" tone="secondary">
                        {formatDateTime(ev.occurredAt ?? ev.createdAt)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>
      ) : null}
    </DataScreen>
  )
}
