/**
 * Kahade — <VoiceNoteSession> sesi perekam voice note TANPA UI (audit chat C7).
 *
 * Dipakai gestur "tahan untuk merekam" (lib/use-voice-hold). Komponen ini
 * hanya memegang perekam `expo-audio` dan mengekspos `start/stop/cancel`
 * lewat `apiRef` — semua keputusan (kapan mulai, kirim, buang) ada di hook.
 *
 * Kenapa di-mount SESUDAH jari turun, bukan permanen: `useAudioRecorderState`
 * memoll status perekam tiap tick; mounting-nya selamanya di ruang chat berarti
 * render ulang berkala tanpa rekaman apa pun. Jeda tahan (~250 ms) menutupi
 * ongkos mount, jadi pengguna tidak merasakannya.
 *
 * Keputusan non-obvious:
 *   - `getRecordingPermissionsAsync` dipanggil lebih dulu supaya hook tahu
 *     apakah dialog izin MUNCUL (`prompted`) — dialog itu memutus gestur OS,
 *     dan rekaman 0 detik tidak boleh terkirim karenanya.
 *   - Durasi saat berhenti dibaca sinkron dari `recorder.getStatus()` (bukan
 *     dari state yang di-poll 250 ms) — rekaman 1,0 dtk tidak boleh tercatat
 *     0,75 dtk lalu ditolak validasi.
 *   - `uri` kadang null sesaat setelah `stop()` di sebagian Android — dicoba
 *     ulang sekali (pola yang sama dengan lembar perekam).
 *   - Unmount saat masih merekam = buang rekaman (tidak ada rekaman hantu).
 */
import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio"
import { useEffect, useImperativeHandle, useRef, type Ref } from "react"

import type { VoiceSessionApi, VoiceSessionStart } from "@/lib/use-voice-hold"
import {
  VOICE_NOTE_MAX_DURATION_MS,
  VOICE_NOTE_MIME,
  voiceNoteFileName,
  type VoiceNoteFile,
} from "@/lib/voice-note"
import { readRecordedFileSize } from "@/lib/voice-note-file"

const TICK_MS = 250
const URI_RETRY_MS = 300

export type VoiceNoteSessionProps = {
  apiRef: Ref<VoiceSessionApi>
  /** Durasi rekaman terkini (ms) — diteruskan ke hook tiap tick. */
  onDuration?: (ms: number) => void
}

export function VoiceNoteSession({ apiRef, onDuration }: VoiceNoteSessionProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recState = useAudioRecorderState(recorder, TICK_MS)
  const durationRef = useRef(onDuration)
  durationRef.current = onDuration

  useEffect(() => {
    durationRef.current?.(recState.durationMillis ?? 0)
  }, [recState.durationMillis])

  useImperativeHandle(
    apiRef,
    (): VoiceSessionApi => ({
      async start(): Promise<VoiceSessionStart> {
        try {
          // SDK 58 (expo-audio): `allowsRecording`/`playsInSilentMode`.
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
          const current = await getRecordingPermissionsAsync()
          let granted = current.granted
          let prompted = false
          if (!granted) {
            prompted = true
            granted = (await requestRecordingPermissionsAsync()).granted
          }
          if (!granted) return { status: "denied", prompted }
          await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY)
          // `forDuration` = rem native: berhenti sendiri di batas durasi walau JS sibuk.
          recorder.record({ forDuration: Math.ceil(VOICE_NOTE_MAX_DURATION_MS / 1000) })
          return { status: "started", prompted }
        } catch {
          // Web / perangkat tanpa dukungan rekam.
          return { status: "unsupported", prompted: false }
        }
      },

      async stop(): Promise<VoiceNoteFile | null> {
        if (!recorder.isRecording) return null
        // Durasi dibaca SEBELUM stop() — sesudahnya perekam di-reset.
        const status = recorder.getStatus()
        const elapsed = status.durationMillis || Math.round((recorder.currentTime ?? 0) * 1000)
        try {
          await recorder.stop()
          let uri = recorder.uri
          if (!uri) {
            await new Promise((resolve) => setTimeout(resolve, URI_RETRY_MS))
            uri = recorder.uri
          }
          if (!uri) return null
          return {
            uri,
            name: voiceNoteFileName(),
            mimeType: VOICE_NOTE_MIME,
            size: await readRecordedFileSize(uri),
            durationMs: elapsed,
          }
        } catch {
          return null
        }
      },

      async cancel(): Promise<void> {
        if (!recorder.isRecording) return
        try {
          await recorder.stop()
        } catch {
          // Sudah berhenti / tidak valid — abaikan.
        }
      },
    }),
    [recorder],
  )

  // Unmount saat masih merekam → buang (tidak ada rekaman hantu di latar).
  useEffect(
    () => () => {
      try {
        if (recorder.isRecording) void recorder.stop().catch(() => undefined)
      } catch {
        // Perekam sudah dilepas native.
      }
    },
    [recorder],
  )

  return null
}
