/** Upload-only workflow. Direct upload ke server (self-hosted storage, 2026-09-26). */
import { api } from "@/lib/api"
import { ApiError, isApiError } from "@/lib/api/errors"
import type { PickedImage } from "@/lib/image-picker"
import { pickedImageToFormData } from "@/lib/image-picker"
import { logWarn } from "@/lib/telemetry"

export type ShowcaseUploadOutcome = { kind: "fileKey"; fileKey: string }

/**
 * Hasil upload video showcase — siap dilampirkan sebagai
 * `{ kind: "video", fileKey, thumbnailFileKey, durationSec }` di `media[]`
 * (kontrak final Tim A #2: video WAJIB thumbnailFileKey).
 */
export type ShowcaseVideoUploadOutcome = {
  kind: "video"
  fileKey: string
  thumbnailFileKey: string
  durationSec?: number
  thumbnailUrl?: string
}

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

/**
 * Upload SATU video showcase (kontrak final Tim A #1, 2026-09-28).
 *
 * Alur: POST /v1/upload/direct (multipart file + purpose=SHOWCASE_VIDEO)
 * dengan laporan progress 0–1 via `onProgress`. Backend memproses video
 * (thumbnail otomatis) — hasilnya WAJIB menyertakan `thumbnailFileKey`
 * (fail-closed: tanpa itu, kirim sebagai video DITOLAK dengan pesan jelas,
 * bukan fail-open jadi gambar).
 *
 * Error backend (FILE_TOO_LARGE, MIME_TYPE_MISMATCH, VIDEO_TOO_LONG,
 * VIDEO_UNPROCESSABLE, UPLOAD_FAILED) sudah dipetakan ke pesan Indonesia
 * di `api.upload.uploadDirectVideo`.
 */
export async function uploadShowcaseVideo(
  asset: PickedImage,
  opts: {
    onProgress?: (fraction: number) => void
    signal?: AbortSignal
  } = {},
): Promise<ShowcaseVideoUploadOutcome> {
  const { onProgress, signal } = opts
  let fileKey: string | undefined
  let thumbnailFileKey: string | undefined
  try {
    if (signal?.aborted) throw new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan." })
    const result = await api.upload.uploadDirectVideo(asset, {
      purpose: "SHOWCASE_VIDEO",
      onProgress,
      signal,
    })
    fileKey = result.fileKey
    // Kontrak #2: video WAJIB thumbnailFileKey — fail-closed bila backend
    // tidak mengembalikannya (jangan kirim video tanpa thumbnail).
    if (!result.thumbnailFileKey) {
      throw new ApiError({
        code: "PARSE",
        message: "Video berhasil diunggah tetapi thumbnail tidak tersedia. Coba lagi.",
      })
    }
    thumbnailFileKey = result.thumbnailFileKey
    if (signal?.aborted) throw new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan." })
    const outcome: ShowcaseVideoUploadOutcome = {
      kind: "video",
      fileKey: result.fileKey,
      thumbnailFileKey: result.thumbnailFileKey,
    }
    if (result.durationSec != null) outcome.durationSec = result.durationSec
    if (result.thumbnailUrl) outcome.thumbnailUrl = result.thumbnailUrl
    return outcome
  } catch (error) {
    // Best-effort: bersihkan fileKey yang sudah terlanjur terunggah.
    const keys = [fileKey, thumbnailFileKey].filter((k): k is string => !!k)
    if (keys.length > 0) await cleanupPendingShowcaseKeys(keys)
    const diag = isApiError(error)
      ? `${error.code}${error.status ? `:${error.status}` : ""}${
          error.backendCode ? `:${error.backendCode}` : ""
        }`
      : "unknown"
    logWarn(`showcase:upload-video:${diag}`, new Error(signal?.aborted ? "cancelled" : "failed"))
    throw error
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
