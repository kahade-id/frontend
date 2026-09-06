/**
 * Kahade — <Divider> (§6 "Semua pemisahan visual pakai border").
 *
 * Garis pemisah 1px (tokens.borderWidth.default) tanpa shadow. Dua tone:
 *   - "default" : `bg-border` (gray.400 / #3A3A3A) — divider fungsional
 *                 antar section, item list, header/body card.
 *   - "subtle"  : gray.300 di light (§2.2 "divider sangat halus, dekoratif
 *                 murni"). Di dark mode TIDAK ada padanan gray.300 di tabel
 *                 mode, jadi jatuh ke `dark:bg-border` — pemisah lebih halus
 *                 dari border-default di dark akan hilang (kontras < 1.1:1).
 *
 * Keputusan non-obvious:
 *   - Dirender sebagai <View> dengan `h-px bg-*`, BUKAN `border-t`. Alasan:
 *     border di RN Web butuh elemen punya tinggi > 0 agar ter-render konsisten,
 *     dan `bg` lebih mudah di-override tone via `dark:`. Ketebalan 1px sama
 *     dengan tokens.borderWidth.default (h-px = 1px di Tailwind).
 *   - `label` (mis. "atau" di layar auth) dirender caption text-tertiary di
 *     antara dua garis. Untuk kasus itu Divider menjadi baris flex, bukan
 *     garis tunggal — tetap satu komponen supaya spacing seragam.
 *   - Vertical divider harus `self-stretch` di dalam flex-row agar punya
 *     tinggi; kalau parent bukan flex-row, beri className "h-*" eksplisit.
 *   - Divider dekoratif -> `accessibilityRole="none"` + importantForAccessibility
 *     "no" supaya screen reader tidak berhenti di sini. Kalau ada `label`,
 *     label itulah yang dibaca.
 */
import { View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"
import { Text } from "@/components/ui/text"

export type DividerOrientation = "horizontal" | "vertical"
export type DividerTone = "default" | "subtle"

export type DividerProps = Omit<ViewProps, "children"> & {
  orientation?: DividerOrientation
  tone?: DividerTone
  /** Teks pendek di tengah garis (hanya horizontal), mis. "atau" */
  label?: string
  /**
   * Inset kiri-kanan mengikuti screen padding (24px) — untuk divider yang
   * dipakai di dalam ScrollView full-bleed tapi konten ber-padding.
   */
  inset?: boolean
  className?: string
}

const toneClass: Record<DividerTone, string> = {
  default: "bg-border",
  // subtle: dekoratif murni (§2.2), hanya di dalam card, bukan antar section (audit #063: functional divider must be default)
  subtle: "bg-gray-300 dark:bg-border",
}

export function Divider({
  orientation = "horizontal",
  tone = "default",
  label,
  inset = false,
  className,
  ...rest
}: DividerProps) {
  if (orientation === "vertical") {
    return (
      <View accessible={false}
        accessibilityRole="none"
        importantForAccessibility="no"
        className={cn("w-px self-stretch", toneClass[tone], className)}
        {...rest}
      />
    )
  }

  if (label) {
    return (
      <View
        accessibilityRole="none"
        className={cn("flex-row items-center gap-3", inset && "mx-6", className)}
        {...rest}
      >
        <View className={cn("h-px flex-1", toneClass[tone])} />
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
        <View className={cn("h-px flex-1", toneClass[tone])} />
      </View>
    )
  }

  return (
    <View
      accessibilityRole="none"
      importantForAccessibility="no"
      // `w-full` + `mx-6` akan overflow di RN (100% + margin); saat inset cukup
      // biarkan flex-col parent me-stretch lebar (default RN), tanpa w-full.
      className={cn("h-px", inset ? "mx-6" : "w-full", toneClass[tone], className)}
      {...rest}
    />
  )
}
