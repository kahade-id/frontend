/**
 * Test kontrak upload voice note (UPFV-01).
 *
 * Regresi: voice note 100% gagal terkirim karena inkonsistensi MIME audio —
 * FE merekam `audio/m4a`, tapi MIME itu tidak ada di whitelist klien
 * (`CHAT_ATTACHMENT_ALLOWED_MIME_TYPES`), whitelist backend, maupun
 * magic-byte backend. Validator klien menolak rekaman aplikasinya sendiri
 * ("unsupported-type").
 *
 * Kontrak yang dikunci:
 *  - `VOICE_NOTE_MIME` (lib/voice-note.ts) HARUS ada di
 *    `CHAT_ATTACHMENT_ALLOWED_MIME_TYPES` (lib/chat-attachment-limits.ts).
 *  - `validateChatAttachment` HARUS meloloskan rekaman voice note
 *    (ukuran normal & ukuran 0/platform tak melaporkan).
 *  - MIME voice note HARUS terdeteksi sebagai audio (`isAudioMime`) agar
 *    `messageTypeFor` memetakannya ke VOICE.
 *
 * Sinkronisasi dengan backend (diverifikasi manual saat fix, bukan oleh test
 * ini — kontrak backend ada di repo backend):
 *  - `ALLOWED_CONTENT_TYPES[CHAT_ATTACHMENT]` memuat `audio/mp4`.
 *  - `MAGIC_BYTES` punya signature `ftypM4A → audio/mp4`
 *    (upload-audio-magic-bytes.spec.ts di repo backend).
 */
import { describe, expect, it } from "vitest"

import {
  CHAT_ATTACHMENT_ALLOWED_MIME_TYPES,
  validateChatAttachment,
} from "@/lib/chat-attachment-limits"
import { isAudioMime, VOICE_NOTE_MIME, VOICE_NOTE_MAX_BYTES } from "@/lib/voice-note"

describe("UPFV-01: kontrak MIME voice note", () => {
  it("VOICE_NOTE_MIME terdaftar di whitelist lampiran chat", () => {
    expect(CHAT_ATTACHMENT_ALLOWED_MIME_TYPES).toContain(VOICE_NOTE_MIME)
  })

  it("rekaman voice note lolos validator klien", () => {
    const r = validateChatAttachment({ size: 120_000, mimeType: VOICE_NOTE_MIME })
    expect(r).toEqual({ ok: true })
  })

  it("rekaman voice note lolos validator klien bila ukuran tak dilaporkan (size 0)", () => {
    const r = validateChatAttachment({ size: 0, mimeType: VOICE_NOTE_MIME })
    expect(r).toEqual({ ok: true })
  })

  it("MIME voice note terdeteksi sebagai audio (untuk pemetaan messageType VOICE)", () => {
    expect(isAudioMime(VOICE_NOTE_MIME)).toBe(true)
  })

  it("whitelist audio klien mencakup semua MIME audio yang didukung", () => {
    for (const mime of ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4"] as const) {
      expect(CHAT_ATTACHMENT_ALLOWED_MIME_TYPES).toContain(mime)
    }
  })

  it("batas ukuran voice note = batas lampiran chat (50 MB)", () => {
    expect(VOICE_NOTE_MAX_BYTES).toBe(50 * 1024 * 1024)
  })
})
