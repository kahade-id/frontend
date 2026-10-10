/**
 * Audit Pesan 2026-10-10 (#7): rekaman pesan suara yang terhenti dari luar
 * (panggilan masuk, audio focus direbut, aplikasi ke latar) harus berakhir
 * di keputusan yang jujur — simpan bagian yang terekam, atau buang dan beri
 * tahu — bukan UI "Merekam…" dengan timer beku.
 */
import { describe, expect, it } from "vitest"

import { VOICE_NOTE_MIN_DURATION_MS } from "@/lib/voice-note"
import {
  isExternalRecordingStop,
  resolveRecordingInterruption,
} from "@/lib/voice-note-interruption"

describe("resolveRecordingInterruption", () => {
  it("ada berkas & durasi ≥ minimum → simpan ke pratinjau", () => {
    expect(
      resolveRecordingInterruption({ uri: "file:///rec.m4a", durationMs: VOICE_NOTE_MIN_DURATION_MS }),
    ).toEqual({ kind: "review", uri: "file:///rec.m4a", durationMs: VOICE_NOTE_MIN_DURATION_MS })
    expect(resolveRecordingInterruption({ uri: "file:///rec.m4a", durationMs: 12_345 })).toEqual({
      kind: "review",
      uri: "file:///rec.m4a",
      durationMs: 12_345,
    })
  })

  it("terlalu pendek → buang (pengguna diberi tahu oleh komponen)", () => {
    expect(
      resolveRecordingInterruption({ uri: "file:///rec.m4a", durationMs: VOICE_NOTE_MIN_DURATION_MS - 1 }),
    ).toEqual({ kind: "discard" })
    expect(resolveRecordingInterruption({ uri: "file:///rec.m4a", durationMs: 0 })).toEqual({
      kind: "discard",
    })
  })

  it("tanpa berkas → buang walau durasinya panjang", () => {
    expect(resolveRecordingInterruption({ uri: null, durationMs: 30_000 })).toEqual({ kind: "discard" })
    expect(resolveRecordingInterruption({ uri: undefined, durationMs: 30_000 })).toEqual({
      kind: "discard",
    })
    expect(resolveRecordingInterruption({ uri: "", durationMs: 30_000 })).toEqual({ kind: "discard" })
  })

  it("durasi tidak valid (NaN/negatif) diperlakukan 0 → buang", () => {
    expect(resolveRecordingInterruption({ uri: "file:///rec.m4a", durationMs: Number.NaN })).toEqual({
      kind: "discard",
    })
    expect(resolveRecordingInterruption({ uri: "file:///rec.m4a", durationMs: -5 })).toEqual({
      kind: "discard",
    })
  })

  it("minimum bisa disuntik (test komponen lain)", () => {
    expect(
      resolveRecordingInterruption({ uri: "file:///x", durationMs: 500, minDurationMs: 400 }).kind,
    ).toBe("review")
  })
})

describe("isExternalRecordingStop", () => {
  it("masih merekam → bukan interupsi", () => {
    expect(isExternalRecordingStop({ isRecording: true, sawRecording: true, stopping: false })).toBe(false)
  })

  it("false sesaat setelah record() (belum pernah true) → bukan interupsi", () => {
    expect(isExternalRecordingStop({ isRecording: false, sawRecording: false, stopping: false })).toBe(
      false,
    )
  })

  it("berhenti karena stop() kita sendiri → bukan interupsi (tidak dobel-tangani)", () => {
    expect(isExternalRecordingStop({ isRecording: false, sawRecording: true, stopping: true })).toBe(false)
  })

  it("pernah merekam, berhenti tanpa diminta → interupsi", () => {
    expect(isExternalRecordingStop({ isRecording: false, sawRecording: true, stopping: false })).toBe(true)
  })
})
