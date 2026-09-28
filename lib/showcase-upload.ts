/** Upload-only workflow. Direct upload ke server (self-hosted storage, 2026-09-26). */
import { api } from "@/lib/api"
import { ApiError, isApiError } from "@/lib/api/errors"
import type { PickedImage } from "@/lib/image-picker"
import { pickedImageToFormData, resizePickedImage } from "@/lib/image-picker"
import {
  SHOWCASE_IMAGE_MAX_BYTES,
  SHOWCASE_VIDEO_MAX_BYTES,
  SHOWCASE_VIDEO_MAX_SEC,
} from "@/lib/showcase-limits"
import { logWarn } from "@/lib/telemetry"

export type ShowcaseUploadOutcome = {
  kind: "fileKey"
  fileKey: string
  /**
   * PERF-FIX (NP-001): key thumbnail foto auto-generate server-side (sharp
   * ~640px) — dilampirkan sebagai `thumbnailFileKey` di `media[]` agar feed
   * memuat varian kecil. undefined = backend tidak mengembalikan (foto lama
   * / thumbnail gagal — feed fallback ke imageUrl penuh).
   */
  thumbnailFileKey?: string
}

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
  let thumbnailFileKey: string | undefined
  let stage = "read"
  const check = () => {
    if (signal?.aborted) throw new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan." })
  }
  try {
    check()
    // PERF-FIX (NP-003): resize DULU (maks 1920px, JPEG 0.8) — guard 5MB
    // diterapkan pada HASIL resize, bukan menolak foto besar sebelum sempat
    // dikecilkan. Fail-open: resize gagal → asset asli dipakai.
    const resized = await resizePickedImage(asset)
    // Item 60 (FE-IMP-1): guard foto terpusat — 5MB SEBELUM upload, pesan
    // jelas. `size` = 0 hanya bila platform tak melaporkan ukuran (fail-open
    // ke validasi server; tidak bisa dipastikan = jangan tolak buta).
    if (resized.size > SHOWCASE_IMAGE_MAX_BYTES) {
      throw new ApiError({
        code: "PAYLOAD_TOO_LARGE",
        message: `Ukuran foto melebihi 5 MB (${(resized.size / 1048576).toFixed(1)} MB). Pilih foto yang lebih kecil.`,
      })
    }
    stage = "transfer"
    // Self-hosted (2026-09-26): tidak ada presigned URL R2 lagi.
    // Upload langsung multipart ke server: POST /v1/upload/direct
    // Pakai pickedImageToFormData (format {uri,name,type}) — Blob langsung
    // tidak terbaca Multer di React Native.
    const formData = await pickedImageToFormData(resized, "file")
    formData.append("purpose", "SHOWCASE_IMAGE")
    const result = await api.upload.uploadDirect(formData, signal)
    if (!result.fileKey) throw new ApiError({ code: "PARSE", message: "Kunci unggahan tidak tersedia." })
    fileKey = result.fileKey
    check()
    // uploadDirect sudah auto-confirm di server — tidak perlu /upload/confirm
    // PERF-FIX (NP-001): teruskan thumbnailFileKey foto bila backend
    // mengembalikannya (auto-generate sharp ~640px).
    const outcome: ShowcaseUploadOutcome = { kind: "fileKey", fileKey }
    if (result.thumbnailFileKey) {
      outcome.thumbnailFileKey = result.thumbnailFileKey
      thumbnailFileKey = result.thumbnailFileKey
    }
    return outcome
  } catch (error) {
    // No file is attached in this workflow: compensating cleanup is safe even after confirm.
    // PERF-FIX (NP-001): bersihkan thumbnail foto juga bila sempat dibuat.
    const pendingKeys = [fileKey, thumbnailFileKey].filter((k): k is string => !!k)
    if (pendingKeys.length > 0) await cleanupPendingShowcaseKeys(pendingKeys)
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
    // Item 60b (FE-IMP-1): guard video SEBELUM upload — 100MB / 180 detik,
    // sesuai keputusan user batch-19 #1. `size` = 0 / `durationMs` undefined
    // hanya bila platform tak melaporkan (fail-open ke validasi server).
    if (asset.size > SHOWCASE_VIDEO_MAX_BYTES) {
      throw new ApiError({
        code: "PAYLOAD_TOO_LARGE",
        message: `Ukuran video melebihi 100 MB (${(asset.size / 1048576).toFixed(0)} MB). Pilih video yang lebih kecil atau lebih pendek.`,
      })
    }
    if (asset.durationMs != null && asset.durationMs > SHOWCASE_VIDEO_MAX_SEC * 1000) {
      throw new ApiError({
        code: "VALIDATION",
        message: `Durasi video melebihi 3 menit (${Math.round(asset.durationMs / 1000)} dtk). Potong dulu sebelum mengunggah.`,
      })
    }
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
