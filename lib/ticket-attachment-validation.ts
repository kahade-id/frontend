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

/** Tipe yang diterima endpoint upload gambar (selaras `pickImages`). */
const ALLOWED_MIME_PREFIXES = ["image/"] as const
const ALLOWED_MIME_EXACT = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"])

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
  return `Maksimal ${TICKET_ATTACHMENT_MAX_COUNT} gambar (JPG/PNG/WebP), masing-masing maksimal ${formatMB(TICKET_ATTACHMENT_MAX_SIZE_BYTES)}.`
}

function isAllowedMime(mimeType: string): boolean {
  const m = (mimeType || "").toLowerCase().split(";")[0].trim()
  if (ALLOWED_MIME_EXACT.has(m)) return true
  return ALLOWED_MIME_PREFIXES.some((p) => m.startsWith(p))
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
        message: `"${c.name}" bukan gambar yang didukung — pilih file JPG, PNG, atau WebP.`,
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
