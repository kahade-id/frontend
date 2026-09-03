/**
 * Kahade — <Grid> + <GridItem> (§11 "Grid multi-elemen 12 kolom").
 *
 * Grid 12 kolom formal untuk dashboard (stat card sejajar, ringkasan).
 * RN tidak punya CSS Grid, jadi diimplementasikan sebagai flex-row wrap
 * dengan lebar per item = span/12 dari lebar container, dikurangi gap.
 *
 * Kenapa memakai `onLayout` + style width, bukan class `w-1/2` (non-obvious):
 *   Class fraksi Tailwind tidak bisa memperhitungkan `gap` — item 50% + gap
 *   16px akan wrap ke baris berikutnya. Menghitung px dari lebar container
 *   satu-satunya cara yang akurat di iOS/Android/web sekaligus. Ini masuk
 *   pengecualian "tidak bisa di-className" (nilai runtime).
 *
 * `span` boleh berbeda per breakpoint: `span={12} spanMd={6}` — di atas
 * 768px (tokens.layout.breakpoint) memakai spanMd. Karena konten web di-cap
 * 520px (§11), umumnya span sama di semua ukuran; prop ini disediakan
 * untuk tablet ke depan.
 */
import { createContext, useContext, useState, type ReactNode } from "react"
import { View, useWindowDimensions, type LayoutChangeEvent, type ViewProps } from "react-native"

import type { SpaceKey } from "@/components/ui/stack"
import { cn } from "@/lib/cn"
import { space, tokens } from "@/lib/tokens"

type GridCtx = { width: number; gapPx: number; columns: number }
const GridContext = createContext<GridCtx>({ width: 0, gapPx: 0, columns: 12 })

export type GridProps = Omit<ViewProps, "children"> & {
  children: ReactNode
  /** Gap antar item (baris & kolom), key skala spacing. Default 3 (12px). */
  gap?: SpaceKey
  columns?: number
  className?: string
}

const gapClass: Record<SpaceKey, string> = {
  0: "gap-0", 1: "gap-1", 2: "gap-2", 3: "gap-3", 4: "gap-4", 5: "gap-5",
  6: "gap-6", 8: "gap-8", 10: "gap-10", 12: "gap-12", 16: "gap-16",
}

export function Grid({ children, gap = 3, columns = tokens.layout.gridColumns, className, ...rest }: GridProps) {
  const [width, setWidth] = useState(0)
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  return (
    <GridContext.Provider value={{ width, gapPx: space[gap], columns }}>
      <View onLayout={onLayout} className={cn("w-full flex-row flex-wrap", gapClass[gap], className)} {...rest}>
        {width > 0 ? children : null}
      </View>
    </GridContext.Provider>
  )
}

export type GridItemProps = ViewProps & {
  /** Jumlah kolom (1..12). Default 6 = setengah. */
  span?: number
  /** Span di >= 768px */
  spanMd?: number
  className?: string
}

export function GridItem({ span = 6, spanMd, className, style, ...rest }: GridItemProps) {
  const { width, gapPx, columns } = useContext(GridContext)
  const { width: screenW } = useWindowDimensions()
  const effective = Math.min(columns, Math.max(1, spanMd != null && screenW >= tokens.layout.breakpoint ? spanMd : span))
  // Lebar kolom tunggal = (W - gap*(cols-1)) / cols; item = n kolom + (n-1) gap
  const col = (width - gapPx * (columns - 1)) / columns
  const itemW = col * effective + gapPx * (effective - 1)

  return <View className={className} style={[{ width: Math.floor(itemW) }, style]} {...rest} />
}
