/**
 * Kahade — <ImageViewer>: pratinjau gambar layar penuh (modal + pager).
 *
 * Dipakai: feed Etalase (ketuk media), detail karya, chat (ketuk gambar),
 * bukti pengiriman. Pengganti <MediaViewer> untuk kasus multi-gambar yang
 * butuh pinch-zoom + swipe antar foto (<MediaViewer> tetap dipakai untuk
 * PDF/berkas dengan tombol "Buka eksternal").
 *
 * Perilaku:
 * - Modal layar penuh di atas scrim token `bg-overlay`.
 * - Tiap slide = <ZoomableImage>: cubit 1–4×, ketuk-ganda toggle 2.5×,
 *   geser satu jari menggeser gambar saat diperbesar.
 * - Swipe horizontal pindah foto (FlatList paging). Swipe DINONAKTIFKAN
 *   selama slide aktif diperbesar — kalau tidak, satu jari berebut antara
 *   pan gambar vs pindah slide (lihat `onZoomChange` di zoomable-image).
 * - Chrome (penghitung "3 dari 8", tutup, sebelum/berikutnya) memakai pill
 *   `bg-surface-elevated` — bukan teks putih mentah di atas scrim — supaya
 *   lolos check:tokens tanpa pengecualian allowlist.
 * - Web: gesture-handler + expo-image bekerja di web; paging FlatList via
 *   scroll-snap RN-web.
 * - Hormat `useReducedMotion`: modal tanpa animasi fade.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  FlatList,
  Modal,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { CaretLeft, CaretRight, X } from "phosphor-react-native"

import { FeedVideo } from "@/components/ui/feed-video"
import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { ZoomableImage } from "@/components/ui/zoomable-image"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { translate } from "@/lib/i18n/translate"

export type ImageViewerItem = {
  url: string
  /** Label aksesibilitas per gambar (default: judul viewer). */
  alt?: string
  /**
   * Item 158 (FE-IMP-1): "video" → slide memutar video (fullscreen).
   * Default "image" — pemanggil lama tidak berubah perilaku.
   */
  kind?: "image" | "video"
}

export type ImageViewerProps = {
  visible: boolean
  images: ImageViewerItem[]
  /** Index awal saat dibuka. */
  index?: number
  /** Judul opsional di pill kiri atas. */
  title?: string
  onClose: () => void
  onIndexChange?: (index: number) => void
  /**
   * Item 159 (FE-IMP-1): slot aksi di chrome bawah (mis. tombol Bagikan /
   * Simpan milik layar pemanggil). Tidak disediakan → chrome bawah seperti
   * semula (hanya navigasi foto).
   */
  actions?: ReactNode
}

export function ImageViewer({
  visible,
  images,
  index = 0,
  title,
  onClose,
  onIndexChange,
  actions,
}: ImageViewerProps) {
  const { width, height } = useWindowDimensions()
  const reducedMotion = useReducedMotion()
  const listRef = useRef<FlatList<ImageViewerItem>>(null)
  const [current, setCurrent] = useState(() => Math.min(Math.max(index, 0), Math.max(images.length - 1, 0)))
  const [zoomed, setZoomed] = useState(false)
  const onIndexChangeRef = useRef(onIndexChange)
  onIndexChangeRef.current = onIndexChange

  // Buka (atau index awal berubah) → reset ke index yang diminta.
  useEffect(() => {
    if (!visible) return
    const next = Math.min(Math.max(index, 0), Math.max(images.length - 1, 0))
    setCurrent(next)
    setZoomed(false)
    // FlatList di-mount saat visible; tunda scroll sampai layout siap.
    const t = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: next, animated: false })
    }, 50)
    return () => clearTimeout(t)
  }, [visible, index, images.length])

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), images.length - 1)
      setCurrent(clamped)
      setZoomed(false)
      listRef.current?.scrollToIndex({ index: clamped, animated: !reducedMotion })
      onIndexChangeRef.current?.(clamped)
    },
    [images.length, reducedMotion],
  )

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0 || images.length === 0) return
      const next = Math.min(
        Math.max(Math.round(event.nativeEvent.contentOffset.x / width), 0),
        images.length - 1,
      )
      setCurrent(next)
      setZoomed(false)
      onIndexChangeRef.current?.(next)
    },
    [width, images.length],
  )

  const renderItem = useCallback(
    ({ item, index: i }: { item: ImageViewerItem; index: number }) => {
      const alt = item.alt ?? title ?? translate("Media {x} dari {y}", { x: i + 1, y: images.length })
      // Item 158: slide video — diputar fullscreen; hanya slide aktif yang
      // berbunyi/berjalan. Zoom cubit tidak berlaku untuk video.
      if (item.kind === "video") {
        return (
          <View style={{ width, height }} className="items-center justify-center">
            <FeedVideo
              source={item.url}
              alt={alt}
              shouldPlay={visible && i === current}
              muted={false}
              allowTapToggle
              className="max-h-full"
            />
          </View>
        )
      }
      return (
        <ZoomableImage
          source={item.url}
          alt={alt}
          width={width}
          height={height}
          resizeMode="contain"
          onZoomChange={setZoomed}
        />
      )
    },
    [width, height, title, images.length, visible, current],
  )

  if (!visible || images.length === 0) return null
  const safeCurrent = Math.min(current, images.length - 1)
  const counterLabel = translate("{x} dari {y}", { x: safeCurrent + 1, y: images.length })

  return (
    <Modal
      visible
      transparent
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={onClose}
      accessibilityLabel={title ?? translate("Pratinjau gambar")}
      // Status bar di atas modal gelap: biarkan default (tidak diubah).
    >
      <View className="flex-1 bg-overlay">
        {/* Pager foto */}
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(item, i) => `${item.url}#${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          // Zoom aktif → swipe pindah foto dimatikan (pan milik gambar).
          scrollEnabled={!zoomed}
          initialScrollIndex={Math.min(Math.max(index, 0), images.length - 1)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollToIndexFailed={(info) => {
            // Fallback bila layout belum siap (mis. rotasi saat dibuka).
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: false })
            }, 100)
          }}
          renderItem={renderItem}
          // Gambar tetangga ikut di-render agar swipe terasa instan.
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
        />

        {/* Chrome atas: judul + penghitung + tutup (pill agar kontras di dua mode). */}
        <View className="absolute inset-x-0 top-0 flex-row items-center justify-between gap-3 px-4 pt-12">
          <View
            className="min-w-0 flex-1 flex-row items-center gap-2"
            accessible
            accessibilityRole="header"
            accessibilityLabel={title ? `${title} — ${counterLabel}` : counterLabel}
          >
            {title ? (
              <View className="max-w-[65%] rounded-full bg-surface-elevated px-3 py-1.5">
                <Text variant="caption" weight={600} numberOfLines={1}>
                  {title}
                </Text>
              </View>
            ) : null}
            <View className="rounded-full bg-surface-elevated px-3 py-1.5">
              <Text variant="caption" weight={600} className="tabular-nums">
                {counterLabel}
              </Text>
            </View>
          </View>
          <View className="rounded-full bg-surface-elevated">
            <IconButton
              icon={X}
              variant="ghost"
              accessibilityLabel={translate("Tutup pratinjau")}
              onPress={onClose}
            />
          </View>
        </View>

        {/* Chrome bawah: aksi pemanggil (item 159) + sebelum/berikutnya
            (keyboard/SR; swipe tetap utama). */}
        {images.length > 1 || actions ? (
          <View className="absolute inset-x-0 bottom-0 items-center gap-2 pb-10">
            {actions ? (
              <View className="flex-row items-center gap-1 rounded-full bg-surface-elevated p-1.5">
                {actions}
              </View>
            ) : null}
            {images.length > 1 ? (
              <View className="flex-row items-center gap-2 rounded-full bg-surface-elevated p-1.5">
                <IconButton
                  icon={CaretLeft}
                  variant="ghost"
                  accessibilityLabel={translate("Media sebelumnya")}
                  onPress={() => goTo(safeCurrent - 1)}
                  disabled={safeCurrent === 0}
                />
                <Text
                  variant="caption"
                  weight={600}
                  className="min-w-16 text-center tabular-nums"
                  accessibilityLabel={counterLabel}
                >
                  {counterLabel}
                </Text>
                <IconButton
                  icon={CaretRight}
                  variant="ghost"
                  accessibilityLabel={translate("Media berikutnya")}
                  onPress={() => goTo(safeCurrent + 1)}
                  disabled={safeCurrent >= images.length - 1}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  )
}
