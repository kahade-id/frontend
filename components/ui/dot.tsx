/**
 * Kahade — <Dot> indikator titik (§5 radius.full, §2.3 semantic).
 *
 * Titik bulat kecil yang dipakai berulang di sistem: status di depan teks
 * (mis. "● Dana ditahan"), indikator halaman carousel, marker timeline,
 * badge "ada yang baru" di tab bar (§9.14 — dot merah tanpa angka).
 *
 * Ukuran dari skala spacing (§4) agar sejajar dengan grid 4px:
 *   sm = 4px (space.1), md = 8px (space.2, default), lg = 12px (space.3).
 * Badge internal memakai 6px sendiri; Dot sengaja tidak menyediakan nilai
 * di luar skala supaya komponen baru tidak menambah ukuran ad-hoc.
 *
 * `ring`: border warna `background` selebar border-focus (1.5px) — dipakai
 * saat dot ditumpuk di atas ikon/avatar agar terpisah dari latar tanpa
 * shadow (§6). `active` menandai item terpilih di pager: fill primary,
 * selain itu border-default (pola sama dengan Rating §9.26 filled/unfilled).
 */
import { View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"

export type DotSize = "sm" | "md" | "lg"
export type DotTone =
  | "neutral" // text-tertiary — inactive/pager
  | "primary"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "disabled"
  | "outline" // transparan + border-default — pager unselected

export type DotProps = Omit<ViewProps, "children"> & {
  size?: DotSize
  tone?: DotTone
  /** Ring warna background 1.5px agar terpisah dari elemen di bawahnya */
  ring?: boolean
  className?: string
}

const sizeClass: Record<DotSize, string> = {
  sm: "h-1 w-1",
  md: "h-2 w-2",
  lg: "h-3 w-3",
}

const toneClass: Record<DotTone, string> = {
  neutral: "bg-text-tertiary",
  primary: "bg-primary",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  disabled: "bg-text-disabled",
  outline: "bg-transparent border border-border",
}

export function Dot({ size = "md", tone = "neutral", ring = false, className, ...rest }: DotProps) {
  return (
    <View accessible={false}
      // Dekoratif: makna status harus disampaikan teks di sampingnya
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn(
        "rounded-full",
        sizeClass[size],
        toneClass[tone],
        ring && "border-focus border-background",
        className,
      )}
      {...rest}
    />
  )
}
