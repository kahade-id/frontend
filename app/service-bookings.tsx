/**
 * Screen — Booking jasa saya (batch 43, item 12 — sisi buyer).
 *
 * Melengkapi alur booking jasa via kalender: buyer melihat daftar booking
 * aktifnya (GET /v1/commerce/service-slots/bookings/mine) dan dapat
 * membatalkan (POST /v1/commerce/service-slots/bookings/:id/cancel).
 * Booking dibuat dari kalender slot di detail produk jasa.
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { CalendarBlank, CalendarX } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import type { SlotBooking } from "@/lib/api/commerce"
import { useHasSession } from "@/lib/guest-gate"
import { translate } from "@/lib/i18n/translate"
import { formatDateLong } from "@/lib/format"
import { useApiQuery } from "@/lib/use-api-query"
import { useToast } from "@/components/ui/toast"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataScreen } from "@/components/ui/data-screen"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { Icon } from "@/components/ui/icon"
import { OrderHelpActions } from "@/components/order-help-actions"
import { Text } from "@/components/ui/text"

function BookingCard({ booking, onCancelled }: { booking: SlotBooking; onCancelled: () => void }) {
  const toast = useToast()
  const slot = booking.slot
  const active = (booking.status ?? "").toUpperCase() !== "CANCELLED"
  // FE-053: kunci double-tap — ketuk ganda tidak mengirim 2 request cancel.
  const [cancelling, setCancelling] = useState(false)

  const handleCancel = useCallback(async () => {
    if (cancelling) return
    setCancelling(true)
    try {
      await api.commerce.cancelSlotBooking(booking.id)
      toast.show({ title: translate("Booking dibatalkan"), tone: "success" })
      onCancelled()
    } catch (err) {
      toast.show({ title: translate("Gagal membatalkan"), description: userMessage(err), tone: "danger" })
    } finally {
      setCancelling(false)
    }
  }, [booking.id, toast, onCancelled, cancelling])

  return (
    <Card variant="outline" className="gap-2 p-4">
      <View className="flex-row items-center gap-2">
        <Icon icon={CalendarBlank} size="sm" tone="default" />
        <Text variant="body" weight={600} className="flex-1">
          {slot ? `${formatDateLong(slot.slotDate)} • ${slot.startTime}–${slot.endTime}` : translate("Jadwal jasa")}
        </Text>
        <Badge tone={active ? "success" : "neutral"}>
          {active ? translate("Aktif") : translate("Batal")}
        </Badge>
      </View>
      {slot?.note ? (
        <Text variant="caption" tone="secondary">
          {slot.note}
        </Text>
      ) : null}
      {active ? (
        <Button variant="secondary" fullWidth={false} loading={cancelling} disabled={cancelling} onPress={() => void handleCancel()}>
          {translate("Batalkan booking")}
        </Button>
      ) : null}
      {/* Poin 2: pintu masuk sengketa/retur — hanya bila order terkait ada. */}
      {booking.orderId ? <OrderHelpActions orderId={booking.orderId} /> : null}
    </Card>
  )
}

export default function ServiceBookingsScreen() {
  const hasSession = useHasSession()
  const query = useApiQuery<SlotBooking[]>(
    "service-bookings-mine",
    useCallback((signal: AbortSignal) => api.commerce.listMySlotBookings(1, 50, signal), []),
  )
  const bookings = query.data ?? []

  if (!hasSession) {
    return <GuestLoginPrompt next="/service-bookings" />
  }

  return (
    <DataScreen
      title={translate("Pesanan jasa saya")}
      state={query}
      loadingMessage={translate("Memuat booking")}
      errorTitle={translate("Gagal memuat booking")}
      empty={
        bookings.length === 0
          ? {
              icon: CalendarX,
              title: translate("Belum ada pesanan jasa"),
              description: translate("Booking slot jasa dari kalender ketersediaan di halaman produk jasa."),
            }
          : undefined
      }
    >
      <View className="gap-3">
        {bookings.map((b) => (
          <BookingCard key={b.id} booking={b} onCancelled={() => void query.refresh()} />
        ))}
      </View>
    </DataScreen>
  )
}
