/**
 * Kahade — <ScrollRow> baris scroll horizontal (§4 spacing, §9.25 chip).
 *
 * ScrollView horizontal untuk deretan Chip filter, kartu ringkas (stat,
 * metode pembayaran), atau avatar. Menstandarkan tiga hal yang sering salah:
 *   1. `gap` antar item dari skala spacing — bukan margin kanan per anak
 *      (yang meninggalkan margin yatim di item terakhir).
 *   2. Padding awal/akhir konten = screen padding 24px (`px-6`) agar item
 *      pertama sejajar dengan judul di atasnya, dan item terakhir tidak
 *      menempel tepi saat di-scroll habis.
 *   3. `bleed`: saat dipakai di dalam <Screen padded>, container diberi
 *      `-mx-6` supaya area scroll (dan item yang terpotong) menyentuh tepi
 *      layar — sementara padding konten menjaga alignment. Ini pola standar
 *      "edge-to-edge scroll dalam kolom ber-padding".
 *
 * Scrollbar horizontal disembunyikan (juga di web) — indikasi "masih ada
 * lagi" cukup dari item yang terpotong di tepi kanan, sesuai kesan tenang §1.
 * Tidak ada snapping default: untuk pager kartu penuh, pakai `snap` yang
 * mengaktifkan `pagingEnabled`-like via `snapToInterval` dari lebar item.
 */
import type { ReactNode } from "react"
import { ScrollView, type ScrollViewProps } from "react-native"

import type { SpaceKey } from "@/components/ui/stack"
import { cn } from "@/lib/cn"

export type ScrollRowProps = Omit<
  ScrollViewProps,
  "horizontal" | "children" | "contentContainerStyle"
> & {
  children?: ReactNode
  /** Jarak antar item (§4). Default 2 (8px) — rapat untuk chip. */
  gap?: SpaceKey
  /** Padding awal/akhir konten 24px (default true) */
  inset?: boolean
  /** -mx-6: tembus tepi saat berada di dalam Screen padded */
  bleed?: boolean
  /** Lebar item + gap untuk snapping pager kartu (px, runtime) */
  snap?: number
  /** Vertikal align item (default center) */
  align?: "start" | "center" | "end"
  contentContainerClassName?: string
  className?: string
}

const gapClass: Record<SpaceKey, string> = {
  0: "gap-0", 1: "gap-1", 2: "gap-2", 3: "gap-3", 4: "gap-4", 5: "gap-5",
  6: "gap-6", 8: "gap-8", 10: "gap-10", 12: "gap-12", 16: "gap-16",
}

const alignClass = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
} as const

export function ScrollRow({
  children,
  gap = 2,
  inset = true,
  bleed = false,
  snap,
  align = "center",
  contentContainerClassName,
  className,
  ...rest
}: ScrollRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Tap pada Chip saat keyboard terbuka langsung tereksekusi
      keyboardShouldPersistTaps="handled"
      decelerationRate={snap ? "fast" : undefined}
      snapToInterval={snap}
      snapToAlignment={snap ? "start" : undefined}
      className={cn("w-full grow-0", bleed && "-mx-6", className)}
      contentContainerClassName={cn(
        "flex-row",
        alignClass[align],
        gapClass[gap],
        inset && "px-6",
        contentContainerClassName,
      )}
      {...rest}
    >
      {children}
    </ScrollView>
  )
}
