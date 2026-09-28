/**
 * Kahade — drag-reorder generik untuk daftar/grid media (C09, batch 139).
 *
 * Pola "drop-to-commit": tahan lama (long-press) lalu seret — sel yang
 * diseret mengikuti jari (UI thread, Reanimated), sel target ditandai, dan
 * urutan data baru dikomit SEKALI saat jari diangkat. Tidak ada reorder
 * live di tengah gesture sehingga view tidak di-remount saat gesture aktif
 * (gesture RNGH tetap hidup).
 *
 * Mendukung 1 kolom (daftar vertikal) dan N kolom (grid wrap) dengan slot
 * berukuran tetap — posisi slot dihitung deterministik dari indeks, tanpa
 * measure per-sel.
 *
 * Aturan: JANGAN pakai `className` pada Animated.View di sini — diabaikan
 * TOTAL di web (bukan cuma bg-*). `cellClassName` dirender pada child <View>
 * biasa; highlight hanya via border.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { type StyleProp, type ViewStyle } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated"
import { View } from "react-native"
import { cn } from "@/lib/cn"

export type DragSortRenderState = {
  /** Sel ini sedang diseret. */
  dragging: boolean
  /** Sel ini adalah target tempat item akan dijatuhkan. */
  dropTarget: boolean
}

export type DragSortListProps<T> = {
  items: readonly T[]
  getId: (item: T) => string
  /**
   * Jumlah kolom. 1 = daftar vertikal; >1 = grid wrap; "auto" = hitung dari
   * lebar container (grid). Slot dihitung dari `cellWidth`/`cellHeight`/`gap`
   * — semuanya harus cocok dengan style sel.
   */
  columns?: number | "auto"
  /** Lebar sel — wajib bila `columns > 1`. */
  cellWidth?: number
  /** Tinggi sel (tetap). */
  cellHeight: number
  /** Jarak antar sel — harus sama dengan gap container. Default 8. */
  gap?: number
  disabled?: boolean
  /** Durasi tahan sebelum drag aktif (ms). Default 280. */
  longPressMs?: number
  /** Dipanggil SEKALI saat drop: pindahkan item dari→ke. */
  onReorder: (from: number, to: number) => void
  /** Konten dalam sel (mengisi penuh wrapper). */
  renderItem: (item: T, index: number, state: DragSortRenderState) => ReactNode
  /**
   * Class layout untuk wrapper sel (tanpa bg-*).
   *
   * WEB-014: class ini TIDAK lagi dipasang pada `<Animated.View>` — className
   * di Animated.View diabaikan TOTAL di web (bukan cuma bg-*), sehingga sel
   * kehilangan layout (flex-row, border, dsb). Class dirender pada child
   * `<View>` biasa yang mengisi penuh container animasi; gesture, dimensi,
   * zIndex, dan transform tetap pada Animated container.
   */
  cellClassName?: string
  /** Style dimensi wrapper sel (width/height tetap). */
  cellStyle?: StyleProp<ViewStyle>
  /** Class layout container. */
  containerClassName?: string
}

type DragConfig = {
  cols: number
  strideX: number
  strideY: number
  count: number
}

export function DragSortList<T>({
  items,
  getId,
  columns = 1,
  cellWidth,
  cellHeight,
  gap = 8,
  disabled = false,
  longPressMs = 280,
  onReorder,
  renderItem,
  cellClassName,
  cellStyle,
  containerClassName,
}: DragSortListProps<T>) {
  // C09: "auto" = kolom dihitung dari lebar container terukur.
  const [measuredCols, setMeasuredCols] = useState<number | null>(null)
  const cols =
    columns === "auto"
      ? (measuredCols ?? 1)
      : Math.max(1, Math.floor(columns))
  const strideX = (cellWidth ?? 0) + gap
  const strideY = cellHeight + gap

  const handleContainerLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      if (columns !== "auto" || !cellWidth) return
      const w = event.nativeEvent.layout.width
      const c = Math.max(1, Math.floor((w + gap) / (cellWidth + gap)))
      setMeasuredCols((prev) => (prev === c ? prev : c))
    },
    [columns, cellWidth, gap],
  )

  // Status drag untuk render (React state — berubah hanya saat
  // mulai/pindah-target/selesai, bukan tiap frame).
  const [activeId, setActiveId] = useState<string | null>(null)
  const [hoverIndex, setHoverIndex] = useState(-1)

  // Nilai atomik di UI thread.
  const dragId = useSharedValue<string | null>(null)
  const dragIdx = useSharedValue(-1)
  const grabX = useSharedValue(0)
  const grabY = useSharedValue(0)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const hoverSV = useSharedValue(-1)
  const configSV = useSharedValue<DragConfig>({ cols, strideX, strideY, count: items.length })
  useEffect(() => {
    configSV.value = { cols, strideX, strideY, count: items.length }
  }, [cols, strideX, strideY, items.length, configSV])

  // Cermin JS untuk commit drop (data tidak berubah selama drag).
  const activeRef = useRef<{ id: string; index: number } | null>(null)
  const hoverRef = useRef(-1)
  const onReorderRef = useRef(onReorder)
  onReorderRef.current = onReorder

  const handleBeginJS = useCallback((id: string, index: number) => {
    activeRef.current = { id, index }
    hoverRef.current = index
    setActiveId(id)
    setHoverIndex(index)
  }, [])
  const handleHoverJS = useCallback((index: number) => {
    hoverRef.current = index
    setHoverIndex(index)
  }, [])
  const handleDropJS = useCallback(() => {
    const active = activeRef.current
    const to = hoverRef.current
    activeRef.current = null
    setActiveId(null)
    setHoverIndex(-1)
    if (active && to >= 0 && to !== active.index) {
      onReorderRef.current(active.index, to)
    }
  }, [])

  // Batalkan drag bila item yang diseret hilang dari data (mis. dihapus).
  useEffect(() => {
    if (activeRef.current && !items.some((it) => getId(it) === activeRef.current!.id)) {
      activeRef.current = null
      dragId.value = null
      dragIdx.value = -1
      tx.value = 0
      ty.value = 0
      hoverSV.value = -1
      setActiveId(null)
      setHoverIndex(-1)
    }
  }, [items, getId, dragId, dragIdx, tx, ty, hoverSV])

  const containerStyle = useMemo<ViewStyle>(
    () => ({
      flexDirection: cols > 1 ? "row" : "column",
      flexWrap: cols > 1 ? "wrap" : "nowrap",
      gap,
    }),
    [cols, gap],
  )

  return (
    <View className={containerClassName} style={containerStyle} onLayout={handleContainerLayout}>
      {items.map((item, index) => (
        <SortableCell
          key={getId(item)}
          id={getId(item)}
          index={index}
          disabled={disabled}
          longPressMs={longPressMs}
          cellClassName={cellClassName}
          cellStyle={cellStyle}
          dragId={dragId}
          dragIdx={dragIdx}
          grabX={grabX}
          grabY={grabY}
          tx={tx}
          ty={ty}
          hoverSV={hoverSV}
          configSV={configSV}
          onBeginJS={handleBeginJS}
          onHoverJS={handleHoverJS}
          onDropJS={handleDropJS}
        >
          {renderItem(item, index, {
            dragging: activeId === getId(item),
            dropTarget: hoverIndex === index && activeId !== null && activeId !== getId(item),
          })}
        </SortableCell>
      ))}
    </View>
  )
}

function SortableCell({
  id,
  index,
  disabled,
  longPressMs,
  cellClassName,
  cellStyle,
  dragId,
  dragIdx,
  grabX,
  grabY,
  tx,
  ty,
  hoverSV,
  configSV,
  onBeginJS,
  onHoverJS,
  onDropJS,
  children,
}: {
  id: string
  index: number
  disabled: boolean
  longPressMs: number
  cellClassName?: string
  cellStyle?: StyleProp<ViewStyle>
  dragId: SharedValue<string | null>
  dragIdx: SharedValue<number>
  grabX: SharedValue<number>
  grabY: SharedValue<number>
  tx: SharedValue<number>
  ty: SharedValue<number>
  hoverSV: SharedValue<number>
  configSV: SharedValue<DragConfig>
  onBeginJS: (id: string, index: number) => void
  onHoverJS: (index: number) => void
  onDropJS: () => void
  children: ReactNode
}) {
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabledRef.current)
        // Long-press dulu agar scroll vertikal biasa tidak tertahan.
        .activateAfterLongPress(longPressMs)
        .onBegin((e) => {
          dragId.value = id
          dragIdx.value = index
          grabX.value = e.x
          grabY.value = e.y
          tx.value = 0
          ty.value = 0
          hoverSV.value = index
          runOnJS(onBeginJS)(id, index)
        })
        .onUpdate((e) => {
          tx.value = e.translationX
          ty.value = e.translationY
          const cfg = configSV.value
          const from = dragIdx.value
          if (from < 0 || cfg.count === 0) return
          // Posisi jari dalam koordinat container — slot dihitung
          // deterministik dari indeks awal + translasi (tanpa measure).
          const slotX = (from % cfg.cols) * cfg.strideX
          const slotY = Math.floor(from / cfg.cols) * cfg.strideY
          const fx = slotX + grabX.value + e.translationX
          const fy = slotY + grabY.value + e.translationY
          const c = Math.max(0, Math.min(cfg.cols - 1, Math.floor(fx / cfg.strideX)))
          const maxR = Math.max(0, Math.ceil(cfg.count / cfg.cols) - 1)
          const r = Math.max(0, Math.min(maxR, Math.floor(fy / cfg.strideY)))
          const h = Math.max(0, Math.min(cfg.count - 1, r * cfg.cols + c))
          if (h !== hoverSV.value) {
            hoverSV.value = h
            runOnJS(onHoverJS)(h)
          }
        })
        .onEnd(() => {
          runOnJS(onDropJS)()
        })
        .onFinalize(() => {
          // Kembalikan atomik — tanpa animasi (data langsung di-reorder
          // saat drop; snap-back hanya untuk drop batal).
          dragId.value = null
          dragIdx.value = -1
          tx.value = 0
          ty.value = 0
          hoverSV.value = -1
        }),
    // `index` stabil selama drag (data tidak berubah) — gesture dibuat
    // per id agar tidak ter-recreate di tengah gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, longPressMs],
  )

  // Sinkronkan `enabled` tanpa me-recreate gesture di tengah drag.
  useEffect(() => {
    pan.enabled(!disabled)
  }, [disabled, pan])

  const dragStyle = useAnimatedStyle(() => {
    const isActive = dragId.value === id
    return {
      transform: [
        { translateX: isActive ? tx.value : 0 },
        { translateY: isActive ? ty.value : 0 },
        { scale: isActive ? 1.06 : 1 },
      ],
      zIndex: isActive ? 20 : 0,
      elevation: isActive ? 8 : 0,
      opacity: isActive ? 0.96 : 1,
    }
  })

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[cellStyle, dragStyle]}
        // WEB-014: JANGAN pasang className di sini — diabaikan total di web.
        // Class sel (cellClassName) dirender pada child <View> biasa di bawah
        // supaya interop NativeWind tetap jalan; cellStyle/dragStyle
        // (dimensi, gesture transform, zIndex) tetap di container animasi.
      >
        {cellClassName ? (
          <View className={cn(cellClassName)} style={dragSortCellInner}>
            {children}
          </View>
        ) : (
          children
        )}
      </Animated.View>
    </GestureDetector>
  )
}

// Inner wrapper untuk cellClassName — mengisi penuh container animasi
// sehingga layout sel (flex-row, border, dsb) identik seperti sebelumnya.
const dragSortCellInner: ViewStyle = { flex: 1 }
