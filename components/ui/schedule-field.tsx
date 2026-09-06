/**
 * Kahade — <ScheduleField> (POST /v1/withdrawals/schedules).
 *
 * Input jadwal penarikan otomatis: hari dalam seminggu (0=Minggu … 6=Sabtu,
 * mengikuti `dayOfWeek` API) + saldo minimum pemicu (`minAmount`).
 *
 * Keputusan non-obvious:
 *   - Hari ditampilkan sebagai 7 pil singkat (Min–Sab) dalam satu baris,
 *     bukan Select — semua opsi terlihat sekaligus dan bisa dipindai cepat.
 *   - Ringkasan kalimat ("Setiap Jumat, saat saldo ≥ Rp500.000") ditampilkan
 *     di bawah supaya user memverifikasi jadwal sebelum menyimpan.
 */
import { View, type ViewProps } from "react-native"

import { AmountInput } from "@/components/ui/amount-input"
import { FieldHelper, FieldLabel } from "@/components/ui/field"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatRupiah } from "@/lib/format"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type ScheduleValue = { dayOfWeek: number | null; minAmount: number | null }

export type ScheduleFieldLabels = {
  dayLabel: string
  amountLabel: string
  days: readonly [string, string, string, string, string, string, string]
  dayNames: readonly [string, string, string, string, string, string, string]
  summary: (day: string, amount: string) => string
}

const DEFAULT_LABELS: ScheduleFieldLabels = {
  dayLabel: "Hari penarikan",
  amountLabel: "Saldo minimum pemicu",
  days: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"],
  dayNames: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
  summary: (day, amount) => `Setiap ${day}, saat saldo mencapai ${amount}`,
}

export type ScheduleFieldProps = Omit<ViewProps, "children"> & {
  value: ScheduleValue
  onChange: (value: ScheduleValue) => void
  errorText?: string
  helperText?: string
  disabled?: boolean
  /** Nominal preset cepat pada AmountInput */
  presets?: number[]
  labels?: Partial<ScheduleFieldLabels>
  className?: string
}

export function isScheduleComplete(v: ScheduleValue): boolean {
  return v.dayOfWeek != null && v.minAmount != null && v.minAmount > 0
}

export function ScheduleField({
  value,
  onChange,
  errorText,
  helperText,
  disabled = false,
  presets = [500_000, 1_000_000, 2_500_000],
  labels,
  className,
  ...rest
}: ScheduleFieldProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const complete = isScheduleComplete(value)

  return (
    <View accessible={false} className={cn("w-full gap-6", className)} {...rest}>
      <View className="gap-2">
        <FieldLabel disabled={disabled}>{t.dayLabel}</FieldLabel>
        <View className="flex-row gap-2" accessibilityRole="radiogroup">
          {t.days.map((d, i) => {
            const selected = value.dayOfWeek === i
            return (
              <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button"
                key={d}
                accessibilityRole="radio"
                accessibilityLabel={t.dayNames[i]}
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => onChange({ ...value, dayOfWeek: i })}
                containerClassName="flex-1"
                className={cn(
                  "h-10 items-center justify-center rounded-sm border",
                  // Radio hari belum terpilih -> outline border-control >= 3:1 (WCAG 1.4.11, audit #6)
                  selected ? "border-primary bg-primary" : "border-border-control bg-surface",
                )}
              >
                <Text variant="label" tone={selected ? "inverse" : "primary"}>
                  {d}
                </Text>
              </PressableScale>
            )
          })}
        </View>
      </View>

      <AmountInput
        label={t.amountLabel}
        value={value.minAmount ?? 0}
        onChange={(n) => onChange({ ...value, minAmount: n > 0 ? n : null })}
        presets={presets}
        disabled={disabled}
      />

      {complete ? (
        <Text variant="body" tone="secondary">
          {t.summary(t.dayNames[value.dayOfWeek as number], formatRupiah(value.minAmount as number))}
        </Text>
      ) : null}

      <FieldHelper helperText={helperText} errorText={errorText} />
    </View>
  )
}