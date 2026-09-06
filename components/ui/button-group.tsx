/**
 * Kahade — <ButtonGroup> (§9.1 pendukung, §4 spacing).
 *
 * Menyusun 2–3 <Button>/<IconButton> dalam satu baris (atau kolom) dengan
 * gap seragam. Kasus utama: pasangan CTA di footer Screen —
 * "Batal" (secondary) di kiri + "Lanjutkan" (primary) di kanan — dan kolom
 * aksi di layar konfirmasi/empty state.
 *
 * Keputusan non-obvious:
 *   - direction="row": tiap anak dibungkus <View accessible={false} className="flex-1"> agar
 *     lebar SAMA rata. Button sendiri default `fullWidth` (w-full) sehingga
 *     mengisi pembungkusnya. Tanpa pembungkus, dua Button w-full dalam
 *     flex-row akan overflow. `equal={false}` mematikan pembungkus untuk
 *     kombinasi IconButton + Button (ikon tetap kotak, Button mengisi sisa).
 *   - Gap default 3 (12px) — sama dengan gap antar card (§4), cukup rapat
 *     untuk terbaca sebagai satu grup aksi tanpa menyatu.
 *   - Urutan hierarki (secondary kiri, primary kanan) TIDAK dipaksa di sini
 *     — diserahkan ke pemanggil supaya komponen tetap netral untuk pola lain
 *     (mis. destructive di kiri pada dialog).
 */
import { Children, type ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import type { SpaceKey } from "@/components/ui/stack"
import { cn } from "@/lib/cn"

export type ButtonGroupProps = Omit<ViewProps, "children"> & {
  children: ReactNode
  direction?: "row" | "column"
  /** Key skala spacing (§4). Default 3 (12px). */
  gap?: Extract<SpaceKey, 2 | 3 | 4>
  /** Row: paksa lebar anak sama rata (default true) */
  equal?: boolean
  className?: string
}

const gapClass: Record<2 | 3 | 4, string> = {
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
}

export function ButtonGroup({
  children,
  direction = "row",
  gap = 3,
  equal = true,
  className,
  ...rest
}: ButtonGroupProps) {
  const isRow = direction === "row"

  return (
    <View
      accessibilityRole="none"
      className={cn("w-full", isRow ? "flex-row items-center" : "flex-col", gapClass[gap], className)}
      {...rest}
    >
      {isRow && equal
        ? Children.map(children, (child, i) =>
            child != null && child !== false ? (
              <View key={i} className="flex-1">
                {child}
              </View>
            ) : null,
          )
        : children}
    </View>
  )
}
