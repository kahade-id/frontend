/**
 * Kahade — <FilterSheetContent> (§9.25 Chip + §9.9 BottomSheet filter).
 *
 * Isi sheet filter yang deklaratif: pemanggil mengirim daftar `sections`
 * (chips / rentang nominal / toggle / rating minimum) dan satu objek
 * `value`; komponen merender semua kontrol + tombol "Atur ulang".
 *
 * Dipakai oleh <FilterSheet> (overlay) tapi juga bisa ditaruh di layar
 * penuh (web ≥768px filter samping). Tidak mengelola state sendiri —
 * pola controlled seperti komponen form lain di sistem ini.
 *
 * Keputusan non-obvious:
 *   - `value` bertipe Record<string, unknown> supaya satu komponen melayani
 *     filter order (status, role), discover user (rating, KYC), riwayat
 *     wallet (tipe, rentang) tanpa generic yang rumit. Helper
 *     `countActiveFilters` dipakai untuk badge angka di trigger.
 *   - Section "rating" memakai <Rating> monokrom (§9.26), bukan chip "4+",
 *     karena skala bintang lebih cepat dipindai daripada teks.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Button } from "@/components/ui/button"
import { ChipGroup, type ChipOption } from "@/components/ui/chip"
import { CurrencyRangeField, type CurrencyRange } from "@/components/ui/currency-range-field"
import { Rating } from "@/components/ui/rating"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type FilterSectionBase = { key: string; title: string; description?: string }

export type FilterSection =
  | (FilterSectionBase & { type: "chips"; options: readonly ChipOption[]; single?: boolean })
  | (FilterSectionBase & { type: "range"; bounds?: { min: number; max: number; step?: number } })
  | (FilterSectionBase & { type: "toggle"; label: string })
  | (FilterSectionBase & { type: "rating"; max?: number })
  | (FilterSectionBase & { type: "custom"; render: (value: unknown, set: (v: unknown) => void) => ReactNode })

export type FilterValues = Record<string, unknown>

export type FilterSheetContentLabels = { reset: string }
const DEFAULT_LABELS: FilterSheetContentLabels = { reset: "Atur ulang" }

export type FilterSheetContentProps = Omit<ViewProps, "children"> & {
  sections: readonly FilterSection[]
  value: FilterValues
  onChange: (next: FilterValues) => void
  /** Nilai awal saat "Atur ulang" — default kosong */
  defaultValue?: FilterValues
  disabled?: boolean
  labels?: Partial<FilterSheetContentLabels>
  className?: string
}

function isEmptyValue(v: unknown): boolean {
  if (v == null || v === false || v === 0 || v === "") return true
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === "object") {
    const r = v as Partial<CurrencyRange>
    return (r.min == null || r.min === 0) && r.max == null
  }
  return false
}

/** Jumlah section yang punya nilai aktif — untuk badge di tombol Filter */
export function countActiveFilters(value: FilterValues, defaultValue: FilterValues = {}): number {
  return Object.entries(value).filter(([k, v]) => !isEmptyValue(v) && JSON.stringify(v) !== JSON.stringify(defaultValue[k])).length
}

export function FilterSheetContent({
  sections,
  value,
  onChange,
  defaultValue = {},
  disabled = false,
  labels,
  className,
  ...rest
}: FilterSheetContentProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v })
  const active = countActiveFilters(value, defaultValue)

  return (
    <View accessible={false} className={cn("w-full gap-8", className)} {...rest}>
      {sections.map((s) => (
        <View key={s.key} className="gap-3">
          <View className="gap-1">
            <Text variant="label" tone="secondary">
              {s.title}
            </Text>
            {s.description ? (
              <Text variant="caption" tone="secondary">
                {s.description}
              </Text>
            ) : null}
          </View>

          {s.type === "chips" ? (
            <ChipGroup
              options={s.options}
              value={(value[s.key] as string[] | undefined) ?? []}
              onChange={(next) => set(s.key, next)}
              single={s.single}
              disabled={disabled}
            />
          ) : null}

          {s.type === "range" ? (
            <CurrencyRangeField
              label={null}
              bounds={s.bounds}
              value={(value[s.key] as CurrencyRange | undefined) ?? { min: null, max: null }}
              onChange={(next) => set(s.key, next)}
              disabled={disabled}
            />
          ) : null}

          {s.type === "toggle" ? (
            <Switch
              label={s.label}
              value={!!value[s.key]}
              onChange={(next) => set(s.key, next)}
              disabled={disabled}
            />
          ) : null}

          {s.type === "rating" ? (
            <Rating
              value={(value[s.key] as number | undefined) ?? 0}
              onChange={(next) => set(s.key, next)}
              max={s.max}
              size="md"
              allowClear
              disabled={disabled}
            />
          ) : null}

          {s.type === "custom" ? s.render(value[s.key], (v) => set(s.key, v)) : null}
        </View>
      ))}

      <Button variant="ghost" size="sm" disabled={disabled || active === 0} onPress={() => onChange({ ...defaultValue })}>
        {t.reset}
      </Button>
    </View>
  )
}