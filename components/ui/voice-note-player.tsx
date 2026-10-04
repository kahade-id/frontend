/**
 * Kahade — <VoiceNotePlayer> pemutar voice note di dalam bubble chat.
 *
 * Pesan `messageType: "VOICE"` tiba sebagai lampiran audio (direkam via
 * <VoiceNoteRecorder> → expo-audio). Sebelum batch ini, lampiran audio hanya
 * tampil sebagai baris ikon generik (tidak bisa diputar) — komponen ini
 * memberikan kontrol putar/jeda, kecepatan 1x/2x, dan waveform.
 *
 * Keputusan non-obvious:
 *   - WAVEFORM DEKORATIF, BUKAN AMPLITUDO ASLI: backend tidak menyimpan
 *     data amplitudo; pola bar dibangkitkan deterministik (PRNG xorshift32
 *     dari hash FNV-1a `messageId`) supaya stabil antar render. Jangan
 *     pernah mengklaim ini visualisasi audio yang sebenarnya.
 *   - Pemutar memakai `expo-audio` (SDK 58): `expo-av` tidak lagi dikirim di
 *     kontrak SDK 58. Player dibuat tanpa sumber (`useAudioPlayer(null)`) dan
 *     sumber baru dipasang saat tombol putar pertama ditekan (`player.replace`)
 *     — pemuatan tetap MALAS, sama seperti `Audio.Sound.createAsync` sebelumnya.
 *   - Status (posisi/durasi/playing/error) dibaca dari `useAudioPlayerStatus`,
 *     bukan dari callback `setOnPlaybackStatusUpdate`.
 *   - SATU pemutar aktif dalam satu waktu: memulai yang baru menghentikan
 *     yang lama (registry level modul) — dua voice note tidak bertumpuk.
 *   - Progres di-update via `onPlaybackStatusUpdate` (state biasa, tanpa
 *     Animated loop) — otomatis patuh `useReducedMotion`; <PressableScale>
 *     juga mematikannya secara internal.
 *   - `setRateAsync(rate, true)` (koreksi pitch): bila platform melempar
 *     (mis. web lama), kecepatan dikembalikan ke 1x diam-diam — tombol
 *     tidak boleh macet di "2x" tanpa efek.
 *   - Gagal muat (jaringan/URL basi) → state error yang jujur + bisa coba
 *     lagi lewat tombol putar, bukan spinner abadi.
 */
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio"
import { Pause, Play } from "phosphor-react-native"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View } from "react-native"

import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { useTheme } from "@/components/theme-provider"
import { translate, useLanguage } from "@/lib/i18n"
import { tokens } from "@/lib/tokens"
import { decorativeWaveform, formatVoiceNoteDuration } from "@/lib/voice-note"

/** Jumlah bar waveform — cukup rapat di lebar bubble (±180px). */
export const VOICE_WAVEFORM_BARS = 32
/** Tinggi bar maksimum (px). */
const BAR_MAX_HEIGHT = 26

/**
 * Registry pemutar aktif: satu suara dalam satu waktu.
 * Menyimpan `owner` (identitas instance) agar `toggle()` hanya menghentikan
 * pemutar LAIN — bukan diri sendiri (P0 2026-10-03: stop tanpa syarat membuat
 * pause tak pernah berhasil karena status dibaca setelah diri di-pause).
 */
let activePlayer: { owner: object; stop: () => void } | null = null

export type VoiceNotePlayerProps = {
  /** URL berkas audio (fileUrl lampiran). */
  uri: string
  /** Id pesan — seed pola waveform dekoratif. */
  messageId: string
  /** Warna mengikuti bubble: outgoing = bg-primary, incoming = bg-surface. */
  direction: "incoming" | "outgoing"
  /**
   * UPFV-03: refresh signed URL yang kedaluwarsa (TTL 5 menit). Dipanggil
   * SEKALI saat pemuatan audio gagal — pola sama seperti `Picture` onError
   * pada thumbnail lampiran (`onRefreshAttachmentUrl`). Mengembalikan URL
   * segar, atau null bila tidak tersedia / refresh gagal.
   */
  onRefreshUrl?: () => Promise<string | null>
}

type PlayerPhase = "idle" | "loading" | "ready" | "error"

export function VoiceNotePlayer({ uri: initialUri, messageId, direction, onRefreshUrl }: VoiceNotePlayerProps) {
  useLanguage()
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const outgoing = direction === "outgoing"

  const [phase, setPhase] = useState<PlayerPhase>("idle")
  const [playing, setPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [rate, setRate] = useState<1 | 2>(1)

  /**
   * UPFV-03: URI di-state (bukan prop langsung) agar bisa di-retry dengan
   * URL segar saat signed URL kedaluwarsa — pola `Picture` onError pada
   * thumbnail (`chat-attachment-item.tsx`).
   */
  const [uri, setUri] = useState(initialUri)
  /** Refresh URL hanya dicoba SEKALI per URI (anti-loop). */
  const urlRefreshTried = useRef(false)

  const aliveRef = useRef(true)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  /**
   * Identitas unik instance ini untuk registry `activePlayer`.
   * Dipakai untuk membedakan "pemutar lain" dari diri sendiri —
   * toggle tidak boleh menghentikan diri sendiri (P0 2026-10-03).
   */
  const playerIdRef = useRef<object>({})

  /**
   * SDK 58 (expo-audio): player dibuat TANPA sumber. Sumber dipasang saat
   * tombol putar pertama ditekan (`player.replace`) supaya voice note di
   * daftar chat tidak memuat audio sebelum diminta — perilaku malas yang
   * sama dengan `Audio.Sound.createAsync` di expo-av.
   */
  const player = useAudioPlayer(null, { updateInterval: 250 })
  const status = useAudioPlayerStatus(player)
  const loadedRef = useRef(false)

  const bars = useMemo(() => decorativeWaveform(messageId, VOICE_WAVEFORM_BARS), [messageId])
  const playedBars = durationMs > 0 ? Math.floor((positionMs / durationMs) * bars.length) : 0

  /** Buang sumber & kembalikan ke keadaan awal (unmount / URI berganti). */
  const unload = useCallback(() => {
    loadedRef.current = false
    try {
      player.pause()
      player.replace(null)
    } catch {
      // Player sudah dilepas — abaikan.
    }
  }, [player])

  // Unmount → buang sumber; hanya kosongkan registry bila milik kita
  // (jangan mencuri stop milik pemutar lain yang masih aktif).
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (activePlayer?.owner === playerIdRef.current) {
        activePlayer = null
      }
      unload()
    }
  }, [unload])

  // UPFV-03: URI prop berganti (reuse baris FlatList / pesan di-sign ulang)
  // → buang sumber lama, reset state refresh.
  useEffect(() => {
    setUri(initialUri)
    urlRefreshTried.current = false
    unload()
    setPhase("idle")
    setPositionMs(0)
    setDurationMs(0)
  }, [initialUri, unload])

  /**
   * Status player → state UI. `useAudioPlayerStatus` memberi snapshot tiap
   * `updateInterval`, jadi tidak perlu callback seperti `setOnPlaybackStatusUpdate`.
   */
  useEffect(() => {
    if (!aliveRef.current) return
    if (status.isLoaded && !loadedRef.current) {
      loadedRef.current = true
      setPhase("ready")
    }
    if (status.isLoaded) {
      setDurationMs(Math.round((status.duration ?? 0) * 1000))
    }
    setPositionMs(Math.round((status.currentTime ?? 0) * 1000))
    setPlaying(status.playing)
    if (status.didJustFinish) {
      // Kembali ke awal ala WhatsApp — siap diputar ulang.
      void player.seekTo(0).catch(() => {})
    }
  }, [status, player])

  /**
   * UPFV-03: pemuatan gagal (mis. signed URL kedaluwarsa → 403) — coba
   * SEKALI dengan URL segar sebelum menyerah ke state error.
   */
  useEffect(() => {
    if (!aliveRef.current || !status.error) return
    if (urlRefreshTried.current || !onRefreshUrl) {
      setPhase("error")
      return
    }
    urlRefreshTried.current = true
    void (async () => {
      try {
        const fresh = await onRefreshUrl()
        if (fresh && fresh !== uri && aliveRef.current) {
          setUri(fresh)
          player.replace({ uri: fresh })
          player.play()
          return
        }
      } catch {
        // Fall through ke state error di bawah.
      }
      if (aliveRef.current) setPhase("error")
    })()
  }, [status.error, onRefreshUrl, uri, player])

  const toggle = useCallback(async () => {
    // Hentikan pemutar LAIN dulu (satu suara dalam satu waktu) —
    // JANGAN stop diri sendiri: stopper di registry milik instance ini
    // bila ia pemutar aktif, dan pause-diri membuat status berikutnya
    // membaca playing=false lalu langsung memutar lagi (P0).
    if (activePlayer && activePlayer.owner !== playerIdRef.current) {
      activePlayer.stop()
    }
    activePlayer = {
      owner: playerIdRef.current,
      stop: () => {
        try {
          player.pause()
        } catch {
          // Player sudah dilepas — abaikan.
        }
      },
    }
    try {
      if (status.playing) {
        player.pause()
        return
      }
      // Pemuatan malas: sumber baru dipasang saat pertama kali diputar.
      if (!loadedRef.current) {
        setPhase("loading")
        player.replace({ uri })
      }
      player.play()
    } catch {
      if (aliveRef.current) setPhase("error")
    }
  }, [player, status.playing, uri])

  const toggleRate = useCallback(() => {
    const next: 1 | 2 = rate === 1 ? 2 : 1
    setRate(next)
    try {
      // `shouldCorrectPitch` mempertahankan nada (perilaku `setRateAsync(r, true)`).
      player.shouldCorrectPitch = true
      player.playbackRate = next
    } catch {
      // Platform tidak mendukung perubahan rate — kembali ke 1x.
      setRate(1)
    }
  }, [rate, player])

  const barColor = outgoing ? palette.primaryForeground : palette.primary
  const circleBg = outgoing ? palette.primaryForeground : palette.primary

  const loading = phase === "loading"
  const failed = phase === "error"

  /**
   * UX-A11Y-001: pengumuman durasi di-quantize ke 5 detik (pola <Countdown>
   * `announceEverySeconds`). Teks visual tetap tick tiap 250ms, tapi
   * `accessibilityLabel` kontainer hanya berubah tiap 5 detik — live region
   * "polite" tidak lagi menenggelamkan interaksi lain saat audio diputar.
   */
  const SPOKEN_QUANTUM_MS = 5_000
  const spokenPositionMs = Math.floor(positionMs / SPOKEN_QUANTUM_MS) * SPOKEN_QUANTUM_MS
  const timerLabel = loading
    ? translate("Memuat pesan suara…")
    : failed
      ? translate("Pesan suara tidak bisa diputar")
      : translate("Pesan suara {x} dari {y}", {
          x: formatVoiceNoteDuration(spokenPositionMs),
          y: formatVoiceNoteDuration(durationMs),
        })

  return (
    // UX-A11Y-005: role "adjustable" hantu DIHAPUS — tidak ada
    // accessibilityActions/onAccessibilityAction (seek tak tersedia),
    // kontrol palsu membingungkan screen reader.
    <View className="w-56 gap-1.5 py-1">
      <View className="flex-row items-center gap-3">
        {/* Lingkaran tombol: warna dari tokens via style (bukan className bg-*
            — nilai dinamis tergantung direction). */}
        <View style={{ backgroundColor: circleBg }} className="rounded-full">
          <PressableScale
            onPress={() => void toggle()}
            accessibilityLabel={
              failed
                ? translate("Coba putar ulang pesan suara")
                : playing
                  ? translate("Jeda pesan suara")
                  : translate("Putar pesan suara")
            }
            accessibilityRole="button"
            className="p-2.5"
          >
            <Icon
              icon={playing ? Pause : Play}
              tone={outgoing ? "active" : "inverse"}
              size="sm"
              weight="fill"
            />
          </PressableScale>
        </View>

        {/* Waveform dekoratif (lihat docblock): bar statis, warna mengikuti
            progres. Tanpa Animated — patuh reduced motion.
            UX-A11Y-006: label DIHAPUS — View tanpa `accessible` mengabaikan
            accessibilityLabel di native (kode mati yang menyesatkan), dan
            waveform memang dekoratif (pola PRNG, bukan amplitudo asli). */}
        <View className="h-8 flex-1 flex-row items-center gap-[2px]">
          {bars.map((level, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: Math.max(3, Math.round(level * BAR_MAX_HEIGHT)),
                borderRadius: tokens.radius.full,
                backgroundColor: barColor,
              }}
              className={i < playedBars ? undefined : "opacity-40"}
            />
          ))}
        </View>

        <PressableScale
          onPress={() => void toggleRate()}
          accessibilityLabel={translate(rate === 1 ? "Kecepatan putar 2 kali" : "Kecepatan putar normal")}
          accessibilityRole="button"
          hitSlop={8}
          className="min-w-10 items-center rounded-full border border-border px-2 py-1"
        >
          <Text
            variant="caption"
            weight={700}
            tone={outgoing ? "inverse" : "primary"}
            className="tabular-nums"
          >
            {rate === 1 ? "1x" : "2x"}
          </Text>
        </PressableScale>
      </View>

      {/* UX-A11Y-001: baris durasi sebagai SATU elemen timer — label
          aksesibilitas di-quantize 5 detik (lihat timerLabel), bukan live
          region pada teks yang me-render ulang tiap 250ms. */}
      <View
        className="flex-row items-center justify-between pl-14 pr-1"
        accessible
        accessibilityRole="timer"
        accessibilityLiveRegion="polite"
        accessibilityLabel={timerLabel}
      >
        <Text
          variant="caption"
          tone={outgoing ? "inverse" : "secondary"}
          className="tabular-nums"
        >
          {loading
            ? translate("Memuat…")
            : failed
              ? translate("Tidak bisa diputar")
              : `${formatVoiceNoteDuration(positionMs)} / ${formatVoiceNoteDuration(durationMs)}`}
        </Text>
      </View>
    </View>
  )
}
