/**
 * Kahade — <ZStack> + <Layer> (§4 layout, §6 tanpa shadow).
 *
 * Penumpukan absolut yang eksplisit: <ZStack> adalah kotak `relative`,
 * setiap <Layer> di dalamnya `absolute` pada posisi bernama. Dipakai untuk:
 *   - badge/status dot di sudut Avatar atau Picture
 *   - overlay loading (Spinner) di atas Card saat refresh
 *   - tombol "hapus" di sudut thumbnail bukti transfer
 *
 * Kenapa komponen terpisah, bukan `absolute top-0 right-0` di tempat pakai
 * (non-obvious): aturan layout kita menyebut absolute positioning hanya bila
 * benar-benar perlu. Dengan membatasinya ke <Layer position="…">, setiap
 * pemakaian absolute jadi terlihat & seragam, dan `pointerEvents` default
 * "box-none" mencegah layer dekoratif menelan sentuhan ke konten di bawah.
 *
 * Anak pertama ZStack (non-Layer) yang menentukan ukuran kotak. Kalau tidak
 * ada konten dasar, beri ukuran lewat className (mis. `w-12 h-12`).
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"

export type ZStackProps = Omit<ViewProps, "children"> & {
  children?: ReactNode
  className?: string
}

export function ZStack({ children, className, ...rest }: ZStackProps) {
  return (
    <View className={cn("relative", className)} {...rest}>
      {children}
    </View>
  )
}

export type LayerPosition =
  | "fill"
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"

export type LayerProps = Omit<ViewProps, "children"> & {
  children?: ReactNode
  position?: LayerPosition
  /**
   * "box-none" (default): layer tembus sentuhan, hanya anaknya yang interaktif.
   * "auto": layer menangkap sentuhan (mis. overlay loading yang memblokir tap).
   * "none": dekoratif murni.
   */
  pointerEvents?: "box-none" | "auto" | "none"
  className?: string
}

// Class literal per posisi agar ter-scan Tailwind (bukan template string).
const positionClass: Record<LayerPosition, string> = {
  fill: "absolute inset-0",
  center: "absolute inset-0 items-center justify-center",
  top: "absolute top-0 left-0 right-0",
  bottom: "absolute bottom-0 left-0 right-0",
  left: "absolute top-0 bottom-0 left-0",
  right: "absolute top-0 bottom-0 right-0",
  "top-left": "absolute top-0 left-0",
  "top-right": "absolute top-0 right-0",
  "bottom-left": "absolute bottom-0 left-0",
  "bottom-right": "absolute bottom-0 right-0",
}

export function Layer({
  children,
  position = "fill",
  pointerEvents = "box-none",
  className,
  ...rest
}: LayerProps) {
  return (
    <View
      pointerEvents={pointerEvents}
      className={cn(positionClass[position], className)}
      {...rest}
    >
      {children}
    </View>
  )
}
