/** Upload-only workflow. Direct upload ke server (self-hosted storage, 2026-09-26). */
import { api } from "@/lib/api"
import { ApiError, isApiError } from "@/lib/api/errors"
import type { PickedImage } from "@/lib/image-picker"
import { pickedImageToFormData } from "@/lib/image-picker"
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
    stage = "transfer"
    // Self-hosted (2026-09-26): tidak ada presigned URL R2 lagi.
    // Upload langsung multipart ke server: POST /v1/upload/direct
    // Pakai pickedImageToFormData (format {uri,name,type}) — Blob langsung
    // tidak terbaca Multer di React Native.
    const formData = await pickedImageToFormData(asset, "file")
    formData.append("purpose", "SHOWCASE_IMAGE")
    const result = await api.upload.uploadDirect(formData, signal)
    if (!result.fileKey) throw new ApiError({ code: "PARSE", message: "Kunci unggahan tidak tersedia." })
    fileKey = result.fileKey
    check()
    // uploadDirect sudah auto-confirm di server — tidak perlu /upload/confirm
    return { kind: "fileKey", fileKey }
  } catch (error) {
    // No file is attached in this workflow: compensating cleanup is safe even after confirm.
    if (fileKey) await cleanupPendingShowcaseKeys([fileKey])
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
