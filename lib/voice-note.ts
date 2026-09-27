/**
 * Kahade — helper voice note (lapisan MURNI, tanpa runtime native).
 *
 * Dipakai <VoiceNoteRecorder> (perekaman) dan layar chat (validasi sebelum
 * antre ke unggahan). Konstanta batas diselaraskan dengan lampiran chat lain
 * (10 MB) supaya satu aturan ukuran di semua jalur kirim.
 *
 * Bukan di sini: izin mikrofon & perekaman (expo-av, hanya di komponen),
 * pengunggahan (endpoint upload ruang yang sudah ada), dan pengiriman
 * (messageType "VOICE" — sudah ada di kontrak SendMessageDto).
 */

/** MIME rekaman expo-av preset HIGH_QUALITY (m4a/AAC di iOS & Android). */
export const VOICE_NOTE_MIME = "audio/m4a"
/** Batas durasi rekam — perekam auto-stop saat tercapai. */
export const VOICE_NOTE_MAX_DURATION_MS = 5 * 60 * 1000
/** Durasi minimum agar tidak terkirim rekaman tak sengaja (< 1 detik). */
export const VOICE_NOTE_MIN_DURATION_MS = 1000
/** Batas ukuran = batas lampiran chat lain (10 MB, server 50 MB). */
export const VOICE_NOTE_MAX_BYTES = 10 * 1024 * 1024

export type VoiceNoteFile = {
  /** URI lokal hasil rekaman (file://). */
  uri: string
  name: string
  mimeType: string
  /** Byte; 0 bila platform tidak melaporkan — server tetap gate. */
  size: number
  /** Durasi rekaman dalam milidetik. */
  durationMs: number
}

/** "M:SS" — dipakai timer perekam & pratinjau. */
export function formatVoiceNoteDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

/** Nama berkas stabil & unik: vn-20260928-005512.m4a. */
export function voiceNoteFileName(at: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `vn-${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}.m4a`
}

/** MIME audio apa pun (m4a/mp3/wav/webm…) — untuk pemetaan messageType. */
export function isAudioMime(mime: string | null | undefined): boolean {
  return typeof mime === "string" && mime.startsWith("audio/")
}

export type VoiceNoteValidation = { ok: true } | { ok: false; reason: "too-big" | "too-short" | "too-long" }

/**
 * Validasi rekaman sebelum diantrekan ke unggahan. `size` 0 = platform tidak
 * melaporkan; lewatkan (server tetap menolak > 50 MB) — pola sama seperti
 * lampiran gambar.
 */
export function validateVoiceNoteFile(input: { size: number; durationMs: number }): VoiceNoteValidation {
  if (input.size > VOICE_NOTE_MAX_BYTES) return { ok: false, reason: "too-big" }
  if (input.durationMs < VOICE_NOTE_MIN_DURATION_MS) return { ok: false, reason: "too-short" }
  if (input.durationMs > VOICE_NOTE_MAX_DURATION_MS) return { ok: false, reason: "too-long" }
  return { ok: true }
}

/** Pesan toast untuk tiap alasan penolakan validasi. */
export function voiceNoteValidationMessage(reason: Exclude<VoiceNoteValidation, { ok: true }>["reason"]): string {
  switch (reason) {
    case "too-big":
      return "Ukuran voice note maksimal 10 MB."
    case "too-short":
      return "Rekaman terlalu pendek — tahan dan rekam minimal 1 detik."
    case "too-long":
      return "Durasi voice note maksimal 5 menit."
  }
}

/**
 * Pola bar waveform DEKORATIF untuk <VoiceNotePlayer> — deterministik
 * (xorshift32 dari hash FNV-1a `seed`, biasanya id pesan) supaya stabil
 * antar render & sesi.
 *
 * JUJUR: ini BUKAN amplitudo audio yang sebenarnya — backend tidak menyimpan
 * data amplitudo. Jangan pernah mengklaim/menampilkannya sebagai
 * visualisasi asli. Nilai 0.25..1 (proporsi tinggi bar maksimum).
 */
export function decorativeWaveform(seed: string, count: number): number[] {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  let state = h || 0x9e3779b9
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    const r = (state >>> 0) / 0xffffffff
    // Tinggi 25%..100% — hindari bar yang nyaris tak terlihat.
    out.push(0.25 + r * 0.75)
  }
  return out
}
