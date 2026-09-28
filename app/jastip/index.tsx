/**
 * Screen — Jastip saya (batch 43, item 15, sisi host).
 *
 * Daftar trip jastip milik host (GET /v1/jastip/trips/mine) + buat trip
 * (POST /v1/jastip/trips): judul, deskripsi, deadline order, total slot.
 * Detail trip (katalog, peserta, kunci harga, gagal/refund) di /jastip/[id].
 *
 * Desain yang disetujui user: harga DIKUNCI host (barang + fee + ongkir
 * terpisah transparan) baru buyer bayar escrow; host gagal dapat barang →
 * refund otomatis; trip tertutup (tanpa discovery publik — dibuka via ID).
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { CalendarBlank, Package, Plus, Users } from "phosphor-react-native"
import { router } from "expo-router"

import { api, userMessage } from "@/lib/api"
import { JASTIP_TRIP_STATUS_LABELS, type JastipTrip } from "@/lib/api/commerce"
import { useHasSession } from "@/lib/guest-gate"
import { translate } from "@/lib/i18n/translate"
import { formatDateLong } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"
import { useToast } from "@/components/ui/toast"

import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataScreen } from "@/components/ui/data-screen"
import { DatePickerSheet } from "@/components/ui/date-picker-sheet"
import { Field } from "@/components/ui/field"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  OPEN: "success",
  CLOSED: "warning",
  FAILED: "danger",
  COMPLETED: "neutral",
}

export default function JastipScreen() {
  const toast = useToast()
  const hasSession = useHasSession()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [deadline, setDeadline] = useState<Date | null>(null)
  const [slotTotal, setSlotTotal] = useState("")
  const [dateSheetOpen, setDateSheetOpen] = useState(false)
  const [formError, setFormError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)

  const query = useApiQuery<JastipTrip[]>(
    "jastip-mine",
    useCallback((signal: AbortSignal) => api.commerce.listMyJastipTrips(1, 50, signal), []),
  )
  const trips = query.data ?? []

  const openCreate = useCallback(() => {
    setTitle("")
    setDescription("")
    setDeadline(null)
    setSlotTotal("")
    setFormError(undefined)
    setSheetOpen(true)
  }, [])

  const handleCreate = useCallback(async () => {
    if (saving) return
    if (title.trim().length < 3) {
      setFormError(translate("Judul minimal 3 karakter."))
      return
    }
    if (!deadline) {
      setFormError(translate("Pilih deadline order."))
      return
    }
    const slots = slotTotal.trim() === "" ? undefined : Number.parseInt(slotTotal, 10)
    if (slots !== undefined && (!Number.isFinite(slots) || slots < 1)) {
      setFormError(translate("Total slot harus angka ≥ 1."))
      return
    }
    setSaving(true)
    try {
      const trip = await api.commerce.createJastipTrip({
        title: title.trim(),
        description: description.trim() || undefined,
        orderDeadline: deadline.toISOString(),
        slotTotal: slots,
      })
      if (!trip) throw new Error("empty")
      toast.show({ title: translate("Trip dibuat"), tone: "success" })
      setSheetOpen(false)
      await query.refresh()
      router.push(ROUTES.jastipDetail(trip.id))
    } catch (err) {
      setFormError(userMessage(err))
    } finally {
      setSaving(false)
    }
  }, [saving, title, description, deadline, slotTotal, toast, query])

  if (!hasSession) {
    return <GuestLoginPrompt next="/jastip" />
  }

  return (
    <DataScreen
      title={translate("Jastip saya")}
      header={{
        right: (
          <IconButton
            icon={Plus}
            accessibilityLabel={translate("Buat trip jastip")}
            onPress={openCreate}
          />
        ),
      }}
      state={query}
      loadingMessage={translate("Memuat trip")}
      errorTitle={translate("Gagal memuat trip")}
      empty={
        trips.length === 0
          ? {
              icon: Package,
              title: translate("Belum ada trip"),
              description: translate("Buat trip jastip: tentukan tujuan, deadline order, dan slot — harga dikunci setelah kamu konfirmasi ke peserta."),
              action: (
                <Button fullWidth={false} onPress={openCreate}>
                  {translate("Buat trip")}
                </Button>
              ),
            }
          : undefined
      }
    >
      <View className="gap-3">
        {trips.map((trip) => (
          <Card
            key={trip.id}
            variant="outline"
            className="gap-2 p-4"
            onPress={() => router.push(ROUTES.jastipDetail(trip.id))}
          >
            <View className="flex-row items-center gap-2">
              <Text variant="body" weight={600} className="flex-1" numberOfLines={1}>
                {trip.title}
              </Text>
              <Badge tone={STATUS_TONE[trip.status] ?? "neutral"}>
                {JASTIP_TRIP_STATUS_LABELS[trip.status] ?? trip.status}
              </Badge>
            </View>
            <View className="flex-row items-center gap-4">
              {trip.orderDeadline ? (
                <View className="flex-row items-center gap-1">
                  <Icon icon={CalendarBlank} size="xs" tone="default" />
                  <Text variant="caption" tone="secondary">
                    {formatDateLong(trip.orderDeadline)}
                  </Text>
                </View>
              ) : null}
              <View className="flex-row items-center gap-1">
                <Icon icon={Users} size="xs" tone="default" />
                <Text variant="caption" tone="secondary">
                  {trip.participants.length}
                  {trip.slotTotal != null ? `/${trip.slotTotal}` : ""} {translate("peserta")}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        title={translate("Buat trip jastip")}
        footer={
          <Button fullWidth loading={saving} onPress={() => void handleCreate()}>
            {translate("Buat trip")}
          </Button>
        }
      >
        <View className="gap-4">
          <Input
            label={translate("Judul trip")}
            value={title}
            onChangeText={setTitle}
            placeholder={translate("cth: Jastip Jepang — batch Maret")}
            maxLength={120}
          />
          <Input
            label={translate("Deskripsi (opsional)")}
            value={description}
            onChangeText={setDescription}
            placeholder={translate("Tujuan, jadwal, ketentuan…")}
            multiline
            maxLength={500}
          />
          <Field label={translate("Deadline order")}>
            <Button variant="secondary" fullWidth={false} onPress={() => setDateSheetOpen(true)}>
              {deadline ? formatDateLong(deadline.toISOString()) : translate("Pilih tanggal")}
            </Button>
          </Field>
          <Input
            label={translate("Total slot (opsional)")}
            value={slotTotal}
            onChangeText={setSlotTotal}
            keyboardType="number-pad"
            placeholder={translate("cth: 20")}
            maxLength={4}
          />
          {formError ? (
            <Text variant="caption" tone="danger">
              {formError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>

      <DatePickerSheet
        visible={dateSheetOpen}
        onRequestClose={() => setDateSheetOpen(false)}
        value={deadline}
        onSelect={(d) => {
          setDeadline(d)
          setDateSheetOpen(false)
        }}
        title={translate("Deadline order")}
      />
    </DataScreen>
  )
}
