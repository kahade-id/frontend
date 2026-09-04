/**
 * Kahade — <OnboardingCarousel> pager horizontal slide intro.
 *
 * FlatList `pagingEnabled` yang lebar halamannya DIUKUR dari container
 * (onLayout), bukan `useWindowDimensions()`: di web ≥768px kolom konten
 * di-cap 520px oleh AppShell (§11), sehingga lebar window ≠ lebar pager.
 * Sebelum pengukuran pertama tidak dirender apa pun (lebar 0) supaya tidak
 * ada frame dengan slide selebar 0 lalu melompat.
 *
 * Keputusan non-obvious:
 *   - Index aktif dihitung di `onMomentumScrollEnd` (bukan onScroll) —
 *     cukup untuk PageIndicator dan label tombol, tanpa setState tiap frame.
 *     Di web (react-native-web) momentum event tidak selalu terpicu, jadi
 *     `onScroll` juga dipakai dengan pembulatan yang sama; keduanya idempoten.
 *   - Navigasi programatik (`scrollToIndex`) menghormati Reduce Motion:
 *     `animated: false` saat aktif (audit #2) — lompat, bukan geser.
 *   - `getItemLayout` diberikan agar `scrollToIndex` tidak butuh render
 *     ulang untuk mengukur; lebar halaman sudah diketahui.
 *   - Komponen ini controlled dari luar (`index` + `onIndexChange`) supaya
 *     footer screen (indicator, tombol) tidak tinggal di dalam FlatList.
 */
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react"
import {
  FlatList,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewProps,
} from "react-native"

import { OnboardingSlideView, type OnboardingSlide } from "@/components/onboarding/slides"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { cn } from "@/lib/cn"

export type OnboardingCarouselHandle = {
  scrollTo: (index: number) => void
}

export type OnboardingCarouselProps = Omit<ViewProps, "children"> & {
  slides: readonly OnboardingSlide[]
  index: number
  onIndexChange: (index: number) => void
  className?: string
}

export const OnboardingCarousel = forwardRef<OnboardingCarouselHandle, OnboardingCarouselProps>(
  function OnboardingCarousel({ slides, index, onIndexChange, className, ...rest }, ref) {
    const listRef = useRef<FlatList<OnboardingSlide>>(null)
    const [width, setWidth] = useState(0)
    const reducedMotion = useReducedMotion()

    const onLayout = useCallback((e: LayoutChangeEvent) => {
      const w = Math.round(e.nativeEvent.layout.width)
      if (w > 0) setWidth(w)
    }, [])

    const syncIndex = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (width <= 0) return
        const next = Math.round(e.nativeEvent.contentOffset.x / width)
        const clamped = Math.min(slides.length - 1, Math.max(0, next))
        if (clamped !== index) onIndexChange(clamped)
      },
      [width, slides.length, index, onIndexChange],
    )

    useImperativeHandle(
      ref,
      () => ({
        scrollTo: (i: number) => {
          const clamped = Math.min(slides.length - 1, Math.max(0, i))
          listRef.current?.scrollToIndex({ index: clamped, animated: !reducedMotion })
          onIndexChange(clamped)
        },
      }),
      [slides.length, reducedMotion, onIndexChange],
    )

    return (
      <View onLayout={onLayout} className={cn("w-full flex-1", className)} {...rest}>
        {width > 0 ? (
          <FlatList
            ref={listRef}
            data={slides}
            keyExtractor={(s) => s.key}
            renderItem={({ item, index: i }) => <OnboardingSlideView slide={item} width={width} active={i === index} />}
            // `index` ikut dalam extraData supaya slide non-aktif dirender ulang
            // saat halaman berganti (renderItem menutup nilai `index` lama).
            extraData={index}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            onMomentumScrollEnd={syncIndex}
            onScroll={syncIndex}
            scrollEventThrottle={64}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            // Slide sedikit; render semuanya sekali supaya swipe cepat tidak
            // menampilkan halaman kosong.
            initialNumToRender={slides.length}
            windowSize={slides.length}
            accessibilityRole="adjustable"
            accessibilityLabel="Slide pengenalan"
            accessibilityValue={{ min: 1, max: slides.length, now: index + 1, text: `Slide ${index + 1} dari ${slides.length}` }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={(e) => {
              const delta = e.nativeEvent.actionName === "increment" ? 1 : -1
              const next = Math.min(slides.length - 1, Math.max(0, index + delta))
              listRef.current?.scrollToIndex({ index: next, animated: !reducedMotion })
              onIndexChange(next)
            }}
          />
        ) : null}
      </View>
    )
  },
)
