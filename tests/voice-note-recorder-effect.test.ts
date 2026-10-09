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
