/**
 * Batch 43 (item 15): replace media existing via PUT penuh.
 *
 * Backend `PUT /v1/users/me/showcase/:id` dengan `media[]` adalah REPLACE
 * penuh seluruh media. `buildMediaReplacePayload` membangun payload dari
 * `images[]` owner response memakai `fileKey` owner-only (backend keputusan
 * #2, 2026-09-28), tanpa append endpoint.
 *
 * Batasan kontrak (server-side, bukan tebakan):
 * - fileKey di owner response adalah konfirmasi upload ONE-TIME; server DAPAT
 *   menolak pemakaian ulang (`UPLOAD_NOT_CONFIRMED`). Pemanggil WAJIB
 *   fallback ke penyimpanan detail tanpa media bila itu terjadi.
 * - video wajib `thumbnailFileKey` + `durationSec` — owner response tidak
 *   memberi `thumbnailFileKey`, jadi item bervideo tidak bisa di-replace
 *   (return null → perilaku lama dipertahankan).
 * - spin360 wajib groupKey + groupOrder kontinu.
 *
 * Return null = JANGAN kirim `media` (pertahankan perilaku lama: detail saja).
 */
import type { ShowcaseMediaInput } from "@/lib/api/types"
import type { ShowcaseImage } from "@/lib/api/users"

export function buildMediaReplacePayload(images: ShowcaseImage[]): ShowcaseMediaInput[] | null {
  if (images.length === 0) return null
  const payload: ShowcaseMediaInput[] = []
  for (const img of images) {
    // Tanpa fileKey (mis. response lama / non-owner) — jangan replace.
    if (!img.fileKey) return null
    const kind = img.kind ?? "image"
    if (kind === "video") {
      // Kontrak: video wajib thumbnailFileKey — tidak tersedia di owner
      // response → replace penuh tidak mungkin tanpa re-upload.
      return null
    }
    const entry: ShowcaseMediaInput = { fileKey: img.fileKey, kind }
    if (kind === "spin360") {
      if (img.groupKey == null || img.groupOrder == null) return null
      entry.groupKey = img.groupKey
      entry.groupOrder = img.groupOrder
    }
    payload.push(entry)
  }
  return payload
}
