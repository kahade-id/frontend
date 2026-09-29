/**
 * Kahade — <Spin360Viewer> (batch 19, item 12).
 *
 * Viewer "putar 360°": seret horizontal untuk berpindah antar frame —
 * MURNI JS/gesture (PanResponder), tanpa dependency native baru. Berjalan
 * identik di web (RN Web memetakan mouse ke responder) & native.
 *
 * Masukan: `frames` = URL frame berurutan (satu putaran penuh). Geser kanan
 * = frame berikutnya. Satu putaran penuh = `SPIN_DRAG_PX_PER_TURN` px.
 *
 * Aksesibilitas: tombol panah prev/next + label "Frame x dari n" (live
 * region) untuk keyboard/screen reader — drag bukan satu-satunya jalan.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { PanResponder, View } from "react-native"
import { CaretLeft, CaretRight, ArrowClockwise } from "phosphor-react-native"

import { Picture } from "@/components/ui/picture"
import { IconButton } from "@/components/ui/icon-button"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import { spinFrameIndex } from "@/lib/spin360"
import { prefetchNeighborImages } from "@/lib/prefetch-neighbors"
import { useDataSaver } from "@/lib/ui-prefs"

// Re-export agar pemanggil cukup import dari komponen.
export { SPIN_DRAG_PX_PER_TURN } from "@/lib/spin360"

export type Spin360ViewerProps = {
  frames: string[]
  alt: string
  className?: string
}

export function Spin360Viewer({ frames, alt, className }: Spin360ViewerProps) {
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  const dataSaver = useDataSaver()
  const count = frames.length
  const [index, setIndex] = useState(0)
  const startIndex = useRef(0)

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 4,
        onPanResponderGrant: () => {
          startIndex.current = index
        },
        onPanResponderMove: (_event, gesture) => {
          setIndex(spinFrameIndex(startIndex.current, gesture.dx, count))
        },
        // Tidak ada aksi khusus saat lepas — frame terakhir bertahan.
        onPanResponderTerminationRequest: () => false,
      }),
    // `index` dibaca via ref saat grant; tidak perlu di deps.
    [count],
  )

  if (count === 0) return null
  const safeIndex = Math.min(index, count - 1)

  const go = (delta: number) => setIndex((i) => (i + delta + count) % count)

  // PERF-FIX (2026-09-30): prefetch frame ±1 saat indeks berubah — drag cepat
  // tidak lagi memicu unduhan fresh per frame (spinner beruntun). Pola sama
  // seperti FE-068 di galeri; mode hemat data dihormati di dalam helper.
  useEffect(() => {
    prefetchNeighborImages(frames, safeIndex, dataSaver)
  }, [frames, safeIndex, dataSaver])

  return (
    <View
      className={cn("overflow-hidden rounded-sm border border-border", className)}
      accessibilityRole="adjustable"
      accessibilityLabel={translate("Tampilan 360 derajat. Seret untuk memutar.")}
      accessibilityValue={{ text: translate("Frame {x} dari {y}", { x: safeIndex + 1, y: count }) }}
    >
      <View {...pan.panHandlers}>
        {/*
         * Hanya frame aktif yang di-render (pola B-01 galeri): N frame ×
         * bitmap penuh per viewer terlalu berat untuk feed.
         */}
        <Picture
          source={frames[safeIndex]!}
          alt={translate("{x} — tampilan putar: frame {y} dari {z}", {
            x: alt,
            y: safeIndex + 1,
            z: count,
          })}
          aspectRatio={1}
          radius="none"
          bordered={false}
          recyclingKey={`spin360-${safeIndex}`}
          dataSaverGate
        />
      </View>

      {/* Bar kontrol: panah + indikator frame + hint seret. */}
      <View className="flex-row items-center justify-between bg-surface px-2 py-1.5">
        <IconButton
          icon={CaretLeft}
          variant="ghost"
          size="sm"
          accessibilityLabel={translate("Frame sebelumnya")}
          onPress={() => go(-1)}
        />
        <View className="flex-row items-center gap-1.5">
          <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">
            {translate("{x}/{y}", { x: safeIndex + 1, y: count })}
          </Text>
          <View className="flex-row items-center gap-1">
            <Icon icon={ArrowClockwise} size="xs" tone="default" />
            <Text variant="caption" tone="tertiary">
              {translate("Seret untuk memutar")}
            </Text>
          </View>
        </View>
        <IconButton
          icon={CaretRight}
          variant="ghost"
          size="sm"
          accessibilityLabel={translate("Frame berikutnya")}
          onPress={() => go(1)}
        />
      </View>
    </View>
  )
}
