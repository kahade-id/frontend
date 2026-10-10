/**
 * Kahade — <StoryVideo>: pemutar video story fullscreen (2026-10-10).
 *
 * Berbeda dari <FeedVideo> (kartu feed: gerbang WiFi, slot player, rasio
 * kartu): story dibuka dengan ketukan sadar pengguna, diputar satu kali,
 * BERSUARA (bisa dibisukan), dan kemajuannya dilaporkan ke viewer supaya
 * progress bar mengikuti posisi video sebenarnya — buffering otomatis
 * menghentikan bar (tidak "lari" mendahului gambar).
 *
 * Kontrak ke viewer:
 *   - `onReady(durationMs)`  : player siap (status readyToPlay) — viewer mulai
 *                              segmen dari sini, bukan dari mount.
 *   - `onProgress(fraction)` : setiap ~200 ms saat bermain (0..1).
 *   - `onEnded()`            : video habis → viewer maju.
 *   - `onError()`            : stream gagal → viewer tampilkan galat + lewati.
 *   - `paused`               : tekan-tahan / sheet terbuka / app di latar.
 *
 * Keputusan non-obvious:
 *   - Modul native `expo-video` di-require TERJAGA (APK lama tanpa modul tidak
 *     boleh crash): viewer memeriksa `isExpoVideoAvailable()` dulu dan jatuh
 *     ke poster bila tidak ada; error boundary di sini menangkap throw
 *     `requireNativeViewManager` sebagai lapisan kedua → `onError`.
 *   - Poster (`thumbnailUrl`) tetap dirender DI BAWAH VideoView sampai frame
 *     pertama siap — tidak ada kotak hitam saat buffering.
 *   - Tanpa kontrol native: gesture viewer (tap/hold/geser) yang berkuasa.
 */
import { Component, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { View } from "react-native"
import { Image } from "expo-image"
import type { VideoPlayer } from "expo-video"

import { getExpoVideoModule } from "@/components/ui/feed-video"

export type StoryVideoProps = {
  uri: string
  poster: string | null
  paused: boolean
  muted: boolean
  onReady: (durationMs: number) => void
  onProgress: (fraction: number) => void
  onEnded: () => void
  onError: () => void
  accessibilityLabel: string
}

class StoryVideoBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function StoryVideoInner({
  uri,
  paused,
  muted,
  onReady,
  onProgress,
  onEnded,
  onError,
  accessibilityLabel,
}: Omit<StoryVideoProps, "poster">) {
  const mod = getExpoVideoModule()
  if (!mod) throw new Error("expo-video unavailable")
  const { VideoView, useVideoPlayer } = mod
  const source = useMemo(() => ({ uri }), [uri])
  const setup = useCallback(
    (pl: VideoPlayer) => {
      pl.loop = false
      pl.muted = muted
      pl.timeUpdateEventInterval = 0.2
    },
    // Hanya saat player dibuat; perubahan `muted` berikutnya lewat effect di bawah.
    [],
  )
  const player = useVideoPlayer(source, setup)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    player.muted = muted
  }, [player, muted])

  useEffect(() => {
    try {
      if (paused) player.pause()
      else player.play()
    } catch {
      // Player sudah dilepas (unmount cepat) — abaikan.
    }
  }, [player, paused])

  useEffect(() => {
    const status = player.addListener("statusChange", (event: { status?: string }) => {
      if (!mounted.current) return
      if (event?.status === "readyToPlay") {
        const seconds = Number(player.duration)
        onReady(Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0)
      } else if (event?.status === "error") {
        onError()
      }
    })
    const time = player.addListener("timeUpdate", (event: { currentTime?: number }) => {
      if (!mounted.current) return
      const seconds = Number(player.duration)
      const now = Number(event?.currentTime)
      if (Number.isFinite(seconds) && seconds > 0 && Number.isFinite(now)) {
        onProgress(Math.min(1, Math.max(0, now / seconds)))
      }
    })
    const end = player.addListener("playToEnd", () => {
      if (mounted.current) onEnded()
    })
    return () => {
      status.remove()
      time.remove()
      end.remove()
    }
  }, [player, onReady, onProgress, onEnded, onError])

  // Pause eksplisit sebelum release otomatis (pola <FeedVideo>).
  useEffect(() => {
    return () => {
      try {
        player.pause()
      } catch {
        // sudah dilepas
      }
    }
  }, [player])

  return (
    <VideoView
      player={player}
      style={{ flex: 1 }}
      contentFit="contain"
      nativeControls={false}
      allowsPictureInPicture={false}
      accessibilityLabel={accessibilityLabel}
    />
  )
}

export const StoryVideo = memo(function StoryVideo(props: StoryVideoProps) {
  const [ready, setReady] = useState(false)
  const { onReady, poster } = props
  const handleReady = useCallback(
    (durationMs: number) => {
      setReady(true)
      onReady(durationMs)
    },
    [onReady],
  )
  return (
    <View style={{ flex: 1 }} className="bg-black">
      {poster && !ready ? (
        <Image
          source={{ uri: poster }}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={0}
          accessibilityLabel={props.accessibilityLabel}
        />
      ) : null}
      <StoryVideoBoundary onError={props.onError}>
        <StoryVideoInner
          uri={props.uri}
          paused={props.paused}
          muted={props.muted}
          onReady={handleReady}
          onProgress={props.onProgress}
          onEnded={props.onEnded}
          onError={props.onError}
          accessibilityLabel={props.accessibilityLabel}
        />
      </StoryVideoBoundary>
    </View>
  )
})
