/**
 * Kahade — <VoiceNoteRecorder> sheet perekam voice note untuk chat.
 *
 * Alur: minta izin mikrofon → rekam (maks 5 menit, auto-stop) → pratinjau
 * (putar/ulang) → Kirim / Hapus. Hasil berupa `VoiceNoteFile` (URI lokal
 * m4a) yang diserahkan ke pemanggil — pemanggil mengantrekan ke alur unggah
 * lampiran yang sudah ada, persis seperti gambar/video.
 *
 * Keputusan non-obvious:
 *   - Izin diminta saat sheet DIBUKA, bukan saat komponen mount — sheet ini
 *     di-mount permanen oleh layar (visible=false) dan izin prematur memicu
 *     dialog sistem di momen yang salah.
 *   - expo-av `Recording` di web melempar (tidak didukung): ditangkap jadi
 *     state "unsupported" dengan pesan ramah, bukan crash. Sama untuk izin
 *     yang ditolak → state "denied" + arahan buka pengaturan.
 *   - Ukuran berkas diambil via expo-file-system (File API SDK 54), bukan
 *     dari expo-av — `RecordingStatus` tidak melaporkan byte.
 *   - Indikator rekam (titik merah) berdenyut dengan Animated loop; bila
 *     `useReducedMotion` aktif, titik tampil statis. backgroundColor diambil
 *     dari tokens (larangan bg-* di Animated.View).
 *   - Rekaman yang masih berjalan DIBATALKAN saat sheet ditutup/unmount —
 *     tidak ada rekaman hantu yang terus merekam di latar.
 */
import { Audio } from "expo-av"
import { Microphone, Pause, Play, Stop, Trash } from "phosphor-react-native"
import { useCallback, useEffect, useRef, useState } from "react"
import { Animated, Easing, View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Dialog } from "@/components/ui/modal"
import { Text } from "@/components/ui/text"
import { useTheme } from "@/components/theme-provider"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { tokens } from "@/lib/tokens"
import { translate, useLanguage } from "@/lib/i18n"
import {
  formatVoiceNoteDuration,
  validateVoiceNoteFile,
  VOICE_NOTE_MAX_DURATION_MS,
  VOICE_NOTE_MIME,
  voiceNoteFileName,
  type VoiceNoteFile,
} from "@/lib/voice-note"

export type { VoiceNoteFile }

type RecorderState = "idle" | "requesting" | "denied" | "unsupported" | "ready" | "recording" | "review"

export type VoiceNoteRecorderProps = {
  visible: boolean
  /** Diminta menutup (backdrop / drag / X). Parent yang set visible=false. */
  onRequestClose: () => void
  /** Rekaman valid → parent menutup sheet & mengantrekan ke unggahan. */
  onRecorded: (file: VoiceNoteFile) => void
  title?: string
}

const TICK_MS = 250

export function VoiceNoteRecorder({
  visible,
  onRequestClose,
  onRecorded,
  title = translate("Pesan suara"),
}: VoiceNoteRecorderProps) {
  const { mode } = useTheme()
  const dangerFill = tokens.colors.semantic.danger[mode].fill
  const reducedMotion = useReducedMotion()

  const [state, setState] = useState<RecorderState>("idle")
  const [durationMs, setDurationMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [recordedUri, setRecordedUri] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  // B3O-22: konfirmasi sebelum membuang rekaman yang berarti.
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)

  // UX-A11Y-007: label aksesibilitas harus ikut ganti bahasa.
  useLanguage()

  // UX-A11Y-007: quantize pengumuman durasi ke 5 detik (pola UX-A11Y-001).
  const SPOKEN_QUANTUM_MS = 5_000
  const spokenDurationMs = Math.floor(durationMs / SPOKEN_QUANTUM_MS) * SPOKEN_QUANTUM_MS

  const recordingRef = useRef<Audio.Recording | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const aliveRef = useRef(true)
  const pulse = useRef(new Animated.Value(1)).current

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const unloadSound = useCallback(async () => {
    const sound = soundRef.current
    soundRef.current = null
    setPlaying(false)
    if (sound) {
      try {
        await sound.unloadAsync()
      } catch {
        // Sudah di-unload / tidak valid — abaikan.
      }
    }
  }, [])

  /** Batalkan & buang rekaman yang sedang berjalan (tutup sheet/unmount). */
  const discardRecording = useCallback(async () => {
    clearTick()
    const recording = recordingRef.current
    recordingRef.current = null
    if (recording) {
      try {
        const status = await recording.getStatusAsync()
        if (status.canRecord || status.isRecording) {
          await recording.stopAndUnloadAsync()
        }
      } catch {
        // Rekaman sudah berhenti / tidak valid — abaikan.
      }
    }
  }, [clearTick])

  const reset = useCallback(() => {
    void discardRecording()
    void unloadSound()
    setDurationMs(0)
    setRecordedUri(null)
    setSending(false)
    setState("idle")
  }, [discardRecording, unloadSound])

  /**
   * B3O-22: back/backdrop/X saat ada rekaman yang berarti (>3 dtk sedang
   * direkam, atau hasil rekaman di pratinjau) meminta konfirmasi dulu —
   * sebelumnya rekaman hilang diam-diam.
   */
  const hasMeaningfulRecording =
    (state === "recording" && durationMs > 3000) || (state === "review" && recordedUri != null)
  const handleRequestClose = useCallback(() => {
    if (hasMeaningfulRecording) {
      setConfirmDiscardOpen(true)
      return
    }
    onRequestClose()
  }, [hasMeaningfulRecording, onRequestClose])

  // Minta izin saat sheet dibuka.
  useEffect(() => {
    aliveRef.current = true
    if (!visible) {
      reset()
      return
    }
    setState("requesting")
    let cancelled = false
    ;(async () => {
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
        const perm = await Audio.requestPermissionsAsync()
        if (cancelled || !aliveRef.current) return
        setState(perm.granted ? "ready" : "denied")
      } catch {
        // Web / perangkat tanpa dukungan rekam.
        if (!cancelled && aliveRef.current) setState("unsupported")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [visible, reset])

  useEffect(() => {
    return () => {
      aliveRef.current = false
      void discardRecording()
      void unloadSound()
    }
  }, [discardRecording, unloadSound])

  // Denyut titik rekam — statis bila reduced motion.
  useEffect(() => {
    if (state !== "recording" || reducedMotion) {
      pulse.setValue(1)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [state, reducedMotion, pulse])

  const startRecording = useCallback(async () => {
    if (state !== "ready") return
    setState("requesting")
    try {
      const recording = new Audio.Recording()
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      await recording.startAsync()
      recordingRef.current = recording
      setDurationMs(0)
      setState("recording")
      tickRef.current = setInterval(() => {
        void (async () => {
          const rec = recordingRef.current
          if (!rec) return
          try {
            const status = await rec.getStatusAsync()
            const elapsed = status.durationMillis ?? 0
            setDurationMs(elapsed)
            if (elapsed >= VOICE_NOTE_MAX_DURATION_MS) {
              await stopRecording()
            }
          } catch {
            // Status sesaat tak terbaca — tick berikutnya mencoba lagi.
          }
        })()
      }, TICK_MS)
    } catch {
      recordingRef.current = null
      setState("unsupported")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const stopRecording = useCallback(async () => {
    const recording = recordingRef.current
    if (!recording) return
    clearTick()
    try {
      await recording.stopAndUnloadAsync()
      const status = await recording.getStatusAsync()
      const uri = recording.getURI()
      const elapsed = status.durationMillis ?? 0
      recordingRef.current = null
      if (!uri) {
        setState("unsupported")
        return
      }
      setRecordedUri(uri)
      setDurationMs(elapsed)
      setState("review")
    } catch {
      recordingRef.current = null
      setState("ready")
    }
  }, [clearTick])

  const togglePreview = useCallback(async () => {
    if (!recordedUri) return
    if (playing) {
      const sound = soundRef.current
      if (sound) await sound.pauseAsync()
      setPlaying(false)
      return
    }
    try {
      let sound = soundRef.current
      if (!sound) {
        const created = await Audio.Sound.createAsync({ uri: recordedUri }, { shouldPlay: false })
        sound = created.sound
        soundRef.current = sound
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlaying(false)
          }
        })
      }
      await sound.playAsync()
      setPlaying(true)
    } catch {
      // Gagal memutar pratinjau — rekaman tetap bisa dikirim.
      setPlaying(false)
    }
  }, [recordedUri, playing])

  const sendRecording = useCallback(async () => {
    if (!recordedUri || sending) return
    setSending(true)
    try {
      let size = 0
      try {
        const { File } = await import("expo-file-system")
        const file = new File(recordedUri)
        const reported = (file as unknown as { size?: number }).size
        if (typeof reported === "number") size = reported
      } catch {
        // Ukuran tak terbaca — validasi meloloskan (server tetap gate).
      }
      const validation = validateVoiceNoteFile({ size, durationMs })
      if (!validation.ok) {
        // Terlalu pendek/panjang nyaris tak mungkin (auto-stop + min 1 dtk),
        // tapi tetap ditangani eksplisit, bukan diam.
        setState("ready")
        setRecordedUri(null)
        setDurationMs(0)
        return
      }
      await unloadSound()
      onRecorded({
        uri: recordedUri,
        name: voiceNoteFileName(),
        mimeType: VOICE_NOTE_MIME,
        size,
        durationMs,
      })
    } finally {
      setSending(false)
    }
  }, [recordedUri, sending, durationMs, unloadSound, onRecorded])

  const retryRecording = useCallback(() => {
    void unloadSound()
    setRecordedUri(null)
    setDurationMs(0)
    setState("ready")
  }, [unloadSound])

  const footer = (() => {
    switch (state) {
      case "ready":
        return (
          <Button variant="primary" onPress={() => void startRecording()} leftIcon={Microphone}>
            Mulai merekam
          </Button>
        )
      case "recording":
        return (
          <Button variant="destructive" onPress={() => void stopRecording()} leftIcon={Stop}>
            Berhenti
          </Button>
        )
      case "review":
        return (
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button variant="ghost" onPress={retryRecording} leftIcon={Trash}>
                Hapus
              </Button>
            </View>
            <View className="flex-1">
              <Button variant="primary" onPress={() => void sendRecording()} loading={sending}>
                Kirim
              </Button>
            </View>
          </View>
        )
      case "denied":
      case "unsupported":
        return (
          <Button variant="secondary" onPress={onRequestClose}>
            Tutup
          </Button>
        )
      default:
        return null
    }
  })()

  return (
    <>
    <BottomSheet
      visible={visible}
      onRequestClose={handleRequestClose}
      title={title}
      description={
        state === "recording"
          ? translate("Merekam… ketuk Berhenti bila selesai.")
          : translate("Rekam pesan suara, maksimal {x} menit.", { x: 5 })
      }
      footer={footer}
    >
      <View className="items-center gap-3 py-4">
        {state === "requesting" || state === "idle" ? (
          <Text variant="body" tone="secondary">
            Menyiapkan mikrofon…
          </Text>
        ) : null}

        {state === "denied" ? (
          <Text variant="body" tone="secondary" className="text-center">
            {translate("Akses mikrofon ditolak. Buka Pengaturan perangkat → Kahade → Mikrofon untuk mengaktifkan pesan suara.")}
          </Text>
        ) : null}

        {state === "unsupported" ? (
          <Text variant="body" tone="secondary" className="text-center">
            Perekaman suara tidak didukung di perangkat ini. Kamu tetap bisa mengirim gambar, video, atau file.
          </Text>
        ) : null}

        {state === "ready" ? (
          <View className="items-center gap-2">
            <Icon icon={Microphone} size="lg" tone="active" />
            <Text variant="body" tone="secondary" className="text-center">
              Ketuk “Mulai merekam”, bicara, lalu ketuk “Berhenti”.
            </Text>
          </View>
        ) : null}

        {state === "recording" ? (
          // UX-A11Y-007: indikator + timer sebagai SATU elemen timer —
          // label di-quantize 5 detik (pola UX-A11Y-001) agar live region
          // "polite" mengumumkan progres tanpa spam tiap 250ms. Label di
          // Animated.View DIHAPUS (tanpa `accessible` = kode mati).
          <View
            className="flex-row items-center gap-3"
            accessible
            accessibilityRole="timer"
            accessibilityLiveRegion="polite"
            accessibilityLabel={translate("Merekam {x}", {
              x: formatVoiceNoteDuration(spokenDurationMs),
            })}
          >
            <Animated.View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: dangerFill,
                opacity: pulse,
                transform: [{ scale: pulse }],
              }}
            />
            <Text variant="h2" weight={600} tone="primary" className="tabular-nums">
              {formatVoiceNoteDuration(durationMs)}
            </Text>
          </View>
        ) : null}

        {state === "review" ? (
          <View className="w-full flex-row items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
            <Button
              fullWidth={false}
              variant="secondary"
              onPress={() => void togglePreview()}
              leftIcon={playing ? Pause : Play}
              accessibilityLabel={playing ? "Jeda pratinjau" : "Putar pratinjau"}
            >
              {playing ? "Jeda" : "Putar"}
            </Button>
            <View className="flex-1">
              <Text variant="body" weight={600} tone="primary">
                {translate("Pesan suara")}
              </Text>
              <Text variant="caption" tone="secondary" className="tabular-nums">
                {formatVoiceNoteDuration(durationMs)}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </BottomSheet>
    {/* B3O-22: konfirmasi buang rekaman — sibling sheet, bukan anak. */}
    <Dialog
      visible={confirmDiscardOpen}
      title={translate("Buang rekaman?")}
      description={translate("Rekaman pesan suara ini akan dihapus dan tidak bisa dikembalikan.")}
      confirmLabel={translate("Buang")}
      cancelLabel={translate("Lanjutkan")}
      destructive
      onConfirm={() => {
        setConfirmDiscardOpen(false)
        onRequestClose()
      }}
      onRequestClose={() => setConfirmDiscardOpen(false)}
    />
    </>
  )
}
