/**
 * Kahade — <VoiceNotePlayer> pemutar voice note di dalam bubble chat.
 *
 * Pesan `messageType: "VOICE"` tiba sebagai lampiran audio (direkam via
 * <VoiceNoteRecorder> → expo-av). Sebelum batch ini, lampiran audio hanya
 * tampil sebagai baris ikon generik (tidak bisa diputar) — komponen ini
 * memberikan kontrol putar/jeda, kecepatan 1x/2x, dan waveform.
 *
 * Keputusan non-obvious:
 *   - WAVEFORM DEKORATIF, BUKAN AMPLITUDO ASLI: backend tidak menyimpan
 *     data amplitudo; pola bar dibangkitkan deterministik (PRNG xorshift32
 *     dari hash FNV-1a `messageId`) supaya stabil antar render. Jangan
 *     pernah mengklaim ini visualisasi audio yang sebenarnya.
 *   - expo-av `Audio.Sound` (bukan `expo-audio`): repo sudah memakai
 *     expo-av untuk merekam — tidak ada dependency/plugin native baru
 *     (batas keras batch ini).
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
import { Audio, type AVPlaybackStatus } from "expo-av"
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
}

type PlayerPhase = "idle" | "loading" | "ready" | "error"

export function VoiceNotePlayer({ uri, messageId, direction }: VoiceNotePlayerProps) {
  useLanguage()
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const outgoing = direction === "outgoing"

  const [phase, setPhase] = useState<PlayerPhase>("idle")
  const [playing, setPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [rate, setRate] = useState<1 | 2>(1)

  const soundRef = useRef<Audio.Sound | null>(null)
  const aliveRef = useRef(true)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  /**
   * Identitas unik instance ini untuk registry `activePlayer`.
   * Dipakai untuk membedakan "pemutar lain" dari diri sendiri —
   * toggle tidak boleh menghentikan diri sendiri (P0 2026-10-03).
   */
  const playerIdRef = useRef<object>({})

  const bars = useMemo(() => decorativeWaveform(messageId, VOICE_WAVEFORM_BARS), [messageId])
  const playedBars = durationMs > 0 ? Math.floor((positionMs / durationMs) * bars.length) : 0

  const unload = useCallback(async () => {
    const sound = soundRef.current
    soundRef.current = null
    if (sound) {
      try {
        await sound.unloadAsync()
      } catch {
        // Sudah di-unload — abaikan.
      }
    }
  }, [])

  // Unmount → buang sound; hanya kosongkan registry bila milik kita
  // (jangan mencuri stop milik pemutar lain yang masih aktif).
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (activePlayer?.owner === playerIdRef.current) {
        activePlayer = null
      }
      void unload()
    }
  }, [unload])

  const handleStatus = useCallback((status: AVPlaybackStatus) => {
    if (!aliveRef.current || !status.isLoaded) {
      if (aliveRef.current && !status.isLoaded && "error" in status) {
        setPhase("error")
        setPlaying(false)
      }
      return
    }
    setDurationMs(status.durationMillis ?? 0)
    setPositionMs(status.positionMillis ?? 0)
    setPlaying(status.isPlaying)
    if (status.didJustFinish) {
      setPlaying(false)
      // Kembali ke awal ala WhatsApp — siap diputar ulang.
      void soundRef.current?.setPositionAsync(0).catch(() => {})
    }
  }, [])

  const ensureSound = useCallback(async (): Promise<Audio.Sound | null> => {
    if (soundRef.current) return soundRef.current
    setPhase("loading")
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { progressUpdateIntervalMillis: 250 },
        handleStatus,
      )
      if (!aliveRef.current) {
        await sound.unloadAsync().catch(() => {})
        return null
      }
      soundRef.current = sound
      setPhase("ready")
      return sound
    } catch {
      if (aliveRef.current) setPhase("error")
      return null
    }
  }, [uri, handleStatus])

  const toggle = useCallback(async () => {
    // Hentikan pemutar LAIN dulu (satu suara dalam satu waktu) —
    // JANGAN stop diri sendiri: stopper di registry milik instance ini
    // bila ia pemutar aktif, dan pause-diri membuat getStatusAsync()
    // membaca isPlaying=false lalu langsung playAsync() lagi (P0).
    if (activePlayer && activePlayer.owner !== playerIdRef.current) {
      activePlayer.stop()
    }
    const sound = await ensureSound()
    if (!sound || !aliveRef.current) return
    activePlayer = {
      owner: playerIdRef.current,
      stop: () => {
        void sound.pauseAsync().catch(() => {})
      },
    }
    try {
      const status = await sound.getStatusAsync()
      if (status.isLoaded && status.isPlaying) {
        await sound.pauseAsync()
      } else {
        await sound.playAsync()
      }
    } catch {
      if (aliveRef.current) setPhase("error")
    }
  }, [ensureSound])

  const toggleRate = useCallback(async () => {
    const next: 1 | 2 = rate === 1 ? 2 : 1
    setRate(next)
    const sound = soundRef.current
    if (!sound) return
    try {
      await sound.setRateAsync(next, true)
    } catch {
      // Platform tidak mendukung perubahan rate — kembali ke 1x.
      setRate(1)
    }
  }, [rate])

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
