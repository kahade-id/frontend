/**
 * ProductCommerceSection — badge & slot jasa di layar detail etalase (batch 43).
 *
 * - `ProductBadges`: GET /v1/commerce/products/:id/badges (publik) —
 *   chip TERLARIS / DISKON. Gagal fetch = tidak render (bukan error).
 * - `CommerceBadgesCompact`: versi ringkas untuk kartu feed — dipakai di
 *   sebelah badge kategori, HANYA untuk item dengan `orderLink` (produk
 *   commerce). Cache modul-level agar feed tidak N+1 request.
 * - `DiscountPrice`: harga coret dari cache sesi (hanya pemilik yang pernah
 *   PATCH di sesi ini — backend belum expose via serializer publik, jadi
 *   tidak ada data = tidak ditampilkan, bukan ditebak).
 * - `ServiceSlotSection`: kalender slot jasa (publik) + booking buyer.
 *   Booking adalah entitas tersendiri (backend tidak menautkannya ke order);
 *   CTA "Buat transaksi" meneruskan slotId ke create-transaction yang
 *   mem-booking slot saat transaksi dikonfirmasi.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { Clock, Flame, Tag } from "phosphor-react-native"
import { router } from "expo-router"

import { api, userMessage } from "@/lib/api"
import type { ServiceSlot, SlotBooking } from "@/lib/api/commerce"
import { getCommerceFieldsCache, discountPercentOf } from "@/lib/commerce-fields"
import { formatDateLong, formatRupiah } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { ROUTES } from "@/lib/routes"
import { useToast } from "@/components/ui/toast"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { SectionHeader } from "@/components/ui/section"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

/** Chip TERLARIS / DISKON — publik, komputasi on-read di server. */
export function ProductBadges({ showcaseId }: { showcaseId: string }) {
  const [badges, setBadges] = useState<string[] | null>(null)

  useEffect(() => {
    let alive = true
    api.commerce
      .getProductBadges(showcaseId)
      .then((b) => {
        if (alive) setBadges(b?.badges ?? [])
      })
      .catch(() => {
        if (alive) setBadges([])
      })
    return () => {
      alive = false
    }
  }, [showcaseId])

  if (!badges || badges.length === 0) return null
  return (
    <View className="flex-row flex-wrap gap-2">
      {badges.includes("TERLARIS") ? (
        <Badge tone="warning" icon={Flame}>
          {translate("Terlaris")}
        </Badge>
      ) : null}
      {badges.includes("DISKON") ? (
        <Badge tone="danger" icon={Tag}>
          {translate("Diskon")}
        </Badge>
      ) : null}
    </View>
  )
}

/**
 * Cache modul-level untuk badge kartu feed — satu produk satu request per
 * sesi, tidak N+1 setiap kartu re-render.
 */
const compactBadgeCache = new Map<string, string[]>()
const compactBadgeInflight = new Map<string, Promise<string[]>>()

/**
 * Chip TERLARIS / DISKON ringkas untuk kartu feed (batch 43, item "badge
 * commerce pada kartu/feed"). Render HANYA bila pemanggil memastikan item
 * adalah produk commerce (`orderLink` ada) — endpoint publik, gagal = diam.
 */
export function CommerceBadgesCompact({ showcaseId }: { showcaseId: string }) {
  const [badges, setBadges] = useState<string[] | null>(
    () => compactBadgeCache.get(showcaseId) ?? null,
  )

  useEffect(() => {
    if (compactBadgeCache.has(showcaseId)) return
    let alive = true
    let pending = compactBadgeInflight.get(showcaseId)
    if (!pending) {
      pending = api.commerce
        .getProductBadges(showcaseId)
        .then((b) => b?.badges ?? [])
        .catch(() => [])
      compactBadgeInflight.set(showcaseId, pending)
    }
    pending.then((list) => {
      compactBadgeCache.set(showcaseId, list)
      compactBadgeInflight.delete(showcaseId)
      if (alive) setBadges(list)
    })
    return () => {
      alive = false
    }
  }, [showcaseId])

  if (!badges || badges.length === 0) return null
  return (
    <>
      {badges.includes("TERLARIS") ? (
        <Badge tone="warning" icon={Flame}>
          {translate("Terlaris")}
        </Badge>
      ) : null}
      {badges.includes("DISKON") ? (
        <Badge tone="danger" icon={Tag}>
          {translate("Diskon")}
        </Badge>
      ) : null}
    </>
  )
}

/**
 * Harga coret + persen diskon — hanya bila data ada (cache sesi pemilik).
 * salePriceIdr = priceMin ?? priceMax dari item.
 */
export function DiscountPrice({
  showcaseId,
  salePriceIdr,
}: {
  showcaseId: string
  salePriceIdr: number | null | undefined
}) {
  const cached = getCommerceFieldsCache(showcaseId)
  const original = cached?.originalPriceIdr ?? null
  const pct = discountPercentOf(original, salePriceIdr)
  if (pct == null || original == null) return null
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <Text variant="body" tone="tertiary" className="tabular-nums line-through">
        {formatRupiah(original)}
      </Text>
      <Badge tone="danger">{`-${pct}%`}</Badge>
    </View>
  )
}

function slotDateKey(slot: ServiceSlot): string {
  return slot.slotDate
}

function slotTimeLabel(slot: ServiceSlot): string {
  return `${slot.startTime}–${slot.endTime} WIB`
}

/** Kalender slot jasa + booking buyer (item 10). */
export function ServiceSlotSection({
  showcaseId,
  sellerUsername,
  hasSession,
  isOwner,
}: {
  showcaseId: string
  sellerUsername: string
  hasSession: boolean
  isOwner: boolean
}) {
  const toast = useToast()
  const [slots, setSlots] = useState<ServiceSlot[] | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [confirmSlot, setConfirmSlot] = useState<ServiceSlot | null>(null)
  const [bookingBusy, setBookingBusy] = useState(false)
  const [myBooking, setMyBooking] = useState<SlotBooking | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)

  const load = useCallback(() => {
    setSlots(null)
    api.commerce
      .listServiceSlots(showcaseId)
      .then((list) => {
        setSlots(list)
        if (list.length > 0 && !selectedDate) setSelectedDate(slotDateKey(list[0]))
      })
      .catch(() => setSlots([]))
    if (hasSession && !isOwner) {
      api.commerce
        .listMySlotBookings()
        .then((bookings) => {
          const mine =
            bookings.find(
              (b) => (b.slot?.showcaseId ?? "") === showcaseId && b.status === "BOOKED",
            ) ?? null
          setMyBooking(mine)
        })
        .catch(() => setMyBooking(null))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showcaseId, hasSession, isOwner])

  useEffect(() => {
    load()
  }, [load])

  const dates = useMemo(() => {
    const keys: string[] = []
    for (const s of slots ?? []) {
      const k = slotDateKey(s)
      if (!keys.includes(k)) keys.push(k)
    }
    return keys
  }, [slots])

  const daySlots = useMemo(
    () => (slots ?? []).filter((s) => slotDateKey(s) === selectedDate),
    [slots, selectedDate],
  )

  const requireSession = useCallback(() => {
    if (!hasSession) {
      router.push(ROUTES.loginRequired(`/showcase/${encodeURIComponent(showcaseId)}`))
      return false
    }
    return true
  }, [hasSession, showcaseId])

  const handleBook = useCallback(async () => {
    if (!confirmSlot || bookingBusy) return
    if (!requireSession()) return
    setBookingBusy(true)
    try {
      const booking = await api.commerce.bookServiceSlot(confirmSlot.id)
      setMyBooking(booking)
      setConfirmSlot(null)
      toast.show({ title: translate("Slot berhasil dipesan"), tone: "success", duration: 3000 })
      void load()
    } catch (err) {
      toast.show({ title: translate("Gagal memesan slot"), description: userMessage(err), tone: "danger" })
    } finally {
      setBookingBusy(false)
    }
  }, [confirmSlot, bookingBusy, requireSession, toast, load])

  const handleCancelBooking = useCallback(async () => {
    if (!myBooking || cancelBusy) return
    setCancelBusy(true)
    try {
      await api.commerce.cancelSlotBooking(myBooking.id)
      setMyBooking(null)
      setCancelOpen(false)
      toast.show({ title: translate("Booking dibatalkan"), tone: "success" })
      void load()
    } catch (err) {
      toast.show({ title: translate("Gagal membatalkan"), description: userMessage(err), tone: "danger" })
    } finally {
      setCancelBusy(false)
    }
  }, [myBooking, cancelBusy, toast, load])

  if (slots == null) {
    return (
      <View className="gap-2 px-5 pt-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-full" />
      </View>
    )
  }
  // Tidak ada slot terkonfigurasi → bukan produk jasa berjadwal; sembunyikan.
  if (slots.length === 0) return null

  const goTransact = (booking: SlotBooking) => {
    const slot = booking.slot
    const target = {
      pathname: "/create-transaction",
      params: {
        counterpart: sellerUsername,
        role: "BUYER",
        orderType: "SERVICE",
        slotId: booking.slotId,
        ...(slot ? { slotDate: slot.slotDate, slotTime: `${slot.startTime}–${slot.endTime} WIB` } : {}),
        // Sudah di-booking di halaman ini — jangan booking ulang saat submit.
        slotBooked: "1",
      },
    } as unknown as Parameters<typeof router.push>[0]
    router.push(hasSession ? target : ROUTES.loginRequired(`/showcase/${encodeURIComponent(showcaseId)}`))
  }

  return (
    <View className="gap-3 px-5 pt-4">
      <SectionHeader
        title={translate("Jadwal jasa")}
        subtitle={translate("Pilih slot ketersediaan penjual")}
      />

      {myBooking ? (
        <View className="gap-2 rounded-md border border-success bg-success-soft p-3">
          <Text variant="body" weight={600} tone="success">
            {translate("Slot Anda terpesan")}
          </Text>
          <Text variant="caption" tone="secondary">
            {myBooking.slot
              ? `${formatDateLong(myBooking.slot.slotDate)} · ${myBooking.slot.startTime}–${myBooking.slot.endTime} WIB`
              : translate("Lihat detail di Booking saya.")}
          </Text>
          <View className="flex-row gap-2 pt-1">
            <Button size="sm" onPress={() => goTransact(myBooking)}>
              {translate("Buat transaksi")}
            </Button>
            <Button size="sm" variant="secondary" onPress={() => setCancelOpen(true)}>
              {translate("Batalkan")}
            </Button>
          </View>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        {dates.map((d) => {
          const active = d === selectedDate
          return (
            <PressableScale
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setSelectedDate(d)}
              className={cn(
                "rounded-full border px-3 py-1.5",
                active ? "border-primary bg-primary/10" : "border-border",
              )}
            >
              <Text variant="caption" weight={active ? 600 : 400} tone={active ? "primary" : "secondary"}>
                {formatDateLong(d)}
              </Text>
            </PressableScale>
          )
        })}
      </View>

      <View className="gap-2">
        {daySlots.map((slot) => (
          <View key={slot.id} className="flex-row items-center gap-3 rounded-md border border-border p-3">
            <Icon icon={Clock} size="sm" tone="default" />
            <View className="flex-1 gap-0.5">
              <Text variant="body" weight={500} className="tabular-nums">
                {slotTimeLabel(slot)}
              </Text>
              <Text variant="caption" tone="secondary">
                {slot.remaining != null && slot.remaining > 0
                  ? translate("Sisa {x} slot", { x: slot.remaining })
                  : translate("Penuh")}
                {slot.note ? ` · ${slot.note}` : ""}
              </Text>
            </View>
            {!isOwner && !myBooking ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={slot.remaining != null && slot.remaining <= 0}
                onPress={() => setConfirmSlot(slot)}
              >
                {translate("Pesan")}
              </Button>
            ) : null}
          </View>
        ))}
      </View>

      <Dialog
        title={translate("Pesan slot ini?")}
        description={
          confirmSlot
            ? translate("{x} · {y}", {
                x: formatDateLong(confirmSlot.slotDate),
                y: slotTimeLabel(confirmSlot),
              })
            : undefined
        }
        visible={confirmSlot != null}
        confirmLabel={translate("Pesan slot")}
        cancelLabel={translate("Batal")}
        loading={bookingBusy}
        onConfirm={() => void handleBook()}
        onCancel={() => setConfirmSlot(null)}
        onRequestClose={() => setConfirmSlot(null)}
      />
      <Dialog
        title={translate("Batalkan booking?")}
        description={translate("Slot kembali tersedia untuk pembeli lain.")}
        visible={cancelOpen}
        destructive
        confirmLabel={translate("Ya, batalkan")}
        cancelLabel={translate("Tutup")}
        loading={cancelBusy}
        onConfirm={() => void handleCancelBooking()}
        onCancel={() => setCancelOpen(false)}
        onRequestClose={() => setCancelOpen(false)}
      />
    </View>
  )
}
