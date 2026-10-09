/**
 * Kahade — guard klien upload foto story (audit 2026-10-09, butir C2).
 *
 * Sumber kebenaran: docs/integrasi_backend.md §4 — "Ukuran upload maks
 * 10 MB"; 413 `STORY_MEDIA_TOO_LARGE` (integrasi_backend.md:74). Tanpa
 * guard ini file >10 MB (kamera 4000 px mentah ~8–12 MB) melaju ke server
 * dan gagal misterius di tengah transfer — sekarang ditolak dini dengan
 * pesan yang menyebut batasnya. Lapisan MURNI (tanpa runtime native) agar
 * bisa di-unit-test; validasi server tetap otoritatif.
 */
import type { PickedImage } from "@/lib/image-picker"

/** Batas ukuran server untuk foto story: 10 MB. */
export const STORY_MEDIA_MAX_BYTES = 10 * 1024 * 1024

/**
 * Tolak foto story >10 MB SEBELUM upload. `size` absen/0 = platform tidak
 * melaporkan ukuran → fail-open ke validasi server (pola photo-upload-guards).
 */
export function validateStoryMediaAsset(asset: PickedImage): string | null {
  if (typeof asset.size === "number" && asset.size > STORY_MEDIA_MAX_BYTES) {
    return "Foto story maksimal 10 MB. Pilih foto yang lebih kecil."
  }
  return null
}
