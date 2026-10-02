/**
 * Kahade — validasi lampiran tiket SEBELUM dikirim (batch 139, item F08).
 *
 * Sebelumnya file tidak valid baru gagal setelah submit (upload/server
 * menolak). Sekarang tipe, ukuran, dan jumlah diperiksa sejak pemilihan di
 * klien dan batasnya dijelaskan eksplisit di UI.
 *
 * Fungsi murni agar bisa di-unit-test; layar contact.tsx memakai hasilnya
 * untuk memblokir pilihan & menampilkan pesan yang bisa dimengerti pengguna.
 */

export const TICKET_ATTACHMENT_MAX_COUNT = 5
/**
 * FAL-025 (fix 2026-10-03): 50 MB per file — selaras kontrak backend
 * `MAX_FILE_SIZE[UploadPurpose.CHAT_ATTACHMENT]`
 * (`src/modules/upload/upload.service.ts:93`). Tiket memverifikasi file key
 * dengan purpose CHAT_ATTACHMENT (`support.service.ts:24,140`), bukan
 * REPORT_EVIDENCE seperti klaim lama di bawah (DBL-011).
 */
export const TICKET_ATTACHMENT_MAX_SIZE_BYTES = 50 * 1024 * 1024

/**
 * FAL-025 (fix 2026-10-03): allowlist PERSIS backend
 * `ALLOWED_MIME_TYPES[UploadPurpose.CHAT_ATTACHMENT]`
 * (`src/modules/upload/upload.service.ts:48`): gambar (jpeg/png/webp/
 * heic/heif), PDF, video (mp4/mov/webm), audio (mp3/wav/ogg/m4a).
 *
 * Dulu memakai allowlist REPORT_EVIDENCE (6 MIME, 10 MB) — PDF/video/audio
 * dan file 10–50 MB DITOLAK klien padahal DITERIMA server. Tidak ada lagi
 * prefix longgar `image/*`: `image/gif`/`image/bmp`/`image/svg+xml` tetap
 * ditolak (tidak ada di allowlist server → MIME_TYPE_MISMATCH).
 */
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
])

export type AttachmentCandidate = {
  name: string
  mimeType: string
  /** Byte; 0 bila platform tidak melaporkan ukuran (tidak bisa divalidasi). */
  size: number
}

export type AttachmentValidationIssue = {
  /** Indeks kandidat dalam daftar yang diperiksa. */
  index: number
  name: string
  reason: "type" | "size" | "count"
  message: string
}

function formatMB(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
}

export function attachmentLimitSummary(): string {
  return `Maksimal ${TICKET_ATTACHMENT_MAX_COUNT} lampiran (gambar, PDF, video, atau audio), masing-masing maksimal ${formatMB(TICKET_ATTACHMENT_MAX_SIZE_BYTES)}.`
}

function isAllowedMime(mimeType: string): boolean {
  const m = (mimeType || "").toLowerCase().split(";")[0].trim()
  return ALLOWED_MIME_TYPES.has(m)
}

/**
 * Validasi kandidat terhadap batas. `existingCount` = lampiran yang sudah
 * terpilih sebelumnya (untuk menghitung total terhadap batas jumlah).
 * Mengembalikan daftar masalah; kosong = semua valid.
 */
export function validateTicketAttachments(
  candidates: AttachmentCandidate[],
  existingCount = 0,
): AttachmentValidationIssue[] {
  const issues: AttachmentValidationIssue[] = []
  candidates.forEach((c, i) => {
    if (!isAllowedMime(c.mimeType)) {
      issues.push({
        index: i,
        name: c.name,
        reason: "type",
        message: `"${c.name}" bukan lampiran yang didukung — pilih gambar (JPG/PNG/WebP/HEIC/HEIF), PDF, video (MP4/MOV/WebM), atau audio (MP3/WAV/OGG/M4A).`,
      })
      return
    }
    if (c.size > 0 && c.size > TICKET_ATTACHMENT_MAX_SIZE_BYTES) {
      issues.push({
        index: i,
        name: c.name,
        reason: "size",
        message: `"${c.name}" berukuran ${formatMB(c.size)} — melebihi batas ${formatMB(TICKET_ATTACHMENT_MAX_SIZE_BYTES)}.`,
      })
      return
    }
    if (existingCount + i + 1 > TICKET_ATTACHMENT_MAX_COUNT) {
      issues.push({
        index: i,
        name: c.name,
        reason: "count",
        message: `Maksimal ${TICKET_ATTACHMENT_MAX_COUNT} lampiran per tiket — "${c.name}" tidak ikut dipilih.`,
      })
    }
  })
  return issues
}
