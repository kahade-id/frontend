import type { GestureResponderEvent, ScrollViewInstance } from "react-native"
import { mediaTapPoint, type OpeningMediaTap } from "@/lib/use-opening-media-tap"
/** Shared, swipeable media pager. At most eight images per item.
 *
 * B-01 (audit 2026-09-23): hanya slide aktif ±1 yang me-render konten —
 * slide lain jadi placeholder seukuran. Dulu SEMUA foto ter-mount per kartu
 * (hingga 8 gambar × N kartu di feed). Klaim window di docblock
 * <ShowcaseFeedItem> kini benar-benar berlaku.
 * B-08: placeholder "Tidak ada gambar" ber-`aspect-square` — tinggi kartu
 * tanpa gambar = tinggi slide 1:1, ritme feed tetap konsisten.
 *
 * Batch 19 (item 11/12/15/16): slide bisa berupa VIDEO selain gambar.
 * `media` dari `showcaseMedia(item)` (lib/showcase-social). Video autoplay
 * muted saat slide aktif & galeri terlihat (`autoplayActive`), pause
 * off-screen (item 16); mode hemat data menunda unduhan gambar & video
 * sampai diketuk (item 15).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ScrollView, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native"
import { Pause, Play, SpeakerHigh, SpeakerSimpleX } from "phosphor-react-native"
import { cn } from "@/lib/cn"
import { Picture } from "@/components/ui/picture"
import { FeedVideo, useWifiAutoplayAllowed } from "@/components/ui/feed-video"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { PressableScale } from "@/components/ui/pressable-scale"
import { formatCountdown } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import { useDataSaver } from "@/lib/ui-prefs"
import { prefetchNeighborImages } from "@/lib/prefetch-neighbors"
import { resolveVideoShouldPlay, toggleDataSaverPlayIntent } from "@/lib/showcase-video-play"
import { hitSlopToReach } from "@/lib/hit-slop"
import type { GalleryMedia } from "@/lib/showcase-social"

/**
 * Jeda maksimum antar dua ketukan agar dihitung ketuk-ganda (ala Instagram).
 * Ketuk pertama langsung membuka viewer/detail; ketuk kedua hanya suka.
 * Tidak ada timer yang menunda navigasi pengguna.
 */
const DOUBLE_TAP_MS = 300

export function ShowcaseMediaGallery({ media, title, onOpen, onDoubleTap, autoplayActive = true, autoplay = true, aspectRatio = 1, activeFullRes = false }: {
  /** Urutan media persis seperti yang dipakai `onOpen` (indeks = indeks media). */
  media: GalleryMedia[]
  title: string
  onOpen: (index: number, openingTap?: OpeningMediaTap) => void
  /** Ketuk-ganda pada slide → mis. suka (opsional; tanpa ini ketuk-tunggal langsung). */
  onDoubleTap?: (index: number) => void
  /**
   * true = galeri terlihat di layar → slide video aktif autoplay (item 16).
   * Kartu feed mengirim "kartu terlihat"; halaman detail mengirim true.
   */
  autoplayActive?: boolean
  /**
   * FD-02 (audit etalase 2026-10-10): false = video TIDAK pernah mulai
   * sendiri (tab Etalase profil, kartu terkait — tanpa wiring viewability),
   * tetapi tombol putar tetap bekerja. Dulu permukaan ini mengirim
   * `autoplayActive={false}` yang ikut mematikan niat putar eksplisit.
   */
  autoplay?: boolean
  /**
   * C01 (batch 139): rasio slide pertama dari respons list — dipakai
   * placeholder di luar jendela render (±1 slide) agar pager tidak bergeser
   * saat slide jauh dimuat. Tiap slide memakai rasionya sendiri bila ada.
   */
  aspectRatio?: number
  /**
   * PERF-FIX (2026-09-30): true = slide AKTIF memakai full-res (`fullUrl`),
   * slide lain tetap thumbnail. Dipakai halaman detail — 8 slide full-res
   * sekaligus (±40 MB) diganti 1 full-res + sisanya thumbnail ~640px.
   * Feed tidak memakai ini (thumbnail cukup untuk ukuran kartu feed).
   */
  activeFullRes?: boolean
}) {
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  const dataSaver = useDataSaver()
  const scroll = useRef<ScrollViewInstance>(null)
  const [width, setWidth] = useState(0)
  const [page, setPage] = useState(0)
  const pageRef = useRef(page)
  pageRef.current = page
  // PERF-FIX (TIM1-P1): ref untuk handleScroll stabil.
  const widthRef = useRef(width)
  widthRef.current = width
  const mediaRef = useRef(media)
  mediaRef.current = media
  /** Ref untuk handler agar identitas stabil. */
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen
  const onDoubleTapRef = useRef(onDoubleTap)
  onDoubleTapRef.current = onDoubleTap
  const lastTapRef = useRef<{ index: number; at: number } | null>(null)
  /** Pause manual per video, hanya dari tombol overlay putar/jeda. */
  const [paused, setPaused] = useState<Record<string, boolean>>({})
  /** Batch 19 (item 15): video yang sudah diketuk di mode hemat data. */
  const [manualPlay, setManualPlay] = useState<Record<string, boolean>>({})
  /**
   * Item 59 strict (FE-IMP-1): latch niat putar eksplisit per video untuk
   * mode hemat data. Autoplay scroll-driven TIDAK PERNAH berlaku saat
   * `dataSaver` aktif — bahkan setelah video dimuat manual. Latch dipasang
   * oleh ketuk eksplisit (tombol overlay "Putar video") dan dicabut
   * saat pindah slide, supaya video tidak "autoplay" saat slide dikunjungi
   * ulang.
   */
  const [playLatch, setPlayLatch] = useState<Record<string, boolean>>({})
  // Item 59 strict: pindah slide dalam mode hemat data = cabut semua niat
  // putar — video yang dimuat manual tidak boleh mulai sendiri.
  useEffect(() => {
    if (dataSaver) setPlayLatch({})
  }, [page, dataSaver])
  const signature = media.map((m) => m.id).join("|")
  useEffect(() => { lastTapRef.current = null; setPage(0); scroll.current?.scrollTo({ x: 0, animated: false }) }, [signature])
  useEffect(() => { scroll.current?.scrollTo({ x: pageRef.current * width, animated: false }) }, [width])
  // FE-068: halaman berubah → prefetch 1 slide tetangga (gambar saja;
  // video dilewati, mode hemat data dihormati — lihat lib/prefetch-neighbors).
  useEffect(() => {
    prefetchNeighborImages(
      media.map((m) => (m.kind === "image" ? m.url : undefined)),
      page,
      dataSaver,
    )
  }, [page, media, dataSaver])
  /** Ketuk gambar/video langsung membuka viewer; ketuk kedua hanya untuk suka. */
  const handleSlidePress = (index: number, event?: GestureResponderEvent) => {
    if (!media[index]) return
    const now = Date.now()
    const prev = lastTapRef.current
    if (onDoubleTapRef.current && prev && prev.index === index && now - prev.at <= DOUBLE_TAP_MS) {
      lastTapRef.current = null
      onDoubleTapRef.current(index)
      return
    }
    lastTapRef.current = { index, at: now }
    onOpenRef.current(index, onDoubleTapRef.current ? { at: now, point: mediaTapPoint(event), onDoubleTap: () => onDoubleTapRef.current?.(index) } : undefined)
  }
  /** B-01: jendela render ±1 slide — di luar itu placeholder seukuran. */
  const inWindow = (index: number) => Math.abs(index - page) <= 1
  // PERF-FIX (TIM1-P1): handler stabil — tidak ada closure inline per render.
  // onLayout: guard nilai sama agar tidak setState sia-sia saat rotasi/
  // font-scale memicu layout ulang dengan lebar identik.
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width
    setWidth((prev) => (prev === w ? prev : w))
  }, [])
  // onScroll: baca page via ref agar identitas stabil (tidak tergantung page).
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const w = widthRef.current
      if (w > 0) {
        const next = Math.max(
          0,
          Math.min(mediaRef.current.length - 1, Math.round(event.nativeEvent.contentOffset.x / w)),
        )
        // Update render window from scrolling, not momentum events (which differ on web).
        if (next !== pageRef.current) setPage(next)
      }
    },
    [],
  )
  // style slide stabil — tidak alokasi objek baru per slide per render.
  const slideStyle = useMemo(() => ({ width }), [width])
  // onTap per slide: cache handler per indeks, delegasi via ref agar selalu
  // memanggil handleSlidePress terbaru tanpa membuat closure baru.
  const handleSlidePressRef = useRef(handleSlidePress)
  handleSlidePressRef.current = handleSlidePress
  const slideTapHandlersRef = useRef(new Map<number, (event: GestureResponderEvent) => void>())
  const getSlideTapHandler = useCallback((index: number) => {
    let h = slideTapHandlersRef.current.get(index)
    if (!h) {
      h = (event) => handleSlidePressRef.current(index, event)
      slideTapHandlersRef.current.set(index, h)
    }
    return h
  }, [])
  // onRequestPlay per video: hanya memakai setState stabil + id → aman di-cache.
  const requestPlayHandlersRef = useRef(new Map<string, () => void>())
  const getRequestPlayHandler = useCallback((id: string) => {
    let h = requestPlayHandlersRef.current.get(id)
    if (!h) {
      h = () => {
        setManualPlay((prev) => ({ ...prev, [id]: true }))
        // Ketuk "Putar video" = niat eksplisit → langsung putar.
        setPlayLatch((prev) => ({ ...prev, [id]: true }))
        setPaused((prev) => ({ ...prev, [id]: false }))
      }
      requestPlayHandlersRef.current.set(id, h)
    }
    return h
  }, [])
  // Bersihkan cache handler bila daftar media berganti (indeks/id basi).
  const mediaSignature = media.map((m) => m.id).join("|")
  useEffect(() => {
    slideTapHandlersRef.current.clear()
    requestPlayHandlersRef.current.clear()
  }, [mediaSignature])
  // Tombol overlay adalah satu-satunya pemicu putar/jeda, bukan area media.
  const togglePlayHandlersRef = useRef(new Map<string, (playing: boolean) => void>())
  const getTogglePlayHandler = useCallback((id: string) => {
    let handler = togglePlayHandlersRef.current.get(id)
    if (!handler) {
      handler = (playing) => {
        const next = toggleDataSaverPlayIntent(playing)
        setManualPlay((prev) => ({ ...prev, [id]: true }))
        setPlayLatch((prev) => ({ ...prev, [id]: next.latch }))
        setPaused((prev) => ({ ...prev, [id]: next.paused }))
      }
      togglePlayHandlersRef.current.set(id, handler)
    }
    return handler
  }, [])

  return (
    <View className="overflow-hidden rounded-sm border border-border" onLayout={handleLayout}>
      {media.length === 0 ? (
        // B-08: seukuran slide (1:1), bukan h-64.
        <View className="aspect-square w-full items-center justify-center bg-surface"><Text>{translate("Tidak ada gambar")}</Text></View>
      ) : (
        <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={handleScroll}>
          {media.map((m, index) => (
            <View key={m.id} style={slideStyle}>
              {inWindow(index) ? (
                m.kind === "video" ? (
                  <VideoSlide
                    media={m}
                    title={title}
                    // PERF-FIX (2026-09-30): poster slide aktif prioritas high.
                    active={index === page}
                    // Item 16: autoplay hanya bila slide aktif & terlihat & tidak di-pause manual.
                    shouldPlay={autoplay && autoplayActive && index === page && !paused[m.id]}
                    // Item 59 strict: dalam mode hemat data, autoplay TIDAK
                    // PERNAH diizinkan — bahkan setelah video dimuat manual.
                    dataSaver={dataSaver}
                    // Niat putar eksplisit (ketuk poster / ketuk video).
                    userPlay={autoplayActive && index === page && playLatch[m.id] === true && !paused[m.id]}
                    // Item 15: tunda unduhan video sampai diketuk.
                    gated={dataSaver && !manualPlay[m.id]}
                    onTap={getSlideTapHandler(index)}
                    onRequestPlay={getRequestPlayHandler(m.id)}
                    onTogglePlay={getTogglePlayHandler(m.id)}
                  />
                ) : (
                  <PressableScale accessibilityRole="button"
                    accessibilityLabel={translate("Lihat foto {x} dari {y}", { x: index + 1, y: media.length })}
                    onPress={getSlideTapHandler(index)} containerClassName="w-full">
                    {/* C01: rasio dari respons list — placeholder tidak meloncat.
                        PERF-FIX (LR-009): slide aktif prioritas "high" — bandwidth
                        didahulukan ke gambar yang terlihat, bukan tetangga.
                        PERF-FIX (2026-09-30): `activeFullRes` — slide aktif
                        memakai full-res, sisanya thumbnail (halaman detail). */}
                    <Picture source={activeFullRes && index === page && m.fullUrl ? m.fullUrl : m.url} alt={title} aspectRatio={m.aspectRatio ?? 1} radius="none" bordered={false} recyclingKey={m.id} preventDownload dataSaverGate priority={index === page ? "high" : "low"} />
                  </PressableScale>
                )
              ) : (
                // Placeholder seukuran (B-01): tata letak pager tidak bergeser.
                // C01: pakai rasio slide sendiri (fallback rasio slide pertama).
                <View className="w-full bg-surface" style={{ aspectRatio: m.aspectRatio ?? aspectRatio }} />
              )}
            </View>
          ))}
        </ScrollView>
      )}
      {/* Item 156 (FE-IMP-1): penghitung posisi "3/8" — konsisten dengan
          <ImageViewer> yang sudah punya "3 dari 8". */}
      {media.length > 1 ? (
        <View
          className="absolute right-2 top-2 rounded-full bg-overlay-media px-2 py-0.5"
          accessible
          accessibilityLabel={translate("Media {x} dari {y}", { x: page + 1, y: media.length })}
        >
          <Text variant="caption" weight={600} className="text-white tabular-nums">
            {page + 1}/{media.length}
          </Text>
        </View>
      ) : null}
      {/* Audit 2026-10-08: titik indikator PASIF di kaki media (Instagram) —
          pengguna melihat "ada slide lain" tanpa membaca angka. Berbeda dari
          bar B-11 lama (panah + titik 44pt yang dibuang 2026-10-01 karena
          berat), ini dekoratif: tidak bisa diketuk, disembunyikan dari
          pembaca layar (posisi sudah dibacakan penghitung di atas), dan tidak
          menyentuh gesture ScrollView. Maks SHOWCASE_MAX_IMAGES titik. */}
      {media.length > 1 ? (
        <View
          style={{ pointerEvents: "none" }}
          // bottom-3.5: pusat pil sejajar pusat kontrol video 44pt di kiri/kanan.
          className="absolute bottom-3.5 left-0 right-0 items-center"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View className="flex-row items-center gap-1 rounded-full bg-overlay-media px-2 py-1.5">
            {media.map((m, index) => (
              <View
                key={`dot-${m.id}`}
                className={cn("h-1.5 w-1.5 rounded-full bg-white", index !== page && "opacity-40")}
              />
            ))}
          </View>
        </View>
      ) : null}

    </View>
  )
}

/**
 * Slide video (item 15/16). `gated` = mode hemat data & belum diketuk:
 * tampilkan poster + tombol putar; video baru diunduh setelah ketukan.
 */
function VideoSlide({
  media,
  title,
  shouldPlay,
  dataSaver,
  userPlay,
  gated,
  onTap,
  onRequestPlay,
  onTogglePlay,
  active,
}: {
  media: GalleryMedia
  title: string
  shouldPlay: boolean
  dataSaver: boolean
  userPlay: boolean
  gated: boolean
  onTap: (event: GestureResponderEvent) => void
  onRequestPlay: () => void
  onTogglePlay: (playing: boolean) => void
  active: boolean
}) {
  const [muted, setMuted] = useState(true)
  const wifiAllowed = useWifiAutoplayAllowed()
  const effectiveShouldPlay = resolveVideoShouldPlay({
    gated,
    dataSaver,
    autoplaySignal: shouldPlay,
    userPlay,
  })
  // Seluler tetap tidak autoplay. Ketuk overlay memasang niat putar eksplisit.
  const playing = effectiveShouldPlay && (wifiAllowed || userPlay)
  const slideAspectRatio = media.aspectRatio ?? 1

  return (
    <View className="relative w-full">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={translate("Lihat video: {x}", { x: title })}
        accessibilityHint={translate("Buka video layar penuh")}
        onPress={onTap}
        containerClassName="w-full"
      >
        {gated ? (
          <View className="relative w-full bg-surface" style={{ aspectRatio: slideAspectRatio }}>
            {media.posterUrl ? (
              <Picture source={media.posterUrl} alt={title} aspectRatio={slideAspectRatio}
                radius="none" bordered={false} priority={active ? "high" : "low"} />
            ) : null}
            <Text variant="caption" tone="secondary" className="absolute bottom-3 w-full text-center">
              {translate("Mode hemat data")}
            </Text>
          </View>
        ) : (
          // FD-03: `embedded` — permukaan video meneruskan ketukan ke slide
          // (viewer), tetapi tombol "Coba lagi" di dalam FeedVideo tetap bisa
          // diketuk. Dulu seluruh FeedVideo `pointerEvents:none`: retry mati
          // dan ketukannya justru membuka viewer.
          <FeedVideo source={media.url} poster={media.posterUrl} alt={title}
            shouldPlay={effectiveShouldPlay} muted={muted} aspectRatio={slideAspectRatio}
            userInitiatedPlay={userPlay} posterPriority={active ? "high" : "low"} embedded />
        )}
      </PressableScale>
      {/* Kontrol adalah saudara permukaan: tidak memicu viewer atau suka. */}
      <View style={{ pointerEvents: "box-none" }} className={gated ? "absolute inset-0 items-center justify-center" : "absolute bottom-2 left-2"}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={playing ? translate("Jeda video: {x}", { x: title }) : translate("Putar video: {x}", { x: title })}
          accessibilityHint={gated ? translate("Mode hemat data aktif. Ketuk untuk memuat video.") : undefined}
          onPress={gated ? onRequestPlay : () => onTogglePlay(playing)}
          containerClassName="rounded-full"
          className="h-11 w-11 items-center justify-center rounded-full bg-overlay-media"
        >
          <Icon icon={playing ? Pause : Play} size="sm" weight="fill" tone="inverse" />
        </PressableScale>
      </View>
      {!gated ? (
        <View className="absolute bottom-2 right-2">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={muted ? translate("Nyalakan suara video") : translate("Bisukan video")}
            onPress={() => setMuted((value) => !value)}
            hitSlop={hitSlopToReach(32)}
            containerClassName="rounded-full"
          >
            <View className="items-center justify-center rounded-full bg-overlay-media p-2">
              <Icon icon={muted ? SpeakerSimpleX : SpeakerHigh} size="sm" tone="inverse" />
            </View>
          </PressableScale>
        </View>
      ) : null}
      {media.durationSec != null ? (
        <View style={{ pointerEvents: "none" }} className="absolute left-2 top-2 rounded-full bg-overlay-media px-2 py-0.5">
          <Text variant="caption" weight={600} className="text-white tabular-nums">
            {formatCountdown(media.durationSec)}
          </Text>
        </View>
      ) : null}
    </View>
  )
}
