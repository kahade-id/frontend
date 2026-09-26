/**
 * Kahade — <DatePickerSheet>.
 *
 * Pemilih tanggal kalender di dalam <BottomSheet> — murni JS/RN (tanpa native
 * module) sehingga aman untuk update OTA. Menampilkan bulan ini + bulan depan;
 * tanggal yang bisa dipilih dibatasi rentang [minDate, maxDate] (default:
 * besok … 14 hari ke depan, kontrak tenggat POST /v1/orders).
 *
 * Keputusan non-obvious:
 *   - Tanggal dinormalisasi ke tengah hari lokal (12:00). `toISOString()`
 *     dari tengah malam lokal bisa jatuh ke hari SEBELUMNYA dalam UTC
 *     (WIB = UTC+7) sehingga backend membaca tanggal yang salah; tengah
 *     hari lokal selalu aman untuk zona UTC+7.
 *   - Pekan dimulai Senin (konvensi Indonesia); header hari memakai
 *     `dayName()` (sudah mengikuti bahasa aktif — pemanggil WAJIB
 *     `useLanguage()` agar ikut render ulang saat bahasa ditukar, lihat
 *     G-07 di lib/format.ts).
 *   - Pilih tanggal langsung menutup sheet — satu ketukan, tanpa tombol
 *     konfirmasi tambahan.
 */
import { useMemo } from "react"
import { View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { dayName, formatDateLong, monthName } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

export const DATE_PICKER_MIN_DAYS_AHEAD = 1
export const DATE_PICKER_MAX_DAYS_AHEAD = 14

/** Tengah hari lokal — aman untuk `toISOString()` di zona UTC+7. */
export function normalizePickerDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
}

export function addDays(date: Date, days: number): Date {
  const d = normalizePickerDate(date)
  d.setDate(d.getDate() + days)
  return d
}

export type DatePickerSheetProps = {
  visible: boolean
  onRequestClose: () => void
  /** Tanggal terpilih saat ini (boleh null). */
  value: Date | null
  onSelect: (date: Date) => void
  /** Batas bawah inklusif — default: besok. */
  minDate?: Date
  /** Batas atas inklusif — default: 14 hari dari hari ini. */
  maxDate?: Date
  title?: string
}

function monthCells(year: number, month: number): (Date | null)[] {
  // Kolom 0 = Senin.
  const lead = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d, 12, 0, 0, 0))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function MonthGrid({
  year,
  month,
  minTime,
  maxTime,
  todayTime,
  selectedTime,
  onSelect,
}: {
  year: number
  month: number
  minTime: number
  maxTime: number
  todayTime: number
  selectedTime: number | null
  onSelect: (date: Date) => void
}) {
  const cells = useMemo(() => monthCells(year, month), [year, month])
  // Urutan kolom: Senin … Minggu (getDay(): 1 … 6, 0).
  const weekdays = useMemo(() => [1, 2, 3, 4, 5, 6, 0], [])
  return (
    <View className="gap-1">
      <Text variant="body" weight={600} className="px-1 pb-1">
        {monthName(month, { long: true })} {year}
      </Text>
      <View className="flex-row">
        {weekdays.map((d) => (
          <View key={d} className="flex-1 items-center py-1">
            <Text variant="caption" tone="tertiary" weight={600}>
              {dayName(d).slice(0, 3)}
            </Text>
          </View>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {cells.map((date, i) =>
          date == null ? (
            <View key={`blank-${i}`} className="w-[14.2857%] items-center py-1" />
          ) : (
            <DayCell
              key={date.getTime()}
              date={date}
              disabled={date.getTime() < minTime || date.getTime() > maxTime}
              isToday={date.getTime() === todayTime}
              selected={selectedTime != null && date.getTime() === selectedTime}
              onSelect={onSelect}
            />
          ),
        )}
      </View>
    </View>
  )
}

function DayCell({
  date,
  disabled,
  isToday,
  selected,
  onSelect,
}: {
  date: Date
  disabled: boolean
  isToday: boolean
  selected: boolean
  onSelect: (date: Date) => void
}) {
  const label = formatDateLong(date)
  return (
    <View className="w-[14.2857%] items-center py-1">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, selected }}
        disabled={disabled}
        onPress={() => onSelect(date)}
        className={cn(
          "h-10 w-10 items-center justify-center rounded-full",
          selected && "bg-primary",
          isToday && !selected && "border border-border",
        )}
      >
        <Text
          variant="body"
          tone={selected ? "inverse" : disabled ? "disabled" : undefined}
          weight={selected || isToday ? 600 : 400}
        >
          {date.getDate()}
        </Text>
      </PressableScale>
    </View>
  )
}

export function DatePickerSheet({
  visible,
  onRequestClose,
  value,
  onSelect,
  minDate,
  maxDate,
  title,
}: DatePickerSheetProps) {
  // G-07: panggil agar nama bulan/hari ikut bahasa aktif.
  useLanguage()

  const today = useMemo(() => normalizePickerDate(new Date()), [])
  const min = useMemo(
    () => normalizePickerDate(minDate ?? addDays(today, DATE_PICKER_MIN_DAYS_AHEAD)),
    [minDate, today],
  )
  const max = useMemo(
    () => normalizePickerDate(maxDate ?? addDays(today, DATE_PICKER_MAX_DAYS_AHEAD)),
    [maxDate, today],
  )
  const selectedTime = value ? normalizePickerDate(value).getTime() : null

  const months = useMemo(() => {
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    const second = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    return [
      { year: first.getFullYear(), month: first.getMonth() },
      { year: second.getFullYear(), month: second.getMonth() },
    ]
  }, [today])

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title={title ?? translate("Pilih tanggal")}
      accessibilityLabel={title ?? translate("Pilih tanggal")}
    >
      <View className="gap-5">
        {months.map((m) => (
          <MonthGrid
            key={`${m.year}-${m.month}`}
            year={m.year}
            month={m.month}
            minTime={min.getTime()}
            maxTime={max.getTime()}
            todayTime={today.getTime()}
            selectedTime={selectedTime}
            onSelect={(date) => {
              onSelect(date)
              onRequestClose()
            }}
          />
        ))}
      </View>
    </BottomSheet>
  )
}
