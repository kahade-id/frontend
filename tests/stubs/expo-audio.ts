/**
 * Stub `expo-audio` untuk Vitest.
 *
 * Kenapa perlu stub (non-obvious): `expo-audio` menarik `expo/build/winter`
 * (runtime browser Expo) saat modul dievaluasi — di Node/jsdom rantai itu
 * gagal dengan "Cannot find module .../utils/getBundleUrl" (impor ESM tanpa
 * ekstensi yang hanya valid untuk Metro), sehingga SEMUA test yang mengimpor
 * komponen voice note mati sebelum sempat jalan (mis.
 * tests/chat-verified-badge.test.tsx: <ChatMessageRow> → <VoiceNotePlayer> →
 * lib/use-audio-playback → expo-audio).
 *
 * Pemutar & perekam di sini sengaja INERT (nilai "tidak ada perangkat"):
 * voice note adalah efek perangkat, bukan objek test. Hook mengembalikan
 * objek stabil (dibuat per panggilan tapi bentuknya selalu sama) dengan
 * metode async no-op — cukup agar komponen chat yang memuat voice-note tetap
 * bisa dirender dan dites presentasinya.
 */

type PermissionResponse = {
  granted: boolean
  status: string
  canAskAgain: boolean
  expires: string
}

const GRANTED: PermissionResponse = {
  granted: true,
  status: "granted",
  canAskAgain: false,
  expires: "never",
}

export const RecordingPresets = {
  HIGH_QUALITY: { extension: ".m4a", sampleRate: 44100, numberOfChannels: 1, bitRate: 128000 },
  LOW_QUALITY: { extension: ".m4a", sampleRate: 16000, numberOfChannels: 1, bitRate: 32000 },
} as const

export async function getRecordingPermissionsAsync(): Promise<PermissionResponse> {
  return GRANTED
}

export async function requestRecordingPermissionsAsync(): Promise<PermissionResponse> {
  return GRANTED
}

export async function setAudioModeAsync(): Promise<void> {}

/** Status pemutar default: belum dimuat, tidak bermain. */
export type AudioStatus = {
  isLoaded: boolean
  playing: boolean
  currentTime: number
  duration: number
  didJustFinish: boolean
  error: string | null
}

export function useAudioPlayer(): {
  play: () => void
  pause: () => void
  remove: () => void
  replace: (source: unknown) => void
  seekTo: (seconds: number) => Promise<void>
  seekBy: (delta: number) => void
  setPlaybackRate: (rate: number, pitchCorrection?: boolean) => void
  volume: number
  muted: boolean
  playing: boolean
  currentTime: number
  duration: number
  shouldCorrectPitch: boolean
} {
  return {
    play: () => {},
    pause: () => {},
    remove: () => {},
    replace: () => {},
    seekTo: async () => {},
    seekBy: () => {},
    setPlaybackRate: () => {},
    volume: 1,
    muted: false,
    playing: false,
    currentTime: 0,
    duration: 0,
    shouldCorrectPitch: true,
  }
}

export function useAudioPlayerStatus(): AudioStatus {
  return {
    isLoaded: false,
    playing: false,
    currentTime: 0,
    duration: 0,
    didJustFinish: false,
    error: null,
  }
}

export function useAudioRecorder(): {
  prepareToRecordAsync: (preset?: unknown) => Promise<void>
  record: (options?: unknown) => void
  stop: () => Promise<void>
  pause: () => Promise<void>
  remove: () => Promise<void>
  getStatus: () => { durationMillis: number; isRecording: boolean; uri: string | null }
  isRecording: boolean
  uri: string | null
  currentTime: number
} {
  return {
    prepareToRecordAsync: async () => {},
    record: () => {},
    stop: async () => {},
    pause: async () => {},
    remove: async () => {},
    getStatus: () => ({ durationMillis: 0, isRecording: false, uri: null }),
    isRecording: false,
    uri: null,
    currentTime: 0,
  }
}

export function useAudioRecorderState(): { durationMillis: number; isRecording: boolean } {
  return { durationMillis: 0, isRecording: false }
}

export default {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
}
