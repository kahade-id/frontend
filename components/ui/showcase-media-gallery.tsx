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
import { Play, SpeakerHigh, SpeakerSimpleX } from "phosphor-react-native"
import { Picture } from "@/components/ui/picture"
import { FeedVideo } from "@/components/ui/feed-video"
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
 * Ketuk tunggal DITUNDA selama jeda ini bila `onDoubleTap` disediakan —
 * supaya ketuk-ganda tidak ikut membuka aksi ketuk-tunggal.
 */
const DOUBLE_TAP_MS = 300

export function ShowcaseMediaGallery({ media, title, onOpen, onDoubleTap, autoplayActive = true, aspectRatio = 1, activeFullRes = false }: {
  /** Urutan media persis seperti yang dipakai `onOpen` (indeks = indeks media). */
  media: GalleryMedia[]
  title: string
  onOpen: (index: number) => void
  /** Ketuk-ganda pada slide → mis. suka (opsional; tanpa ini ketuk-tunggal langsung). */
  onDoubleTap?: (index: number) => void
  /**
   * true = galeri terlihat di layar → slide video aktif autoplay (item 16).
   * Kartu feed mengirim "kartu terlihat"; halaman detail mengirim true.
   */
  autoplayActive?: boolean
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
  const scroll = useRef<ScrollView>(null)
  const [width, setWidth] = useState(0)
  const [page, setPage] = useState(0)
  const pageRef = useRef(page)
  pageRef.current = page
  // PERF-FIX (TIM1-P1): ref untuk handleScroll stabil.
  const widthRef = useRef(width)
  widthRef.current = width
  const mediaRef = useRef(media)
  mediaRef.current = media
  /** Ref untuk handler (dipakai di dalam timeout) agar identitas stabil. */
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen
  const onDoubleTapRef = useRef(onDoubleTap)
  onDoubleTapRef.current = onDoubleTap
  const lastTapRef = useRef<{ index: number; at: number } | null>(null)
  const pendingSingleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Batch 19 (item 16): pause manual per video (ketuk video = toggle). */
  const [paused, setPaused] = useState<Record<string, boolean>>({})
  /** Batch 19 (item 15): video yang sudah diketuk di mode hemat data. */
  const [manualPlay, setManualPlay] = useState<Record<string, boolean>>({})
  /**
   * Item 59 strict (FE-IMP-1): latch niat putar eksplisit per video untuk
   * mode hemat data. Autoplay scroll-driven TIDAK PERNAH berlaku saat
   * `dataSaver` aktif — bahkan setelah video dimuat manual. Latch dipasang
   * oleh ketuk eksplisit (poster "Putar video" / ketuk video) dan dicabut
   * saat pindah slide, supaya video tidak "autoplay" saat slide dikunjungi
   * ulang.
   */
  const [playLatch, setPlayLatch] = useState<Record<string, boolean>>({})
  useEffect(() => () => {
    if (pendingSingleRef.current) clearTimeout(pendingSingleRef.current)
  }, [])
  // Item 59 strict: pindah slide dalam mode hemat data = cabut semua niat
  // putar — video yang dimuat manual tidak boleh mulai sendiri.
  useEffect(() => {
    if (dataSaver) setPlayLatch({})
  }, [page, dataSaver])
  const signature = media.map((m) => m.id).join("|")
  useEffect(() => { setPage(0); scroll.current?.scrollTo({ x: 0, animated: false }) }, [signature])
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
  /**
   * Ketuk pada slide: deteksi ketuk-ganda manual (bukan RNGH) supaya tidak
   * berebut gesture dengan ScrollView paging horizontal di bawahnya — pola
   * yang sama dipakai web (tidak ada gesture handler) & native.
   *
   * Batch 19: ketuk-tunggal pada slide VIDEO = toggle play/pause (bukan buka
   * viewer gambar); ketuk-ganda tetap "suka".
   */
  const handleSlidePress = (index: number) => {
    const slide = media[index]
    const singleTap = () => {
      if (slide?.kind === "video") {
        if (dataSaver) {
          // Item 59 strict: dalam mode hemat data, ketuk video = toggle niat
          // putar EKSPLISIT (bukan autoplay). Tidak ada sinyal otomatis yang
          // bisa memutar video — hanya latch ini.
          const playing = manualPlay[slide.id] === true && playLatch[slide.id] === true && !paused[slide.id]
          const next = toggleDataSaverPlayIntent(playing)
          setPlayLatch((prev) => ({ ...prev, [slide.id]: next.latch }))
          setPaused((prev) => ({ ...prev, [slide.id]: next.paused }))
          return
        }
        setPaused((prev) => ({ ...prev, [slide.id]: !prev[slide.id] }))
        return
      }
      onOpenRef.current(index)
    }
    if (!onDoubleTapRef.current) {
      singleTap()
      return
    }
    const now = Date.now()
    const prev = lastTapRef.current
    if (prev && prev.index === index && now - prev.at <= DOUBLE_TAP_MS) {
      if (pendingSingleRef.current) {
        clearTimeout(pendingSingleRef.current)
        pendingSingleRef.current = null
      }
      lastTapRef.current = null
      onDoubleTapRef.current(index)
      return
    }
    lastTapRef.current = { index, at: now }
    if (pendingSingleRef.current) clearTimeout(pendingSingleRef.current)
    pendingSingleRef.current = setTimeout(() => {
      pendingSingleRef.current = null
      singleTap()
    }, DOUBLE_TAP_MS)
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
  const slideTapHandlersRef = useRef(new Map<number, () => void>())
  const getSlideTapHandler = useCallback((index: number) => {
    let h = slideTapHandlersRef.current.get(index)
    if (!h) {
      h = () => handleSlidePressRef.current(index)
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
                    shouldPlay={autoplayActive && index === page && !paused[m.id]}
                    // Item 59 strict: dalam mode hemat data, autoplay TIDAK
                    // PERNAH diizinkan — bahkan setelah video dimuat manual.
                    dataSaver={dataSaver}
                    // Niat putar eksplisit (ketuk poster / ketuk video).
                    userPlay={playLatch[m.id] === true && !paused[m.id]}
                    // Item 15: tunda unduhan video sampai diketuk.
                    gated={dataSaver && !manualPlay[m.id]}
                    onTap={getSlideTapHandler(index)}
                    onRequestPlay={getRequestPlayHandler(m.id)}
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
  active,
}: {
  media: GalleryMedia
  title: string
  shouldPlay: boolean
  /** Item 59 strict: true = autoplay mati total, hanya niat eksplisit. */
  dataSaver: boolean
  /** Niat putar eksplisit pengguna (latch), sudah dikurangi pause manual. */
  userPlay: boolean
  gated: boolean
  onTap: () => void
  onRequestPlay: () => void
  /** PERF-FIX (2026-09-30): slide aktif → poster prioritas "high". */
  active: boolean
}) {
  /**
   * Item 50 (FE-IMP-1): toggle speaker per video. State lokal per slide —
   * default muted (perilaku feed sosial); ketuk ikon untuk dengar suara.
   * Tombol di-render SEBAGAI SAUDARA (bukan anak) PressableScale luar supaya
   * ketuk speaker tidak ikut memicu toggle play/pause ketuk-tunggal.
   */
  const [muted, setMuted] = useState(true)
  // Item 59 strict (FE-IMP-1): keputusan putar terpusat di
  // `resolveVideoShouldPlay`. Saat gated (hemat data, belum diketuk) jangan
  // pernah putar; dalam mode hemat data autoplay (`shouldPlay`) SELALU
  // diabaikan — hanya niat eksplisit (`userPlay`) yang memutar video.
  const effectiveShouldPlay = resolveVideoShouldPlay({
    gated,
    dataSaver,
    autoplaySignal: shouldPlay,
    userPlay,
  })
  const toggleMute = () => setMuted((m) => !m)
  // C01: rasio slide — placeholder & poster ikut agar tak meloncat.
  const slideAspectRatio = media.aspectRatio ?? 1

  const muteButton = (
    <View className="absolute bottom-2 right-2">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={muted ? translate("Nyalakan suara video") : translate("Bisukan video")}
        onPress={toggleMute}
        // Tombol visual sekitar 32px; tambah slop untuk target sentuh 44px.
        hitSlop={hitSlopToReach(32)}
        containerClassName="rounded-full"
      >
        <View className="items-center justify-center rounded-full bg-overlay-media p-2">
          <Icon icon={muted ? SpeakerSimpleX : SpeakerHigh} size="sm" tone="inverse" />
        </View>
      </PressableScale>
    </View>
  )

  if (gated) {
    return (
      <View className="relative w-full">
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={translate("Putar video: {x}", { x: title })}
          accessibilityHint={translate("Mode hemat data aktif. Ketuk untuk memuat video.")}
          onPress={onRequestPlay}
          containerClassName="w-full"
        >
          <View className="relative w-full items-center justify-center gap-1.5 bg-surface px-8" style={{ aspectRatio: slideAspectRatio }}>
            {media.posterUrl ? (
              <Picture
                source={media.posterUrl}
                alt={title}
                aspectRatio={slideAspectRatio}
                radius="none"
                bordered={false}
                className="absolute inset-0"
              />
            ) : null}
            <View className="items-center justify-center rounded-full bg-overlay-media p-4">
              <Icon icon={Play} size="lg" weight="fill" tone="inverse" />
            </View>
            <Text variant="caption" tone="secondary" className="text-center">
              {translate("Mode hemat data")}
            </Text>
            <Text variant="caption" tone="tertiary" className="text-center">
              {translate("Ketuk untuk memuat video")}
            </Text>
          </View>
        </PressableScale>
        {/* Item 57: badge durasi juga tampil di poster gated. */}
        {media.durationSec != null ? (
          <View className="absolute bottom-2 left-2 rounded-full bg-overlay-media px-2 py-0.5">
            <Text variant="caption" weight={600} className="text-white tabular-nums">
              {formatCountdown(media.durationSec)}
            </Text>
          </View>
        ) : null}
      </View>
    )
  }
  return (
    <View className="relative w-full">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={translate("Video: {x}. Ketuk untuk putar atau jeda.", { x: title })}
        onPress={onTap}
        containerClassName="w-full"
      >
        <FeedVideo source={media.url} poster={media.posterUrl} alt={title} shouldPlay={effectiveShouldPlay} muted={muted} aspectRatio={slideAspectRatio} userInitiatedPlay={userPlay} posterPriority={active ? "high" : "low"} />
      </PressableScale>
      {muteButton}
      {/* Item 57: badge durasi ala TikTok/IG di thumbnail video. */}
      {media.durationSec != null ? (
        <View className="absolute bottom-2 left-2 rounded-full bg-overlay-media px-2 py-0.5">
          <Text variant="caption" weight={600} className="text-white tabular-nums">
            {formatCountdown(media.durationSec)}
          </Text>
        </View>
      ) : null}
    </View>
  )
}
