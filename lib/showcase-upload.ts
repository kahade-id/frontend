/** Upload-only workflow. Never fall back to a legacy endpoint that auto-publishes an item. */
import { api } from "@/lib/api"
import { ApiError, isApiError } from "@/lib/api/errors"
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
    let blob = await pickedImageToBlob(asset)
    // Android: blob.type bisa kosong → paksa mime dari asset agar presigned header benar
    if (!blob.type && asset.mimeType) {
      blob = new Blob([blob], { type: asset.mimeType })
    }
    // Fallback ukuran: presigned butuh fileSize akurat, blob.size 0 di Android lama → pakai asset.size
    const effectiveSize = blob.size > 0 ? blob.size : asset.size > 0 ? asset.size : blob.size
    if (effectiveSize <= 0) throw new ApiError({ code: "VALIDATION", message: "Berkas kosong atau tidak terbaca." })
    check()
    stage = "presign"
    const upload = await api.upload.requestPresignedUrl({
      purpose: "SHOWCASE_IMAGE", fileName: asset.name, contentType: asset.mimeType, fileSize: effectiveSize,
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
    // BUG #2: telemetri sebelumnya memakai pesan generik "failed" sehingga
    // penyebab (mis. R2 SignatureDoesNotMatch) tak terlacak. Sertakan
    // code:status:backendCode — aman karena tidak memuat nama file, URL,
    // maupun fileKey (lihat komentar redaksi di bawah).
    const diag = isApiError(error)
      ? `${error.code}${error.status ? `:${error.status}` : ""}${
          error.backendCode ? `:${error.backendCode}` : ""
        }`
      : "unknown"
    // Deliberately omit file names, signed URLs and keys from telemetry.
    logWarn(`showcase:upload:${stage}:${diag}`, new Error(signal?.aborted ? "cancelled" : "failed"))
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

/*
 * P-06 (audit 2026-09-24): `uploadShowcasePhotos()` (batch konkurensi-3 +
 * progres) DIHAPUS — 0 pemanggil di seluruh repo sejak alur yang dipakai
 * adalah unggah satu-per-satu dari layar manajemen (dengan pratinjau per
 * foto), sehingga janji "G-21: tidak lagi serial" di docblock lamanya tidak
 * pernah benar-benar berlaku. Kalau nanti produk memakai pemilihan BANYAK
 * foto sekaligus (pickImages selectionLimit > 1), hidupkan kembali batch ini
 * bersama pemanggilnya, bukan lebih dulu.
 */
