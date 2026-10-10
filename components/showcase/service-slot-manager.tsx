/**
 * ServiceSlotManagerSheet — batch 43, item 12.
 *
 * Penjual mengelola kalender ketersediaan produk JASA:
 * - Daftar slot (GET /v1/commerce/service-slots/showcase/:showcaseId, dari hari ini)
 * - Tambah slot (POST /v1/commerce/service-slots): tanggal + jam mulai/selesai
 *   (WIB) + kapasitas + catatan
 * - Nonaktifkan slot (DELETE /v1/commerce/service-slots/:id)
 *
 * Server yang memvalidasi bentrok/aturan slot; klien hanya validasi format.
 * Angka booked/remaining tampil apa adanya dari server.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { CalendarPlus, Clock, Trash, Users } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import type { ServiceSlot } from "@/lib/api/commerce"
import { translate } from "@/lib/i18n/translate"
import { formatDateLong } from "@/lib/format"
import { useToast } from "@/components/ui/toast"

import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DatePickerSheet } from "@/components/ui/date-picker-sheet"
import { Dialog } from "@/components/ui/modal"
import { Field } from "@/components/ui/field"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { IconButton } from "@/components/ui/icon-button"
import { NumberStepper } from "@/components/ui/number-stepper"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { TimePickerSheet } from "@/components/ui/time-picker-sheet"

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function slotDateLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return formatDateLong(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

export function ServiceSlotManagerSheet({
  visible,
  onRequestClose,
  showcaseId,
  productTitle,
}: {
  visible: boolean
  onRequestClose: () => void
  showcaseId: string
  productTitle: string
}) {
  const toast = useToast()
  const [slots, setSlots] = useState<ServiceSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  // Form tambah slot
  const [slotDate, setSlotDate] = useState<Date | null>(null)
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("10:00")
  const [capacity, setCapacity] = useState(1)
  const [note, setNote] = useState("")
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [timeTarget, setTimeTarget] = useState<"start" | "end" | null>(null)
  const [formError, setFormError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ServiceSlot | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.commerce.listServiceSlots(showcaseId, todayIso())
      setSlots(list.filter((s) => s.isActive))
    } catch {
      toast.show({ title: translate("Gagal memuat slot"), tone: "danger" })
    } finally {
      setLoading(false)
    }
  }, [showcaseId, toast])

  useEffect(() => {
    if (visible) void load()
  }, [visible, load])

  const openForm = useCallback(() => {
    setSlotDate(new Date())
    setStartTime("09:00")
    setEndTime("10:00")
    setCapacity(1)
    setNote("")
    setFormError(undefined)
    setFormOpen(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (saving || !slotDate) return
    if (startTime >= endTime) {
      setFormError(translate("Jam selesai harus setelah jam mulai."))
      return
    }
    setSaving(true)
    try {
      await api.commerce.createServiceSlot({
        showcaseId,
        slotDate: toIsoDate(slotDate),
        startTime,
        endTime,
        capacity,
        note: note.trim() || undefined,
      })
      toast.show({ title: translate("Slot ditambahkan"), tone: "success" })
      setFormOpen(false)
      await load()
    } catch (err) {
      setFormError(userMessage(err))
    } finally {
      setSaving(false)
    }
  }, [saving, slotDate, startTime, endTime, capacity, note, showcaseId, toast, load])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await api.commerce.deleteServiceSlot(deleteTarget.id)
      toast.show({ title: translate("Slot dinonaktifkan"), tone: "success" })
      setDeleteTarget(null)
      await load()
    } catch (err) {
      toast.show({ title: translate("Gagal menonaktifkan slot"), description: userMessage(err), tone: "danger" })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, deleting, toast, load])

  return (
    <>
      <BottomSheet
        visible={visible && !formOpen}
        onRequestClose={onRequestClose}
        title={translate("Kelola slot")}
        description={productTitle}
        footer={
          <Button fullWidth leftIcon={CalendarPlus} onPress={openForm}>
            {translate("Tambah slot")}
          </Button>
        }
      >
        <View className="gap-2">
          {loading ? (
            // UX-16 (audit etalase 2026-10-10): shimmer, bukan teks "Memuat…".
            <SkeletonGroup>
              <View
                className="gap-2"
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={translate("Memuat jadwal jasa")}
              >
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} shape="card" height={72} className="w-full" />
                ))}
              </View>
            </SkeletonGroup>
          ) : slots.length === 0 ? (
            <Text variant="caption" tone="secondary">
              {translate("Belum ada slot. Tambahkan jadwal ketersediaan agar pembeli bisa booking.")}
            </Text>
          ) : (
            slots.map((slot) => (
              <Card key={slot.id} variant="outline" className="gap-1 p-3">
                <View className="flex-row items-center gap-2">
                  <Icon icon={Clock} size="sm" tone="default" />
                  <Text variant="body" weight={600} className="flex-1" numberOfLines={1}>
                    {slotDateLabel(slot.slotDate)} · {slot.startTime}–{slot.endTime}
                  </Text>
                  <IconButton
                    icon={Trash}
                    size="sm"
                    variant="ghost"
                    accessibilityLabel={translate("Nonaktifkan slot")}
                    onPress={() => setDeleteTarget(slot)}
                  />
                </View>
                <View className="flex-row items-center gap-3">
                  <View className="flex-row items-center gap-1">
                    <Icon icon={Users} size="xs" tone="default" />
                    <Text variant="caption" tone="secondary" className="tabular-nums">
                      {translate("{x}/{y} terisi", {
                        x: slot.bookedCount,
                        y: slot.capacity,
                      })}
                    </Text>
                  </View>
                  {(slot.remaining ?? 0) > 0 ? (
                    <Badge tone="success">{translate("Tersedia")}</Badge>
                  ) : (
                    <Badge tone="neutral">{translate("Penuh")}</Badge>
                  )}
                </View>
                {slot.note ? (
                  <Text variant="caption" tone="tertiary" numberOfLines={2}>
                    {slot.note}
                  </Text>
                ) : null}
              </Card>
            ))
          )}
        </View>
      </BottomSheet>

      <BottomSheet
        // FRM-022/FRM-023: single-sheet — disembunyikan selama date/time picker terbuka.
        visible={formOpen && !datePickerOpen && timeTarget == null}
        onRequestClose={() => setFormOpen(false)}
        title={translate("Tambah slot")}
        // FRM-022: keyboard tidak menutupi field catatan di layar kecil.
        avoidKeyboard
        footer={
          <Button fullWidth loading={saving} onPress={() => void handleSave()}>
            {translate("Simpan slot")}
          </Button>
        }
      >
        <View className="gap-4">
          <Field label={translate("Tanggal")}>
            <Button variant="secondary" onPress={() => setDatePickerOpen(true)}>
              {slotDate ? formatDateLong(slotDate) : translate("Pilih tanggal")}
            </Button>
          </Field>
          <View className="flex-row gap-3">
            <Field label={translate("Jam mulai (WIB)")} className="flex-1">
              <Button variant="secondary" onPress={() => setTimeTarget("start")}>
                {startTime}
              </Button>
            </Field>
            <Field label={translate("Jam selesai (WIB)")} className="flex-1">
              <Button variant="secondary" onPress={() => setTimeTarget("end")}>
                {endTime}
              </Button>
            </Field>
          </View>
          <NumberStepper
            label={translate("Kapasitas")}
            value={capacity}
            min={1}
            max={100}
            onChange={(n) => { setCapacity(n); setFormError(undefined) }}
          />
          <Input
            label={translate("Catatan (opsional)")}
            value={note}
            onChangeText={(t) => { setNote(t); setFormError(undefined) }}
            placeholder={translate("cth: bawa laptop sendiri")}
            maxLength={200}
          />
          {formError ? (
            <Text variant="caption" tone="danger">
              {formError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>

      <DatePickerSheet
        visible={datePickerOpen}
        onRequestClose={() => setDatePickerOpen(false)}
        value={slotDate}
        minDate={new Date()}
        onSelect={(date) => {
          setSlotDate(date)
          setFormError(undefined)
          setDatePickerOpen(false)
        }}
      />
      <TimePickerSheet
        visible={timeTarget != null}
        onRequestClose={() => setTimeTarget(null)}
        title={timeTarget === "start" ? translate("Jam mulai") : translate("Jam selesai")}
        value={timeTarget === "start" ? startTime : endTime}
        onSelect={(next) => {
          if (timeTarget === "start") setStartTime(next)
          else setEndTime(next)
          setFormError(undefined)
          setTimeTarget(null)
        }}
      />

      <Dialog
        title={translate("Nonaktifkan slot ini?")}
        description={
          deleteTarget
            ? translate("{x} · {y}–{z}", {
                x: slotDateLabel(deleteTarget.slotDate),
                y: deleteTarget.startTime,
                z: deleteTarget.endTime,
              })
            : undefined
        }
        visible={deleteTarget != null}
        destructive
        loading={deleting}
        confirmLabel={translate("Nonaktifkan")}
        cancelLabel={translate("Batal")}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        onRequestClose={() => setDeleteTarget(null)}
      />
    </>
  )
}
