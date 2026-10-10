/**
 * Kahade — guard klien media story (foto & video), audit 2026-10-09 (C2) +
 * video 2026-10-10.
 *
 * Sumber kebenaran: backend `app.constants.ts` — foto ≤ 10 MB (413
 * `STORY_MEDIA_TOO_LARGE`), video ≤ 50 MB & ≤ 60 detik (`VIDEO_TOO_LONG`),
 * format foto JPEG/PNG/WEBP (HEIC dikonversi klien, lihat
 * `storyImageNeedsReencode`) dan video MP4/MOV/WEBM (415 `STORY_MEDIA_TYPE`).
 *
 * Tanpa guard ini berkas yang pasti ditolak tetap diunggah penuh (video 80 MB
 * di 4G ≈ 13 menit) lalu gagal — pesan di sini menyebut batasnya SEBELUM
 * satu byte pun dikirim. Lapisan MURNI (tanpa runtime native) agar bisa
 * di-unit-test; validasi server tetap otoritatif. `size`/`durationMs` absen
 * = platform tidak melaporkan → fail-open ke validasi server.
 */
import {
  STORY_VIDEO_MAX_BYTES as API_STORY_VIDEO_MAX_BYTES,
  STORY_VIDEO_MAX_DURATION_MS as API_STORY_VIDEO_MAX_DURATION_MS,
  type StoryMediaKind,
} from "@/lib/api/story"
import type { PickedImage } from "@/lib/image-picker"

/** Batas ukuran server untuk foto story: 10 MB. */
export const STORY_MEDIA_MAX_BYTES = 10 * 1024 * 1024
/** Batas video story: 50 MB / 60 detik (selaras `lib/api/story.ts` & backend). */
export const STORY_VIDEO_MAX_BYTES = API_STORY_VIDEO_MAX_BYTES
export const STORY_VIDEO_MAX_DURATION_MS = API_STORY_VIDEO_MAX_DURATION_MS

/** MIME foto yang diterima server apa adanya. */
const STORY_IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"])
/** MIME foto yang bisa dikonversi klien ke JPEG sebelum upload (iPhone). */
const STORY_IMAGE_REENCODE_MIME = new Set(["image/heic", "image/heif"])
/** MIME video yang diterima server (magic-byte diverifikasi di server). */
const STORY_VIDEO_MIME = new Set(["video/mp4", "video/quicktime", "video/webm"])

/** Pesan guard (Indonesia = kunci i18n; dicatat di katalog lewat object literal). */
const GUARD_COPY = {
  imageTooLarge: "Foto story maksimal 10 MB. Pilih foto yang lebih kecil.",
  videoTooLarge: "Video story maksimal 50 MB. Pilih video yang lebih kecil atau lebih pendek.",
  videoTooLong: "Video story maksimal 60 detik. Potong video dulu di galeri.",
  unsupported: "Format tidak didukung. Gunakan foto JPEG/PNG atau video MP4/MOV.",
}

/** Jenis media story dari aset picker; `unsupported` = format di luar kontrak. */
export function storyMediaKindOf(asset: Pick<PickedImage, "mimeType" | "name">): StoryMediaKind | "unsupported" {
  const mime = (asset.mimeType || "").toLowerCase()
  if (STORY_VIDEO_MIME.has(mime)) return "video"
  if (STORY_IMAGE_MIME.has(mime) || STORY_IMAGE_REENCODE_MIME.has(mime)) return "image"
  // MIME kosong (Android lama): tebak dari ekstensi nama berkas.
  const ext = asset.name?.split(".").pop()?.toLowerCase() ?? ""
  if (["mp4", "m4v", "mov", "webm"].includes(ext)) return "video"
  if (["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext)) return "image"
  if (mime.startsWith("image/") || mime.startsWith("video/")) return "unsupported"
  // Tidak diketahui sama sekali: fail-open sebagai foto (server memverifikasi).
  return "image"
}

/**
 * MIME deklarasi yang dikirim ke server. `image/jpg` (non-standar, dilaporkan
 * sebagian picker Android) lolos guard tetapi ditolak server 415 — server
 * hanya mengenal `image/jpeg`. Selain itu dikembalikan apa adanya.
 */
export function normalizeStoryMime(mime: string): string {
  return mime.toLowerCase() === "image/jpg" ? "image/jpeg" : mime
}

/**
 * True bila foto harus dikonversi ke JPEG di klien sebelum upload — HEIC/HEIF
 * (default kamera iPhone) ditolak server dengan 415 `STORY_MEDIA_TYPE`, dan
 * `resizePickedImage` hanya mengonversi bila sisi terpanjang > 1920 px.
 */
export function storyImageNeedsReencode(asset: Pick<PickedImage, "mimeType" | "name">): boolean {
  const mime = (asset.mimeType || "").toLowerCase()
  if (STORY_IMAGE_REENCODE_MIME.has(mime)) return true
  if (STORY_IMAGE_MIME.has(mime)) return false
  const ext = asset.name?.split(".").pop()?.toLowerCase() ?? ""
  return ext === "heic" || ext === "heif"
}

/**
 * Tolak media story yang pasti ditolak server SEBELUM upload. Null = lolos.
 * Ukuran/durasi 0/undefined = platform tidak melaporkan → fail-open.
 */
export function validateStoryMediaAsset(asset: PickedImage): string | null {
  const kind = storyMediaKindOf(asset)
  if (kind === "unsupported") return GUARD_COPY.unsupported
  if (kind === "video") {
    if (typeof asset.size === "number" && asset.size > STORY_VIDEO_MAX_BYTES) return GUARD_COPY.videoTooLarge
    if (typeof asset.durationMs === "number" && asset.durationMs > STORY_VIDEO_MAX_DURATION_MS)
      return GUARD_COPY.videoTooLong
    return null
  }
  if (typeof asset.size === "number" && asset.size > STORY_MEDIA_MAX_BYTES) return GUARD_COPY.imageTooLarge
  return null
}
