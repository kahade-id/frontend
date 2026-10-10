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
 *   - `muted` default true; `loop` default FALSE (PERF-FIX NP-002) — video
 *     tidak mengulang otomatis (hemat kuota/CPU); pemanggil bisa
 *     menyalakannya eksplisit bila dibutuhkan.
 *   - PERF-FIX (NP-002): autoplay WiFi-only — di seluler tampilkan poster +
 *     tombol putar; ketuk = niat eksplisit (override sesi ini). Pemanggil
 *     yang sudah memastikan niat eksplisit (galeri: latch "Putar video";
 *     viewer fullscreen: dibuka via ketuk) memakai `userInitiatedPlay`
 *     untuk melewati gerbang.
 *   - Kontrol volume tidak ada di item ini (di luar cakupan); tap toggle
 *     play/pause hanya untuk pratinjau upload (`allowTapToggle`).
 *   - Player dibuat via `useVideoPlayer` (auto-release saat unmount) —
 *     jangan `createVideoPlayer` manual kecuali di luar React tree.
 */
import { Component, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
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
import { useConnectionType } from "@/lib/connectivity"
import { supportsVideoModule } from "@/lib/showcase-video-play"
import { acquireVideoPlayerSlot, releaseVideoPlayerSlot, waitForVideoPlayerSlot } from "@/lib/video-player-slots"

// LR-008: batas player video konkuren — lihat lib/video-player-slots.ts
// (dipisah & diperbaiki pada audit etalase 2026-10-10, FD-01).

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
  return supportsVideoModule(getExpoVideoModule())
}

/**
 * PERF-FIX (NP-002): keputusan gerbang autoplay — diekstrak murni agar
 * bisa di-unit-test tanpa me-render expo-video (native module).
 *
 * Autoplay (shouldPlay dari visibilitas) HANYA jalan bila:
 * - wifiAllowed (koneksi WiFi), ATAU
 * - userInitiatedPlay (pemanggil memastikan niat eksplisit user), ATAU
 * - userPlayOverride (user mengetuk tombol putar pada poster gerbang).
 */
export function shouldGateVideoAutoplay(opts: {
  shouldPlay: boolean
  wifiAllowed: boolean
  userInitiatedPlay: boolean
  userPlayOverride: boolean
}): boolean {
  return (
    opts.shouldPlay &&
    !opts.wifiAllowed &&
    !opts.userInitiatedPlay &&
    !opts.userPlayOverride
  )
}

/**
 * FE-016: keputusan mount player — diekstrak murni agar bisa di-unit-test.
 *
 * `useVideoPlayer({ uri })` dapat memicu buffering walau `shouldPlay=false`,
 * jadi player native JANGAN di-mount sebelum waktunya: hanya bila video
 * benar-benar akan diputar (`effectiveShouldPlay`), atau ada niat eksplisit
 * user (`userInitiatedPlay` — mis. latch "Putar video" / viewer dibuka via
 * ketuk). `allowTapToggle` (pratinjau upload) selalu mount: ketuk-toggle
 * butuh player yang sudah ada.
 */
export function shouldMountVideoPlayer(opts: {
  effectiveShouldPlay: boolean
  userInitiatedPlay: boolean
  allowTapToggle: boolean
}): boolean {
  return opts.effectiveShouldPlay || opts.userInitiatedPlay || opts.allowTapToggle
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
  /** true = item terlihat → autoplay; false = pause. PERF-FIX (NP-002): autoplay hanya saat WiFi. */
  shouldPlay?: boolean
  muted?: boolean
  /** PERF-FIX (NP-002): default MATI — video tidak mengulang otomatis. */
  loop?: boolean
  /** Tampilkan kontrol native (pratinjau upload); feed memakai false. */
  nativeControls?: boolean
  /** Ketuk video = toggle play/pause (pratinjau upload). */
  allowTapToggle?: boolean
  /**
   * PERF-FIX (NP-002): true bila sinyal putar berasal dari NIAT EKSPLISIT
   * pengguna (mis. mengetuk poster "Putar video", membuka viewer fullscreen).
   * Melewati gerbang jaringan — pengguna sudah menyetujui pemakaian data.
   * Autoplay murni (shouldPlay dari visibilitas) tetap WiFi-only.
   */
  userInitiatedPlay?: boolean
  /** C01 (batch 139): rasio slide — dipakai poster/frame agar tak meloncat. */
  aspectRatio?: number
  className?: string
  /**
   * PERF-FIX (2026-09-30): prioritas unduhan poster/thumbnail — galeri video
   * aktif mengirim "high"/"low" sesuai visibilitas slide. Diteruskan ke
   * semua <Picture> poster & state gagal.
   */
  posterPriority?: "high" | "normal" | "low"
  /**
   * FD-03 (audit etalase 2026-10-10): true bila video di-host di dalam
   * permukaan yang memiliki ketukan (slide galeri → viewer). Permukaan video
   * dan poster inert meneruskan sentuhan ke induk; hanya kontrol yang
   * benar-benar bisa ditindak (tombol "Coba lagi") yang menangkapnya. Poster
   * gerbang WiFi dirender TANPA tombol putar — induk punya kontrol sendiri
   * (dulu dua ikon putar tampil bersamaan, yang besar tidak bisa diketuk).
   */
  embedded?: boolean
}

/**
 * PERF-FIX (NP-002): autoplay video HANYA saat WiFi. `shouldPlay` dari
 * pemanggil diabaikan bila koneksi seluler terdeteksi — user melihat poster
 * + tombol putar; ketuk = niat eksplisit, video tetap bisa diputar manual.
 * Fail-open: tipe koneksi belum diketahui / NetInfo tak tersedia → autoplay
 * seperti biasa (jangan rusak cold start / platform tanpa NetInfo).
 * Tipe koneksi dibaca dari `lib/connectivity` (satu langganan NetInfo per
 * proses) — bukan langganan baru di sini.
 */

/**
 * Aturan boleh-autoplay dari tipe koneksi. Hanya koneksi seluler yang
 * positif terdeteksi yang memblokir — hemat kuota tanpa false-positive di
 * status 'unknown'/'none' (web) atau sebelum NetInfo menjawab.
 */
export function isAutoplayAllowedByConnection(connectionType: string | null | undefined): boolean {
  // PERF-FIX (NP-002): WiFi-ONLY, fail-closed. Keputusan user eksplisit:
  // autoplay hanya saat connectionType === "wifi". Seluler, ethernet, vpn,
  // unknown, none, dan null/undefined semuanya TIDAK autoplay.
  // (HLS/transcode deferred — tidak diimplementasikan di sini.)
  return connectionType?.toLowerCase() === "wifi"
}

/** true bila video boleh autoplay sekarang (hanya WiFi), live. */
export function useWifiAutoplayAllowed(): boolean {
  const connectionType = useConnectionType()
  return isAutoplayAllowedByConnection(connectionType)
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
  priority,
}: {
  poster?: MediaSource
  alt: string
  label?: string
  /** C01 (batch 139): rasio slide — dipakai saat poster belum siap. */
  aspectRatio?: number
  onPress?: () => void
  className?: string
  /** PERF-FIX (2026-09-30): prioritas unduhan poster. */
  priority?: "high" | "normal" | "low"
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
      accessible={!onPress}
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
          priority={priority}
        />
      ) : null}
      {onPress ? (
        <View className="items-center justify-center rounded-full bg-overlay-media p-4">
          <Icon
            icon={Play}
            size="lg"
            weight="fill"
            tone="onMedia"
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
  userInitiatedPlay = false,
  posterPriority,
  embedded = false,
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
  /** PERF-FIX (NP-002): niat putar eksplisit user → lewati gerbang jaringan. */
  userInitiatedPlay?: boolean
  /** PERF-FIX (2026-09-30): prioritas unduhan poster/fallback. */
  posterPriority?: "high" | "normal" | "low"
  /** FD-03: lihat FeedVideoProps.embedded. */
  embedded?: boolean
}) {
  // i18n: label aksesibilitas mengikuti bahasa aktif.
  useLanguage()
  const [retryKey, setRetryKey] = useState(0)
  const [failed, setFailed] = useState(false)
  // PERF-FIX (NP-002): autoplay hanya saat WiFi — di seluler, tampilkan
  // poster + tombol putar. Ketuk = niat eksplisit user (override sesi ini).
  // userInitiatedPlay = pemanggil sudah memastikan niat eksplisit (mis.
  // poster "Putar video" diketuk / viewer fullscreen dibuka) → lewati gerbang.
  const wifiAllowed = useWifiAutoplayAllowed()
  const [userPlayOverride, setUserPlayOverride] = useState(false)
  useEffect(() => {
    if (!shouldPlay) setUserPlayOverride(false)
  }, [shouldPlay])
  // FE-061: callback error stabil agar memo ExpoVideoPlayerInner hit.
  const handlePlayerError = useCallback(() => setFailed(true), [])
  const effectiveShouldPlay = shouldPlay && (wifiAllowed || userInitiatedPlay || userPlayOverride)
  // PERF-FIX (NP-002): gerbang autoplay — diekstrak ke shouldGateVideoAutoplay
  // agar logikanya teruji (lihat tests/feed-video-wifi-autoplay.test.tsx).
  const gated = shouldGateVideoAutoplay({ shouldPlay, wifiAllowed, userInitiatedPlay, userPlayOverride })
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
            priority={posterPriority}
          />
        ) : null}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={translate("Coba muat video lagi")}
          onPress={() => {
            setRetryKey((n) => n + 1)
            setFailed(false)
          }}
          // UX-TCH-015: tinggi tombol ~38px → py-3 ≈ 46px (≥44pt).
          containerClassName="rounded-full bg-background px-4 py-3"
        >
          <View className="flex-row items-center gap-1.5">
            <Icon icon={ArrowClockwise} size="sm" />
            <Text variant="caption" weight={600}>
              {translate("Coba lagi")}
            </Text>
          </View>
        </PressableScale>
        {/* UX-21 (audit etalase 2026-10-10): teks di atas poster butuh scrim. */}
        <View className="rounded-full bg-overlay-media px-3 py-1">
          <Text variant="caption" weight={600} tone="onMedia" className="text-center">
            {translate("Video gagal dimuat")}
          </Text>
        </View>
      </View>
    )
  }

  // PERF-FIX (NP-002): autoplay diminta tapi koneksi seluler → jangan
  // putar otomatis; poster + tombol putar, ketuk = niat eksplisit user.
  // Dilewati bila pemanggil sudah memastikan niat eksplisit (userInitiatedPlay).
  if (gated) {
    // FD-03/VI-07: di dalam galeri, tombol putar milik induk — poster di sini
    // inert supaya tidak ada dua ikon putar (yang besar tak bisa diketuk).
    if (embedded) {
      return <VideoPoster poster={poster} alt={alt} aspectRatio={aspectRatio} priority={posterPriority} />
    }
    return (
      <VideoPoster
        poster={poster}
        alt={alt}
        aspectRatio={aspectRatio}
        label={translate("Putar video")}
        onPress={() => setUserPlayOverride(true)}
        priority={posterPriority}
      />
    )
  }

  // FE-016: belum waktunya diputar dan tanpa niat eksplisit → JANGAN mount
  // player native (`useVideoPlayer({ uri })` dapat memicu buffering walau
  // shouldPlay=false). Tampilkan poster inert sampai kartu benar-benar
  // shouldPlay / user mengetuk. allowTapToggle dikecualikan (pratinjau
  // upload butuh player untuk ketuk-toggle) — lihat shouldMountVideoPlayer.
  if (!shouldMountVideoPlayer({ effectiveShouldPlay, userInitiatedPlay, allowTapToggle })) {
    return <VideoPoster poster={poster} alt={alt} aspectRatio={aspectRatio} priority={posterPriority} />
  }

  return (
    <ExpoVideoPlayer
      key={retryKey}
      source={source}
      aspectRatio={aspectRatio}
      shouldPlay={effectiveShouldPlay}
      muted={muted}
      loop={loop}
      nativeControls={nativeControls}
      allowTapToggle={allowTapToggle}
      onError={handlePlayerError}
      poster={poster}
      alt={alt}
      posterPriority={posterPriority}
      embedded={embedded}
    />
  )
}

/**
 * LR-008: gate slot player konkuren. Bila slot penuh, tampilkan poster statis
 * (tanpa membuat player native) sampai ada slot bebas — lalu me-mount player.
 */
function ExpoVideoPlayer(props: {
  source: string
  aspectRatio: number
  shouldPlay: boolean
  muted: boolean
  loop: boolean
  nativeControls: boolean
  allowTapToggle: boolean
  onError: () => void
  poster?: MediaSource
  alt: string
  /** PERF-FIX (2026-09-30): prioritas unduhan poster saat slot penuh. */
  posterPriority?: "high" | "normal" | "low"
  /** FD-03: lihat FeedVideoProps.embedded. */
  embedded?: boolean
}) {
  // FD-01 (audit etalase 2026-10-10): slot diminta di EFFECT, bukan di
  // initializer state — render yang dibuang React tanpa commit tidak boleh
  // memegang slot tanpa cleanup. Satu cleanup menangani semua jalur: cancel
  // bila masih mengantre, release bila sudah memegang (termasuk slot yang
  // diserahkan lewat `onGranted`). Versi lama membiarkan resolver pemohon
  // yang sudah unmount tetap di antrean → slot bocor permanen.
  const [hasSlot, setHasSlot] = useState(false)
  useEffect(() => {
    let owned = acquireVideoPlayerSlot()
    let cancel: (() => void) | null = null
    if (owned) setHasSlot(true)
    else {
      cancel = waitForVideoPlayerSlot(() => {
        owned = true
        setHasSlot(true)
      })
    }
    return () => {
      cancel?.()
      if (owned) releaseVideoPlayerSlot()
    }
  }, [])
  if (!hasSlot) {
    return <VideoPoster poster={props.poster} alt={props.alt} aspectRatio={props.aspectRatio} priority={props.posterPriority} />
  }
  return <ExpoVideoPlayerInner {...props} />
}

/** Instans player tunggal — di-mount ulang (key) setiap "Coba lagi". */
// FE-061 (audit 2026-09-29): di-memo — identitas source object + callback
// setup yang stabil membuat memo ini benar-benar hit.
const ExpoVideoPlayerInner = memo(function ExpoVideoPlayerInner({
  source,
  aspectRatio,
  shouldPlay,
  muted,
  loop,
  nativeControls,
  allowTapToggle,
  onError,
  embedded = false,
}: {
  source: string
  aspectRatio: number
  shouldPlay: boolean
  muted: boolean
  loop: boolean
  nativeControls: boolean
  allowTapToggle: boolean
  onError: () => void
  /**
   * PERF-FIX (2026-09-30): diterima dari spread ExpoVideoPlayer — tidak
   * dipakai player (tanpa poster), hanya agar tipe spread tetap valid.
   */
  posterPriority?: "high" | "normal" | "low"
  /** FD-03: permukaan video meneruskan sentuhan ke induk (slide galeri). */
  embedded?: boolean
}) {
  // i18n: label aksesibilitas mengikuti bahasa aktif.
  useLanguage()
  // Static require aman: paket terdaftar di package.json. Guard runtime
  // (bukan di sini) yang memutuskan komponen ini boleh di-mount.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { VideoView, useVideoPlayer } = require("expo-video") as typeof import("expo-video")
  // FE-061 (audit 2026-09-29): identitas source object + callback setup
  // distabilkan — inline literal membuat player di-setup ulang tiap render.
  const videoSource = useMemo(() => ({ uri: source }), [source])
  const setupPlayer = useCallback(
    (pl: VideoPlayer) => {
      pl.loop = loop
      pl.muted = muted
    },
    [loop, muted],
  )
  const player = useVideoPlayer(videoSource, setupPlayer)
  useSyncPlayer(player, shouldPlay, muted, loop)

  /**
   * Force-close saat reply (2026-10-03, defensif): `useVideoPlayer` me-release
   * player native otomatis saat unmount (`useReleasingSharedObject`), tapi
   * pause eksplisit DULU menghindari decoder native di-teardown saat masih
   * memutar. Cleanup ini didaftarkan SETELAH `useVideoPlayer` → berjalan
   * SEBELUM release otomatis (cleanup effect urutan terbalik). Jangan panggil
   * `player.release()` manual — double-release justru berbahaya.
   */
  useEffect(() => {
    return () => {
      try {
        player.pause()
      } catch {
        // Player mungkin sudah tidak valid — abaikan, release otomatis
        // dari useVideoPlayer tetap berjalan.
      }
    }
  }, [player])

  /**
   * Guard state-update pasca-unmount: listener native bisa mengirim event
   * yang sudah antre tepat saat unmount; setState setelah itu adalah
   * no-op berbahaya di teardown native.
   */
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const sub = player.addListener("statusChange", (event: { status?: string }) => {
      if (event?.status === "error" && mountedRef.current) onError()
    })
    return () => sub.remove()
  }, [player, onError])

  const [tapPaused, setTapPaused] = useState(true)
  useEffect(() => {
    if (!allowTapToggle) return
    const sub = player.addListener("playingChange", (event) => {
      if (mountedRef.current) setTapPaused(!event.isPlaying)
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
      // FD-03: di dalam galeri, permukaan video bukan target sentuhan —
      // ketukan jatuh ke slide (buka viewer). Ketuk-toggle pratinjau tetap
      // butuh sentuhan, jadi dikecualikan.
      style={{ aspectRatio, pointerEvents: embedded && !allowTapToggle ? "none" : undefined }}
    >
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        nativeControls={nativeControls}
        accessibilityLabel={translate("Video")}
      />
      {/* Keep VideoView mounted when the opening gesture expires. */}
      {allowTapToggle && !nativeControls ? (
        <PressableScale containerClassName="absolute inset-0 flex-1" className="flex-1"
          accessibilityRole="button" accessibilityLabel={translate("Putar/jeda video")} onPress={handleTap}>
          {tapPaused ? (
            <View style={{ pointerEvents: "none" }} className="flex-1 items-center justify-center">
              <View className="items-center justify-center rounded-full bg-overlay-media p-4">
                <Icon icon={Play} size="lg" weight="fill" tone="onMedia" />
              </View>
            </View>
          ) : null}
        </PressableScale>
      ) : null}
    </View>
  )
  return frame
})

export function FeedVideo({
  source,
  poster,
  alt,
  shouldPlay = false,
  muted = true,
  loop = false,
  nativeControls = false,
  allowTapToggle = false,
  userInitiatedPlay = false,
  aspectRatio = 1,
  className,
  posterPriority,
  embedded = false,
  ...rest
}: FeedVideoProps) {
  // i18n: label aksesibilitas mengikuti bahasa aktif.
  useLanguage()
  const available = isExpoVideoAvailable()
  const fallback = <VideoPoster poster={poster} alt={alt} aspectRatio={aspectRatio} className={className} priority={posterPriority} />
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
          userInitiatedPlay={userInitiatedPlay}
          posterPriority={posterPriority}
          embedded={embedded}
        />
      </VideoErrorBoundary>
    </View>
  )
}
