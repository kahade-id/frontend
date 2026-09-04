/**
 * Kahade — <Collapse> animasi buka/tutup tinggi (§8 durasi standar).
 *
 * Primitif di balik Accordion, "Lihat rincian biaya", filter lanjutan, dan
 * detail error yang bisa dibentangkan. Menganimasikan `height` 0 <-> tinggi
 * konten terukur dengan durasi base (300ms) + easing standar; opacity ikut
 * agar konten tidak "terpotong keras" saat menutup.
 *
 * Cara kerja (non-obvious):
 *   - Konten SELALU dirender di dalam container `overflow-hidden` dan
 *     tingginya diukur lewat `onLayout`. Sebelum pengukuran pertama selesai
 *     dan `open=true`, container dibiarkan `height: undefined` (auto) supaya
 *     tidak ada frame kosong; setelah terukur, animasi memakai angka nyata.
 *   - `height` tidak bisa di-native-driver (bukan transform/opacity), jadi
 *     `useNativeDriver: false` — ini animasi layout yang wajar di JS thread
 *     untuk konten pendek. Untuk daftar sangat panjang, pertimbangkan
 *     render kondisional biasa (tanpa animasi) — §8 "tenang" > efek.
 *   - Saat tertutup penuh, `accessibilityElementsHidden` + `importantFor
 *     Accessibility` menyembunyikan konten dari screen reader; tombol pemicu
 *     (di parent) harus membawa `accessibilityState={{ expanded }}`.
 *   - `unmountOnClose`: unmount konten setelah animasi tutup selesai — untuk
 *     konten berat (chart). Default false agar state input di dalam terjaga.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Animated, Easing, View, type LayoutChangeEvent, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

export type CollapseProps = Omit<ViewProps, "children" | "style"> & {
  open: boolean
  children?: ReactNode
  duration?: "fast" | "base" | "slow"
  unmountOnClose?: boolean
  onOpened?: () => void
  onClosed?: () => void
  className?: string
}

export function Collapse({
  open,
  children,
  duration = "base",
  unmountOnClose = false,
  onOpened,
  onClosed,
  className,
  ...rest
}: CollapseProps) {
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  const [mounted, setMounted] = useState(open || !unmountOnClose)
  // Reduce Motion (audit #2): buka/tutup instan (tinggi lompat ke nilai akhir).
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (open) setMounted(true)
    const anim = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: motionDuration(reducedMotion, tokens.motion.duration[duration]),
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: false,
    })
    anim.start(({ finished }) => {
      if (!finished) return
      if (open) onOpened?.()
      else {
        onClosed?.()
        if (unmountOnClose) setMounted(false)
      }
    })
    return () => anim.stop()
  }, [open, duration, progress, unmountOnClose, onOpened, onClosed, reducedMotion])

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height
    // Update hanya bila berubah — konten dinamis (teks bertambah) tetap terukur
    setContentHeight((prev) => (prev === h ? prev : h))
  }, [])

  // Sebelum terukur & open: auto height (tanpa frame kosong).
  const animatedHeight =
    contentHeight == null
      ? open
        ? undefined
        : 0
      : progress.interpolate({ inputRange: [0, 1], outputRange: [0, contentHeight] })

  return (
    <Animated.View
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
      pointerEvents={open ? "auto" : "none"}
      style={{ height: animatedHeight, opacity: progress, overflow: "hidden" }}
      {...rest}
    >
      {mounted ? (
        // Konten diletakkan absolute di dalam container yang tingginya
        // dianimasikan: onLayout mengukur tinggi asli tanpa dipotong.
        <View
          onLayout={handleLayout}
          className={cn("absolute left-0 right-0 top-0", className)}
        >
          {children}
        </View>
      ) : null}
    </Animated.View>
  )
}
