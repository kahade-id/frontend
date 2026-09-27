/**
 * Screen — Lacak Pengiriman (GAP-D G236–G240, G246).
 * GET /v1/courier/shipments/[id] + /tracking · refresh manual (G239).
 * Lokasi termasking, tanpa alamat lengkap (G238).
 */
import { useState } from "react"
import { Text, View } from "react-native"
import { useLocalSearchParams } from "expo-router"

import { api } from "@/lib/api"
import type { Shipment, TrackingEvent } from "@/lib/api/courier"
import { SHIPMENT_STATUS_LABEL, formatIdrSen } from "@/lib/api/courier"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { showMutationError } from "@/lib/mutation-toast"
import { useTheme } from "@/components/theme-provider"
import { useToast } from "@/components/ui/toast"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataScreen } from "@/components/ui/data-screen"
import { SectionHeader } from "@/components/ui/section"

export default function TrackingScreen() {
  const { shipmentId } = useLocalSearchParams<{ shipmentId: string }>()
  const { mode } = useTheme()
  const toast = useToast()
  const c = tokens.colors[mode]
  const warningText = tokens.colors.semantic.warning[mode].text
  const [refreshing, setRefreshing] = useState(false)
  const shipmentQuery = useApiQuery<Shipment>(
    `shipment:${String(shipmentId)}`,
    (signal) => api.courier.getShipment(String(shipmentId), signal),
    !!shipmentId,
    { refreshOnFocus: true },
  )
  const timelineQuery = useApiQuery<TrackingEvent[]>(
    `shipment-timeline:${String(shipmentId)}`,
    (signal) => api.courier.getTrackingTimeline(String(shipmentId), signal),
    !!shipmentId,
    { refreshOnFocus: true },
  )
  const shipment = shipmentQuery.data
  const events = timelineQuery.data ?? []

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
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "800", fontSize: 16 }}>
                {shipment.trackingNumber ?? shipment.manualTrackingNumber ?? "—"}
              </Text>
              <Badge>{SHIPMENT_STATUS_LABEL[shipment.status]}</Badge>
            </View>
            <Text style={{ color: c.textTertiary, marginTop: tokens.space[1] }}>
              {shipment.providerCode.toUpperCase()}
              {shipment.serviceCode ? ` · ${shipment.serviceCode}` : ""}
              {shipment.isManual ? " · Resi manual" : ""}
            </Text>
            {shipment.status === "UNKNOWN" ? (
              <Text style={{ color: warningText, marginTop: tokens.space[1] }}>
                Status belum diketahui — provider tidak merespons atau timeout. Bukan berarti gagal.
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: tokens.space[4], marginTop: tokens.space[2] }}>
              <View>
                <Text style={{ fontSize: 12, color: c.textTertiary }}>Estimasi ongkir</Text>
                <Text style={{ fontWeight: "700" }}>{formatIdrSen(shipment.estimatedCost)}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 12, color: c.textTertiary }}>Ongkir aktual</Text>
                <Text style={{ fontWeight: "700" }}>{formatIdrSen(shipment.actualCost)}</Text>
              </View>
            </View>
            <View style={{ marginTop: tokens.space[3] }}>
              <Button variant="secondary" disabled={refreshing} onPress={refresh}>
                {refreshing ? "Memuat…" : "Muat Ulang Tracking"}
              </Button>
            </View>
          </Card>

          <Card>
            <SectionHeader title="Perjalanan paket" />
            {timelineQuery.loading && events.length === 0 ? (
              <Text style={{ color: c.textTertiary }}>Memuat perjalanan paket…</Text>
            ) : timelineQuery.error ? (
              <View style={{ gap: tokens.space[2] }}>
                <Text style={{ color: c.textTertiary }}>{timelineQuery.error}</Text>
                <Button variant="secondary" onPress={() => void timelineQuery.reload()}>
                  Coba lagi
                </Button>
              </View>
            ) : events.length === 0 ? (
              <Text style={{ color: c.textTertiary }}>Belum ada event tracking.</Text>
            ) : (
              <View style={{ gap: tokens.space[3] }}>
                {events.map((ev) => (
                  <View key={ev.id} style={{ flexDirection: "row", gap: tokens.space[2] }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary, marginTop: 6 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "600" }}>{SHIPMENT_STATUS_LABEL[ev.status]}</Text>
                      {ev.locationMasked ? <Text style={{ color: c.textTertiary }}>{ev.locationMasked}</Text> : null}
                      {ev.description ? <Text style={{ fontSize: 13 }}>{ev.description}</Text> : null}
                      <Text style={{ color: c.textTertiary, fontSize: 12 }}>
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
