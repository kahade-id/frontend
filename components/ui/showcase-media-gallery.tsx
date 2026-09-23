/** Shared, keyboard-operable media pager. At most eight images per item. */
import { useEffect, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { CaretLeft, CaretRight } from "phosphor-react-native"
import { IconButton } from "@/components/ui/icon-button"
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
  return (
    <View className="overflow-hidden rounded-sm border border-border" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {images.length === 0 ? <View className="h-64 items-center justify-center bg-surface"><Text>Tidak ada gambar</Text></View> : (
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
              <PressableScale accessibilityRole="button"
                accessibilityLabel={translate("Lihat foto {x} dari {y}", { x: index + 1, y: images.length })}
                onPress={() => onOpen(index)} containerClassName="w-full">
                <Picture source={image.url} alt={title} aspectRatio={1} radius="none" bordered={false} recyclingKey={image.id} preventDownload />
              </PressableScale>
            </View>
          ))}
        </ScrollView>
      )}
      {images.length > 1 ? <View className="flex-row items-center justify-between bg-background px-2 py-1">
        <IconButton icon={CaretLeft} accessibilityLabel="Foto sebelumnya" disabled={page === 0} onPress={() => move(page - 1)} />
        <Text accessibilityLiveRegion="polite" variant="caption">{translate("Foto {x} dari {y}", { x: page + 1, y: images.length })}</Text>
        <IconButton icon={CaretRight} accessibilityLabel="Foto berikutnya" disabled={page >= images.length - 1} onPress={() => move(page + 1)} />
      </View> : null}
    </View>
  )
}
