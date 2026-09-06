/**
 * Kahade — <CurrencyRangeField> (§9.2 AmountInput ×2 + RangeSlider).
 *
 * Rentang nominal Rupiah "dari – sampai": dua <AmountInput> sejajar (Mono,
 * §3.1) dengan slider di bawahnya bila `min`/`max` batas diketahui. Dipakai
 * di filter riwayat transaksi, batas harga showcase, limit penarikan.
 *
 * Keputusan non-obvious:
 *   - Nilai `null` berarti "tanpa batas" untuk sisi itu — jangan dipaksa ke 0
 *     atau max, supaya filter "≥ Rp1jt" bisa diekspresikan.
 *   - Slider hanya muncul kalau `bounds` ada; tanpa bounds slider tidak punya
 *     skala yang jujur. Slider dan input saling sinkron; input yang melampaui
 *     bounds tetap diterima (slider clamp secara visual saja).
 *   - Error "minimum > maksimum" dideteksi lokal dan ditampilkan sekali di
 *     bawah baris (bukan di dua field) agar tidak dobel.
 */
import { View, type ViewProps } from "react-native"

import { AmountInput } from "@/components/ui/amount-input"
import { FieldHelper, FieldLabel } from "@/components/ui/field"
import { RangeSlider } from "@/components/ui/range-slider"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatRupiah } from "@/lib/format"

export type CurrencyRange = { min: number | null; max: number | null }

export type CurrencyRangeFieldLabels = { label: string; from: string; to: string; invalid: string }
const DEFAULT_LABELS: CurrencyRangeFieldLabels = {
  label: "Rentang nominal",
  from: "Minimum",
  to: "Maksimum",
  invalid: "Minimum tidak boleh lebih besar dari maksimum",
}

export type CurrencyRangeFieldProps = Omit<ViewProps, "children"> & {
  value: CurrencyRange
  onChange: (value: CurrencyRange) => void
  /** Batas skala slider; tanpa ini slider tidak ditampilkan */
  bounds?: { min: number; max: number; step?: number }
  label?: string | null
  helperText?: string
  errorText?: string
  disabled?: boolean
  labels?: Partial<CurrencyRangeFieldLabels>
  className?: string
}

export function CurrencyRangeField({
  value,
  onChange,
  bounds,
  label,
  helperText,
  errorText,
  disabled = false,
  labels,
  className,
  ...rest
}: CurrencyRangeFieldProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const invalid = value.min != null && value.max != null && value.min > value.max
  const error = errorText ?? (invalid ? t.invalid : undefined)

  const sliderValue: [number, number] | null = bounds
    ? [
        Math.min(Math.max(value.min ?? bounds.min, bounds.min), bounds.max),
        Math.min(Math.max(value.max ?? bounds.max, bounds.min), bounds.max),
      ]
    : null

  return (
    <View accessible={false} className={cn("w-full gap-3", className)} {...rest}>
      {label !== null ? <FieldLabel disabled={disabled}>{label ?? t.label}</FieldLabel> : null}

      <View className="flex-row items-start gap-3 tabular-nums">
        <View className="flex-1">
          <AmountInput
            label={t.from}
            value={value.min ?? 0}
            onChange={(n) => onChange({ ...value, min: n > 0 ? n : null })}
            disabled={disabled}
            reserveHelperSpace={false}
          />
        </View>
        <View className="h-14 justify-center">
          <Text accessibilityHint="Ketuk untuk detail" variant="body" tone="secondary">
            –
          </Text>
        </View>
        <View className="flex-1">
          <AmountInput
            label={t.to}
            value={value.max ?? 0}
            onChange={(n) => onChange({ ...value, max: n > 0 ? n : null })}
            disabled={disabled}
            reserveHelperSpace={false}
          />
        </View>
      </View>

      {bounds && sliderValue ? (
        <RangeSlider
          value={sliderValue}
          min={bounds.min}
          max={bounds.max}
          step={bounds.step ?? 50_000}
          disabled={disabled}
          formatValue={(v) => formatRupiah(v, { compact: true })}
          accessibilityLabels={[t.from, t.to]}
          onChange={([lo, hi]) => onChange({ min: lo <= bounds.min ? null : lo, max: hi >= bounds.max ? null : hi })}
        />
      ) : null}

      <FieldHelper helperText={helperText} errorText={error} reserveSpace={false} />
    </View>
  )
}
