/**
 * Kahade — lampiran pesan sengketa (GAP-B3, G126–G150).
 *
 * Helper murni (tanpa RN/UI) untuk antrean lampiran composer sengketa:
 * validasi ukuran/MIME/jumlah sesuai kontrak backend, deteksi berkas sensitif,
 * kedaluwarsa signed URL, label pihak, dan perbandingan konteks sengketa.
 * Ditaruh di lib (bukan layar) agar bisa di-unit-test via vitest.
 *
 * Kontrak backend (terverifikasi 2026-09-26):
 * - POST /v1/disputes/{id}/messages — DTO { message?, attachments? }
 * - DisputeMessageService.sendMessage: maks 5 lampiran/pesan, tiap berkas
 *   ≤ 10 MB (ukuran aktual diukur server), total ≤ 20 MB, fileKey wajib
 *   upload DISPUTE_EVIDENCE terkonfirmasi milik pengirim
 *   (verifyEvidenceFileKeysBatch), tanpa fileKey duplikat.
 * - UploadService ALLOWED_CONTENT_TYPES[DISPUTE_EVIDENCE]: 9 MIME di bawah.
 * - GET /v1/disputes/{id}/messages kini menyertakan `url` + `expiresAt`
 *   (signed URL TTL 300 dtk); refresh via
 *   GET /v1/disputes/{id}/attachments/signed-url?fileKey=…
 */

export const DISPUTE_ATTACHMENT_MAX_FILES = 5
export const DISPUTE_ATTACHMENT_MAX_FILE_BYTES = 10 * 1024 * 1024
export const DISPUTE_ATTACHMENT_MAX_TOTAL_BYTES = 20 * 1024 * 1024
/** TTL signed URL lampiran pesan (detik) — selaras backend (300). */
export const DISPUTE_ATTACHMENT_URL_TTL_SECONDS = 300

/**
 * MIME yang diizinkan backend untuk lampiran pesan sengketa
 * (UploadService.ALLOWED_CONTENT_TYPES[DISPUTE_EVIDENCE]). JANGAN hardcode
 * daftar lain — validasi klien harus selaras agar penolakan server tidak
 * mengejutkan pengguna.
 */
export const DISPUTE_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const

export type DisputeAttachmentCandidate = {
  name: string
  mimeType: string
  /** Byte; 0 bila platform tidak melaporkan (tetap divalidasi server). */
  size: number
}

export type DisputeAttachmentValidation = {
  ok: boolean
  errors: string[]
}

export function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

/**
 * Validasi kandidat lampiran SEBELUM upload (G128). `existing` = lampiran yang
 * sudah ada di antrean draft (jumlah + total byte) supaya batas 5 file /
 * 20 MB ditegakkan terhadap keseluruhan pesan, bukan per aksi pilih.
 */
export function validateDisputeAttachments(
  candidates: DisputeAttachmentCandidate[],
  existing: { count: number; bytes: number } = { count: 0, bytes: 0 },
): DisputeAttachmentValidation {
  const errors: string[] = []
  const totalCount = existing.count + candidates.length
  if (totalCount > DISPUTE_ATTACHMENT_MAX_FILES) {
    errors.push(
      `Maksimal ${DISPUTE_ATTACHMENT_MAX_FILES} lampiran per pesan — Anda memilih ${candidates.length} dengan ${existing.count} sudah terpasang.`,
    )
  }
  let newBytes = 0
  for (const c of candidates) {
    const label = c.name || "Berkas"
    if (!DISPUTE_ATTACHMENT_MIME_TYPES.includes(c.mimeType as (typeof DISPUTE_ATTACHMENT_MIME_TYPES)[number])) {
      errors.push(`${label}: tipe berkas tidak didukung (${c.mimeType || "tidak diketahui"}).`)
      continue
    }
    if (c.size > DISPUTE_ATTACHMENT_MAX_FILE_BYTES) {
      errors.push(
        `${label}: ukuran melebihi ${formatMb(DISPUTE_ATTACHMENT_MAX_FILE_BYTES)} per berkas.`,
      )
      continue
    }
    newBytes += c.size
  }
  if (existing.bytes + newBytes > DISPUTE_ATTACHMENT_MAX_TOTAL_BYTES) {
    errors.push(
      `Total ukuran lampiran melebihi ${formatMb(DISPUTE_ATTACHMENT_MAX_TOTAL_BYTES)} per pesan.`,
    )
  }
  return { ok: errors.length === 0, errors }
}

const SENSITIVE_NAME_PATTERNS = [
  "ktp",
  "sim",
  "paspor",
  "passport",
  "kartuidentitas",
  "identitas",
  "idcard",
  "id-card",
  "nik",
  "npwp",
  "kk",
  "kartukeluarga",
  "ktm",
  "akte",
  "ijazah",
]

/**
 * Deteksi heuristik berkas sensitif/dokumen identitas (G145) dari nama berkas.
 * Bukan keputusan keamanan — hanya pemicu dialog konfirmasi sebelum kirim.
 */
export function isSensitiveAttachment(fileName: string, _mimeType?: string): boolean {
  const normalized = (fileName || "").toLowerCase().replace(/[\s._-]+/g, "")
  if (!normalized) return false
  return SENSITIVE_NAME_PATTERNS.some((p) => normalized.includes(p))
}

/**
 * Apakah signed URL sudah (atau hampir) kedaluwarsa (G139). `skewSeconds`
 * memberi jeda agar URL yang kedaluwarsa dalam hitungan detik tidak dipakai.
 */
export function isAttachmentUrlExpired(
  expiresAt: string | undefined | null,
  nowMs: number = Date.now(),
  skewSeconds: number = 30,
): boolean {
  if (!expiresAt) return true
  const exp = Date.parse(expiresAt)
  if (!Number.isFinite(exp)) return true
  return exp - skewSeconds * 1000 <= nowMs
}

export type DisputeContext = {
  disputeId: string
  role: string | undefined
  status: string | undefined
}

/** G144: konteks sengketa/role berubah saat upload berjalan → kunci composer. */
export function sameDisputeContext(a: DisputeContext, b: DisputeContext): boolean {
  return a.disputeId === b.disputeId && a.role === b.role && a.status === b.status
}

export type AttachmentParty =
  | "self"
  | "buyer"
  | "seller"
  | "moderator"
  | "unknown"

/**
 * G141: label pihak dari identitas pengirim. `adminId` terisi → moderator
 * (DisputeMessage mendukung pesan admin). Perbandingan id pembeli/penjual
 * dari order yang sedang dibuka.
 */
export function attachmentPartyOf(opts: {
  senderId?: string | null
  adminId?: string | null
  myUserId?: string | null
  buyerId?: string | null
  sellerId?: string | null
}): AttachmentParty {
  const { senderId, adminId, myUserId, buyerId, sellerId } = opts
  if (adminId) return "moderator"
  if (senderId && myUserId && senderId === myUserId) return "self"
  if (senderId && buyerId && senderId === buyerId) return "buyer"
  if (senderId && sellerId && senderId === sellerId) return "seller"
  return "unknown"
}

export const DISPUTE_ATTACHMENT_PARTY_LABELS: Record<AttachmentParty, string> = {
  self: "Bukti Anda",
  buyer: "Bukti Pembeli",
  seller: "Bukti Penjual",
  moderator: "Bukti Moderator",
  unknown: "Bukti",
}

/** Label tipe berkas untuk a11y & metadata (G142/G146). */
export function attachmentTypeLabel(mimeType: string): string {
  if (!mimeType) return "Berkas"
  if (mimeType.startsWith("image/")) return "Gambar"
  if (mimeType === "application/pdf") return "PDF"
  if (mimeType.startsWith("video/")) return "Video"
  return "Berkas"
}
