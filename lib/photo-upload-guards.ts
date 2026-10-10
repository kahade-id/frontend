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

/** Guard avatar (MIME + ukuran mentah) — dipertahankan untuk pemanggil lama & test. */
export function validateAvatarAsset(asset: PickedImage): string | null {
  return validatePhotoAsset(asset, AVATAR_ALLOWED_MIME, AVATAR_MAX_MB, AVATAR_COPY)
}

/** Guard foto sampul (MIME + ukuran mentah) — dipertahankan untuk pemanggil lama & test. */
export function validateHeaderAsset(asset: PickedImage): string | null {
  return validatePhotoAsset(asset, HEADER_ALLOWED_MIME, HEADER_MAX_MB, HEADER_COPY)
}

/**
 * E-13 (audit 2026-10-10): guard dipecah dua tahap. Ukuran dicek SETELAH
 * resize — foto kamera (lazim 3–8 MB) dulu ditolak "maksimal 2 MB" padahal
 * hasil resize pasti di bawah batas. MIME tetap dicek sebelum pratinjau.
 */
function validatePhotoMime(asset: PickedImage, allowedMime: readonly string[], copy: string): string | null {
  const mime = (asset.mimeType ?? "").toLowerCase()
  const extOk = /\.(jpe?g|png|webp)$/i.test(asset.name ?? "")
  if (mime ? !allowedMime.includes(mime) : !extOk) return copy
  return null
}

function validatePhotoSize(asset: Pick<PickedImage, "size">, maxMb: number, copy: string): string | null {
  if (typeof asset.size === "number" && asset.size > maxMb * 1024 * 1024) return copy
  return null
}

export function validateAvatarMime(asset: PickedImage): string | null {
  return validatePhotoMime(asset, AVATAR_ALLOWED_MIME, AVATAR_COPY)
}
export function validateAvatarSize(asset: Pick<PickedImage, "size">): string | null {
  return validatePhotoSize(asset, AVATAR_MAX_MB, AVATAR_COPY)
}
export function validateHeaderMime(asset: PickedImage): string | null {
  return validatePhotoMime(asset, HEADER_ALLOWED_MIME, HEADER_COPY)
}
export function validateHeaderSize(asset: Pick<PickedImage, "size">): string | null {
  return validatePhotoSize(asset, HEADER_MAX_MB, HEADER_COPY)
}
