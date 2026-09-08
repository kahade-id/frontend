/**
 * Kahade — domain `upload` (presigned URL, confirm, direct, cleanup).
 *
 * Direct multipart dipakai avatar (lihat users.uploadAvatarDirect) untuk
 * memangkas round-trip; KYC / bukti sengketa memakai presigned URL karena
 * server menuntut `fileKey` dari S3.
 */
import { assertDtoConstraints } from "@/lib/financial"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { ApiError } from "@/lib/api/errors"
import { safeHttpsUrl } from "@/lib/version"
import { http, seg } from "@/lib/api/client"
import type { CleanupFilesDto, ConfirmUploadDto, PresignedUrlDto } from "@/lib/api/types"

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
  assertDtoConstraints(dto, API_CONSTRAINTS.PresignedUrlDto)
  return http
    .post<unknown, PresignedUrlDto>("/v1/upload/presigned-url", dto, { auth: "required" })
    .then((raw) => {
      const value = raw as Record<string, unknown>
      return {
        ...value,
        url: value.url ?? value.uploadUrl,
        expiresAt: value.expiresAt ?? value.expires_at,
      } as PresignedUpload
    })
}

/** Object storage is a separate HTTPS transport: never send cookies or application headers. */
export async function uploadToPresignedUrl(
  upload: Pick<PresignedUpload, "url" | "method" | "fields" | "headers">,
  blob: Blob,
  fileName = "upload",
  timeoutMs = 60_000,
) {
  const url = safeHttpsUrl(upload.url)
  if (!url) throw new ApiError({ code: "VALIDATION", message: "URL unggah tidak aman." })
  const method = upload.method ?? (upload.fields ? "POST" : "PUT")
  if (method !== "PUT" && method !== "POST")
    throw new ApiError({ code: "PARSE", message: "Metode unggah tidak didukung." })
  const headers = new Headers(upload.headers)
  let body: Blob | FormData = blob
  if (method === "POST") {
    body = new FormData()
    for (const [key, value] of Object.entries(upload.fields ?? {})) body.append(key, value)
    body.append("file", blob, fileName)
    headers.delete("Content-Type") // fetch owns the multipart boundary.
  } else if (!headers.has("Content-Type") && blob.type) headers.set("Content-Type", blob.type)
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const response = await Promise.race([
      fetch(url, { method, body, headers, credentials: "omit", signal: controller.signal }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(
            new ApiError({
              code: "TIMEOUT",
              message: "Unggah terlalu lama. Periksa koneksi lalu coba kembali.",
            }),
          )
        }, timeoutMs)
      }),
    ])
    if (!response.ok)
      throw new ApiError({
        code: "SERVER",
        status: response.status,
        message: "Unggah berkas gagal. Silakan coba kembali.",
      })
  } finally {
    clearTimeout(timer)
  }
}
export async function putToPresignedUrl(url: string, blob: Blob, headers?: Record<string, string>) {
  return uploadToPresignedUrl({ url, method: "PUT", headers }, blob)
}

export function confirmUpload(dto: ConfirmUploadDto) {
  return http.post<ConfirmedUpload, ConfirmUploadDto>("/v1/upload/confirm", dto, {
    auth: "required",
  })
}

/** Multipart langsung ke server dengan field `file`. */
export function uploadDirect(formData: FormData) {
  return http.post<DirectUpload>("/v1/upload/direct", undefined, { formData, auth: "required" })
}

/**
 * Audit kontrak: spec menandai requestBody `POST /v1/upload/cleanup` sebagai
 * `required: true` dengan skema `CleanupFilesDto`, yang di spec berupa objek
 * KOSONG (`{ "type": "object", "properties": {} }` → `Record<string, never>`).
 * Versi lama mengirim `undefined`, sehingga tidak ada body sama sekali —
 * backend yang memvalidasi `required` akan menolak dengan 400/415. Kirim
 * objek kosong eksplisit agar sesuai kontrak.
 *
 * Catatan jujur: fungsi ini saat ini TIDAK punya pemanggil (dead export), jadi
 * cacatnya belum pernah tercapai pengguna. Diperbaiki sekarang supaya tidak
 * menjadi jebakan saat nanti dipasang.
 */
export function cleanupUploads() {
  const dto: CleanupFilesDto = {}
  return http.post<void, CleanupFilesDto>("/v1/upload/cleanup", dto, { auth: "required" })
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
  await uploadToPresignedUrl(
    { ...presigned, headers: { "Content-Type": contentType, ...presigned.headers } },
    blob,
    fileName,
  )
  const confirmed = await confirmUpload({ fileKey: presigned.fileKey })
  return { fileKey: presigned.fileKey, url: confirmed.url }
}

/** URL aman untuk fileKey (mis. `${base}/files/...`) — dipakai fallback path. */
export function fileKeyToUrl(fileKey: string) {
  return seg(fileKey)
}
