/**
 * Kahade — <Select> trigger + <SelectOptionList> (§9.4, §10).
 *
 * Select di Kahade BUKAN dropdown melayang: per §10, pilihan dibuka di
 * Bottom Sheet. Maka komponen ini dipecah dua:
 *   1. <Select>           — field trigger yang tampil seperti <Input> (outlined,
 *                           floating label, ikon CaretDown kanan). Menampilkan
 *                           label opsi terpilih; `onPress` diserahkan ke
 *                           pemanggil untuk membuka sheet.
 *   2. <SelectOptionList> — daftar opsi (label, deskripsi, ikon Check di
 *                           kanan untuk yang terpilih) untuk ditaruh di dalam
 *                           Bottom Sheet (kelompok Overlay). Tidak bergantung
 *                           ke implementasi sheet agar bisa dipakai juga di
 *                           layar Push (§10) bila opsi sangat panjang.
 *
 * Keputusan non-obvious:
 *   - Label float ditentukan oleh `value != null`, bukan fokus — trigger tidak
 *     punya state fokus keyboard. Saat sheet terbuka (`open=true`) border jadi
 *     border-focus supaya field yang sedang diedit tetap terlihat di balik sheet.
 *   - Tinggi 56 (h-14) menyamai Input berlabel agar sejajar dalam form.
 *   - Opsi memakai role "radio" + state checked: secara semantik Select
 *     adalah pilihan tunggal.
 *   - Focus ring keyboard (web saja): trigger memakai `focusRing` luar
 *     (rounded-sm mengikuti field); baris opsi memakai `focusRingInset`
 *     karena lebar penuh di dalam sheet — ring luar akan terpotong.
 *   - `ref` diteruskan ke PressableScale (React 19: ref adalah prop biasa,
 *     tidak perlu forwardRef yang merusak generic <V>) supaya pemanggil bisa
 *     memberinya ke `BottomSheet.returnFocusRef` — fokus SR kembali ke field
 *     ini saat sheet opsi tutup (audit #3).
 */
import { CaretDown, Check } from "phosphor-react-native"
import type { ReactNode, Ref } from "react"
import { View, type ViewProps } from "react-native"

import { Divider } from "@/components/ui/divider"
import { Field, type FieldProps } from "@/components/ui/field"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRing, focusRingInset } from "@/lib/focus-ring"

export type SelectOption<V extends string = string> = {
  value: V
  label: string
  description?: string
  icon?: IconComponent
  disabled?: boolean
}

export type SelectProps<V extends string = string> = Omit<
  PressableScaleProps,
  "children" | "className"
> &
  Pick<FieldProps, "helperText" | "errorText" | "reserveHelperSpace" | "required"> & {
    label: string
    value: V | undefined
    options: readonly SelectOption<V>[]
    /** Teks saat belum ada pilihan dan label sudah float (jarang perlu) */
    placeholder?: string
    /** true saat sheet opsi sedang terbuka -> border-focus */
    open?: boolean
    disabled?: boolean
    leftIcon?: IconComponent
    className?: string
    containerClassName?: string
    /** Ref ke trigger — berikan ke `BottomSheet.returnFocusRef` (audit #3) */
    ref?: Ref<View>
  }

export function Select<V extends string = string>({
  ref,
  label,
  value,
  options,
  placeholder,
  open = false,
  disabled = false,
  required,
  helperText,
  errorText,
  reserveHelperSpace,
  leftIcon,
  className,
  containerClassName,
  ...rest
}: SelectProps<V>) {
  const selected = options.find((o) => o.value === value)
  const floated = selected != null || open
  const hasError = !!errorText

  return (
    <Field
      required={required}
      helperText={helperText}
      errorText={errorText}
      reserveHelperSpace={reserveHelperSpace}
      disabled={disabled}
      className={containerClassName}
    >
      <PressableScale
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label }}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        scaleOnPress={false}
        containerClassName={cn("w-full rounded-sm", focusRing)}
        className={cn(
          "h-14 w-full flex-row items-center rounded-sm bg-background",
          hasError
            ? "border-error border-border-error px-[15px]"
            : open
              ? "border-focus border-border-focus px-[15px]"
              : "border border-border-control px-4",
          className,
        )}
        {...rest}
      >
        {leftIcon ? (
          <View className="mr-2">
            <Icon icon={leftIcon} size="sm" tone={open ? "active" : "default"} />
          </View>
        ) : null}

        <View className="relative flex-1 justify-center self-stretch">
          {/* Label: resting di tengah, float ke garis border saat ada nilai */}
          <View
            pointerEvents="none"
            className={cn(
              "absolute left-0 items-start",
              floated ? "-top-2" : "inset-y-0 justify-center",
            )}
          >
            <View className={cn("-mx-1 px-1", floated && "bg-background")}>
              <Text
                variant={floated ? "caption" : "bodyLarge"}
                tone={hasError ? "danger" : open ? "primary" : "secondary"}
                numberOfLines={1}
              >
                {label}
                {required ? (
                  <Text variant={floated ? "caption" : "bodyLarge"} tone="danger">
                    {" *"}
                  </Text>
                ) : null}
              </Text>
            </View>
          </View>

          {floated ? (
            <Text
              variant="bodyLarge"
              tone={selected ? "primary" : "disabled"}
              numberOfLines={1}
              className="pt-3"
            >
              {selected?.label ?? placeholder ?? ""}
            </Text>
          ) : null}
        </View>

        <View className="ml-2" style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <Icon icon={CaretDown} size="sm" tone={open ? "active" : "default"} />
        </View>
      </PressableScale>
    </Field>
  )
}

// ------------------------------------------------------------------
// Option list — konten untuk Bottom Sheet
// ------------------------------------------------------------------

export type SelectOptionListProps<V extends string = string> = ViewProps & {
  options: readonly SelectOption<V>[]
  value: V | undefined
  onSelect: (value: V) => void
  /** Header opsional (mis. judul sheet) */
  header?: ReactNode
  className?: string
}

export function SelectOptionList<V extends string = string>({
  options,
  value,
  onSelect,
  header,
  className,
  ...rest
}: SelectOptionListProps<V>) {
  return (
    <View accessibilityRole="radiogroup" className={cn("w-full", className)} {...rest}>
      {header}
      {options.map((opt, i) => {
        const selected = opt.value === value
        return (
          <View key={opt.value}>
            {i > 0 ? <Divider /> : null}
            <PressableScale
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: !!opt.disabled }}
              disabled={opt.disabled}
              scaleOnPress={false}
              onPress={() => onSelect(opt.value)}
              containerClassName={cn("w-full", focusRingInset)}
              className="min-h-[56px] flex-row items-center gap-3 py-4"
            >
              {opt.icon ? <Icon icon={opt.icon} size="sm" active={selected} /> : null}
              <View className="flex-1 gap-1">
                <Text variant="body" tone="primary" weight={selected ? 600 : 400}>
                  {opt.label}
                </Text>
                {opt.description ? (
                  <Text variant="caption" tone="secondary">
                    {opt.description}
                  </Text>
                ) : null}
              </View>
              {selected ? <Icon icon={Check} size="sm" weight="bold" tone="active" /> : null}
            </PressableScale>
          </View>
        )
      })}
    </View>
  )
}
