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
 *   - Perekaman memakai `expo-audio` (SDK 58): `expo-av` sudah TIDAK dikirim
 *     lagi di kontrak SDK 58 (tidak ada di `expo/bundledNativeModules.json`),
 *     jadi `Audio.Recording`/`Audio.Sound` digantikan `useAudioRecorder` dan
 *     `useAudioPlayer`. Di web perekaman bisa melempar (tidak didukung):
 *     ditangkap jadi state "unsupported" dengan pesan ramah, bukan crash.
 *     Sama untuk izin yang ditolak → state "denied" + arahan buka pengaturan.
 *   - Ukuran berkas diambil via expo-file-system (File API), bukan dari
 *     status rekaman — ukuran dilaporkan `RecorderState.fileSize` tapi baru
 *     final setelah `stop()`, jadi tetap dibaca dari berkasnya.
 *   - Indikator rekam (titik merah) berdenyut dengan Animated loop; bila
 *     `useReducedMotion` aktif, titik tampil statis. backgroundColor diambil
 *     dari tokens (larangan bg-* di Animated.View).
 *   - Rekaman yang masih berjalan DIBATALKAN saat sheet ditutup/unmount —
 *     tidak ada rekaman hantu yang terus merekam di latar.
 */
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio"
import { Microphone, Pause, Play, Stop, Trash } from "phosphor-react-native"
import { useCallback, useEffect, useRef, useState } from "react"
import { Animated, AppState, Easing, View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Dialog } from "@/components/ui/modal"
import { Text } from "@/components/ui/text"
import { useTheme } from "@/components/theme-provider"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { tokens } from "@/lib/tokens"
import { translate, useLanguage } from "@/lib/i18n"
import { readRecordedFileSize } from "@/lib/voice-note-file"
import {
  isExternalRecordingStop,
  resolveRecordingInterruption,
} from "@/lib/voice-note-interruption"
import {
  formatVoiceNoteDuration,
  validateVoiceNoteFile,
  VOICE_NOTE_MAX_DURATION_MS,
  VOICE_NOTE_MIME,
  voiceNoteFileName,
  type VoiceNoteFile,
} from "@/lib/voice-note"
import { restorePlaybackAudioMode } from "@/lib/use-audio-playback"

export type { VoiceNoteFile }

type RecorderState = "idle" | "requesting" | "denied" | "unsupported" | "ready" | "recording" | "review"

/**
 * Audit Pesan 2026-10-10 (#7): pemberitahuan setelah rekaman terhenti dari
 * luar (panggilan masuk, aplikasi lain merebut audio, aplikasi ke latar).
 * "kept" = bagian yang sempat terekam disimpan ke pratinjau; "lost" = terlalu
 * pendek / berkas tidak ada → kembali siap rekam. Keduanya diberi tahu —
 * tidak ada yang diam-diam.
 */
type RecorderNotice = "interrupted-kept" | "interrupted-lost" | "too-short" | null

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
  const [recordedUri, setRecordedUri] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  // B3O-22: konfirmasi sebelum membuang rekaman yang berarti.
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)
  const [notice, setNotice] = useState<RecorderNotice>(null)
  /** #7: pernah melihat `isRecording === true` di sesi rekam ini. */
  const sawRecordingRef = useRef(false)
  /** #7: penghentian sedang/sudah ditangani (manual, auto-stop, atau interupsi). */
  const stoppingRef = useRef(false)

  // UX-A11Y-007: label aksesibilitas harus ikut ganti bahasa.
  useLanguage()

  // UX-A11Y-007: quantize pengumuman durasi ke 5 detik (pola UX-A11Y-001).
  const SPOKEN_QUANTUM_MS = 5_000
  const spokenDurationMs = Math.floor(durationMs / SPOKEN_QUANTUM_MS) * SPOKEN_QUANTUM_MS

  // SDK 58: SATU recorder untuk seumur komponen (bukan instance per sesi
  // rekam seperti `new Audio.Recording()` di expo-av). Sesi baru cukup
  // `record()` lagi setelah `stop()`.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recState = useAudioRecorderState(recorder, TICK_MS)
  // Pemutar pratinjau; sumbernya baru ada setelah rekaman dihentikan.
  const previewPlayer = useAudioPlayer(recordedUri ? { uri: recordedUri } : null)
  const previewStatus = useAudioPlayerStatus(previewPlayer)
  /** Status putar dibaca dari player, bukan state lokal (SDK 58). */
  const playing = previewStatus.playing

  const aliveRef = useRef(true)
  const pulse = useRef(new Animated.Value(1)).current

  /**
   * Durasi saat merekam dibaca dari recorder (polling `useAudioRecorderState`),
   * bukan dari `setInterval` + `getStatusAsync` seperti di expo-av.
   */
  useEffect(() => {
    if (state !== "recording") return
    setDurationMs(recState.durationMillis ?? 0)
  }, [state, recState.durationMillis])

  /** Hentikan pratinjau dan kembalikan posisi ke awal. */
  const stopPreview = useCallback(() => {
    try {
      previewPlayer.pause()
      void previewPlayer.seekTo(0).catch(() => {})
    } catch {
      // Player tanpa sumber (belum ada rekaman) — abaikan.
    }
  }, [previewPlayer])

  /** Batalkan & buang rekaman yang sedang berjalan (tutup sheet/unmount). */
  const discardRecording = useCallback(async () => {
    if (!recorder.isRecording) return
    try {
      await recorder.stop()
    } catch {
      // Rekaman sudah berhenti / tidak valid — abaikan.
    }
    // Batch 3: mode PUTAR dipasang ulang (speaker, bukan earpiece).
    void restorePlaybackAudioMode()
  }, [recorder])

  const reset = useCallback(() => {
    void discardRecording()
    stopPreview()
    setDurationMs(0)
    setRecordedUri(null)
    setSending(false)
    setNotice(null)
    sawRecordingRef.current = false
    stoppingRef.current = false
    setState("idle")
  }, [discardRecording, stopPreview])

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

  /**
   * 2026-10-08 (bug: habis rekam & tekan stop, perekam menyala lagi).
   *
   * `reset` bergantung pada `stopPreview` → `previewPlayer`, dan
   * `useAudioPlayer(source)` MEMBERI instance player baru setiap kali
   * `recordedUri` berubah. Jadi begitu `stopRecording()` menetapkan
   * `recordedUri`, identitas `reset` ikut berubah → effect ini berjalan
   * ulang padahal sheet sedang terbuka (`visible === true`) →
   * `setState("requesting")` → izin sudah ada → `setState("ready")`.
   * State "review" yang baru saja ditampilkan ditimpa, dan yang user lihat
   * adalah tombol rekam siap pakai lagi — seolah-olah rekam ulang.
   *
   * Perbaikan: effect izin TIDAK boleh bergantung pada `reset`. Dependensi
   * efektifnya cukup `visible`; `reset` dibaca lewat ref supaya effect
   * berjalan TEPAT SATU KALI per kali sheet dibuka.
   */
  const resetRef = useRef(reset)
  useEffect(() => {
    resetRef.current = reset
  }, [reset])

  // Minta izin saat sheet dibuka.
  useEffect(() => {
    aliveRef.current = true
    if (!visible) {
      resetRef.current()
      return
    }
    setState("requesting")
    let cancelled = false
    ;(async () => {
      try {
        // SDK 58 (expo-audio): nama mode audio berbeda dari expo-av —
        // `allowsRecording`/`playsInSilentMode` (tanpa akhiran `IOS`).
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
        const perm = await requestRecordingPermissionsAsync()
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
  }, [visible])

  useEffect(() => {
    return () => {
      aliveRef.current = false
      void discardRecording()
      stopPreview()
    }
  }, [discardRecording, stopPreview])

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
    setNotice(null)
    sawRecordingRef.current = false
    stoppingRef.current = false
    try {
      await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY)
      // `forDuration` = rem native: rekaman berhenti sendiri di batas 5 menit
      // walau JS sedang sibuk. Transisi UI ke "review" tetap dipicu effect di
      // bawah (durasi dari `useAudioRecorderState`).
      recorder.record({ forDuration: Math.ceil(VOICE_NOTE_MAX_DURATION_MS / 1000) })
      setDurationMs(0)
      setState("recording")
    } catch {
      setState("unsupported")
    }
  }, [state, recorder])

  /**
   * Audit Pesan 2026-10-10 (#7): SATU jalur penghentian untuk stop manual,
   * auto-stop batas durasi, aplikasi ke latar, dan interupsi OS. `stoppingRef`
   * memastikan jalur ini berjalan sekali per sesi rekam — tanpa itu efek
   * interupsi di bawah ikut menyala saat `isRecording` jatuh karena `stop()`
   * kita sendiri.
   *
   * `interrupted=true` → keputusan via `resolveRecordingInterruption`: bagian
   * yang sempat terekam disimpan bila ≥ durasi minimum, selain itu dibuang —
   * dan pengguna DIBERI TAHU (notice), bukan menatap timer beku.
   */
  const finalizeRecording = useCallback(
    async (elapsed: number, interrupted: boolean) => {
      if (stoppingRef.current) return
      stoppingRef.current = true
      try {
        // Interupsi OS: recorder mungkin sudah berhenti — `stop()` tetap
        // dipanggil agar berkas ditutup rapi; gagal di sini bukan fatal.
        if (recorder.isRecording) await recorder.stop()
      } catch {
        // Sudah berhenti / tidak valid — lanjut membaca uri.
      }
      // Batch 3 (voice note): perekam meninggalkan `allowsRecording: true` →
      // pratinjau DAN pesan suara berikutnya keluar dari earpiece (pelan).
      // Kembalikan mode putar begitu mikrofon dilepas.
      void restorePlaybackAudioMode()
      // 2026-10-07: beri jeda kecil agar `uri` terisi (race condition di
      // beberapa perangkat Android di mana uri null sesaat setelah stop).
      let uri = recorder.uri
      if (!uri) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        uri = recorder.uri
      }
      if (!aliveRef.current) return
      if (interrupted) {
        const outcome = resolveRecordingInterruption({ uri, durationMs: elapsed })
        if (outcome.kind === "review") {
          setRecordedUri(outcome.uri)
          setDurationMs(outcome.durationMs)
          setNotice("interrupted-kept")
          setState("review")
        } else {
          setRecordedUri(null)
          setDurationMs(0)
          setNotice("interrupted-lost")
          setState("ready")
        }
        return
      }
      if (!uri) {
        // Jangan diam — beri tahu user apa yang terjadi.
        setState("unsupported")
        return
      }
      setRecordedUri(uri)
      setDurationMs(elapsed)
      setState("review")
    },
    [recorder],
  )

  const stopRecording = useCallback(async () => {
    if (!recorder.isRecording) return
    // Durasi terakhir dibaca SEBELUM `stop()` — setelah berhenti, recorder
    // di-reset untuk sesi berikutnya. Audit Pesan 2026-10-10 (media #8):
    // dibaca SINKRON dari `getStatus()` (presisi), bukan state poll 250 ms —
    // rekaman 1,1 dtk dulu bisa terbaca 0,85 dtk lalu ditolak "terlalu pendek".
    let exact = 0
    try {
      exact = recorder.getStatus().durationMillis ?? 0
    } catch {
      // Status tak terbaca — jatuh ke nilai poll.
    }
    await finalizeRecording(Math.max(exact, recState.durationMillis ?? 0), false)
  }, [recorder, recState.durationMillis, finalizeRecording])

  /**
   * Auto-stop di batas maksimum. Sumber kebenarannya `durationMillis` dari
   * recorder (menggantikan `setInterval` + `getStatusAsync` expo-av).
   */
  useEffect(() => {
    if (state !== "recording") return
    if (durationMs < VOICE_NOTE_MAX_DURATION_MS) return
    void stopRecording()
  }, [state, durationMs, stopRecording])

  /**
   * #7: interupsi OS. `isRecording` dari recorder native jatuh ke false TANPA
   * `stop()` dari kita (panggilan telepon, aplikasi lain merebut audio
   * focus, mikrofon dicabut OS). `sawRecordingRef` menahan false sesaat
   * setelah `record()`; `stoppingRef` menahan gema dari stop kita sendiri.
   */
  useEffect(() => {
    if (state !== "recording") return
    if (recState.isRecording) {
      sawRecordingRef.current = true
      return
    }
    if (
      !isExternalRecordingStop({
        isRecording: recState.isRecording,
        sawRecording: sawRecordingRef.current,
        stopping: stoppingRef.current,
      })
    ) {
      return
    }
    void finalizeRecording(durationMs, true)
  }, [state, recState.isRecording, durationMs, finalizeRecording])

  /**
   * #7: aplikasi ke latar saat merekam → hentikan dan simpan yang sudah ada
   * (pola WhatsApp). Dibiarkan jalan di latar = mikrofon menyala tanpa
   * indikator di layar kita, dan OS kerap mematikannya tanpa kabar.
   */
  useEffect(() => {
    if (state !== "recording") return
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") return
      void finalizeRecording(durationMs, true)
    })
    return () => sub.remove()
  }, [state, durationMs, finalizeRecording])

  const togglePreview = useCallback(async () => {
    if (!recordedUri) return
    if (playing) {
      previewPlayer.pause()
      return
    }
    try {
      // Putar dari awal bila pemutaran sebelumnya sudah selesai — expo-audio
      // tidak mengulang otomatis (tidak ada `shouldPlay`/loop di sini).
      if (previewStatus.didJustFinish || previewStatus.currentTime >= previewStatus.duration) {
        await previewPlayer.seekTo(0)
      }
      previewPlayer.play()
    } catch {
      // Gagal memutar pratinjau — rekaman tetap bisa dikirim.
    }
  }, [recordedUri, playing, previewPlayer, previewStatus.didJustFinish, previewStatus.currentTime, previewStatus.duration])

  const sendRecording = useCallback(async () => {
    if (!recordedUri || sending) return
    setSending(true)
    try {
      // Ukuran tak terbaca = 0 — validasi meloloskan (server tetap gate).
      const size = await readRecordedFileSize(recordedUri)
      const validation = validateVoiceNoteFile({ size, durationMs })
      if (!validation.ok) {
        // Media #8: rekaman yang ditolak DIBERI TAHU (live region), bukan
        // diam-diam kembali ke "Mulai merekam".
        setNotice("too-short")
        setState("ready")
        setRecordedUri(null)
        setDurationMs(0)
        return
      }
      stopPreview()
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
  }, [recordedUri, sending, durationMs, stopPreview, onRecorded])

  const retryRecording = useCallback(() => {
    stopPreview()
    setRecordedUri(null)
    setDurationMs(0)
    setNotice(null)
    setState("ready")
  }, [stopPreview])

  // #10 (audit Pesan): semua teks lewat translate() — dulu literal Indonesia.
  const footer = (() => {
    switch (state) {
      case "ready":
        return (
          <Button variant="primary" onPress={() => void startRecording()} leftIcon={Microphone}>
            {translate("Mulai merekam")}
          </Button>
        )
      case "recording":
        return (
          <Button variant="destructive" onPress={() => void stopRecording()} leftIcon={Stop}>
            {translate("Berhenti")}
          </Button>
        )
      case "review":
        return (
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button variant="ghost" onPress={retryRecording} leftIcon={Trash}>
                {translate("Hapus")}
              </Button>
            </View>
            <View className="flex-1">
              <Button variant="primary" onPress={() => void sendRecording()} loading={sending}>
                {translate("Kirim")}
              </Button>
            </View>
          </View>
        )
      case "denied":
      case "unsupported":
        return (
          <Button variant="secondary" onPress={onRequestClose}>
            {translate("Tutup")}
          </Button>
        )
      default:
        return null
    }
  })()

  const noticeText =
    notice === "interrupted-kept"
      ? translate("Rekaman terhenti oleh sistem. Bagian yang sudah terekam disimpan.")
      : notice === "interrupted-lost"
        ? translate("Rekaman terhenti oleh sistem sebelum 1 detik. Coba rekam lagi.")
        : notice === "too-short"
          ? translate("Rekaman terlalu pendek — tahan dan rekam minimal 1 detik.")
          : null

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
            {translate("Menyiapkan mikrofon…")}
          </Text>
        ) : null}

        {/* #7: pemberitahuan interupsi — live region supaya pembaca layar
            juga tahu rekaman berhenti bukan karena ketukan mereka. */}
        {noticeText ? (
          <Text
            variant="caption"
            tone="secondary"
            className="text-center"
            accessibilityLiveRegion="polite"
          >
            {noticeText}
          </Text>
        ) : null}

        {state === "denied" ? (
          <Text variant="body" tone="secondary" className="text-center">
            {translate("Akses mikrofon ditolak. Buka Pengaturan perangkat → Kahade → Mikrofon untuk mengaktifkan pesan suara.")}
          </Text>
        ) : null}

        {state === "unsupported" ? (
          <Text variant="body" tone="secondary" className="text-center">
            {translate(
              "Perekaman suara tidak didukung di perangkat ini. Kamu tetap bisa mengirim gambar, video, atau file.",
            )}
          </Text>
        ) : null}

        {state === "ready" ? (
          <View className="items-center gap-2">
            <Icon icon={Microphone} size="lg" tone="active" />
            <Text variant="body" tone="secondary" className="text-center">
              {translate("Ketuk “Mulai merekam”, bicara, lalu ketuk “Berhenti”.")}
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
              accessibilityLabel={playing ? translate("Jeda pratinjau") : translate("Putar pratinjau")}
            >
              {playing ? translate("Jeda") : translate("Putar")}
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
