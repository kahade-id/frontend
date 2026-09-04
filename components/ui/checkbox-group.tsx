/**
 * Kahade — <CheckboxGroup> + <CheckboxGroupItem> (§9.5, padanan RadioGroup).
 *
 * Multi-select dengan Context: tiap item hanya butuh `value`, bukan
 * `checked` + `onChange` masing-masing — API sejajar dengan <RadioGroup>
 * supaya dua grup ini bisa saling ditukar tanpa mengubah struktur JSX.
 * Nilai generik `V extends string` agar cocok dengan enum domain (jenis
 * dokumen KYC, syarat yang disetujui, kategori laporan).
 *
 * Varian:
 *   - "plain" (default): baris kotak + label, tanpa border, gap 0 (tiap baris
 *                        sudah min-h 44 + py-3 dari <Checkbox>).
 *   - "card"           : tiap opsi dibungkus border-control rounded-md bg-surface
 *                        (kartu ini adalah kontrol yang bisa dipilih, jadi
 *                        outline-nya wajib >= 3:1 — WCAG 1.4.11, audit #6);
 *                        terpilih -> border-focus. Hierarki dari border (§6),
 *                        kotak dipindah ke KANAN seperti Radio card agar
 *                        leading icon/konten di kiri sejajar.
 *
 * Keputusan non-obvious:
 *   - Varian plain mendelegasikan ke <Checkbox> (satu sumber kebenaran untuk
 *     visual kotak + hit area). Varian card TIDAK bisa memakai <Checkbox>
 *     karena kartunya sendiri Pressable — Pressable bersarang membuat sentuhan
 *     di Android/web tidak konsisten. Karena itu card merender
 *     <CheckboxIndicator> (kotak polos dari checkbox.tsx) di dalam
 *     PressableScale miliknya sendiri.
 *   - `max`: saat jumlah terpilih mencapai batas, item yang BELUM terpilih
 *     ikut disabled (opacity 40%) — user langsung melihat kenapa tidak bisa
 *     menambah, tanpa helper text tambahan.
 *   - `error` hanya mengubah border kotak/kartu; pesan error ditulis pemanggil
 *     lewat <Field errorText> yang membungkus grup (konsisten dengan Checkbox).
 */
import { createContext, useContext, type ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Checkbox, CheckboxIndicator } from "@/components/ui/checkbox"
import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type CheckboxGroupVariant = "plain" | "card"

type CheckboxGroupContextValue = {
  values: readonly string[]
  toggle: (v: string) => void
  disabled: boolean
  error: boolean
  variant: CheckboxGroupVariant
  /** true bila `max` tercapai — item yang belum terpilih dikunci */
  full: boolean
}

const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(null)

export type CheckboxGroupProps<V extends string = string> = Omit<ViewProps, "children"> & {
  value: readonly V[]
  onChange: (next: V[]) => void
  /** Batas maksimum item terpilih */
  max?: number
  disabled?: boolean
  error?: boolean
  variant?: CheckboxGroupVariant
  children: ReactNode
  className?: string
}

export function CheckboxGroup<V extends string = string>({
  value,
  onChange,
  max,
  disabled = false,
  error = false,
  variant = "plain",
  children,
  className,
  ...rest
}: CheckboxGroupProps<V>) {
  const toggle = (v: string) => {
    const has = value.includes(v as V)
    if (has) return onChange(value.filter((x) => x !== v))
    if (max != null && value.length >= max) return
    onChange([...value, v as V])
  }

  const full = max != null && value.length >= max

  return (
    <CheckboxGroupContext.Provider value={{ values: value, toggle, disabled, error, variant, full }}>
      <View
        // RN tidak punya role "group" khusus checkbox; "list" memberi konteks
        // "daftar N item" ke screen reader tanpa menyalahi semantik.
        accessibilityRole="list"
        className={cn("w-full", variant === "card" ? "gap-3" : "gap-0", className)}
        {...rest}
      >
        {children}
      </View>
    </CheckboxGroupContext.Provider>
  )
}

export type CheckboxGroupItemProps = Omit<PressableScaleProps, "children" | "onPress"> & {
  value: string
  label: ReactNode
  description?: ReactNode
  /** Slot kiri opsional (mis. <Icon> / <IconBox>) untuk varian card */
  leading?: ReactNode
  disabled?: boolean
  className?: string
}

export function CheckboxGroupItem({
  value,
  label,
  description,
  leading,
  disabled: ownDisabled = false,
  className,
  ...rest
}: CheckboxGroupItemProps) {
  const ctx = useContext(CheckboxGroupContext)
  if (!ctx) throw new Error("<CheckboxGroupItem> harus berada di dalam <CheckboxGroup>")

  const checked = ctx.values.includes(value)
  // Item yang belum terpilih dikunci saat max tercapai; yang sudah terpilih
  // tetap bisa di-uncheck.
  const disabled = ctx.disabled || ownDisabled || (ctx.full && !checked)

  if (ctx.variant === "plain") {
    return (
      <Checkbox
        checked={checked}
        onChange={() => ctx.toggle(value)}
        label={label}
        description={description}
        error={ctx.error}
        disabled={disabled}
        className={className}
        {...rest}
      />
    )
  }

  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => ctx.toggle(value)}
      containerClassName="w-full"
      className={cn(
        "flex-row items-start gap-3 rounded-md bg-surface p-5",
        ctx.error
          ? "border-error border-border-error"
          : checked
            ? "border-focus border-border-focus"
            : "border border-border-control",
        className,
      )}
      {...rest}
    >
      {leading ? <View className="mt-[1px]">{leading}</View> : null}

      <View className="flex-1 gap-1">
        {typeof label === "string" ? (
          <Text variant="body" tone="primary" weight={600}>
            {label}
          </Text>
        ) : (
          label
        )}
        {description != null ? (
          typeof description === "string" ? (
            <Text variant="caption" tone="secondary">
              {description}
            </Text>
          ) : (
            description
          )
        ) : null}
      </View>

      <CheckboxIndicator checked={checked} error={ctx.error} />
    </PressableScale>
  )
}
