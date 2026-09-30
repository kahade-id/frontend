/**
 * CommerceProductFields — field commerce batch 43 untuk form buat/edit etalase.
 *
 * Dipakai `app/showcase/create.tsx` dan editor di `app/showcase-management.tsx`:
 *   - picker tipe produk JASA/FISIK/DIGITAL/LAINNYA
 *   - harga coret (validasi lokal: harus > harga jual; server tetap otoritatif)
 *   - tenggat pengerjaan (hari) — hanya & wajib bila JASA
 *   - info pengiriman digital — hanya bila DIGITAL
 *   - jadwal publish — pemilih tanggal (DatePickerSheet) + jam HH:mm
 *
 * Resi/ongkir tidak ada di form etalase: hanya relevan di checkout untuk
 * produk FISIK (lihat `needsShippingAddress` di lib/commerce-fields.ts).
 */
import { useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { CalendarBlank, X } from "phosphor-react-native"

import { PRODUCT_TYPE_LABELS, type ProductType } from "@/lib/api/commerce"
import { formatDateLong, formatDateTimeWIB, formatRupiah } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { cn } from "@/lib/cn"

import { DatePickerSheet, addDays } from "@/components/ui/date-picker-sheet"
import { Field } from "@/components/ui/field"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { PressableScale } from "@/components/ui/pressable-scale"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"

export type CommerceFormValues = {
  productType: ProductType
  /** Harga coret IDR (null = tidak diatur). */
  originalPriceIdr: number | null
  /** Tenggat pengerjaan jasa (hari). */
  serviceDeadlineDays: number | null
  digitalDeliveryInfo: string
  /** ISO dengan offset WIB, atau null. */
  scheduledAt: string | null
}

export const EMPTY_COMMERCE_FORM: CommerceFormValues = {
  productType: "LAINNYA",
  originalPriceIdr: null,
  serviceDeadlineDays: null,
  digitalDeliveryInfo: "",
  scheduledAt: null,
}

const PRODUCT_TYPE_ORDER: ProductType[] = ["JASA", "FISIK", "DIGITAL", "LAINNYA"]

/** null = kosong; undefined = input tidak valid (abaikan). */
function parseDigits(raw: string): number | null | undefined {
  const digits = raw.replace(/[.\s,]/g, "")
  if (!/^\d*$/.test(digits)) return undefined
  return digits === "" ? null : Number(digits)
}

/** "2026-10-05" + "14:30" → "2026-10-05T14:30:00+07:00". */
export function combineScheduledAt(date: Date, timeHHmm: string): string | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeHHmm.trim())
  if (!m) return null
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${mo}-${d}T${m[1]}:${m[2]}:00+07:00`
}

export function parseScheduledAt(iso: string | null): { date: Date; time: string } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return {
    date: d,
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  }
}

export type CommerceProductFieldsProps = {
  value: CommerceFormValues
  onChange: (next: CommerceFormValues) => void
  /** Harga jual (priceMin ?? priceMax) untuk validasi harga coret. */
  salePriceIdr?: number | null
  disabled?: boolean
}

export function CommerceProductFields({ value, onChange, salePriceIdr, disabled }: CommerceProductFieldsProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [schedDate, setSchedDate] = useState<Date | null>(() => parseScheduledAt(value.scheduledAt)?.date ?? null)
  const [schedTime, setSchedTime] = useState(() => parseScheduledAt(value.scheduledAt)?.time ?? "")

  const set = (patch: Partial<CommerceFormValues>) => onChange({ ...value, ...patch })

  const originalError =
    value.originalPriceIdr != null && salePriceIdr != null && value.originalPriceIdr <= salePriceIdr
      ? translate("Harga coret harus lebih besar dari harga jual ({x}).", {
          x: formatRupiah(salePriceIdr),
        })
      : undefined

  const jasaError =
    value.productType === "JASA" && value.serviceDeadlineDays == null
      ? translate("Produk jasa wajib memiliki tenggat pengerjaan.")
      : undefined

  const applySchedule = () => {
    if (!schedDate) {
      set({ scheduledAt: null })
      return
    }
    const iso = combineScheduledAt(schedDate, schedTime || "09:00")
    if (!iso) return
    if (new Date(iso).getTime() <= Date.now()) {
      // Server menolak jadwal di masa lalu — jangan kirim nilai basi.
      set({ scheduledAt: null })
      return
    }
    set({ scheduledAt: iso })
  }

  const timeValid = schedTime === "" || /^([01]\d|2[0-3]):([0-5]\d)$/.test(schedTime.trim())

  return (
    <View className="gap-4">
      <Field label={translate("Jenis produk")}>
        <SegmentedControl<ProductType>
          items={PRODUCT_TYPE_ORDER.map((t) => ({ value: t, label: PRODUCT_TYPE_LABELS[t] }))}
          value={value.productType}
          onChange={(t) => set({ productType: t })}
          disabled={disabled}
          accessibilityLabel={translate("Jenis produk")}
        />
        {value.productType === "FISIK" ? (
          <Text variant="caption" tone="secondary">
            {translate("Resi & ongkir hanya untuk barang fisik — diisi saat transaksi.")}
          </Text>
        ) : null}
      </Field>

      <Input
        label={translate("Harga coret (opsional)")}
        keyboardType="number-pad"
        value={value.originalPriceIdr == null ? "" : String(value.originalPriceIdr)}
        maxLength={15}
        onChangeText={(raw) => {
          const parsed = parseDigits(raw)
          if (parsed === undefined) return
          set({ originalPriceIdr: parsed })
        }}
        errorText={originalError}
        helperText={translate("Ditampilkan tercoret bila lebih besar dari harga jual.")}
        disabled={disabled}
      />

      {value.productType === "JASA" ? (
        <Input
          label={translate("Tenggat pengerjaan (hari)")}
          keyboardType="number-pad"
          value={value.serviceDeadlineDays == null ? "" : String(value.serviceDeadlineDays)}
          maxLength={3}
          onChangeText={(raw) => {
            const digits = raw.replace(/\D/g, "")
            if (digits.length > 3) return
            const n = digits === "" ? null : Number(digits)
            set({ serviceDeadlineDays: n != null && n >= 1 && n <= 365 ? n : null })
          }}
          errorText={jasaError}
          helperText={translate("Wajib untuk produk jasa — berapa hari pengerjaan maksimal.")}
          disabled={disabled}
        />
      ) : null}

      {value.productType === "DIGITAL" ? (
        <TextArea
          label={translate("Info pengiriman digital (opsional)")}
          value={value.digitalDeliveryInfo}
          onChangeText={(text) => set({ digitalDeliveryInfo: text })}
          maxLength={2000}
          rows={2}
          placeholder={translate("cth: file dikirim otomatis setelah pembayaran via…")}
          disabled={disabled}
        />
      ) : null}

      <Field label={translate("Jadwalkan publish (opsional)")}>
        <View className="flex-row items-center gap-2">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={translate("Pilih tanggal publish")}
            onPress={() => setSheetOpen(true)}
            disabled={disabled}
            className={cn(
              "h-14 flex-1 flex-row items-center rounded-sm border bg-background px-4",
              "border-border-control",
            )}
          >
            <Text variant="body" tone={schedDate ? undefined : "tertiary"} numberOfLines={1} className="flex-1">
              {schedDate ? formatDateLong(schedDate) : translate("Pilih tanggal")}
            </Text>
            <Icon icon={CalendarBlank} size="sm" tone="default" />
          </PressableScale>
          {schedDate || value.scheduledAt ? (
            <IconButton
              icon={X}
              size="sm"
              variant="ghost"
              accessibilityLabel={translate("Hapus jadwal publish")}
              disabled={disabled}
              onPress={() => {
                setSchedDate(null)
                setSchedTime("")
                set({ scheduledAt: null })
              }}
            />
          ) : null}
        </View>
        {schedDate ? (
          <View className="flex-row items-center gap-2">
            <Input
              label={translate("Jam (WIB)")}
              value={schedTime}
              onChangeText={setSchedTime}
              placeholder="09:00"
              maxLength={5}
              keyboardType="number-pad"
              errorText={timeValid ? undefined : translate("Format jam HH:mm.")}
              disabled={disabled}
              containerClassName="flex-1"
            />
            <Text variant="caption" tone="secondary" className="flex-1">
              {value.scheduledAt
                ? translate("Terjadwal: {x}", { x: formatDateTimeWIB(value.scheduledAt) })
                : translate("Pilih jam lalu simpan — etalase terbit otomatis.")}
            </Text>
          </View>
        ) : null}
        <DatePickerSheet
          visible={sheetOpen}
          onRequestClose={() => setSheetOpen(false)}
          value={schedDate}
          minDate={addDays(new Date(), 0)}
          maxDate={addDays(new Date(), 90)}
          title={translate("Tanggal publish")}
          onSelect={(date) => {
            setSchedDate(date)
            setSheetOpen(false)
          }}
        />
      </Field>
      <ScheduleCommit date={schedDate} time={schedTime} onCommit={applySchedule} />
    </View>
  )
}

/**
 * Komit nilai jadwal ke form setiap tanggal/jam berubah. Komponen terpisah
 * supaya effect tidak bercampur dengan render field di atas.
 */
function ScheduleCommit({
  date,
  time,
  onCommit,
}: {
  date: Date | null
  time: string
  onCommit: () => void
}) {
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit
  const lastKey = useRef<string | null>(null)
  useEffect(() => {
    const key = date ? `${date.getTime()}|${time}` : "none"
    if (key === lastKey.current) return
    lastKey.current = key
    commitRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, time])
  return null
}
