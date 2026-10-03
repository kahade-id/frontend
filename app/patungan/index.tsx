/**
 * Screen — Patungan (batch 43, item 16).
 *
 * Daftar grup patungan publik (GET /v1/patungan/groups, filter status) +
 * buat grup (POST /v1/patungan/groups): judul, target, deadline, slot,
 * mode BAGI_RATA (nominal per orang wajib) / CUSTOM.
 *
 * Desain yang disetujui user: semua peserta bayar via Kahade dulu sebelum
 * deadline; target tercapai → cair ke host; gagal → auto-refund; mulai dari
 * patungan tertutup via link undangan (inviteCode). Overfunding → pengurang
 * merata per orang. Fee mengikuti escrow normal per order (tanpa logika
 * uang baru). Agregat (terkumpul, sisa, slot) tampil dari server apa adanya.
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { CalendarBlank, Plus, Question, Users, UsersThree } from "phosphor-react-native"
import { router } from "expo-router"

import { api, userMessage } from "@/lib/api"
import {
  PATUNGAN_STATUS_LABELS,
  type PatunganGroup,
  type PatunganMode,
  type PatunganStatus,
} from "@/lib/api/commerce"
import { useHasSession } from "@/lib/guest-gate"
import { translate } from "@/lib/i18n/translate"
import { formatDateLong, formatRupiah } from "@/lib/format"
import { formatRupiahTypingText, parseRupiahTypingText } from "@/lib/rupiah-input"
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
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { ProgressBar } from "@/components/ui/progress-bar"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Text } from "@/components/ui/text"

const FILTERS: { value: PatunganStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Semua" },
  { value: "OPEN", label: "Dibuka" },
  { value: "TARGET_REACHED", label: "Tercapai" },
  { value: "RELEASED", label: "Cair" },
]

const MODE_OPTIONS: { value: PatunganMode; label: string }[] = [
  { value: "BAGI_RATA", label: "Bagi rata" },
  { value: "CUSTOM", label: "Nominal bebas" },
]

function GroupCard({ group }: { group: PatunganGroup }) {
  const pct =
    group.targetAmountIdr && group.targetAmountIdr > 0
      ? Math.min(100, (group.totalPaidIdr / group.targetAmountIdr) * 100)
      : 0
  return (
    <Card
      variant="outline"
      className="gap-2 p-4"
      onPress={() => router.push(ROUTES.patunganDetail(group.id))}
    >
      <View className="flex-row items-center gap-2">
        <Text variant="body" weight={600} className="flex-1" numberOfLines={1}>
          {group.title}
        </Text>
        <Badge tone={group.status === "OPEN" ? "success" : group.status === "TARGET_REACHED" ? "info" : "neutral"}>
          {PATUNGAN_STATUS_LABELS[group.status] ?? group.status}
        </Badge>
      </View>
      <ProgressBar value={pct} />
      <View className="flex-row items-center gap-4">
        <Text variant="caption" tone="secondary" className="tabular-nums">
          {formatRupiah(group.totalPaidIdr)} / {group.targetAmountIdr != null ? formatRupiah(group.targetAmountIdr) : "—"}
        </Text>
      </View>
      <View className="flex-row items-center gap-4">
        {group.deadlineAt ? (
          <View className="flex-row items-center gap-1">
            <Icon icon={CalendarBlank} size="xs" tone="default" />
            <Text variant="caption" tone="secondary">
              {formatDateLong(group.deadlineAt)}
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center gap-1">
          <Icon icon={Users} size="xs" tone="default" />
          <Text variant="caption" tone="secondary">
            {group.paidCount}/{group.participantCount} {translate("bayar")}
            {group.slotsLeft != null ? ` • ${translate("sisa")} ${group.slotsLeft} ${translate("slot")}` : ""}
          </Text>
        </View>
      </View>
    </Card>
  )
}

export default function PatunganScreen() {
  const toast = useToast()
  const hasSession = useHasSession()
  const [filter, setFilter] = useState<PatunganStatus | "ALL">("ALL")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [target, setTarget] = useState("")
  const [deadline, setDeadline] = useState<Date | null>(null)
  const [slotTotal, setSlotTotal] = useState("")
  const [mode, setMode] = useState<PatunganMode>("BAGI_RATA")
  const [perPerson, setPerPerson] = useState("")
  const [dateSheetOpen, setDateSheetOpen] = useState(false)
  const [formError, setFormError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)

  const query = useApiQuery<PatunganGroup[]>(
    `patungan-${filter}`,
    useCallback(
      (signal: AbortSignal) =>
        api.commerce.listPatunganGroups(filter === "ALL" ? undefined : filter, 1, 50, signal),
      [filter],
    ),
  )
  const groups = query.data ?? []

  const openCreate = useCallback(() => {
    setTitle("")
    setDescription("")
    setTarget("")
    setDeadline(null)
    setSlotTotal("")
    setMode("BAGI_RATA")
    setPerPerson("")
    setFormError(undefined)
    setSheetOpen(true)
  }, [])

  const parseIdr = (v: string) => {
    const n = Number.parseInt(v.replace(/\D/g, ""), 10)
    return Number.isFinite(n) ? n : NaN
  }

  const handleCreate = useCallback(async () => {
    if (saving) return
    if (title.trim().length < 3) {
      setFormError(translate("Judul minimal 3 karakter."))
      return
    }
    const targetIdr = parseIdr(target)
    if (!Number.isFinite(targetIdr) || targetIdr <= 0) {
      setFormError(translate("Target dana wajib > 0."))
      return
    }
    if (!deadline) {
      setFormError(translate("Pilih deadline patungan."))
      return
    }
    const slots = slotTotal.trim() === "" ? undefined : Number.parseInt(slotTotal, 10)
    if (slots !== undefined && (!Number.isFinite(slots) || slots < 2)) {
      setFormError(translate("Total slot minimal 2."))
      return
    }
    let perPersonIdr: number | undefined
    if (mode === "BAGI_RATA") {
      perPersonIdr = parseIdr(perPerson)
      if (!Number.isFinite(perPersonIdr) || perPersonIdr <= 0) {
        setFormError(translate("Nominal per orang wajib > 0 untuk mode bagi rata."))
        return
      }
    }
    setSaving(true)
    try {
      const group = await api.commerce.createPatunganGroup({
        title: title.trim(),
        description: description.trim() || undefined,
        targetAmountIdr: targetIdr,
        deadlineAt: deadline.toISOString(),
        slotTotal: slots,
        mode,
        perPersonAmountIdr: perPersonIdr,
      })
      if (!group) throw new Error("empty")
      toast.show({ title: translate("Grup patungan dibuat"), tone: "success" })
      setSheetOpen(false)
      void query.refresh()
      router.push(ROUTES.patunganDetail(group.id))
    } catch (err) {
      setFormError(userMessage(err))
    } finally {
      setSaving(false)
    }
  }, [saving, title, description, target, deadline, slotTotal, mode, perPerson, toast, query])

  return (
    <DataScreen
      title={translate("Patungan")}
      header={{
        right: hasSession ? (
          <View className="flex-row items-center gap-1">
            {/* U5-014 (journey): pintu "Cara kerja" Patungan. */}
            <IconButton
              icon={Question}
              accessibilityLabel={translate("Cara kerja Patungan")}
              onPress={() => router.push(ROUTES.patunganHowItWorks)}
            />
            <IconButton
              icon={Plus}
              accessibilityLabel={translate("Buat grup patungan")}
              onPress={openCreate}
            />
          </View>
        ) : undefined,
      }}
      above={
        <SegmentedControl<PatunganStatus | "ALL">
          items={FILTERS}
          value={filter}
          onChange={setFilter}
          accessibilityLabel={translate("Filter status")}
        />
      }
      state={query}
      loadingMessage={translate("Memuat grup patungan")}
      errorTitle={translate("Gagal memuat grup")}
      empty={
        groups.length === 0
          ? {
              icon: UsersThree,
              title: translate("Belum ada grup"),
              description: translate("Buat grup patungan — semua peserta bayar via Kahade dulu; target tercapai baru cair ke host, gagal → pengembalian dana otomatis."),
              action: hasSession ? (
                <Button fullWidth={false} onPress={openCreate}>
                  {translate("Buat grup")}
                </Button>
              ) : undefined,
              // U5-014 (journey): pintu "Cara kerja" dari empty state.
              secondaryAction: (
                <Button variant="ghost" fullWidth={false} onPress={() => router.push(ROUTES.patunganHowItWorks)}>
                  {translate("Cara kerja Patungan")}
                </Button>
              ),
            }
          : undefined
      }
    >
      <View className="gap-3">
        {groups.map((g) => (
          <GroupCard key={g.id} group={g} />
        ))}
      </View>

      {/* FRM-023: sheet induk disembunyikan selama DatePickerSheet terbuka
          (pola single-sheet — dua BottomSheet tidak boleh visible bersamaan). */}
      <BottomSheet
        visible={sheetOpen && !dateSheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        title={translate("Buat grup patungan")}
        // FRM-017: field bawah tidak tertutup keyboard di layar kecil.
        avoidKeyboard
        footer={
          <Button fullWidth loading={saving} onPress={() => void handleCreate()}>
            {translate("Buat grup")}
          </Button>
        }
      >
        <View className="gap-4">
          <Input
            label={translate("Judul")}
            value={title}
            onChangeText={(t) => { setTitle(t); setFormError(undefined) }}
            placeholder={translate("cth: Patungan kado perpisahan")}
            maxLength={120}
          />
          <Input
            label={translate("Deskripsi (opsional)")}
            value={description}
            onChangeText={(t) => { setDescription(t); setFormError(undefined) }}
            multiline
            maxLength={500}
          />
          <Field label={translate("Mode iuran")}>
            <SegmentedControl<PatunganMode>
              items={MODE_OPTIONS}
              value={mode}
              onChange={(m) => { setMode(m); setFormError(undefined) }}
              accessibilityLabel={translate("Mode iuran")}
            />
          </Field>
          <Input
            label={translate("Target dana (Rp)")}
            // FE-052: pemisah ribuan saat mengetik; state digit mentah —
            // nilai ke backend tidak berubah.
            value={formatRupiahTypingText(target)}
            onChangeText={(t) => {
              const parsed = parseRupiahTypingText(t)
              if (parsed === null) return
              setTarget(parsed)
              setFormError(undefined)
            }}
            keyboardType="number-pad"
          />
          {mode === "BAGI_RATA" ? (
            <Input
              label={translate("Nominal per orang (Rp)")}
              value={formatRupiahTypingText(perPerson)}
              onChangeText={(t) => {
                const parsed = parseRupiahTypingText(t)
                if (parsed === null) return
                setPerPerson(parsed)
                setFormError(undefined)
              }}
              keyboardType="number-pad"
            />
          ) : null}
          <Field label={translate("Deadline")}>
            <Button variant="secondary" fullWidth={false} onPress={() => setDateSheetOpen(true)}>
              {deadline ? formatDateLong(deadline.toISOString()) : translate("Pilih tanggal")}
            </Button>
          </Field>
          <Input
            label={translate("Total slot (opsional, min. 2)")}
            value={slotTotal}
            onChangeText={(t) => { setSlotTotal(t); setFormError(undefined) }}
            keyboardType="number-pad"
            maxLength={4}
          />
          <Text variant="caption" tone="secondary">
            {translate("Kelebihan dana (overfunding) dibagi rata sebagai pengurang per orang. Fee mengikuti aturan normal per pesanan peserta.")}
          </Text>
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
          setFormError(undefined)
          setDateSheetOpen(false)
        }}
        title={translate("Deadline patungan")}
      />
    </DataScreen>
  )
}
