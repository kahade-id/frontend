import type { PickedImage } from "@/lib/image-picker"

/**
 * Guard klien upload foto profil — avatar & sampul (UPF-03, UPF-06).
 *
 * Lapisan MURNI (tanpa runtime native) agar bisa di-unit-test. Validasi
 * server tetap otoritatif; guard ini hanya memberi pesan Bahasa Indonesia
 * yang actionable SEBELUM upload, supaya user tidak gagal misterius.
 */

/** Batas avatar backend (users.service.ts): 2 MB, jpeg/png/webp. */
export const AVATAR_MAX_MB = 2
export const AVATAR_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"]
export const AVATAR_COPY = "Foto maksimal 2 MB dengan format JPG/PNG/WebP."

/** Batas sampul backend (users.service.ts): 5 MB, jpeg/png/webp. */
export const HEADER_MAX_MB = 5
export const HEADER_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"]
export const HEADER_COPY = "Foto sampul maksimal 5 MB dengan format JPG/PNG/WebP."

function validatePhotoAsset(
  asset: PickedImage,
  allowedMime: readonly string[],
  maxMb: number,
  copy: string,
): string | null {
  const mime = (asset.mimeType ?? "").toLowerCase()
  const extOk = /\.(jpe?g|png|webp)$/i.test(asset.name ?? "")
  // UPF-06: bila platform MELAPORKAN mime dan mime itu tidak didukung, tolak
  // langsung — ekstensi tidak boleh mengesampingkan MIME yang jelas (mis.
  // HEIC iPhone bernama .jpg lolos ke server lalu gagal misterius).
  // Bila platform tidak melaporkan mime, fallback ke ekstensi (fail-open).
  if (mime ? !allowedMime.includes(mime) : !extOk) return copy
  if (typeof asset.size === "number" && asset.size > maxMb * 1024 * 1024) return copy
  return null
}

/** Guard avatar — dipakai useAvatarUpload. */
export function validateAvatarAsset(asset: PickedImage): string | null {
  return validatePhotoAsset(asset, AVATAR_ALLOWED_MIME, AVATAR_MAX_MB, AVATAR_COPY)
}

/** Guard foto sampul — dipakai app/edit-profile.tsx (UPF-03). */
export function validateHeaderAsset(asset: PickedImage): string | null {
  return validatePhotoAsset(asset, HEADER_ALLOWED_MIME, HEADER_MAX_MB, HEADER_COPY)
}

/**
 * UPF-04: timeout adaptif upload foto — 20 dtk basis + waktu upload pada
 * 100 KB/s (konservatif untuk koneksi HP Indonesia), maks 120 dtk.
 * Tanpa info ukuran (fail-open resize): 60 dtk — aman untuk file pasca-resize.
 */
export function photoUploadTimeoutMs(bytes?: number): number {
  if (typeof bytes !== "number" || bytes <= 0) return 60_000
  return Math.min(120_000, Math.max(20_000, 20_000 + bytes / 100))
}
