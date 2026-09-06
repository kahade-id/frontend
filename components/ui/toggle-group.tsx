/**
 * Kahade — <ToggleGroup> (§9.16 pelengkap Segmented Control / Chip).
 *
 * Sekumpulan tombol outline yang bisa di-toggle, single atau multi select.
 * Beda dari <SegmentedControl> (satu blok bersambung untuk switch tampilan)
 * dan <ChipGroup> (pill filter): ToggleGroup adalah tombol persegi terpisah
 * untuk memilih NILAI form (mis. metode pengiriman, durasi langganan, ukuran)
 * — tampil sejajar 2–4 kolom, boleh dengan ikon & sub-label.
 *
 * Keputusan non-obvious:
 *   - Selected = border-focus + bg-surface (bukan fill primary seperti Chip):
 *     tombol ini mewakili opsi form, harus tetap "tenang" saat berdampingan
 *     dengan CTA primary di footer. Belum terpilih = `border-border-control`
 *     (bukan `border-border`): tombol tanpa fill hanya dikenali dari
 *     outline-nya, jadi wajib >= 3:1 (WCAG 1.4.11, audit #6).
 *   - `columns` mengatur grid via flex-basis persen — bukan CSS grid, karena
 *     RN tidak punya grid; nilai basis dihitung dari kolom + gap.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { tokens } from "@/lib/tokens"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type ToggleOption<V extends string = string> = {
  value: V
  label: string
  /** Baris kecil di bawah label (mis. "Rp5.000", "1–2 hari") */
  hint?: string
  icon?: IconComponent
  disabled?: boolean
}

type Base<V extends string> = Omit<ViewProps, "children"> & {
  options: readonly ToggleOption<V>[]
  columns?: 2 | 3 | 4
  disabled?: boolean
  /** Ratakan tinggi & center konten (default true) */
  centered?: boolean
  className?: string
}

export type ToggleGroupProps<V extends string = string> =
  | (Base<V> & { multiple?: false; value: V | undefined; onChange: (value: V) => void })
  | (Base<V> & { multiple: true; value: readonly V[]; onChange: (value: V[]) => void })

export function ToggleGroup<V extends string = string>(props: ToggleGroupProps<V>) {
  const { options, columns = 2, disabled = false, centered = true, className, ...rest } = props
  const gap = tokens.space[2]

  const isSelected = (v: V) => (props.multiple ? props.value.includes(v) : props.value === v)

  const toggle = (v: V) => {
    if (props.multiple) {
      const cur = props.value
      props.onChange(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v])
    } else {
      props.onChange(v)
    }
  }

  // flex-basis: (100% - gap*(cols-1)) / cols — dihitung sebagai persen minus px
  // tidak bisa di RN, jadi dipakai margin negatif pada wrapper + padding item.
  const basis = `${100 / columns}%` as const

  return (
    <View accessible={false}
      accessibilityRole={props.multiple ? undefined : "radiogroup"}
      className={cn("w-full flex-row flex-wrap", className)}
      style={{ marginHorizontal: -gap / 2, marginVertical: -gap / 2 }}
      {...rest}
    >
      {options.map((o) => {
        const selected = isSelected(o.value)
        const off = disabled || o.disabled
        return (
          <View key={o.value} style={{ flexBasis: basis, padding: gap / 2 }}>
            <PressableScale accessibilityHint="Ketuk untuk berinteraksi" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button"
              accessibilityRole={props.multiple ? "checkbox" : "radio"}
              accessibilityState={{ selected, checked: selected, disabled: !!off }}
              accessibilityLabel={o.hint ? `${o.label}, ${o.hint}` : o.label}
              disabled={off}
              onPress={() => toggle(o.value)}
              containerClassName={cn("rounded-sm", focusRing, off && "opacity-disabled")}
              className={cn(
                "min-h-12 justify-center gap-1 rounded-sm px-3 py-3",
                centered ? "items-center" : "items-start",
                selected ? "border-focus border-border-focus bg-surface" : "border border-border-control bg-background",
              )}
            >
              {o.icon ? <Icon icon={o.icon} size="sm" active={selected} /> : null}
              <Text ellipsizeMode="tail" variant="body" weight={selected ? 600 : 500} tone="primary" numberOfLines={1} className={cn(centered && "text-center")}>
                {o.label}
              </Text>
              {o.hint ? (
                <Text variant="caption" tone="secondary" numberOfLines={1} className={cn(centered && "text-center")}>
                  {o.hint}
                </Text>
              ) : null}
            </PressableScale>
          </View>
        )
      })}
    </View>
  )
}

/** Baris label + ToggleGroup — untuk dipakai langsung di form */
export function ToggleGroupField({
  label,
  helper,
  children,
}: {
  label: string
  helper?: string
  children: ReactNode
}) {
  return (
    <View className="w-full gap-2">
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      {children}
      {helper ? (
        <Text variant="caption" tone="secondary">
          {helper}
        </Text>
      ) : null}
    </View>
  )
}