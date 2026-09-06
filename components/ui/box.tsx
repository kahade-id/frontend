/**
 * Kahade — <Box> primitif kotak ber-token (§4 spacing, §5 radius, §6 border).
 *
 * `View` dengan prop yang HANYA menerima nilai token: padding dari skala
 * `space`, radius dari `radius`, fill dari mode tokens, border dari 3 role
 * (§6.1). Tujuannya bukan mengganti `<View className>`, tapi memberi jalan
 * cepat yang mustahil melanggar sistem — `p={5}` pasti 20px, `rounded="md"`
 * pasti 8px (maksimum non-pill), dan tidak ada prop untuk shadow.
 *
 * Kenapa tabel class literal, bukan `p-${n}` (non-obvious): Tailwind content
 * scanner tidak melihat string yang disusun saat runtime. Setiap kombinasi
 * ditulis eksplisit; `Record<SpaceKey, string>` memaksa tabel ikut lengkap
 * bila `space` di tokens.ts bertambah (compile error, bukan class hilang).
 *
 * Perbedaan dengan Surface/Card: Surface = fill tanpa geometri, Card = kontrak
 * visual kartu (radius md + border + padding 20). Box = bebas dikombinasi,
 * untuk layout internal komponen lain.
 */
import { forwardRef, type ReactNode } from "react"
import { View, type View as RNView, type ViewProps } from "react-native"

import type { SpaceKey } from "@/components/ui/stack"
import { cn } from "@/lib/cn"
import type { radius } from "@/lib/tokens"

export type BoxRadius = keyof typeof radius
export type BoxBg =
  | "transparent"
  | "background"
  | "surface"
  | "elevated"
  | "inverted" // bg-primary — teks di dalamnya harus tone "inverse"
  | "success" // fill bgSoft semantik — hanya untuk status transaksi (§2.3)
  | "danger"
  | "warning"
  | "info"
export type BoxBorder = boolean | "default" | "focus" | "error"

export type BoxProps = Omit<ViewProps, "children"> & {
  children?: ReactNode
  p?: SpaceKey
  px?: SpaceKey
  py?: SpaceKey
  pt?: SpaceKey
  pb?: SpaceKey
  pl?: SpaceKey
  pr?: SpaceKey
  bg?: BoxBg
  rounded?: BoxRadius
  /** true = border-default 1px; "focus"/"error" = 1.5px sesuai role §6.1 */
  border?: BoxBorder
  /** flex-row (default flex-col mengikuti RN) */
  row?: boolean
  /** flex-1 */
  flex?: boolean
  /** overflow-hidden — perlu saat anak (Image) harus mengikuti radius */
  clip?: boolean
  className?: string
}

const pClass: Record<SpaceKey, string> = {
  0: "p-0", 1: "p-1", 2: "p-2", 3: "p-3", 4: "p-4", 5: "p-5",
  6: "p-6", 8: "p-8", 10: "p-10", 12: "p-12", 16: "p-16",
}
const pxClass: Record<SpaceKey, string> = {
  0: "px-0", 1: "px-1", 2: "px-2", 3: "px-3", 4: "px-4", 5: "px-5",
  6: "px-6", 8: "px-8", 10: "px-10", 12: "px-12", 16: "px-16",
}
const pyClass: Record<SpaceKey, string> = {
  0: "py-0", 1: "py-1", 2: "py-2", 3: "py-3", 4: "py-4", 5: "py-5",
  6: "py-6", 8: "py-8", 10: "py-10", 12: "py-12", 16: "py-16",
}
const ptClass: Record<SpaceKey, string> = {
  0: "pt-0", 1: "pt-1", 2: "pt-2", 3: "pt-3", 4: "pt-4", 5: "pt-5",
  6: "pt-6", 8: "pt-8", 10: "pt-10", 12: "pt-12", 16: "pt-16",
}
const pbClass: Record<SpaceKey, string> = {
  0: "pb-0", 1: "pb-1", 2: "pb-2", 3: "pb-3", 4: "pb-4", 5: "pb-5",
  6: "pb-6", 8: "pb-8", 10: "pb-10", 12: "pb-12", 16: "pb-16",
}
const plClass: Record<SpaceKey, string> = {
  0: "pl-0", 1: "pl-1", 2: "pl-2", 3: "pl-3", 4: "pl-4", 5: "pl-5",
  6: "pl-6", 8: "pl-8", 10: "pl-10", 12: "pl-12", 16: "pl-16",
}
const prClass: Record<SpaceKey, string> = {
  0: "pr-0", 1: "pr-1", 2: "pr-2", 3: "pr-3", 4: "pr-4", 5: "pr-5",
  6: "pr-6", 8: "pr-8", 10: "pr-10", 12: "pr-12", 16: "pr-16",
}

const bgClass: Record<BoxBg, string> = {
  transparent: "bg-transparent",
  background: "bg-background",
  surface: "bg-surface",
  elevated: "bg-surface-elevated",
  inverted: "bg-primary",
  success: "bg-success-soft",
  danger: "bg-danger-soft",
  warning: "bg-warning-soft",
  info: "bg-info-soft",
}

const roundedClass: Record<BoxRadius, string> = {
  none: "rounded-none",
  xs: "rounded-xs",
  sm: "rounded-sm",
  md: "rounded-md",
  full: "rounded-full",
}

function borderClass(border: BoxBorder | undefined) {
  if (!border) return null
  if (border === "focus") return "border-focus border-border-focus"
  if (border === "error") return "border-error border-border-error"
  return "border border-border"
}

export const Box = forwardRef<RNView, BoxProps>(function Box(
  { children, p, px, py, pt, pb, pl, pr, bg, rounded, border, row, flex, clip, className, ...rest },
  ref,
) {
  return (
    <View accessible={false}
      ref={ref}
      className={cn(
        row && "flex-row",
        flex && "flex-1",
        clip && "overflow-hidden",
        p != null && pClass[p],
        px != null && pxClass[px],
        py != null && pyClass[py],
        pt != null && ptClass[pt],
        pb != null && pbClass[pb],
        pl != null && plClass[pl],
        pr != null && prClass[pr],
        bg && bgClass[bg],
        rounded && roundedClass[rounded],
        borderClass(border),
        className,
      )}
      {...rest}
    >
      {children}
    </View>
  )
})
