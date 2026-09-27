/**
 * Test lapisan murni voice note (lib/voice-note.ts).
 *
 * Mengunci kontrak:
 *  - `formatVoiceNoteDuration`: format timer "M:SS".
 *  - `voiceNoteFileName`: nama berkas stabil & unik.
 *  - `isAudioMime`: deteksi MIME audio untuk pemetaan messageType VOICE.
 *  - `validateVoiceNoteFile`: batas durasi & ukuran sebelum antre unggah.
 */
import { describe, expect, it } from "vitest"

import {
  formatVoiceNoteDuration,
  isAudioMime,
  validateVoiceNoteFile,
  VOICE_NOTE_MAX_BYTES,
  VOICE_NOTE_MAX_DURATION_MS,
  VOICE_NOTE_MIME,
  voiceNoteFileName,
  voiceNoteValidationMessage,
} from "@/lib/voice-note"

describe("formatVoiceNoteDuration", () => {
  it("0 → 0:00", () => {
    expect(formatVoiceNoteDuration(0)).toBe("0:00")
  })
  it("detik dua digit", () => {
    expect(formatVoiceNoteDuration(9_000)).toBe("0:09")
    expect(formatVoiceNoteDuration(61_000)).toBe("1:01")
  })
  it("5 menit → 5:00", () => {
    expect(formatVoiceNoteDuration(VOICE_NOTE_MAX_DURATION_MS)).toBe("5:00")
  })
  it("negatif dijepit ke 0:00", () => {
    expect(formatVoiceNoteDuration(-500)).toBe("0:00")
  })
})

describe("voiceNoteFileName", () => {
  it("format vn-YYYYMMDD-HHmmss.m4a", () => {
    const at = new Date(2026, 8, 28, 0, 55, 12)
    expect(voiceNoteFileName(at)).toBe("vn-20260928-005512.m4a")
  })
  it("MIME konsisten audio/m4a", () => {
    expect(VOICE_NOTE_MIME).toBe("audio/m4a")
    expect(isAudioMime(VOICE_NOTE_MIME)).toBe(true)
  })
})

describe("isAudioMime", () => {
  it("audio/* → true", () => {
    expect(isAudioMime("audio/m4a")).toBe(true)
    expect(isAudioMime("audio/mpeg")).toBe(true)
  })
  it("non-audio → false", () => {
    expect(isAudioMime("image/jpeg")).toBe(false)
    expect(isAudioMime("video/mp4")).toBe(false)
    expect(isAudioMime(null)).toBe(false)
    expect(isAudioMime(undefined)).toBe(false)
  })
})

describe("validateVoiceNoteFile", () => {
  it("rekaman normal → ok", () => {
    expect(validateVoiceNoteFile({ size: 120_000, durationMs: 12_000 })).toEqual({ ok: true })
  })
  it("> 10 MB → too-big", () => {
    const r = validateVoiceNoteFile({ size: VOICE_NOTE_MAX_BYTES + 1, durationMs: 60_000 })
    expect(r).toEqual({ ok: false, reason: "too-big" })
    expect(voiceNoteValidationMessage("too-big")).toContain("10 MB")
  })
  it("< 1 detik → too-short", () => {
    const r = validateVoiceNoteFile({ size: 10_000, durationMs: 500 })
    expect(r).toEqual({ ok: false, reason: "too-short" })
  })
  it("> 5 menit → too-long", () => {
    const r = validateVoiceNoteFile({ size: 10_000, durationMs: VOICE_NOTE_MAX_DURATION_MS + 1 })
    expect(r).toEqual({ ok: false, reason: "too-long" })
  })
  it("size 0 (platform tak melaporkan) diloloskan — server tetap gate", () => {
    expect(validateVoiceNoteFile({ size: 0, durationMs: 5_000 })).toEqual({ ok: true })
  })
})
