/**
 * Screen — Lacak Pengiriman (GAP-D G236–G240, G246).
 * GET /v1/courier/shipments/[id] + /tracking · refresh manual (G239).
 * Lokasi termasking, tanpa alamat lengkap (G238).
 */
import { useState } from "react"
import { View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"

import { api } from "@/lib/api"
import type { Shipment, TrackingEvent } from "@/lib/api/courier"
import { SHIPMENT_STATUS_LABEL, formatIdrSen } from "@/lib/api/courier"
import { formatDateTime } from "@/lib/format"
import { shortId } from "@/lib/short-id"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { showMutationError } from "@/lib/mutation-toast"
import { useTheme } from "@/components/theme-provider"
import { useToast } from "@/components/ui/toast"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataScreen } from "@/components/ui/data-screen"
import { OrderStatusBadge } from "@/components/ui/order-status-badge"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"

export default function TrackingScreen() {
  const { shipmentId } = useLocalSearchParams<{ shipmentId: string }>()
  const { mode } = useTheme()
  const toast = useToast()
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
  const events = timelineQuery.data ?? []
  /**
   * D17 (batch 139): status ORDER selalu terlihat — query independen dari
   * query tracking. Kegagalan timeline tracking TIDAK PERNAH menutupi
   * status order: kartu order di bawah dirender dari query-nya sendiri dan
   * punya retry sendiri.
   */
  const orderQuery = useApiQuery(
    `tracking-order:${shipment?.orderId ?? "none"}`,
    (signal) => api.orders.getOrder(String(shipment?.orderId), signal),
    !!shipment?.orderId,
    // NC-003 (audit performa ronde-3): skip refetch fokus bila data <30 dtk.
    { refreshOnFocus: true, refreshOnFocusStaleMs: 30_000 },
  )
  const trackedOrder = orderQuery.data

  async function refresh() {
    if (!shipmentId || refreshing) return
    setRefreshing(true)
    try {
      await api.courier.refreshTracking(String(shipmentId))
      await Promise.all([shipmentQuery.reload(), timelineQuery.reload()])
    } catch (e) {
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal memuat ulang tracking",
          uncertainHint: "Refresh mungkin sudah diproses — memuat ulang…",
          err: e,
        })
      ) {
        await Promise.all([shipmentQuery.reload(), timelineQuery.reload()])
      }
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <DataScreen title="Lacak Pengiriman" state={shipmentQuery} loadingMessage="Memuat pengiriman…">
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
                    Order #{shortId(trackedOrder.id)}
                  </Text>
                </View>
                <OrderStatusBadge status={trackedOrder.status} size="sm" />
              </View>
              <View style={{ marginTop: tokens.space[3] }}>
                <Button
                  variant="secondary"
                  onPress={() => router.push(ROUTES.orderDetail(trackedOrder.id))}
                >
                  Lihat detail order
                </Button>
              </View>
            </Card>
          ) : orderQuery.error ? (
            <Card>
              <Text tone="secondary">
                Status order tidak dapat dimuat: {orderQuery.error}
              </Text>
              <View style={{ marginTop: tokens.space[2] }}>
                <Button variant="secondary" onPress={() => void orderQuery.reload()}>
                  Muat ulang status order
                </Button>
              </View>
            </Card>
          ) : null}
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text variant="monoBody">
                {shipment.trackingNumber ?? shipment.manualTrackingNumber ?? "—"}
              </Text>
              {/* UI-T009 (audit UI/UX 2026-09-27): fallback nilai mentah bila
                  backend mengirim status asing — sebelumnya Badge kosong. */}
              <Badge>{SHIPMENT_STATUS_LABEL[shipment.status] ?? shipment.status}</Badge>
            </View>
            <Text variant="body" tone="secondary" style={{ marginTop: tokens.space[1] }}>
              {shipment.providerCode.toUpperCase()}
              {shipment.serviceCode ? ` · ${shipment.serviceCode}` : ""}
              {shipment.isManual ? " · Resi manual" : ""}
            </Text>
            {shipment.status === "UNKNOWN" ? (
              <Text tone="warning" style={{ marginTop: tokens.space[1] }}>
                Status belum diketahui — provider tidak merespons atau timeout. Bukan berarti gagal.
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: tokens.space[4], marginTop: tokens.space[2] }}>
              <View>
                <Text variant="caption" tone="secondary">Estimasi ongkir</Text>
                <Text variant="monoBody">{formatIdrSen(shipment.estimatedCost)}</Text>
              </View>
              <View>
                <Text variant="caption" tone="secondary">Ongkir aktual</Text>
                <Text variant="monoBody">{formatIdrSen(shipment.actualCost)}</Text>
              </View>
            </View>
            <View style={{ marginTop: tokens.space[3] }}>
              {/* UI-T012 (audit UI/UX 2026-09-27): gunakan prop loading Button
                  (spinner + anti double-tap), bukan ganti label teks. */}
              <Button variant="secondary" loading={refreshing} onPress={refresh}>
                Muat Ulang Tracking
              </Button>
            </View>
          </Card>

          <Card>
            <SectionHeader title="Perjalanan paket" />
            {timelineQuery.loading && events.length === 0 ? (
              <Text tone="secondary">Memuat perjalanan paket…</Text>
            ) : timelineQuery.error ? (
              <View style={{ gap: tokens.space[2] }}>
                <Text tone="secondary">{timelineQuery.error}</Text>
                <Button variant="secondary" onPress={() => void timelineQuery.reload()}>
                  Coba lagi
                </Button>
              </View>
            ) : events.length === 0 ? (
              <Text tone="secondary">Belum ada event tracking.</Text>
            ) : (
              <View style={{ gap: tokens.space[3] }}>
                {events.map((ev) => (
                  <View key={ev.id} style={{ flexDirection: "row", gap: tokens.space[2] }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary, marginTop: 6 }} />
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight={600}>{SHIPMENT_STATUS_LABEL[ev.status] ?? ev.status}</Text>
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
