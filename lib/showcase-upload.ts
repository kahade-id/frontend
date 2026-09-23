/** Upload-only workflow. Never fall back to a legacy endpoint that auto-publishes an item. */
import { api } from "@/lib/api"
import { ApiError } from "@/lib/api/errors"
import type { PickedImage } from "@/lib/image-picker"
import { pickedImageToBlob } from "@/lib/image-picker"
import { logWarn } from "@/lib/telemetry"

export type ShowcaseUploadOutcome = { kind: "fileKey"; fileKey: string }

export async function uploadShowcasePhoto(asset: PickedImage, signal?: AbortSignal): Promise<ShowcaseUploadOutcome> {
  let fileKey: string | undefined
  let stage = "read"
  const check = () => {
    if (signal?.aborted) throw new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan." })
  }
  try {
    check()
    const blob = await pickedImageToBlob(asset)
    check()
    stage = "presign"
    const upload = await api.upload.requestPresignedUrl({
      purpose: "SHOWCASE_IMAGE", fileName: asset.name, contentType: asset.mimeType, fileSize: blob.size,
    }, signal)
    if (!upload.fileKey) throw new ApiError({ code: "PARSE", message: "Kunci unggahan tidak tersedia." })
    fileKey = upload.fileKey
    check()
    stage = "transfer"
    await api.upload.uploadToPresignedUrl(upload, blob, asset.name, 60_000, signal)
    check()
    stage = "confirm"
    await api.upload.confirmUpload({ fileKey }, signal)
    check()
    return { kind: "fileKey", fileKey }
  } catch (error) {
    // No file is attached in this workflow: compensating cleanup is safe even after confirm.
    if (fileKey) await cleanupPendingShowcaseKeys([fileKey])
    // Deliberately omit file names, signed URLs and keys from telemetry.
    logWarn(`showcase:upload:${stage}`, new Error(signal?.aborted ? "cancelled" : "failed"))
    throw error
  }
}

export async function cleanupPendingShowcaseKeys(fileKeys: string[]): Promise<void> {
  for (let offset = 0; offset < fileKeys.length; offset += 20) {
    try {
      await api.upload.cleanupUploads(fileKeys.slice(offset, offset + 20))
    } catch {
      logWarn("showcase:cleanup", new Error("Pending upload cleanup failed"))
    }
  }
}

export type ShowcasePhotoUploadResult = {
  /** Berhasil — URUTAN pilihan asli dipertahankan (foto pertama = cover). */
  uploaded: { fileKey: string; asset: PickedImage }[]
  /** Gagal per foto (G-06) — satu kegagalan tidak menggagalkan batch. */
  failed: PickedImage[]
}

/**
 * G-21 (audit 2026-09-23): unggah banyak foto dengan konkurensi kecil
 * (default 3) — dulu serial per foto. `onSettled(done, total)` dipanggil
 * setiap foto selesai (sukses/gagal) untuk progres; pembatalan lewat `signal`
 * (foto yang belum mulai langsung dihitung gagal, pemanggil membersihkan
 * key hasil unggah bila membatalkan batch).
 */
export async function uploadShowcasePhotos(
  assets: PickedImage[],
  opts: {
    signal?: AbortSignal
    onSettled?: (done: number, total: number) => void
    concurrency?: number
  } = {},
): Promise<ShowcasePhotoUploadResult> {
  const total = assets.length
  const slots: ({ fileKey: string; asset: PickedImage } | null)[] = new Array(total).fill(null)
  const ok = new Array<boolean>(total).fill(false)
  let settled = 0
  let next = 0
  const worker = async () => {
    for (;;) {
      const index = next
      next += 1
      if (index >= total) return
      if (!opts.signal?.aborted) {
        try {
          const outcome = await uploadShowcasePhoto(assets[index], opts.signal)
          slots[index] = { fileKey: outcome.fileKey, asset: assets[index] }
          ok[index] = true
        } catch {
          /* kegagalan per foto — batch lanjut (G-06) */
        }
      }
      settled += 1
      opts.onSettled?.(settled, total)
    }
  }
  const width = Math.max(1, Math.min(opts.concurrency ?? 3, total || 1))
  await Promise.all(Array.from({ length: width }, () => worker()))
  return {
    uploaded: slots.filter((entry): entry is { fileKey: string; asset: PickedImage } => entry != null),
    failed: assets.filter((_, index) => !ok[index]),
  }
}
