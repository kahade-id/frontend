/**
 * Temuan #12 — habis rekam & tekan "Berhenti", perekam menyala lagi.
 *
 * RANTAI PENYEBAB (non-obvious, jangan diulang):
 *   useAudioPlayer(source) → instance player BARU tiap kali `source` berubah
 *     → `stopPreview` (useCallback [previewPlayer]) berubah identitas
 *       → `reset` (useCallback [discardRecording, stopPreview]) berubah
 *         → effect izin yang dependensinya `[visible, reset]` BERJALAN ULANG
 *           padahal sheet sedang terbuka
 *           → setState("requesting") → izin sudah ada → setState("ready").
 *
 * State "review" (Hapus / Kirim) yang baru muncul ditimpa oleh "ready"
 * ("Mulai merekam") — dan tombol itu berada tepat di tempat jari user
 * menekan "Berhenti", sehingga sekali lagi tersentuh = rekam ulang.
 *
 * Perbaikannya: effect izin bergantung HANYA pada `visible`; `reset` dibaca
 * lewat ref. Karena penyebabnya adalah IDENTITAS yang bocor melintasi hook,
 * bukan nilai, regresinya paling andal dijaga di tingkat sumber — tes render
 * penuh butuh meniru seluruh lifecycle expo-audio (rekam → stop → uri baru)
 * yang tidak tersedia di jsdom.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const REL = "components/ui/voice-note-recorder.tsx"
const src = readFileSync(resolve(process.cwd(), REL), "utf8")

describe("<VoiceNoteRecorder>: effect izin tidak boleh bergantung pada `reset`", () => {
  it("dependensi effect izin HANYA `visible`", () => {
    expect(src).toMatch(/\},\s*\[visible\]\)/)
    // Pola lama yang memicu bug — harus hilang.
    expect(src).not.toMatch(/\[visible,\s*reset\]/)
  })

  it("`reset` dibaca lewat ref supaya identitasnya tidak mengulang effect", () => {
    expect(src).toMatch(/resetRef\.current\s*=\s*reset/)
    // Dan ref itulah yang dipanggil saat sheet ditutup, bukan `reset` langsung.
    expect(src).toMatch(/resetRef\.current\(\)/)
  })

  it("alasan perbaikannya terdokumentasi di sumber", () => {
    expect(src).toContain("habis rekam & tekan stop, perekam menyala lagi")
  })
})

/**
 * Audit Pesan 2026-10-10 (#7): interupsi OS. Keputusannya murni & teruji di
 * tests/voice-note-interruption.test.ts; di sini dijaga PENYAMBUNGANNYA ke
 * komponen (lifecycle expo-audio tidak tersedia di jsdom).
 */
describe("<VoiceNoteRecorder>: rekaman yang terhenti dari luar ditangani (#7)", () => {
  it("mengamati `isRecording` recorder, bukan hanya durasi", () => {
    expect(src).toMatch(/isExternalRecordingStop\(\{/)
    expect(src).toMatch(/isRecording:\s*recState\.isRecording/)
    expect(src).toMatch(/sawRecording:\s*sawRecordingRef\.current/)
    expect(src).toMatch(/stopping:\s*stoppingRef\.current/)
  })

  it("satu jalur penghentian (finalizeRecording) dipakai stop manual DAN interupsi", () => {
    expect(src).toMatch(/const finalizeRecording = useCallback\(/)
    // Stop manual: interrupted=false; interupsi & ke latar: interrupted=true.
    // Audit Pesan 2026-10-10 (media #8): durasi presisi dari getStatus(),
    // minimal nilai poll — tetap SATU jalur finalizeRecording(…, false).
    expect(src).toMatch(/finalizeRecording\(Math\.max\(exact, recState\.durationMillis \?\? 0\), false\)/)
    expect((src.match(/finalizeRecording\(durationMs, true\)/g) ?? []).length).toBeGreaterThanOrEqual(2)
    // Penjaga sekali-jalan — tanpa ini stop() kita sendiri terbaca sebagai interupsi.
    expect(src).toMatch(/if \(stoppingRef\.current\) return\s*\n\s*stoppingRef\.current = true/)
  })

  it("aplikasi ke latar saat merekam → rekaman dihentikan & disimpan", () => {
    expect(src).toMatch(/AppState\.addEventListener\("change"/)
    expect(src).toMatch(/if \(next === "active"\) return\s*\n\s*void finalizeRecording\(durationMs, true\)/)
  })

  it("keputusan interupsi lewat resolveRecordingInterruption, dan pengguna diberi tahu", () => {
    expect(src).toMatch(/resolveRecordingInterruption\(\{ uri, durationMs: elapsed \}\)/)
    expect(src).toContain('setNotice("interrupted-kept")')
    expect(src).toContain('setNotice("interrupted-lost")')
    // Teks pemberitahuan lewat i18n dan spesifik (bukan "Terjadi kesalahan").
    expect(src).toContain('translate("Rekaman terhenti oleh sistem. Bagian yang sudah terekam disimpan.")')
    expect(src).toContain('translate("Rekaman terhenti oleh sistem sebelum 1 detik. Coba rekam lagi.")')
    expect(src).not.toContain("Terjadi kesalahan")
  })

  it("#10: tidak ada lagi label tombol/teks yang hardcoded tanpa translate()", () => {
    for (const literal of [
      ">\n            Mulai merekam\n",
      ">\n            Berhenti\n",
      ">\n                Hapus\n",
      ">\n                Kirim\n",
      ">\n            Tutup\n",
      "Menyiapkan mikrofon…\n",
      '{playing ? "Jeda" : "Putar"}',
    ]) {
      expect(src).not.toContain(literal)
    }
  })
})
