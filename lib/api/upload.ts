/**
 * Kahade — domain `upload` (presigned URL, confirm, direct, cleanup).
 *
 * Direct multipart dipakai avatar (lihat users.uploadAvatarDirect) untuk
 * memangkas round-trip; KYC / bukti sengketa memakai presigned URL karena
 * server menuntut `fileKey` dari S3.
 */
import { http, seg } from "@/lib/api/client"
import type { ConfirmUploadDto, PresignedUrlDto } from "@/lib/api/types"

/** Hasil POST /v1/upload/presigned-url. */
export type PresignedUpload = {
  fileKey: string
  url: string
  /** Method PUT untuk menaruh objek (form = POST multipart). */
  method?: "PUT" | "POST"
  fields?: Record<string, string>
  headers?: Record<string, string>
  expiresAt?: string
}

/** Hasil POST /v1/upload/confirm. */
export type ConfirmedUpload = {
  fileKey: string
  url?: string
  sha256?: string
}

/** Hasil POST /v1/upload/direct — menerima FormData multipart. */
export type DirectUpload = {
  fileKey: string
  url: string
}

export function requestPresignedUrl(dto: PresignedUrlDto) {
  return http.post<PresignedUpload, PresignedUrlDto>("/v1/upload/presigned-url", dto, {
    auth: "required",
  })
}

/** PUT objek ke URL presigned (S3) — tanpa auth aplikasi. */
export async function putToPresignedUrl(url: string, blob: Blob, headers?: Record<string, string>) {
  const res = await fetch(url, { method: "PUT", body: blob, headers })
  if (!res.ok) throw new Error(`Upload gagal (${res.status})`)
}

export function confirmUpload(dto: ConfirmUploadDto) {
  return http.post<ConfirmedUpload, ConfirmUploadDto>("/v1/upload/confirm", dto, { auth: "required" })
}

/** Multipart langsung ke server dengan field `file`. */
export function uploadDirect(formData: FormData) {
  return http.post<DirectUpload, FormData>("/v1/upload/direct", formData, { auth: "required" })
}

export function cleanupUploads() {
  return http.post<void>("/v1/upload/cleanup", undefined, { auth: "required" })
}

/**
 * Upload dari asset lokal (dipakai form bukti/KYC): ambil blob, minta
 * presigned URL, PUT, lalu confirm. Kembalikan fileKey siap kirim.
 */
export async function uploadPresigned(
  purpose: PresignedUrlDto["purpose"],
  fileName: string,
  contentType: string,
  blob: Blob,
) {
  const presigned = await requestPresignedUrl({
    purpose,
    fileName,
    contentType,
    fileSize: blob.size,
  })
  await putToPresignedUrl(presigned.url, blob, presigned.headers)
  const confirmed = await confirmUpload({ fileKey: presigned.fileKey })
  return { fileKey: presigned.fileKey, url: confirmed.url }
}

/** URL aman untuk fileKey (mis. `${base}/files/...`) — dipakai fallback path. */
export function fileKeyToUrl(fileKey: string) {
  return seg(fileKey)
}
