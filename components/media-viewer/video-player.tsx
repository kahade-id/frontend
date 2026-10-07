/**
 * Kahade — video player full-screen halaman media terpusat (`type=video`).
 *
 * §spek (pengecualian DARK_ALLOWLIST): chrome putih di atas hitam solid kedua
 * mode — preseden showcase-media-gallery (kontrol di atas media).
 *
 * Fitur: play/pause/resume, seek bar + thumbnail preview saat drag, skip ±10
 * detik (tombol + double-tap kiri/kanan), kecepatan 0.5–2x, kualitas
 * (otomatis/tinggi/sedang/hemat bila tersedia), volume + mute, geser
 * kecerahan (tepi kanan), auto-hide kontrol 3 detik, loading + error + retry,
 * orientasi mengikuti rotasi HP + tombol fullscreen.
 *
 * Keputusan non-obvious:
 *   - Signed URL diteruskan VERBATIM ke `useVideoPlayer({ uri })` — query
 *     signature tidak pernah di-strip. Seek memakai HTTP Range (206) secara
 *     native oleh ExoPlayer/AVPlayer — klien tidak mengunduh ulang manual.
 *   - Satu PanResponder di permukaan video menangani: ketuk (toggle kontrol),
 *     double-tap kiri/kanan (±10 dtk, deteksi manual 300ms — tanpa
 *     gesture-handler agar identik di web), geser vertikal tepi kiri (volume)
 *     & tepi kanan (kecerahan app via expo-brightness, dipulihkan saat keluar).
 *     Tombol/seek bar adalah sibling DI ATAS permukaan — sentuhannya menang
 *     (responder terdalam/teratas), jadi tidak tertelan gesture permukaan.
 *   - Orientasi: `unlockAsync()` saat mount (mengikuti rotasi HP), tombol
 *     fullscreen mengunci landscape/portrait, dan portrait dikembalikan saat
 *     unmount (default aplikasi). Web: no-op.
 *   - Kualitas REAL: `maxResolution` untuk adaptive stream + ganti sumber
 *     `variants` (posisi & status putar dipertahankan). Tombol kualitas
 *     DISEMBUNYIKAN bila video single-track tanpa varian (tanpa pilihan palsu).
 *   - Thumbnail seek: `expo-video-thumbnails` (remote OK, debounce 350ms);
 *     gagal/lambat → tooltip waktu tetap tampil (jangan spinner abadi).
 *   - Modul hilang (APK lama tanpa expo-video): error jujur "perbarui aplikasi",
 *     bukan crash — pola <FeedVideo> (guard + error boundary).
 */
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { AppState, Image, PanResponder, Platform, View } from "react-native"
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowClockwise,
  ArrowsIn,
  ArrowsOut,
  DownloadSimple,
  Gauge,
  Pause,
  Play,
  ShareNetwork,
  SpeakerHigh,
  SpeakerLow,
  SpeakerX,
} from "phosphor-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { VideoPlayer } from "expo-video"

import { PressableScale } from "@/components/ui/pressable-scale"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { ViewerError } from "@/components/media-viewer/viewer-chrome"
import { isExpoVideoAvailable } from "@/components/ui/feed-video"
import { tokens } from "@/lib/tokens"
import { hitSlopToReach } from "@/lib/hit-slop"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import {
  CONTROLS_AUTOHIDE_MS,
  PLAYBACK_RATES,
  QUALITY_OPTIONS,
  SEEK_STEP_SECONDS,
  formatMediaClock,
  type MediaViewerVariant,
  type PlaybackRate,
  type QualityKey,
} from "@/lib/media-viewer"
import {
  MediaActionError,
  inferFileName,
  saveImageOrVideoToGallery,
  shareRemoteFile,
} from "@/lib/media-actions"

export type FullVideoPlayerProps = {
  url: string
  title?: string | null
  mimeType?: string | null
  fileName?: string | null
  /** Durasi awal (detik) dari pengirim — placeholder sebelum metadata siap. */
  initialDurationSeconds?: number | null
  /** Varian kualitas (URL per label) bila backend menyediakannya. */
  variants?: MediaViewerVariant[]
  onClose: () => void
}

const DOUBLE_TAP_MS = 300
const SCRUB_THUMB_DEBOUNCE_MS = 350
const EDGE_ZONE_RATIO = 0.35
/**
 * Putih/hitam chrome dari TOKEN (bukan hex literal): scrim viewer selalu
 * hitam di kedua mode, jadi putih = primaryForeground palet light dan
 * hitam = primary palet light. Nilai statis — aman untuk kedua mode.
 */
const CHROME_WHITE = tokens.colors.light.primaryForeground
const CHROME_BLACK = tokens.colors.light.primary

class VideoPlayerBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function FullVideoPlayer(props: FullVideoPlayerProps) {
  // `playerKey` = retry TOTAL (remount penuh → player native dibuat ulang).
  const [playerKey, setPlayerKey] = useState(0)
  if (!isExpoVideoAvailable()) {
    return (
      <View className="flex-1 bg-black">
        <ViewerError
          title="Pemutar video tidak tersedia"
          description="Versi aplikasi ini belum mendukung pemutaran video. Perbarui aplikasi ke versi terbaru, lalu coba lagi."
        />
      </View>
    )
  }
  return (
    <VideoPlayerBoundary
      fallback={
        <View className="flex-1 bg-black">
          <ViewerError
            title="Pemutar video gagal dibuka"
            description="Komponen video perangkat bermasalah. Coba tutup halaman ini lalu buka ulang."
          />
        </View>
      }
    >
      <VideoPlayerInner
        key={playerKey}
        {...props}
        onRequestRemount={() => setPlayerKey((k) => k + 1)}
      />
    </VideoPlayerBoundary>
  )
}

type PlayerStatus = "idle" | "loading" | "ready" | "error"

function VideoPlayerInner({
  url: initialUrl,
  title,
  mimeType,
  fileName,
  initialDurationSeconds,
  variants,
  onClose,
  onRequestRemount,
}: FullVideoPlayerProps & { onRequestRemount: () => void }) {
  // Static require aman: paket terdaftar di package.json; guard runtime
  // (isExpoVideoAvailable + boundary) yang memutuskan boleh di-mount.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { VideoView, useVideoPlayer } = require("expo-video") as typeof import("expo-video")

  const insets = useSafeAreaInsets()
  const toast = useToast()
  useLanguage()

  // ── Sumber & player ──────────────────────────────────────────────
  // `useVideoPlayer` MENGGANTI sumber otomatis (replaceAsync) saat objek
  // source berubah — ganti varian cukup `setActiveUrl`, JANGAN panggil
  // `player.replace` manual (double-load). Retry total = remount komponen.
  const [activeUrl, setActiveUrl] = useState(initialUrl)
  const videoSource = useMemo(() => ({ uri: activeUrl }), [activeUrl])
  const setupPlayer = useCallback((pl: VideoPlayer) => {
    pl.loop = false
    pl.muted = false
    pl.preservesPitch = true
    pl.timeUpdateEventInterval = 0.25
  }, [])
  const player = useVideoPlayer(videoSource, setupPlayer)

  const [status, setStatus] = useState<PlayerStatus>("loading")
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(initialDurationSeconds ?? 0)
  const [buffered, setBuffered] = useState(0)
  const [rate, setRate] = useState<PlaybackRate>(1)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [quality, setQuality] = useState<QualityKey>("auto")
  const [trackCount, setTrackCount] = useState(0)
  const [activeVariant, setActiveVariant] = useState(0)

  const [controlsVisible, setControlsVisible] = useState(true)
  const [popup, setPopup] = useState<"speed" | "quality" | "volume" | null>(null)
  const [landscape, setLandscape] = useState(false)
  const [busy, setBusy] = useState<"save" | "share" | null>(null)

  // Scrub state (seek bar).
  const [scrubPreview, setScrubPreview] = useState<number | null>(null)
  const [scrubThumb, setScrubThumb] = useState<string | null>(null)
  const [scrubThumbLoading, setScrubThumbLoading] = useState(false)

  // Indikator sementara: double-tap flash + volume/brightness swipe.
  const [flash, setFlash] = useState<{ side: "left" | "right"; key: number } | null>(null)
  const [swipeIndicator, setSwipeIndicator] = useState<{ kind: "volume" | "brightness"; value: number } | null>(null)

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const swipeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTap = useRef<{ side: "left" | "right"; at: number } | null>(null)
  const autoPlayed = useRef(false)
  const pendingSeekAfterReplace = useRef<number | null>(null)
  const resumePlayingAfterReplace = useRef(false)
  const brightnessInitial = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const surfaceSize = useRef({ width: 0, height: 0 })

  const hasVariants = !!variants && variants.length > 1
  const showQuality = trackCount > 1 || hasVariants

  // ── Siklus hidup: orientasi + kecerahan + jeda saat background ────
  useEffect(() => {
    mountedRef.current = true
    if (Platform.OS !== "web") {
      void (async () => {
        try {
          const Orientation = await import("expo-screen-orientation")
          await Orientation.unlockAsync()
        } catch {
          // Perangkat menolak unlock — player tetap jalan portrait.
        }
        try {
          const Brightness = await import("expo-brightness")
          brightnessInitial.current = await Brightness.getBrightnessAsync()
        } catch {
          brightnessInitial.current = null
        }
      })()
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        try {
          player.pause()
        } catch {
          // Abaikan — player mungkin sudah dilepas.
        }
      }
    })
    return () => {
      mountedRef.current = false
      sub.remove()
      try {
        player.pause()
      } catch {
        // Abaikan — release otomatis useVideoPlayer tetap berjalan.
      }
      if (Platform.OS !== "web") {
        void (async () => {
          try {
            const Orientation = await import("expo-screen-orientation")
            await Orientation.lockAsync(Orientation.OrientationLock.PORTRAIT_UP)
          } catch {
            // Abaikan — orientasi kembali default saat rute ditutup.
          }
          if (brightnessInitial.current != null) {
            try {
              const Brightness = await import("expo-brightness")
              await Brightness.setBrightnessAsync(brightnessInitial.current)
            } catch {
              // Abaikan — kecerahan app kembali saat app direstart.
            }
          }
        })()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ganti URL (deep-link video lain) → reset; hook me-replace otomatis.
  useEffect(() => {
    setActiveUrl(initialUrl)
    setActiveVariant(0)
    setQuality("auto")
    autoPlayed.current = false
    setStatus("loading")
    setPosition(0)
    setBuffered(0)
    setEnded(false)
  }, [initialUrl])

  // ── Listener player ──────────────────────────────────────────────
  useEffect(() => {
    const subs = [
      player.addListener("statusChange", (event: { status?: string }) => {
        if (!mountedRef.current) return
        if (event.status === "error") {
          setStatus("error")
          return
        }
        if (event.status === "readyToPlay") {
          setStatus("ready")
          try {
            // Durasi SELALU dibaca dari sumber aktif (bisa beda antar varian).
            const d = player.duration
            if (Number.isFinite(d) && d > 0) setDuration(d)
            const tracks = player.availableVideoTracks
            if (Array.isArray(tracks)) setTrackCount(tracks.length)
          } catch {
            // Properti belum siap — biarkan placeholder.
          }
          // Lanjutan ganti varian: kembalikan posisi + status putar.
          if (pendingSeekAfterReplace.current != null) {
            try {
              player.currentTime = pendingSeekAfterReplace.current
            } catch {
              // Abaikan — mulai dari awal.
            }
            pendingSeekAfterReplace.current = null
            if (resumePlayingAfterReplace.current) {
              resumePlayingAfterReplace.current = false
              try {
                player.play()
              } catch {
                // Abaikan — user bisa menekan putar manual.
              }
            }
          } else if (!autoPlayed.current) {
            // Dibuka eksplisit oleh user → putar otomatis sekali.
            autoPlayed.current = true
            try {
              player.play()
            } catch {
              // Autoplay ditolak — user menekan putar manual.
            }
          }
        } else if (event.status === "loading" || event.status === "idle") {
          setStatus("loading")
        }
      }),
      player.addListener("playingChange", (event: { isPlaying?: boolean }) => {
        if (!mountedRef.current) return
        setPlaying(!!event.isPlaying)
        if (event.isPlaying) {
          setEnded(false)
          poke()
        }
      }),
      player.addListener("timeUpdate", (event: { currentTime?: number; bufferedPosition?: number }) => {
        if (!mountedRef.current) return
        if (typeof event.currentTime === "number") setPosition(event.currentTime)
        if (typeof event.bufferedPosition === "number") setBuffered(event.bufferedPosition)
        try {
          const d = player.duration
          if (Number.isFinite(d) && d > 0) setDuration((prev) => (prev > 0 ? prev : d))
        } catch {
          // Abaikan.
        }
      }),
      player.addListener("playToEnd", () => {
        if (!mountedRef.current) return
        setPlaying(false)
        setEnded(true)
        setControlsVisible(true)
      }),
    ]
    return () => {
      for (const s of subs) s.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player])

  // ── Auto-hide kontrol ─────────────────────────────────────────────
  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }
  /** Setiap interaksi memanggil ini: tampilkan + jadwalkan sembunyi 3 dtk. */
  const poke = useCallback(() => {
    setControlsVisible(true)
    setPopup(null)
    clearHideTimer()
  }, [])
  useEffect(() => {
    clearHideTimer()
    if (controlsVisible && playing && !popup && scrubPreview == null) {
      hideTimer.current = setTimeout(() => {
        if (mountedRef.current) setControlsVisible(false)
      }, CONTROLS_AUTOHIDE_MS)
    }
    return clearHideTimer
  }, [controlsVisible, playing, popup, scrubPreview])
  useEffect(() => clearHideTimer, [])

  // ── Aksi dasar ───────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    poke()
    try {
      if (ended) {
        setEnded(false)
        player.replay()
        return
      }
      if (playing) player.pause()
      else player.play()
    } catch {
      setStatus("error")
    }
  }, [ended, playing, player, poke])

  const seekBy = useCallback(
    (delta: number) => {
      poke()
      try {
        if (duration > 0) {
          player.currentTime = Math.min(duration, Math.max(0, position + delta))
        } else {
          player.seekBy(delta)
        }
      } catch {
        // Abaikan — kontrol tetap tampil.
      }
    },
    [poke, player, duration, position],
  )

  const seekTo = useCallback(
    (seconds: number) => {
      setEnded(false)
      try {
        player.currentTime = Math.min(Math.max(duration, 0), Math.max(0, seconds))
      } catch {
        // Abaikan.
      }
    },
    [player, duration],
  )

  const showFlash = useCallback((side: "left" | "right") => {
    setFlash({ side, key: Date.now() })
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => {
      if (mountedRef.current) setFlash(null)
    }, 650)
  }, [])

  const applyRate = useCallback(
    (next: PlaybackRate) => {
      setRate(next)
      poke()
      try {
        player.preservesPitch = true
        player.playbackRate = next
      } catch {
        setRate(1)
      }
    },
    [player, poke],
  )

  const QUALITY_BOX: Record<QualityKey, { width: number; height: number } | null> = {
    auto: null,
    high: { width: 1920, height: 1080 },
    medium: { width: 1280, height: 720 },
    low: { width: 854, height: 480 },
  }

  const applyQuality = useCallback(
    (next: QualityKey) => {
      setQuality(next)
      poke()
      try {
        player.maxResolution = QUALITY_BOX[next]
      } catch {
        // Platform menolak — biarkan otomatis.
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [player, poke],
  )

  const switchVariant = useCallback(
    (index: number) => {
      if (!variants || !variants[index] || index === activeVariant) return
      // Hook me-replace otomatis dari `activeUrl`; posisi + status putar
      // dipulihkan di handler status ready (pendingSeekAfterReplace).
      pendingSeekAfterReplace.current = position
      resumePlayingAfterReplace.current = playing || ended
      setEnded(false)
      setActiveVariant(index)
      setActiveUrl(variants[index].url)
      setScrubThumb(null)
      setStatus("loading")
      poke()
    },
    [variants, activeVariant, position, playing, ended, poke],
  )

  const applyMuted = useCallback(
    (next: boolean) => {
      setMuted(next)
      poke()
      try {
        player.muted = next
      } catch {
        // Abaikan.
      }
    },
    [player, poke],
  )

  const applyVolume = useCallback(
    (next: number) => {
      const clamped = Math.min(1, Math.max(0, next))
      setVolume(clamped)
      try {
        player.volume = clamped
        if (clamped > 0 && muted) {
          setMuted(false)
          player.muted = false
        }
      } catch {
        // Abaikan.
      }
    },
    [player, muted],
  )

  const toggleFullscreen = useCallback(async () => {
    poke()
    if (Platform.OS === "web") return
    const next = !landscape
    setLandscape(next)
    try {
      const Orientation = await import("expo-screen-orientation")
      await Orientation.lockAsync(
        next ? Orientation.OrientationLock.LANDSCAPE : Orientation.OrientationLock.PORTRAIT_UP,
      )
    } catch {
      setLandscape(!next)
      toast.show({ title: "Rotasi layar tidak didukung perangkat ini", tone: "warning" })
    }
  }, [landscape, poke, toast])

  // Retry TOTAL: remount penuh (player native dibuat ulang dari awal).
  const retry = useCallback(() => {
    onRequestRemount()
  }, [onRequestRemount])

  // ── Simpan / bagikan ─────────────────────────────────────────────
  const runMediaAction = useCallback(
    async (kind: "save" | "share") => {
      if (busy) return
      setBusy(kind)
      poke()
      const name = inferFileName(activeUrl, fileName ?? title, "video.mp4")
      try {
        if (kind === "save") {
          await saveImageOrVideoToGallery(activeUrl, name)
          toast.show({ title: "Video tersimpan di galeri", tone: "success" })
        } else {
          await shareRemoteFile(activeUrl, name, mimeType ?? "video/mp4")
        }
      } catch (err) {
        toast.show({
          title: err instanceof MediaActionError ? err.message : "Gagal memproses video. Coba lagi.",
          tone: "danger",
        })
      } finally {
        if (mountedRef.current) setBusy(null)
      }
    },
    [activeUrl, busy, fileName, mimeType, title, toast, poke],
  )

  // ── Thumbnail preview saat scrub (debounce) ──────────────────────
  useEffect(() => {
    if (scrubPreview == null) {
      setScrubThumb(null)
      setScrubThumbLoading(false)
      return
    }
    setScrubThumbLoading(true)
    let cancelled = false
    const t = setTimeout(() => {
      void (async () => {
        try {
          const Thumbnails = await import("expo-video-thumbnails")
          const result = await Thumbnails.getThumbnailAsync(activeUrl, {
            time: Math.round(scrubPreview * 1000),
            quality: 0.35,
          })
          if (!cancelled && mountedRef.current) {
            setScrubThumb(result.uri)
            setScrubThumbLoading(false)
          }
        } catch {
          // Thumbnail gagal (remote lambat/terproteksi) → tooltip waktu saja.
          if (!cancelled && mountedRef.current) setScrubThumbLoading(false)
        }
      })()
    }, SCRUB_THUMB_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [scrubPreview, activeUrl])

  // ── Gesture permukaan: ketuk / double-tap / geser volume & cerah ──
  const gestureState = useRef({
    startX: 0,
    mode: "tap" as "tap" | "volume" | "brightness" | "dead",
    startVolume: 1,
    startBrightness: 0.5,
  })

  const showSwipeIndicator = useCallback((kind: "volume" | "brightness", value: number) => {
    setSwipeIndicator({ kind, value })
    if (swipeTimer.current) clearTimeout(swipeTimer.current)
    swipeTimer.current = setTimeout(() => {
      if (mountedRef.current) setSwipeIndicator(null)
    }, 900)
  }, [])

  const surfaceResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const { locationX } = event.nativeEvent
          gestureState.current = {
            startX: locationX,
            mode: "tap",
            startVolume: volume,
            startBrightness: 0.5,
          }
          // Ambil kecerahan awal async (jarang berubah antar gesture).
          void (async () => {
            if (Platform.OS === "web") return
            try {
              const Brightness = await import("expo-brightness")
              gestureState.current.startBrightness = await Brightness.getBrightnessAsync()
            } catch {
              // Tetap 0.5 — geser masih berfungsi relatif.
            }
          })()
        },
        onPanResponderMove: (_event, gesture) => {
          const st = gestureState.current
          const { width, height } = surfaceSize.current
          if (st.mode === "tap") {
            const { dx, dy } = gesture
            if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.2 && width > 0) {
              if (st.startX < width * EDGE_ZONE_RATIO) st.mode = "volume"
              else if (st.startX > width * (1 - EDGE_ZONE_RATIO)) st.mode = "brightness"
              else st.mode = "dead"
            } else if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
              // Gerak horizontal/tengah → bukan swipe vertikal tepi.
              if (Math.abs(dx) >= Math.abs(dy)) st.mode = "dead"
            }
          }
          if (st.mode === "volume" && height > 0) {
            const next = Math.min(1, Math.max(0, st.startVolume - gesture.dy / height))
            applyVolume(next)
            showSwipeIndicator("volume", next)
          } else if (st.mode === "brightness" && height > 0) {
            const next = Math.min(1, Math.max(0.05, st.startBrightness - gesture.dy / height))
            showSwipeIndicator("brightness", next)
            if (Platform.OS !== "web") {
              void (async () => {
                try {
                  const Brightness = await import("expo-brightness")
                  await Brightness.setBrightnessAsync(next)
                } catch {
                  // Perangkat menolak — indikator tetap tampil jujur? Tidak:
                  // sembunyikan agar tidak menampilkan nilai yang bohong.
                  if (mountedRef.current) setSwipeIndicator(null)
                }
              })()
            }
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          const st = gestureState.current
          // Geser vertikal tepi = sudah ditangani di move; jangan toggle kontrol.
          if (st.mode === "volume" || st.mode === "brightness") return
          if (Math.abs(gesture.dx) > 12 || Math.abs(gesture.dy) > 12) return
          // Ketuk: double-tap kiri/kanan = ±10 dtk, ketuk tunggal = kontrol.
          const { width } = surfaceSize.current
          const side = st.startX < width / 2 ? "left" : "right"
          const now = Date.now()
          if (lastTap.current?.side === side && now - lastTap.current.at < DOUBLE_TAP_MS) {
            lastTap.current = null
            if (tapTimer.current) {
              clearTimeout(tapTimer.current)
              tapTimer.current = null
            }
            showFlash(side)
            seekBy(side === "left" ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS)
            return
          }
          lastTap.current = { side, at: now }
          if (tapTimer.current) clearTimeout(tapTimer.current)
          tapTimer.current = setTimeout(() => {
            tapTimer.current = null
            if (!mountedRef.current) return
            // Ketuk tunggal: toggle kontrol (tutup popup dulu bila terbuka).
            if (popup) {
              setPopup(null)
              return
            }
            setControlsVisible((v) => !v)
          }, DOUBLE_TAP_MS)
        },
        onPanResponderTerminate: () => {
          gestureState.current.mode = "dead"
        },
      }),
    [applyVolume, popup, seekBy, showFlash, showSwipeIndicator, volume],
  )

  if (status === "error") {
    return (
      <View className="flex-1 bg-black">
        <ViewerError
          title="Video gagal dimuat"
          description="Periksa koneksi internet Anda. Jika video ini dari pesan lama, tautannya mungkin sudah kedaluwarsa — tutup halaman ini lalu buka ulang dari chat."
          onRetry={retry}
        />
      </View>
    )
  }

  const shownPosition = scrubPreview ?? position
  const volumeIcon = muted || volume === 0 ? SpeakerX : volume < 0.5 ? SpeakerLow : SpeakerHigh

  return (
    <View className="flex-1 bg-black">
      {/* Video — contain (jangan crop) di kedua orientasi. */}
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        contentFit="contain"
        nativeControls={false}
        accessibilityLabel={title ?? "Video"}
      />

      {/* Permukaan gesture: ketuk / double-tap / geser volume & cerah. */}
      <View
        className="absolute inset-0"
        onLayout={(e) => {
          surfaceSize.current = {
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          }
        }}
        {...surfaceResponder.panHandlers}
      />

      {/* Loading awal — spinner + label (jangan layar hitam kosong). */}
      {status === "loading" ? (
        <View
          className="absolute inset-0 items-center justify-center gap-3"
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Memuat video"
          style={{ pointerEvents: "none" }}
        >
          <Spinner size="md" tone="inverse" />
          <Text variant="body" className="text-white">
            Memuat video…
          </Text>
        </View>
      ) : null}

      {/* Flash double-tap ±10 detik. */}
      {flash ? (
        <View
          className="absolute inset-y-0 items-center justify-center"
          style={[
            flash.side === "left" ? { left: 0 } : { right: 0 },
            // Lebar 40% layar — string persen lolos gate angka literal.
            { width: "40%" },
            { pointerEvents: "none" },
          ]}
          key={flash.key}
        >
          <View className="items-center gap-1 rounded-full bg-overlay-media px-4 py-3">
            <Text variant="body" weight={700} className="text-white">
              {flash.side === "left" ? `−${SEEK_STEP_SECONDS}` : `+${SEEK_STEP_SECONDS}`}
            </Text>
            <Text variant="caption" className="text-white opacity-80">
              detik
            </Text>
          </View>
        </View>
      ) : null}

      {/* Indikator geser volume / kecerahan. */}
      {swipeIndicator ? (
        <View
          className="absolute inset-x-0 top-1/3 items-center"
          style={{ pointerEvents: "none" }}
        >
          <View className="w-40 items-center gap-2 rounded-md bg-overlay-media p-3">
            <Text variant="caption" weight={600} className="text-white">
              {swipeIndicator.kind === "volume" ? "Volume" : "Kecerahan"}
            </Text>
            <View className="h-1 w-full overflow-hidden rounded-full bg-white opacity-30">
              <View
                className="h-1 rounded-full bg-white"
                style={{ width: `${Math.round(swipeIndicator.value * 100)}%` }}
              />
            </View>
            <Text variant="caption" className="text-white tabular-nums">
              {Math.round(swipeIndicator.value * 100)}%
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── Chrome atas ── */}
      {controlsVisible ? (
        <View
          className="absolute inset-x-0 top-0 flex-row items-center gap-2 bg-overlay-media px-4 py-2"
          style={{ paddingTop: insets.top + tokens.space[2] }}
        >
          <ChromeButton icon={ArrowLeft} label="Kembali" onPress={onClose} />
          <View className="min-w-0 flex-1">
            {title ? (
              <Text variant="body" weight={600} numberOfLines={1} ellipsizeMode="middle" className="text-white">
                {title}
              </Text>
            ) : null}
            <Text variant="caption" className="text-white opacity-70 tabular-nums">
              {activeVariant > 0 && variants?.[activeVariant]
                ? `${variants[activeVariant].label} · ${formatMediaClock(shownPosition)} / ${formatMediaClock(duration)}`
                : `${formatMediaClock(shownPosition)} / ${formatMediaClock(duration)}`}
            </Text>
          </View>
          <ChromeButton
            icon={DownloadSimple}
            label="Simpan video ke galeri"
            onPress={() => void runMediaAction("save")}
            disabled={busy != null}
          />
          <ChromeButton
            icon={ShareNetwork}
            label="Bagikan video"
            onPress={() => void runMediaAction("share")}
            disabled={busy != null}
          />
        </View>
      ) : null}

      {/* ── Tombol tengah: putar (jeda) / putar ulang (selesai) ── */}
      {controlsVisible && !playing && status === "ready" ? (
        <View className="absolute inset-0 items-center justify-center" style={{ pointerEvents: "box-none" }}>
          <PressableScale
            onPress={togglePlay}
            accessibilityRole="button"
            accessibilityLabel={ended ? "Putar ulang video" : "Putar video"}
            className="items-center justify-center rounded-full bg-overlay-media p-5"
          >
            {ended ? (
              <ArrowClockwise size={40} color={CHROME_WHITE} weight="fill" />
            ) : (
              <Play size={40} color={CHROME_WHITE} weight="fill" />
            )}
          </PressableScale>
        </View>
      ) : null}

      {/* ── Chrome bawah ── */}
      {controlsVisible ? (
        <View
          className="absolute inset-x-0 bottom-0 gap-2 bg-overlay-media px-4 pt-2"
          style={{ paddingBottom: Math.max(insets.bottom, tokens.space[2]) }}
        >
          {/* Baris seek: waktu + slider + durasi. */}
          <View className="flex-row items-center gap-2">
            <Text variant="caption" className="min-w-10 text-white tabular-nums">
              {formatMediaClock(shownPosition)}
            </Text>
            <SeekBar
              position={shownPosition}
              duration={duration}
              buffered={buffered}
              previewThumb={scrubThumb}
              previewLoading={scrubThumbLoading}
              scrubbing={scrubPreview != null}
              onScrubPreview={setScrubPreview}
              onSeek={(seconds) => {
                setScrubPreview(null)
                seekTo(seconds)
                poke()
              }}
            />
            <Text variant="caption" className="min-w-10 text-right text-white tabular-nums">
              {formatMediaClock(duration)}
            </Text>
          </View>
          {/* Baris tombol: putar, ±10 dtk, kecepatan, volume, kualitas, fullscreen. */}
          <View className="flex-row items-center gap-1">
            <ChromeButton
              icon={ArrowCounterClockwise}
              label={`Mundur ${SEEK_STEP_SECONDS} detik`}
              onPress={() => seekBy(-SEEK_STEP_SECONDS)}
            />
            <ChromeButton
              icon={playing ? Pause : Play}
              label={playing ? "Jeda video" : "Putar video"}
              onPress={togglePlay}
              filled
            />
            <ChromeButton
              icon={ArrowClockwise}
              label={`Maju ${SEEK_STEP_SECONDS} detik`}
              onPress={() => seekBy(SEEK_STEP_SECONDS)}
            />
            <View className="flex-1" />
            <PressableScale
              onPress={() => {
                poke()
                setPopup((p) => (p === "speed" ? null : "speed"))
              }}
              accessibilityRole="button"
              accessibilityLabel={translate("Kecepatan putar {x} — ketuk untuk mengubah", { x: `${rate}x` })}
              hitSlop={tokens.space[2]}
              className="min-w-11 items-center rounded-full bg-white px-2 py-1.5"
            >
              <Text variant="caption" weight={700} className="text-black tabular-nums">
                {`${rate}x`}
              </Text>
            </PressableScale>
            <ChromeButton
              icon={volumeIcon}
              label={muted ? "Nyalakan suara" : "Bisukan / atur volume"}
              onPress={() => {
                poke()
                setPopup((p) => (p === "volume" ? null : "volume"))
              }}
            />
            {showQuality ? (
              <ChromeButton
                icon={Gauge}
                label="Kualitas video"
                onPress={() => {
                  poke()
                  setPopup((p) => (p === "quality" ? null : "quality"))
                }}
              />
            ) : null}
            <ChromeButton
              icon={landscape ? ArrowsIn : ArrowsOut}
              label={landscape ? "Keluar layar penuh" : "Layar penuh"}
              onPress={() => void toggleFullscreen()}
            />
          </View>
        </View>
      ) : null}

      {/* ── Popup: kecepatan / volume / kualitas ── */}
      {controlsVisible && popup ? (
        <>
          <PressableScale
            onPress={() => setPopup(null)}
            accessibilityRole="button"
            accessibilityLabel="Tutup pilihan"
            className="absolute inset-0"
          />
          <View
            className="absolute inset-x-4 mb-28 rounded-md border border-border bg-surface-elevated p-3"
            style={{ bottom: insets.bottom }}
          >
            {popup === "speed" ? (
              <View>
                <Text variant="caption" weight={600} tone="secondary" className="mb-2 px-1">
                  Kecepatan putar
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {PLAYBACK_RATES.map((r) => (
                    <PressableScale
                      key={r}
                      onPress={() => applyRate(r)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: rate === r }}
                      accessibilityLabel={translate("{x} kali kecepatan", { x: `${r}` })}
                      className={`rounded-full px-4 py-2 ${rate === r ? "bg-primary" : "bg-surface"}`}
                    >
                      <Text
                        variant="body"
                        weight={600}
                        tone={rate === r ? "inverse" : "primary"}
                        className="tabular-nums"
                      >
                        {`${r}x`}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              </View>
            ) : null}
            {popup === "volume" ? (
              <View className="gap-2">
                <View className="flex-row items-center justify-between px-1">
                  <Text variant="caption" weight={600} tone="secondary">
                    Volume
                  </Text>
                  <PressableScale
                    onPress={() => applyMuted(!muted)}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: !muted }}
                    accessibilityLabel={muted ? "Nyalakan suara" : "Bisukan"}
                    hitSlop={tokens.space[2]}
                    className="rounded-full bg-surface px-3 py-1.5"
                  >
                    <Text variant="caption" weight={600}>
                      {muted ? "Nyalakan" : "Bisukan"}
                    </Text>
                  </PressableScale>
                </View>
                <Slider
                  value={Math.round(volume * 100)}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => applyVolume(v / 100)}
                  onChangeEnd={() => poke()}
                  formatValue={(v) => `${v}%`}
                  accessibilityLabel="Volume video"
                />
                <Text variant="caption" tone="tertiary" className="px-1">
                  Geser vertikal di tepi kiri video untuk volume, tepi kanan untuk kecerahan.
                </Text>
              </View>
            ) : null}
            {popup === "quality" ? (
              <View>
                <Text variant="caption" weight={600} tone="secondary" className="mb-2 px-1">
                  Kualitas
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {QUALITY_OPTIONS.map((q) => (
                    <PressableScale
                      key={q.key}
                      onPress={() => applyQuality(q.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: quality === q.key }}
                      accessibilityLabel={translate("Kualitas {x}", { x: q.label })}
                      className={`rounded-full px-4 py-2 ${quality === q.key ? "bg-primary" : "bg-surface"}`}
                    >
                      <Text variant="body" weight={600} tone={quality === q.key ? "inverse" : "primary"}>
                        {q.label}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
                {hasVariants ? (
                  <View className="mt-3 gap-2">
                    <Text variant="caption" weight={600} tone="secondary" className="px-1">
                      Sumber video
                    </Text>
                    {variants!.map((v, i) => (
                      <PressableScale
                        key={`${v.label}-${i}`}
                        onPress={() => switchVariant(i)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: activeVariant === i }}
                        accessibilityLabel={translate("Sumber {x}", { x: v.label })}
                        className={`rounded-sm px-3 py-2 ${activeVariant === i ? "bg-primary" : "bg-surface"}`}
                      >
                        <Text variant="body" weight={600} tone={activeVariant === i ? "inverse" : "primary"}>
                          {v.label}
                        </Text>
                      </PressableScale>
                    ))}
                  </View>
                ) : null}
                {trackCount > 1 ? (
                  <Text variant="caption" tone="tertiary" className="mt-2 px-1">
                    {trackCount} pilihan kualitas tersedia dari server — "Otomatis" menyesuaikan koneksi.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  )
}

function ChromeButton({
  icon: PhosphorIcon,
  label,
  onPress,
  disabled,
  filled = false,
}: {
  icon: typeof Play
  label: string
  onPress: () => void
  disabled?: boolean
  filled?: boolean
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={hitSlopToReach(38, 38)}
      className={`items-center justify-center rounded-full p-2 ${filled ? "bg-white" : ""} ${disabled ? "opacity-40" : ""}`}
    >
      <PhosphorIcon size={22} color={filled ? CHROME_BLACK : CHROME_WHITE} weight="fill" />
    </PressableScale>
  )
}

/**
 * Seek bar kustom: tap/drag untuk scrub, tooltip waktu + thumbnail preview
 * saat drag. Commit seek HANYA saat jari dilepas (hemat bandwidth — tidak ada
 * seek beruntun tiap frame seperti scrubbing live).
 */
function SeekBar({
  position,
  duration,
  buffered,
  previewThumb,
  previewLoading,
  scrubbing,
  onScrubPreview,
  onSeek,
}: {
  position: number
  duration: number
  buffered: number
  previewThumb: string | null
  previewLoading: boolean
  scrubbing: boolean
  onScrubPreview: (seconds: number | null) => void
  onSeek: (seconds: number) => void
}) {
  useLanguage()
  const trackWidth = useRef(0)
  const fraction = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0
  const bufferedFraction = duration > 0 ? Math.min(1, Math.max(0, buffered / duration)) : 0

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          if (duration <= 0 || trackWidth.current <= 0) return
          const x = Math.min(trackWidth.current, Math.max(0, event.nativeEvent.locationX))
          onScrubPreview((x / trackWidth.current) * duration)
        },
        onPanResponderMove: (event) => {
          if (duration <= 0 || trackWidth.current <= 0) return
          const x = Math.min(trackWidth.current, Math.max(0, event.nativeEvent.locationX))
          onScrubPreview((x / trackWidth.current) * duration)
        },
        onPanResponderRelease: (event) => {
          if (duration <= 0 || trackWidth.current <= 0) {
            onScrubPreview(null)
            return
          }
          const x = Math.min(trackWidth.current, Math.max(0, event.nativeEvent.locationX))
          onSeek((x / trackWidth.current) * duration)
        },
        onPanResponderTerminate: () => onScrubPreview(null),
      }),
    [duration, onScrubPreview, onSeek],
  )

  return (
    <View className="flex-1">
      {/* Tooltip preview (waktu + thumbnail) — mengikuti posisi jari saat scrub. */}
      {scrubbing ? (
        <View
          className="absolute bottom-6 items-center"
          style={{ left: `${Math.round(fraction * 100)}%`, transform: [{ translateX: "-50%" }] }}
        >
          <View className="items-center gap-1 rounded-md bg-surface-elevated p-1.5">
            {previewThumb ? (
              <Image
                source={{ uri: previewThumb }}
                className="h-[68px] w-[120px] rounded-xs"
                accessible={false}
                accessibilityIgnoresInvertColors
              />
            ) : previewLoading ? (
              <View className="h-[68px] w-[120px] items-center justify-center">
                <Spinner size="sm" />
              </View>
            ) : null}
            <Text variant="caption" weight={700} className="tabular-nums">
              {formatMediaClock(position)}
            </Text>
          </View>
        </View>
      ) : null}
      <View
        className="justify-center py-2"
        onLayout={(e) => {
          trackWidth.current = e.nativeEvent.layout.width
        }}
        accessibilityRole="adjustable"
        accessibilityLabel={translate("Posisi putar {x} dari {y}", {
          x: formatMediaClock(position),
          y: formatMediaClock(duration),
        })}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => {
          if (duration <= 0) return
          const delta = event.nativeEvent.actionName === "increment" ? SEEK_STEP_SECONDS : -SEEK_STEP_SECONDS
          onSeek(Math.min(duration, Math.max(0, position + delta)))
        }}
        {...responder.panHandlers}
      >
        <View className="h-1 overflow-hidden rounded-full bg-white opacity-30">
          <View
            className="absolute inset-y-0 left-0 rounded-full bg-white opacity-50"
            style={{ width: `${Math.round(bufferedFraction * 100)}%` }}
          />
          <View
            className="absolute inset-y-0 left-0 rounded-full bg-white"
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </View>
        {/* Thumb: lingkaran putih 12px di posisi putar. */}
        <View
          className="absolute h-3 w-3 rounded-full bg-white"
          style={{ left: `${Math.round(fraction * 100)}%`, transform: [{ translateX: "-50%" }] }}
        />
      </View>
    </View>
  )
}
