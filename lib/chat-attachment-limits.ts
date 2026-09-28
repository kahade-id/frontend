/**
 * Kahade — batas lampiran chat yang BERASAL DARI SERVER (B06).
 *
 * Sumber kebenaran: backend `src/modules/upload/upload.service.ts`
 *   - `MAX_FILE_SIZE[UploadPurpose.CHAT_ATTACHMENT]` = 50 * 1024 * 1024
 *   - `ALLOWED_MIME_TYPES[UploadPurpose.CHAT_ATTACHMENT]`
 *   - `chat.controller.ts` → `FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } })`
 *
 * Kenapa modul ini ada: klien sebelumnya mem-hardcode 10 MB — LEBIH KETAT
 * dari server (50 MB), sehingga file 10–50 MB yang sah ditolak sebelum
 * sempat diunggah. Validasi klien sekarang mencerminkan batas server:
 * file yang pasti ditolak server gagal CEPAT di klien dengan pesan yang
 * menyebut batas sebenarnya; file yang lolos tetap di-gate ulang oleh
 * server (klien tidak dipercaya).
 *
 * Perubahan batas di backend WAJIB dicerminkan di sini (tidak ada endpoint
 * yang mengekspos batas ini — gap kontrak yang diketahui).
 */

/** Batas ukuran server untuk lampiran chat: 50 MB. */
export const CHAT_ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024

/**
 * Daftar MIME yang diterima server untuk CHAT_ATTACHMENT — salinan dari
 * `ALLOWED_MIME_TYPES[UploadPurpose.CHAT_ATTACHMENT]` backend.
 */
export const CHAT_ATTACHMENT_ALLOWED_MIME_TYPES: readonly string[] = [
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
]

/** Label manusia untuk satu MIME — dipakai pesan error & sheet lampiran. */
export function chatAttachmentTypeLabel(mimeType: string): string {
  const t = (mimeType || "").toLowerCase()
  if (t.startsWith("image/")) return "gambar"
  if (t.startsWith("video/")) return "video"
  if (t.startsWith("audio/")) return "audio"
  if (t === "application/pdf") return "PDF"
  return "berkas"
}

/**
 * Ringkasan format yang didukung untuk ditampilkan di UI
 * ("JPG, PNG, WebP, HEIC, PDF, MP4, MOV, WebM, MP3, WAV, OGG, M4A").
 */
export function chatAttachmentFormatsLabel(): string {
  return "JPG, PNG, WebP, HEIC, PDF, MP4, MOV, WebM, MP3, WAV, OGG, M4A"
}

export type ChatAttachmentValidation =
  | { ok: true }
  | { ok: false; reason: "too-large" | "unsupported-type"; message: string }

/** Format "50 MB" / "1,5 MB" untuk pesan — tanpa dependensi format. */
export function formatBytesId(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B"
  if (bytes < 1024) return `${Math.trunc(bytes)} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.trunc(kb)} KB`
  const mb = kb / 1024
  const rounded = Math.round(mb * 10) / 10
  return `${String(rounded).replace(".", ",")} MB`
}

/**
 * Validasi klien sebelum unggah: ukuran + tipe MIME.
 * `size` 0 = platform tidak melaporkan → lewatkan cek ukuran (server tetap gate).
 * `mimeType` kosong → lewatkan cek tipe (server memvalidasi magic bytes).
 */
export function validateChatAttachment(input: {
  size?: number | null
  mimeType?: string | null
  fileName?: string | null
}): ChatAttachmentValidation {
  const size = typeof input.size === "number" ? input.size : 0
  if (size > CHAT_ATTACHMENT_MAX_BYTES) {
    return {
      ok: false,
      reason: "too-large",
      message: `Ukuran lampiran maksimal ${formatBytesId(CHAT_ATTACHMENT_MAX_BYTES)} (file ini ${formatBytesId(size)}).`,
    }
  }
  const mime = (input.mimeType ?? "").toLowerCase().trim()
  if (mime && !CHAT_ATTACHMENT_ALLOWED_MIME_TYPES.includes(mime)) {
    return {
      ok: false,
      reason: "unsupported-type",
      message: `Format ${chatAttachmentTypeLabel(mime)} belum didukung untuk lampiran chat. Format yang didukung: ${chatAttachmentFormatsLabel()}.`,
    }
  }
  return { ok: true }
}
