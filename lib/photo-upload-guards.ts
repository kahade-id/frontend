import type { PickedImage } from "@/lib/image-picker"
import { uploadTimeoutMs } from "@/lib/upload-errors"

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
 * UPF-04: timeout adaptif upload foto.
 *
 * Audit 2026-10-09 (B6): rumus terpusat di `uploadTimeoutMs`
 * (upload-errors.ts) — 60 dtk basis + waktu transfer pada 100 KB/s, cap
 * 5 menit. Rumus lama (basis 20 dtk, cap 120 dtk) terlalu lemah: avatar
 * 2 MB @ 100 KB/s ≈ 20,5 dtk transfer + proses server melewati batas 23 dtk.
 */
export function photoUploadTimeoutMs(bytes?: number): number {
  return uploadTimeoutMs(bytes, "photo")
}
