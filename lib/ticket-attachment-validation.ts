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
/** 10 MB per file — di atas ini upload rawan gagal di koneksi seluler. */
export const TICKET_ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024

/**
 * DBL-011 (audit integrasi 2026-10-01): allowlist PERSIS backend
 * `ALLOWED_MIME_TYPES[REPORT_EVIDENCE]` (`src/modules/upload/upload.service.ts`):
 * image/jpeg, image/png, image/webp, image/heic, image/heif, application/pdf.
 *
 * Dulu memakai prefix `image/*` — `image/gif`/`image/bmp`/`image/svg+xml`
 * lolos validasi klien lalu DITOLAK server (MIME_TYPE_MISMATCH); sebaliknya
 * `application/pdf` DITERIMA server untuk lampiran laporan tapi DIBLOKIR
 * klien. Tidak ada lagi prefix longgar: hanya 6 MIME ini yang lolos.
 */
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
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
  return `Maksimal ${TICKET_ATTACHMENT_MAX_COUNT} lampiran (JPG/PNG/WebP/HEIC/HEIF/PDF), masing-masing maksimal ${formatMB(TICKET_ATTACHMENT_MAX_SIZE_BYTES)}.`
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
        message: `"${c.name}" bukan lampiran yang didukung — pilih file JPG, PNG, WebP, HEIC/HEIF, atau PDF.`,
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
