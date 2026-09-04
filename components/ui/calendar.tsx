/**
 * Kahade — <Calendar> (§9.2 turunan; pemilih tanggal, konten untuk sheet).
 *
 * Grid satu bulan (7 kolom, minggu mulai Senin) tanpa dependensi picker
 * native: tampilan identik di iOS/Android/web dan seluruhnya dari token.
 * Dipakai sebagai KONTEN Bottom Sheet lewat <DateField> (lihat date-field.tsx),
 * atau berdiri sendiri di layar Push untuk pemilihan deadline escrow.
 *
 * Anatomi: header (bulan+tahun, panah prev/next) -> baris nama hari
 * (caption secondary) -> 6 baris tanggal (selalu 6 supaya tinggi sheet tidak
 * melompat saat ganti bulan — sel kosong tetap dirender tak terlihat).
 *
 * State sel:
 *   - selected : fill `primary` + teks inverse (invert otomatis di dark)
 *   - today    : border-focus 1.5px, teks primary (bukan fill — "hari ini"
 *                adalah penanda, bukan pilihan)
 *   - disabled : opacity-disabled (di luar min/max atau `isDateDisabled`)
 *   - default  : teks primary, tanpa border
 * Radius sel `rounded-sm` (6px, seperti Button) — bukan lingkaran; sistem ini
 * sharp/institusional (§5), pill hanya untuk avatar/dot/chip.
 *
 * Keputusan non-obvious:
 *   - Angka tanggal Sofia Sans `tabular-nums` (§3.1: angka dalam list/tabel),
 *     BUKAN Mono — tanggal di grid bukan "field angka yang berdiri sendiri".
 *   - Tidak ada tampilan tanggal bulan sebelumnya/berikutnya di sel kosong:
 *     mengurangi noise, konsisten dengan prinsip "tenang".
 *   - Navigasi bulan dibatasi oleh min/max: panah disabled bila seluruh
 *     bulan tujuan berada di luar rentang.
 *   - Semua perbandingan tanggal memakai "hari lokal" (Y/M/D) lewat helper
 *     `sameDay`/`startOfDay` agar zona waktu tidak menggeser pilihan.
 */
import { CaretLeft, CaretRight } from "phosphor-react-native"
import { useMemo, useState } from "react"
import { View, type ViewProps } from "react-native"

import { IconButton } from "@/components/ui/icon-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

const MONTHS_ID_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]
/** Minggu dimulai Senin (kebiasaan kalender Indonesia) */
const WEEKDAYS_ID = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
const ROWS = 6

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
export function sameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export type CalendarProps = Omit<ViewProps, "children"> & {
  value?: Date | null
  onChange?: (date: Date) => void
  /** Bulan yang pertama ditampilkan (default: value ?? hari ini) */
  initialMonth?: Date
  minDate?: Date
  maxDate?: Date
  /** Nonaktifkan tanggal tertentu (mis. akhir pekan, hari libur) */
  isDateDisabled?: (date: Date) => boolean
  disabled?: boolean
  className?: string
}

export function Calendar({
  value,
  onChange,
  initialMonth,
  minDate,
  maxDate,
  isDateDisabled,
  disabled = false,
  className,
  ...rest
}: CalendarProps) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [month, setMonth] = useState(() => {
    const base = initialMonth ?? value ?? today
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const min = minDate ? startOfDay(minDate) : null
  const max = maxDate ? startOfDay(maxDate) : null

  // Grid 6x7: offset hari pertama (Senin=0) + jumlah hari bulan ini
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const out: (Date | null)[] = []
    for (let i = 0; i < ROWS * 7; i++) {
      const day = i - offset + 1
      out.push(day >= 1 && day <= daysInMonth ? new Date(month.getFullYear(), month.getMonth(), day) : null)
    }
    return out
  }, [month])

  const isOutOfRange = (d: Date) => (min != null && d < min) || (max != null && d > max)
  const canPrev = !disabled && !(min && sameMonth(month, min)) && !(min && month < min)
  const canNext = !disabled && !(max && sameMonth(month, max)) && !(max && month > max)

  const monthLabel = `${MONTHS_ID_LONG[month.getMonth()]} ${month.getFullYear()}`

  return (
    <View className={cn("w-full gap-3", disabled && "opacity-disabled", className)} {...rest}>
      {/* Header: bulan + navigasi */}
      <View className="flex-row items-center justify-between">
        <IconButton
          icon={CaretLeft}
          variant="ghost"
          size="sm"
          accessibilityLabel="Bulan sebelumnya"
          disabled={!canPrev}
          onPress={() => setMonth((m) => addMonths(m, -1))}
        />
        <Text variant="h3" tone="primary" accessibilityRole="header" accessibilityLiveRegion="polite">
          {monthLabel}
        </Text>
        <IconButton
          icon={CaretRight}
          variant="ghost"
          size="sm"
          accessibilityLabel="Bulan berikutnya"
          disabled={!canNext}
          onPress={() => setMonth((m) => addMonths(m, 1))}
        />
      </View>

      {/* Nama hari */}
      <View className="flex-row">
        {WEEKDAYS_ID.map((w) => (
          <View key={w} className="flex-1 items-center py-1">
            <Text variant="caption" tone="secondary" weight={500}>
              {w}
            </Text>
          </View>
        ))}
      </View>

      {/* Grid tanggal — 6 baris tetap */}
      <View className="gap-1">
        {Array.from({ length: ROWS }, (_, r) => (
          <View key={r} className="flex-row gap-1">
            {cells.slice(r * 7, r * 7 + 7).map((d, c) => {
              if (!d) return <View key={`e-${r}-${c}`} className="flex-1 aspect-square" />

              const selected = sameDay(d, value)
              const isToday = sameDay(d, today)
              const cellDisabled = disabled || isOutOfRange(d) || !!isDateDisabled?.(d)

              return (
                <PressableScale
                  key={d.getTime()}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.getDate()} ${MONTHS_ID_LONG[d.getMonth()]} ${d.getFullYear()}`}
                  accessibilityState={{ selected, disabled: cellDisabled }}
                  disabled={cellDisabled}
                  onPress={() => onChange?.(d)}
                  containerClassName="flex-1"
                  className={cn(
                    "aspect-square items-center justify-center rounded-sm",
                    selected
                      ? "bg-primary"
                      : isToday
                        ? "border-focus border-border-focus"
                        : "bg-transparent",
                  )}
                >
                  {/* Disabled cukup lewat opacity-disabled dari PressableScale (§9.1) —
                      jangan ditumpuk dengan tone "disabled", jadi terlalu pudar */}
                  <Text
                    variant="body"
                    weight={selected || isToday ? 600 : 400}
                    tone={selected ? "inverse" : "primary"}
                  >
                    {d.getDate()}
                  </Text>
                </PressableScale>
              )
            })}
          </View>
        ))}
      </View>
    </View>
  )
}
