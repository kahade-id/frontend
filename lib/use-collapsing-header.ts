/**
 * Kahade — useCollapsingHeader: header yang melipat saat scroll ke bawah dan
 * muncul lagi saat scroll ke atas (pola feed X/Twitter), dipakai tab Showcase.
 *
 * Arsitektur (kenapa begini, non-obvious):
 *   - KEPUTUSAN lipat/terbuka diambil DI UI THREAD lewat worklet
 *     (`scrollWorklet`) yang diteruskan ke scroller lewat `onScrollWorklet`:
 *     di Android scroller native tidak pernah memicu onScroll JS (lihat
 *     pull-to-refresh.tsx), sehingga logika arah scroll wajib worklet.
 *   - Web/iOS memakai `onScroll` BIASA (fungsi JS) yang memanggil worklet yang
 *     sama. REVISI 2026-09-18 — INI PENYEBAB TOOLBAR TIDAK BERGERAK DI WEB:
 *     `onScroll` sebelumnya diisi `useAnimatedScrollHandler`. Handler
 *     Reanimated bukan fungsi biasa — `useEvent` mengembalikan objek
 *     `{ workletEventHandler }` yang baru di-unpack oleh komponen hasil
 *     `createAnimatedComponent` (`Animated.ScrollView`/`Animated.FlatList`).
 *     Scroller di sini sengaja `FlatList` biasa milik <PullGestureSurface>
 *     (FlatList harus tetap satu-satunya pemilik scroll agar pull-to-refresh
 *     custom tidak pecah), jadi objek itu dikirim apa adanya dan onScroll tidak
 *     pernah terpanggil satu kalipun. Memanggil worklet dari JS thread legal:
 *     di web UI thread == JS thread, dan `runOnJS` pendek jalan
 *     `queueMicrotask` saat runtime-nya sudah JS
 *     (react-native-worklets/src/threads.ts) — jadi kedua jalur berbagi SATU
 *     implementasi, tidak ada dua versi logika lipat yang bisa drift.
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
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native"
import {
  runOnJS,
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
   * Dieksekusi di UI thread tiap frame scroll (jalur Android) atau di JS
   * thread (web/iOS). Hanya menyentuh shared value; satu-satunya hop JS
   * (runOnJS) terjadi saat state lipat BERGANTI.
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

  /**
   * `onScroll` untuk scroller NON-Animated (FlatList di <PullGestureSurface>).
   * Harus fungsi JS biasa — lihat alasan di blok komentar atas.
   * `scrollEventThrottle: 16` sudah dipasang pull-to-refresh, jadi frekuensi
   * callback ini sama dengan jalur worklet di Android.
   */
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event?.nativeEvent?.contentOffset?.y
      if (typeof y === "number" && Number.isFinite(y)) scrollWorklet(y)
    },
    [scrollWorklet],
  )

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
