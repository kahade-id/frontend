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
