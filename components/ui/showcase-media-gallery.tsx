/** Shared, keyboard-operable media pager. At most eight images per item.
 *
 * B-01 (audit 2026-09-23): hanya slide aktif ±1 yang me-render <Picture> —
 * slide lain jadi placeholder seukuran. Dulu SEMUA foto ter-mount per kartu
 * (hingga 8 gambar × N kartu di feed). Klaim window di docblock
 * <ShowcaseFeedItem> kini benar-benar berlaku.
 * B-08: placeholder "Tidak ada gambar" ber-`aspect-square` — tinggi kartu
 * tanpa gambar = tinggi slide 1:1, ritme feed tetap konsisten.
 */
import { useEffect, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { CaretLeft, CaretRight } from "phosphor-react-native"
import { cn } from "@/lib/cn"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n/translate"

export function ShowcaseMediaGallery({ images, title, onOpen }: {
  images: { id: string; url: string }[]
  title: string
  onOpen: (index: number) => void
}) {
  const scroll = useRef<ScrollView>(null)
  const [width, setWidth] = useState(0)
  const [page, setPage] = useState(0)
  const pageRef = useRef(page)
  pageRef.current = page
  const signature = images.map((image) => image.id).join("|")
  useEffect(() => { setPage(0); scroll.current?.scrollTo({ x: 0, animated: false }) }, [signature])
  useEffect(() => { scroll.current?.scrollTo({ x: pageRef.current * width, animated: false }) }, [width])
  const move = (index: number) => {
    const next = Math.max(0, Math.min(images.length - 1, index))
    setPage(next)
    scroll.current?.scrollTo({ x: next * width, animated: false })
  }
  /** B-01: jendela render ±1 slide — di luar itu placeholder seukuran. */
  const inWindow = (index: number) => Math.abs(index - page) <= 1
  return (
    <View className="overflow-hidden rounded-sm border border-border" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {images.length === 0 ? (
        // B-08: seukuran slide (1:1), bukan h-64.
        <View className="aspect-square w-full items-center justify-center bg-surface"><Text>{translate("Tidak ada gambar")}</Text></View>
      ) : (
        <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(event) => {
            if (width > 0) {
              const next = Math.max(0, Math.min(images.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)))
              // Update render window from scrolling, not momentum events (which differ on web).
              if (next !== page) setPage(next)
            }
          }}>
          {images.map((image, index) => (
            <View key={image.id} style={{ width }}>
              {inWindow(index) ? (
                <PressableScale accessibilityRole="button"
                  accessibilityLabel={translate("Lihat foto {x} dari {y}", { x: index + 1, y: images.length })}
                  onPress={() => onOpen(index)} containerClassName="w-full">
                  <Picture source={image.url} alt={title} aspectRatio={1} radius="none" bordered={false} recyclingKey={image.id} preventDownload />
                </PressableScale>
              ) : (
                // Placeholder seukuran (B-01): tata letak pager tidak bergeser.
                <View className="aspect-square w-full bg-surface" />
              )}
            </View>
          ))}
        </ScrollView>
      )}
      {images.length > 1 ? (
        // B-11 (audit 2026-09-23): kontrol + indikator TITIK di-overlay di
        // kaki gambar (scrim hitam kedua mode, sama dengan "+N" pada
        // <ShowcaseGalleryGrid>) — dulu baris terpisah di bawah gambar membuat
        // tiap kartu multi-foto ±44px lebih tinggi dan tanpa indikator titik.
        // Panah tetap ada → keyboard/screen-reader tetap bisa berpindah slide.
        // Putih eksplisit di atas scrim hitam (pengecualian terdokumentasi,
        // lihat DARK_ALLOWLIST check-tokens) — `tone="inverse"` bukan putih di
        // dark mode.
        <View className="absolute inset-x-0 bottom-0 flex-row items-center justify-between bg-overlay-media px-1.5 py-1">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={translate("Foto sebelumnya")}
            disabled={page === 0}
            onPress={() => move(page - 1)}
            containerClassName="min-h-8 min-w-8 items-center justify-center rounded-full"
          >
            <CaretLeft size={18} color="#FFFFFF" weight="bold" />
          </PressableScale>
          <View className="flex-row items-center gap-3">
            <View accessible accessibilityLabel={translate("Foto {x} dari {y}", { x: page + 1, y: images.length })} accessibilityLiveRegion="polite" className="flex-row items-center gap-1.5">
              {images.map((image, index) => (
                <View
                  key={`dot-${image.id}`}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    index === page ? "bg-white" : "bg-white opacity-40",
                  )}
                />
              ))}
            </View>

          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={translate("Foto berikutnya")}
            disabled={page >= images.length - 1}
            onPress={() => move(page + 1)}
            containerClassName="min-h-8 min-w-8 items-center justify-center rounded-full"
          >
            <CaretRight size={18} color="#FFFFFF" weight="bold" />
          </PressableScale>
        </View>
      ) : null}
    </View>
  )
}
