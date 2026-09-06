/**
 * Kahade — <DateField> trigger tanggal (§9.2 turunan, §10, §13).
 *
 * Field pemilih tanggal yang tampil seperti <Select>: outlined, floating
 * label, ikon CalendarBlank di kanan, nilai diformat eksplisit "3 Sep 2026"
 * (§13: tidak ada relative time). Seperti Select, komponen ini HANYA trigger:
 * `onPress` dibuka pemanggil ke Bottom Sheet berisi <Calendar>. Alasannya
 * aturan stacking §9.9 — kalau DateField membuka sheet sendiri, DateField di
 * dalam sheet form akan memicu sheet-di-atas-sheet tanpa disadari. Pemanggil
 * yang tahu konteksnya (sheet vs Push) yang memutuskan.
 *
 * Keputusan non-obvious:
 *   - Nilai tanggal dirender Sofia Sans (bukan Mono): tanggal berbentuk
 *     "3 Sep 2026" adalah teks campuran, bukan angka murni (§3.1). Jika
 *     pemanggil butuh timestamp teknis Mono ("2026-09-03"), pakai prop
 *     `formatValue`.
 *   - `clearable` menampilkan X di kanan (menggantikan ikon kalender) agar
 *     tanggal opsional bisa dikosongkan tanpa membuka sheet.
 *   - Tinggi h-14 menyamai Input/Select berlabel supaya sejajar dalam form.
 */
import { CalendarBlank, X } from "phosphor-react-native"
import { Pressable, View } from "react-native"

import { Field, type FieldProps } from "@/components/ui/field"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatDate } from "@/lib/format"
import { ICON_SM_HIT_SLOP } from "@/lib/hit-slop"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type DateFieldProps = Omit<PressableScaleProps, "children" | "className"> &
  Pick<FieldProps, "helperText" | "errorText" | "reserveHelperSpace" | "required"> & {
    label: string
    value: Date | null | undefined
    /** Teks saat belum ada nilai dan label sudah float (mis. saat sheet terbuka) */
    placeholder?: string
    /** true saat sheet kalender terbuka -> border-focus */
    open?: boolean
    disabled?: boolean
    /** Tampilkan tombol X untuk mengosongkan nilai */
    clearable?: boolean
    onClear?: () => void
    /** Override format tampilan (default `formatDate` "3 Sep 2026") */
    formatValue?: (d: Date) => string
    leftIcon?: IconComponent
    className?: string
    containerClassName?: string
  }

export function DateField({
  label,
  value,
  placeholder,
  open = false,
  disabled = false,
  clearable = false,
  onClear,
  formatValue = (d) => formatDate(d),
  required,
  helperText,
  errorText,
  reserveHelperSpace,
  leftIcon,
  className,
  containerClassName,
  ...rest
}: DateFieldProps) {
  const hasValue = value != null
  const floated = hasValue || open
  const hasError = !!errorText
  const showClear = clearable && hasValue && !disabled

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
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: hasValue ? formatValue(value) : undefined }}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        scaleOnPress={false}
        containerClassName="w-full"
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
          <View accessible={false} className="mr-2">
            <Icon icon={leftIcon} size="sm" tone={open ? "active" : "default"} />
          </View>
        ) : null}

        <View className="relative flex-1 justify-center self-stretch">
          <View
            pointerEvents="none"
            className={cn(
              "absolute left-0 items-start",
              floated ? "-top-[9px]" : "inset-y-0 justify-center",
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
              tone={hasValue ? "primary" : "disabled"}
              numberOfLines={1}
              className="pt-3"
            >
              {hasValue ? formatValue(value) : placeholder ?? ""}
            </Text>
          ) : null}
        </View>

        {showClear ? (
          <Pressable
            onPress={onClear}
            hitSlop={ICON_SM_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Hapus tanggal"
            className="ml-2"
          >
            <Icon icon={X} size="sm" />
          </Pressable>
        ) : (
          <View className="ml-2">
            <Icon icon={CalendarBlank} size="sm" tone={open ? "active" : "default"} />
          </View>
        )}
      </PressableScale>
    </Field>
  )
}