/**
 * Kahade — photo viewer halaman media terpusat (`type=photo`).
 *
 * §spek (pengecualian DARK_ALLOWLIST): teks/ikon putih di atas latar hitam
 * solid kedua mode — preseden showcase-media-gallery (kontrol di atas media).
 *
 * Fitur: pager swipe antar foto satu album/pesan (FlatList paging),
 * pinch-to-zoom + double-tap zoom + pan saat zoom (via <ZoomableImage>),
 * tombol share / simpan ke galeri / info (nama, ukuran, dimensi, tanggal),
 * loading progressive (skeleton <Picture>), dan error per slide dengan retry.
 *
 * Keputusan non-obvious:
 *   - Swipe pindah foto DINONAKTIFKAN selama slide aktif di-zoom (pan milik
 *     gambar) — pola yang sama dengan <ImageViewer> lama.
 *   - Gagal muat tidak memakai pesan generik: kemungkinan terbesar adalah
 *     signed URL kedaluwarsa (TTL 5 mnt) bila dibuka dari pesan lama — pesannya
 *     menjelaskan itu + cara pulih (buka ulang dari chat).
 *   - Simpan/bagikan mengunduh dulu ke cache (progress di toast tombol),
 *     lalu MediaLibrary (galeri) / share sheet OS — tidak pernah browser luar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  FlatList,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { DownloadSimple, Info, ShareNetwork, X } from "phosphor-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ZoomableImage } from "@/components/ui/zoomable-image"
import { IconButton } from "@/components/ui/icon-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { formatFileSize, formatDateTimeLocal } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import { tokens } from "@/lib/tokens"
import type { MediaViewerAlbumItem } from "@/lib/media-viewer"
import {
  MediaActionError,
  inferFileName,
  saveImageOrVideoToGallery,
  shareRemoteFile,
} from "@/lib/media-actions"

export type PhotoViewerProps = {
  items: MediaViewerAlbumItem[]
  index?: number
  /** ISO tanggal kirim (panel info) — dari `message.createdAt`. */
  sentAt?: string | null
  onClose: () => void
}

type SlideState = { failed: boolean; retryKey: number; width?: number; height?: number }

export function PhotoViewer({ items, index = 0, sentAt, onClose }: PhotoViewerProps) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  useLanguage()
  const listRef = useRef<FlatList<MediaViewerAlbumItem>>(null)

  const safeStart = Math.min(Math.max(index, 0), Math.max(items.length - 1, 0))
  const [current, setCurrent] = useState(safeStart)
  const [zoomed, setZoomed] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [busy, setBusy] = useState<"save" | "share" | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [slides, setSlides] = useState<Record<number, SlideState>>({})

  const currentItem = items[Math.min(current, items.length - 1)]
  const slideState = slides[current] ?? { failed: false, retryKey: 0 }

  // Index awal berubah (deep-link antar foto) → lompat tanpa animasi.
  useEffect(() => {
    setCurrent(safeStart)
    setZoomed(false)
    const t = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: safeStart, animated: false })
    }, 50)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeStart])

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0 || items.length === 0) return
      const next = Math.min(
        Math.max(Math.round(event.nativeEvent.contentOffset.x / width), 0),
        items.length - 1,
      )
      setCurrent(next)
      setZoomed(false)
      setInfoOpen(false)
    },
    [width, items.length],
  )

  const markFailed = useCallback((i: number) => {
    setSlides((prev) => ({ ...prev, [i]: { failed: true, retryKey: prev[i]?.retryKey ?? 0 } }))
  }, [])

  const markLoaded = useCallback(
    (i: number, event: { source?: { width?: number; height?: number } }) => {
      setSlides((prev) => ({
        ...prev,
        [i]: {
          failed: false,
          retryKey: prev[i]?.retryKey ?? 0,
          width: event.source?.width,
          height: event.source?.height,
        },
      }))
    },
    [],
  )

  const retrySlide = useCallback(() => {
    setSlides((prev) => ({
      ...prev,
      [current]: { failed: false, retryKey: (prev[current]?.retryKey ?? 0) + 1 },
    }))
  }, [current])

  const runAction = useCallback(
    async (kind: "save" | "share") => {
      if (!currentItem || busy) return
      setBusy(kind)
      setProgress(null)
      const fileName = inferFileName(currentItem.url, currentItem.fileName ?? currentItem.title, "foto.jpg")
      try {
        const onProgress = ({ written, total }: { written: number; total: number }) =>
          setProgress(total > 0 ? Math.round((written / total) * 100) : null)
        if (kind === "save") {
          await saveImageOrVideoToGallery(currentItem.url, fileName, { onProgress })
          toast.show({ title: "Foto tersimpan di galeri", tone: "success" })
        } else {
          await shareRemoteFile(currentItem.url, fileName, currentItem.mimeType ?? "image/jpeg", { onProgress })
        }
      } catch (err) {
        toast.show({
          title: err instanceof MediaActionError ? err.message : "Gagal memproses foto. Coba lagi.",
          tone: "danger",
        })
      } finally {
        setBusy(null)
        setProgress(null)
      }
    },
    [busy, currentItem, toast],
  )

  const keys = useMemo(() => {
    const counts = new Map<string, number>()
    return items.map((item) => {
      const base = item.url
      const n = counts.get(base) ?? 0
      counts.set(base, n + 1)
      return n === 0 ? base : `${base}#${n}`
    })
  }, [items])

  const renderItem = useCallback(
    ({ item, index: i }: { item: MediaViewerAlbumItem; index: number }) => {
      const state = slides[i] ?? { failed: false, retryKey: 0 }
      if (state.failed) {
        return (
          <View style={{ width, height }} className="items-center justify-center gap-2 px-10">
            <Text variant="body" weight={600} className="text-center text-white">
              Foto gagal dimuat
            </Text>
            <Text variant="body" className="text-center text-white opacity-80">
              Periksa koneksi internet Anda. Jika foto ini dari pesan lama, tautannya mungkin sudah
              kedaluwarsa — tutup halaman ini lalu buka ulang dari chat.
            </Text>
            <PressableScale
              onPress={retrySlide}
              accessibilityRole="button"
              accessibilityLabel="Muat ulang foto"
              className="mt-3 rounded-full bg-white px-5 py-2.5"
            >
              <Text variant="body" weight={600} className="text-black">
                Coba lagi
              </Text>
            </PressableScale>
          </View>
        )
      }
      return (
        <ZoomableImage
          key={state.retryKey}
          source={item.url}
          alt={item.title ?? item.fileName ?? `Foto ${i + 1} dari ${items.length}`}
          width={width}
          height={height}
          resizeMode="contain"
          onZoomChange={setZoomed}
          priority={i === current ? "high" : "low"}
          onLoad={(event) => markLoaded(i, event)}
          onError={() => markFailed(i)}
        />
      )
    },
    [width, height, items.length, current, slides, markLoaded, markFailed, retrySlide],
  )

  if (items.length === 0 || !currentItem) return null
  const counterLabel = `${Math.min(current, items.length - 1) + 1} dari ${items.length}`
  const infoName = currentItem.fileName ?? currentItem.title ?? "Foto"

  return (
    <View className="flex-1 bg-black">
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(_item, i) => keys[i]}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!zoomed}
        initialScrollIndex={safeStart}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: false })
          }, 100)
        }}
        renderItem={renderItem}
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
      />

      {/* Chrome atas: penghitung + tutup. */}
      <View
        className="absolute inset-x-0 top-0 flex-row items-center justify-between gap-3 px-4"
        style={{ paddingTop: insets.top + tokens.space[3] }}
      >
        <View
          className="rounded-full bg-surface-elevated px-3 py-1.5"
          accessible
          accessibilityRole="header"
          accessibilityLabel={items.length > 1 ? `Foto ${counterLabel}` : "Pratinjau foto"}
        >
          <Text variant="caption" weight={600} className="tabular-nums">
            {items.length > 1 ? counterLabel : infoName}
          </Text>
        </View>
        <View className="rounded-full bg-surface-elevated">
          <IconButton icon={X} variant="ghost" accessibilityLabel="Tutup pratinjau" onPress={onClose} />
        </View>
      </View>

      {/* Progress unduh (simpan/bagikan) — garis di bawah chrome atas. */}
      {busy && progress != null ? (
        <View className="absolute inset-x-0 px-4" style={{ top: insets.top + tokens.space[16] }}>
          <ProgressBar value={progress} showValue label={busy === "save" ? "Menyimpan…" : "Menyiapkan…"} />
        </View>
      ) : null}

      {/* Chrome bawah: share / simpan / info. */}
      <View
        className="absolute inset-x-0 bottom-0 items-center"
        style={{ paddingBottom: insets.bottom + tokens.space[4] }}
      >
        <View className="flex-row items-center gap-2 rounded-full bg-surface-elevated p-1.5">
          <IconButton
            icon={ShareNetwork}
            variant="ghost"
            accessibilityLabel="Bagikan foto"
            onPress={() => void runAction("share")}
            loading={busy === "share"}
            disabled={busy != null}
          />
          <IconButton
            icon={DownloadSimple}
            variant="ghost"
            accessibilityLabel="Simpan foto ke galeri"
            onPress={() => void runAction("save")}
            loading={busy === "save"}
            disabled={busy != null}
          />
          <IconButton
            icon={Info}
            variant="ghost"
            accessibilityLabel={infoOpen ? "Sembunyikan info foto" : "Lihat info foto"}
            active={infoOpen}
            onPress={() => setInfoOpen((v) => !v)}
          />
        </View>
      </View>

      {/* Panel info: nama, ukuran, dimensi, tanggal — pill mode-aware agar kontras. */}
      {infoOpen ? (
        <View
          className="absolute inset-x-4 mb-20 rounded-md border border-border bg-surface-elevated p-4"
          style={{ bottom: insets.bottom }}
          accessible
          accessibilityRole="summary"
          accessibilityLabel={translate("Info foto: {x}", { x: infoName })}
        >
          <InfoRow label="Nama berkas" value={infoName} />
          <InfoRow
            label="Ukuran"
            value={currentItem.fileSize ? formatFileSize(currentItem.fileSize) : "Tidak diketahui"}
          />
          <InfoRow
            label="Dimensi"
            value={
              slideState.width && slideState.height
                ? `${slideState.width} × ${slideState.height} px`
                : "Memuat…"
            }
          />
          <InfoRow
            label="Dikirim"
            value={sentAt ? formatDateTimeLocal(sentAt) : "Tidak diketahui"}
            last
          />
        </View>
      ) : null}

    </View>
  )
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={last ? "gap-0.5 py-1" : "gap-0.5 border-b border-border py-1"}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="body" numberOfLines={2} ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  )
}
