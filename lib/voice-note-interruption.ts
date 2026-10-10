/**
 * Kahade — keputusan saat rekaman pesan suara TERHENTI TANPA DIMINTA
 * (audit Pesan 2026-10-10, #7).
 *
 * Perekam native bisa berhenti sendiri: panggilan telepon masuk, aplikasi
 * lain merebut audio focus, aplikasi ke latar, atau OS mematikan mikrofon.
 * Dulu komponen hanya mengamati `durationMillis`; `isRecording` yang jatuh ke
 * false tidak pernah ditangani, sehingga UI tetap "Merekam…" dengan timer
 * beku dan tombol Berhenti yang tidak menghasilkan apa-apa.
 *
 * Aturannya murni (tanpa RN) supaya bisa diuji di Node:
 *   - ada berkas DAN durasi ≥ minimum  → simpan sebagai hasil ("review"),
 *     pengguna tetap bisa memutar/mengirim bagian yang sempat terekam;
 *   - selain itu                       → buang ("discard") dan kembali siap
 *     rekam, dengan pemberitahuan yang jujur — bukan diam.
 */
import { VOICE_NOTE_MIN_DURATION_MS } from "@/lib/voice-note"

export type RecordingInterruptionOutcome =
  | { kind: "review"; uri: string; durationMs: number }
  | { kind: "discard" }

export function resolveRecordingInterruption(input: {
  uri: string | null | undefined
  durationMs: number
  minDurationMs?: number
}): RecordingInterruptionOutcome {
  const min = input.minDurationMs ?? VOICE_NOTE_MIN_DURATION_MS
  const durationMs = Number.isFinite(input.durationMs) ? Math.max(0, input.durationMs) : 0
  if (!input.uri || durationMs < min) return { kind: "discard" }
  return { kind: "review", uri: input.uri, durationMs }
}

/**
 * Transisi pengamatan `isRecording` dari recorder native selama UI berada
 * di state "recording". `sawRecording` = pernah melihat true di sesi ini
 * (melindungi dari false sesaat setelah `record()` dipanggil); `stopping` =
 * pengguna/auto-stop sudah memulai penghentian sendiri.
 *
 * Mengembalikan `true` hanya bila penghentian ini datang dari LUAR
 * (interupsi OS) dan belum ditangani.
 */
export function isExternalRecordingStop(input: {
  isRecording: boolean
  sawRecording: boolean
  stopping: boolean
}): boolean {
  if (input.isRecording) return false
  if (!input.sawRecording) return false
  if (input.stopping) return false
  return true
}
