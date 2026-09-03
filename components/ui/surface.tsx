/**
 * Kahade — <Surface> + <Inset> (§2.4 mode tokens, §4 padding).
 *
 * Primitif "kotak berwarna" yang lebih ringan dari Card: tanpa radius/
 * border default, hanya fill dari token mode. Dipakai untuk latar section
 * (mis. blok abu di bawah header beranda), footer sticky, area sheet.
 *
 *   - level="background" : bg-background (putih / #121212)
 *   - level="surface"    : bg-surface (abu muda / #1A1A1A)
 *   - level="elevated"   : bg-surface-elevated (putih / #212121) — dipakai
 *                          bersama `bordered` karena tanpa shadow (§6).
 *   - level="inverted"   : bg-primary (hitam / putih) — hero saldo.
 *
 * <Inset> = padding horizontal screen (24px) tanpa fill, untuk membungkus
 * konten di dalam Screen `padded={false}` (list full-bleed + judul ber-padding).
 *
 * Kenapa bukan sekadar `<View className="bg-surface">` (non-obvious): nama
 * level memaksa pemanggil memilih dari 4 layer yang ada, bukan mengarang
 * warna abu baru dengan bg-gray-*. Ini penjaga disiplin palet 3–5 warna.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"

export type SurfaceLevel = "background" | "surface" | "elevated" | "inverted"

export type SurfaceProps = ViewProps & {
  children?: ReactNode
  level?: SurfaceLevel
  /** border 1px border-default (elevated hampir selalu true) */
  bordered?: boolean
  /** radius md (8px) — hanya bila surface berdiri sebagai blok, bukan full-bleed */
  rounded?: boolean
  className?: string
}

const levelClass: Record<SurfaceLevel, string> = {
  background: "bg-background",
  surface: "bg-surface",
  elevated: "bg-surface-elevated",
  inverted: "bg-primary",
}

export function Surface({
  children,
  level = "surface",
  bordered = false,
  rounded = false,
  className,
  ...rest
}: SurfaceProps) {
  return (
    <View
      className={cn(
        levelClass[level],
        bordered && (level === "inverted" ? "border border-primary" : "border border-border"),
        rounded && "rounded-md overflow-hidden",
        className,
      )}
      {...rest}
    >
      {children}
    </View>
  )
}

export type InsetProps = ViewProps & { children?: ReactNode; className?: string }

/** Padding horizontal 24px (tokens.layout.screenPaddingX) */
export function Inset({ children, className, ...rest }: InsetProps) {
  return (
    <View className={cn("w-full px-6", className)} {...rest}>
      {children}
    </View>
  )
}
