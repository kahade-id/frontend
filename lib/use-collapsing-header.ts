/**
 * Kahade — useCollapsingHeader: header yang melipat saat scroll ke bawah dan
 * muncul lagi saat scroll ke atas (pola feed X/Twitter), dipakai tab Showcase.
 *
 * Arsitektur (kenapa begini, non-obvious):
 *   - KEPUTUSAN lipat/terbuka diambil DI UI THREAD lewat worklet
 *     (`scrollWorklet`) yang diteruskan ke scroller: di Android scroller
 *     native tidak pernah memicu onScroll JS (lihat pull-to-refresh.tsx —
 *     `onScrollWorklet`), sehingga logika arah scroll wajib worklet; web/iOS
 *     memakai `onScroll` (animated handler) yang membungkus worklet sama.
 *   - Worklet hanya menulis shared value `progress` (0 terbuka → 1 terlipat)
 *     dan memanggil runOnJS SEKALI per pergantian state (untuk mirror JS
 *     `collapsed` yang mengatur pointerEvents) — bukan per frame. Animasi
 *     tinggi/translate berjalan penuh di UI thread, jadi scroll tidak pernah
 *     menunggu JS.
 *   - Tinggi header TIDAK diprop tetap: diukur via onLayout (`onHeaderLayout`)
 *     ke shared value, karena isinya (bar judul + pencarian + tab strip)
 *     berbeda antar platform/lebar. Kontainer meng-clip lewat overflow
 *     hidden + height teranimasi; isi digeser -height supaya melipat ke atas.
 *   - Reduced motion (audit #2): progress lompat instan (withTiming 0ms),
 *     perilaku lipat tetap ada tanpa pegas.
 *   - Ambang arah 6px: micro-bounce di ujung list tidak boleh membolak-balik
 *     header; dan di puncak list (y <= 1, mis. sehabis pull-to-refresh atau
 *     scrollToTop) header selalu dibuka kembali.
 */
import { useCallback, useEffect, useState } from "react"
import type { LayoutChangeEvent } from "react-native"
import {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"

/** Geser arah scroll minimal (px) sebelum header bereaksi. */
const DIRECTION_THRESHOLD = 6

export function useCollapsingHeader() {
  const progress = useSharedValue(0)
  const lastY = useSharedValue(0)
  const height = useSharedValue(0)
  const reducedSV = useSharedValue(false)
  const reducedMotion = useReducedMotion()
  useEffect(() => {
    reducedSV.value = reducedMotion
  }, [reducedMotion, reducedSV])

  const [collapsed, setCollapsed] = useState(false)
  const setCollapsedJS = useCallback((value: boolean) => setCollapsed(value), [])

  /**
   * Dipanggil di UI thread tiap frame scroll. Hanya menyentuh shared value;
   * satu-satunya hop JS (runOnJS) terjadi saat state lipat BERGANTI.
   */
  const scrollWorklet = useCallback(
    (y: number) => {
      "worklet"
      // Di puncak (sehabis refresh / scroll-to-top) header selalu terbuka.
      if (y <= 1) {
        lastY.value = 0
        if (progress.value !== 0) {
          progress.value = reducedSV.value
            ? withTiming(0, { duration: 0 })
            : withSpring(0, tokens.motion.spring)
          runOnJS(setCollapsedJS)(false)
        }
        return
      }
      const dy = y - lastY.value
      if (Math.abs(dy) < DIRECTION_THRESHOLD) return
      lastY.value = y
      const target = dy > 0 ? 1 : 0
      if (target === progress.value) return
      progress.value = reducedSV.value
        ? withTiming(target, { duration: 0 })
        : withSpring(target, tokens.motion.spring)
      runOnJS(setCollapsedJS)(target === 1)
    },
    [progress, lastY, reducedSV, setCollapsedJS],
  )

  // Web/iOS: scroller memicu onScroll JS — bungkus worklet yang sama supaya
  // keputusan lipat identik di semua platform.
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollWorklet(event.contentOffset.y)
    },
  })

  const containerStyle = useAnimatedStyle(() => ({
    // Sebelum onLayout pertama tinggi belum diketahui — biarkan `auto`
    // (undefined) supaya header tidak "hilang" satu frame saat mount.
    height: height.value > 0 ? Math.max(0, height.value * (1 - progress.value)) : undefined,
    overflow: "hidden",
  }))
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -height.value * progress.value }],
  }))

  const onHeaderLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const measured = event.nativeEvent.layout.height
      if (measured > 0 && measured !== height.value) height.value = measured
    },
    [height],
  )

  return { collapsed, containerStyle, contentStyle, onScroll, scrollWorklet, onHeaderLayout }
}
