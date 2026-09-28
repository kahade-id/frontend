/**
 * Kahade — <FeedVideo> (batch 19, item 16: autoplay video di feed).
 *
 * Pemutar video feed: autoplay saat `shouldPlay` (item terlihat),
 * mute default, pause saat off-screen (`shouldPlay=false` dari pemanggil).
 *
 * ── Kenapa dua lapis ──
 * `expo-video` adalah native module. Di WEB ia murni JS dan langsung jalan
 * setelah push; di APK native ia baru aktif SETELAH user menyetujui build
 * APK baru (modul tidak ada di APK lama). Bila modul tak tersedia/rusak,
 * <VideoView> melempar JS Error saat render (requireNativeViewManager) —
 * <VideoErrorBoundary> menangkapnya dan jatuh ke <VideoPoster> (thumbnail
 * gambar biasa). Jadi TIDAK PERNAH crash/redbox: video yang gagal selalu
 * menjadi gambar.
 *
 * Keputusan non-obvious:
 *   - `shouldPlay` dikontrol PEMANGGIL (viewability FlatList), bukan
 *     IntersectionObserver di dalam komponen: satu sumber kebenaran untuk
 *     "item terlihat" dipakai kartu (memo) agar tidak ada N observer per
 *     kartu yang berebut.
 *   - `muted` default true + `loop` default true: perilaku feed sosial;
 *     pemanggil (pratinjau upload) bisa mematikan loop.
 *   - Kontrol volume tidak ada di item ini (di luar cakupan); tap toggle
 *     play/pause hanya untuk pratinjau upload (`allowTapToggle`).
 *   - Player dibuat via `useVideoPlayer` (auto-release saat unmount) —
 *     jangan `createVideoPlayer` manual kecuali di luar React tree.
 */
import { Component, useEffect, useState, type ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { ArrowClockwise, Play } from "phosphor-react-native"
import type { ImageSource } from "expo-image"
import type { VideoPlayer } from "expo-video"

import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import type { MediaSource } from "@/lib/media"

/** Hasil guarded-require expo-video; null = modul tak tersedia di bundle. */
type ExpoVideoModule = typeof import("expo-video") | null

let cachedModule: ExpoVideoModule | undefined
export function getExpoVideoModule(): ExpoVideoModule {
  if (cachedModule !== undefined) return cachedModule
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require("expo-video") as typeof import("expo-video")
  } catch {
    cachedModule = null
  }
  return cachedModule
}

/**
 * True bila implementasi JS expo-video ada. CATATAN: di APK lama (tanpa
 * native module) require JS tetap lolos — proteksi sesungguhnya adalah
 * <VideoErrorBoundary> di bawah yang menangkap throw requireNativeViewManager.
 */
export function isExpoVideoAvailable(): boolean {
  const mod = getExpoVideoModule()
  return !!mod && typeof mod.VideoView === "function" && typeof mod.useVideoPlayer === "function"
}

class VideoErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    // Sengaja tidak log ke telemetry: kegagalan modul video di APK lama
    // adalah kondisi yang DIHARAPKAN (bukan bug) sampai APK baru dipasang.
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export type FeedVideoProps = Omit<ViewProps, "children"> & {
  /** URI video (remote http(s) atau lokal file:// dari picker). */
  source: string
  /** Thumbnail/gambar pengganti bila modul tak tersedia atau error. */
  poster?: MediaSource
  alt: string
  /** true = item terlihat → autoplay; false = pause. */
  shouldPlay?: boolean
  muted?: boolean
  loop?: boolean
  /** Tampilkan kontrol native (pratinjau upload); feed memakai false. */
  nativeControls?: boolean
  /** Ketuk video = toggle play/pause (pratinjau upload). */
  allowTapToggle?: boolean
  /** C01 (batch 139): rasio slide — dipakai poster/frame agar tak meloncat. */
  aspectRatio?: number
  className?: string
}

/**
 * MediaSource membolehkan { uri: string | null } — normalkan ke tipe yang
 * diterima <Picture> (string | number | ImageSource).
 */
function normalizePosterSource(
  poster?: MediaSource,
): string | number | ImageSource | undefined {
  if (typeof poster === "string" || typeof poster === "number") return poster
  return typeof poster?.uri === "string" ? { uri: poster.uri } : undefined
}

function VideoPoster({
  poster,
  alt,
  label,
  aspectRatio = 1,
  onPress,
  className,
}: {
  poster?: MediaSource
  alt: string
  label?: string
  /** C01 (batch 139): rasio slide — dipakai saat poster belum siap. */
  aspectRatio?: number
  onPress?: () => void
  className?: string
}) {
  // i18n: label aksesibilitas mengikuti bahasa aktif.
  useLanguage()
  const posterSource = normalizePosterSource(poster)
  const body = (
    <View
      className={cn(
        "relative w-full items-center justify-center overflow-hidden bg-surface",
        className,
      )}
      style={{ aspectRatio }}
      // T2-F07 (audit UI/UX 2026-09-28): bila modul video native tidak ada
      // (APK lama), poster ini INERT — jangan tampilkan ikon Play besar +
      // label "Putar video" yang menyiratkan bisa diketuk padahal tap tidak
      // melakukan apa-apa. Tanpa onPress: murni pratinjau visual.
      accessibilityLabel={onPress ? undefined : (label ?? translate("Pratinjau video"))}
    >
      {posterSource ? (
        <Picture
          source={posterSource}
          alt={alt}
          aspectRatio={aspectRatio}
          radius="none"
          bordered={false}
          className="absolute inset-0"
        />
      ) : null}
      {onPress ? (
        <View className="items-center justify-center rounded-full bg-overlay-media p-4">
          <Icon
            icon={Play}
            size="lg"
            weight="fill"
            tone="inverse"
            accessibilityLabel={label ?? translate("Putar video")}
          />
        </View>
      ) : null}
    </View>
  )
  if (!onPress) return body
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label ?? translate("Putar video")}
      onPress={onPress}
    >
      {body}
    </PressableScale>
  )
}

function useSyncPlayer(player: VideoPlayer, shouldPlay: boolean, muted: boolean, loop: boolean) {
  useEffect(() => {
    player.muted = muted
    player.loop = loop
  }, [player, muted, loop])
  useEffect(() => {
    if (shouldPlay) player.play()
    else player.pause()
  }, [player, shouldPlay])
}

/**
 * Pemutar expo-video yang sebenarnya — HANYA di-render bila modul tersedia.
 * Throw di sini (APK lama) ditangkap <VideoErrorBoundary> pemanggil.
 *
 * C04 (batch 139): bila stream gagal (`statusChange` → "error"), laporkan ke
 * `onError`; <ExpoVideoInner> menampilkan fallback poster + tombol "Coba
 * lagi" yang me-mount ulang komponen ini (player baru) tanpa menyembunyikan
 * info produk di kartu.
 */
function ExpoVideoInner({
  source,
  poster,
  alt,
  aspectRatio = 1,
  shouldPlay,
  muted,
  loop,
  nativeControls,
  allowTapToggle,
}: {
  source: string
  poster?: MediaSource
  alt: string
  /** C01: rasio slide — dipakai frame & fallback saat video belum siap. */
  aspectRatio?: number
  shouldPlay: boolean
  muted: boolean
  loop: boolean
  nativeControls: boolean
  allowTapToggle: boolean
}) {
  // i18n: label aksesibilitas mengikuti bahasa aktif.
  useLanguage()
  const [retryKey, setRetryKey] = useState(0)
  const [failed, setFailed] = useState(false)

  if (failed) {
    const posterSource = normalizePosterSource(poster)
    return (
      <View
        className="relative w-full items-center justify-center gap-2 overflow-hidden bg-surface px-6"
        style={{ aspectRatio }}
      >
        {posterSource ? (
          <Picture
            source={posterSource}
            alt={alt}
            aspectRatio={aspectRatio}
            radius="none"
            bordered={false}
            className="absolute inset-0"
          />
        ) : null}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={translate("Coba muat video lagi")}
          onPress={() => {
            setRetryKey((n) => n + 1)
            setFailed(false)
          }}
          containerClassName="rounded-full bg-background px-4 py-2"
        >
          <View className="flex-row items-center gap-1.5">
            <Icon icon={ArrowClockwise} size="sm" />
            <Text variant="caption" weight={600}>
              {translate("Coba lagi")}
            </Text>
          </View>
        </PressableScale>
        <Text variant="caption" tone="secondary" className="text-center">
          {translate("Video gagal dimuat")}
        </Text>
      </View>
    )
  }

  return (
    <ExpoVideoPlayer
      key={retryKey}
      source={source}
      aspectRatio={aspectRatio}
      shouldPlay={shouldPlay}
      muted={muted}
      loop={loop}
      nativeControls={nativeControls}
      allowTapToggle={allowTapToggle}
      onError={() => setFailed(true)}
    />
  )
}

/** Instans player tunggal — di-mount ulang (key) setiap "Coba lagi". */
function ExpoVideoPlayer({
  source,
  aspectRatio,
  shouldPlay,
  muted,
  loop,
  nativeControls,
  allowTapToggle,
  onError,
}: {
  source: string
  aspectRatio: number
  shouldPlay: boolean
  muted: boolean
  loop: boolean
  nativeControls: boolean
  allowTapToggle: boolean
  onError: () => void
}) {
  // i18n: label aksesibilitas mengikuti bahasa aktif.
  useLanguage()
  // Static require aman: paket terdaftar di package.json. Guard runtime
  // (bukan di sini) yang memutuskan komponen ini boleh di-mount.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { VideoView, useVideoPlayer } = require("expo-video") as typeof import("expo-video")
  const player = useVideoPlayer({ uri: source }, (p) => {
    p.loop = loop
    p.muted = muted
  })
  useSyncPlayer(player, shouldPlay, muted, loop)

  useEffect(() => {
    const sub = player.addListener("statusChange", (event: { status?: string }) => {
      if (event?.status === "error") onError()
    })
    return () => sub.remove()
  }, [player, onError])

  const [tapPaused, setTapPaused] = useState(true)
  useEffect(() => {
    if (!allowTapToggle) return
    const sub = player.addListener("playingChange", (event) => {
      setTapPaused(!event.isPlaying)
    })
    return () => sub.remove()
  }, [player, allowTapToggle])

  const handleTap = () => {
    if (!allowTapToggle) return
    if (tapPaused) player.play()
    else player.pause()
  }

  const frame = (
    <View
      className="relative w-full overflow-hidden bg-surface"
      style={{ aspectRatio }}
    >
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        nativeControls={nativeControls}
        accessibilityLabel={translate("Video")}
      />
      {allowTapToggle && tapPaused ? (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <View className="items-center justify-center rounded-full bg-overlay-media p-4">
            <Icon
              icon={Play}
              size="lg"
              weight="fill"
              tone="inverse"
              accessibilityLabel={translate("Putar video")}
            />
          </View>
        </View>
      ) : null}
    </View>
  )
  if (!allowTapToggle) return frame
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={translate("Putar/jeda video")} onPress={handleTap}>
      {frame}
    </PressableScale>
  )
}

export function FeedVideo({
  source,
  poster,
  alt,
  shouldPlay = false,
  muted = true,
  loop = true,
  nativeControls = false,
  allowTapToggle = false,
  aspectRatio = 1,
  className,
  ...rest
}: FeedVideoProps) {
  // i18n: label aksesibilitas mengikuti bahasa aktif.
  useLanguage()
  const available = isExpoVideoAvailable()
  const fallback = <VideoPoster poster={poster} alt={alt} aspectRatio={aspectRatio} className={className} />
  if (!available) return <View className={cn("w-full", className)} {...rest}>{fallback}</View>
  return (
    <View className={cn("w-full", className)} {...rest}>
      <VideoErrorBoundary fallback={fallback}>
        <ExpoVideoInner
          source={source}
          poster={poster}
          alt={alt}
          aspectRatio={aspectRatio}
          shouldPlay={shouldPlay}
          muted={muted}
          loop={loop}
          nativeControls={nativeControls}
          allowTapToggle={allowTapToggle}
        />
      </VideoErrorBoundary>
    </View>
  )
}
