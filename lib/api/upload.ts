/**
 * Kahade — domain `upload` (direct, confirm, cleanup).
 *
 * Self-hosted storage (2026-09-26): SEMUA upload lewat `POST /v1/upload/direct`
 * (multipart). Alur presigned URL sudah dimatikan backend (DEPRECATED 400) —
 * `uploadPresigned` di bawah hanya dipertahankan sebagai stub deprecated dan
 * tidak boleh dipakai kode baru.
 */
import { assertDtoConstraints } from "@/lib/financial"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { ApiError, codeFromStatus, DEFAULT_ERROR_MESSAGES } from "@/lib/api/errors"
import { safeHttpsUrl } from "@/lib/version"
import { http, seg } from "@/lib/api/client"
import type { CleanupFilesDto, ConfirmUploadDto, PresignedUrlDto } from "@/lib/api/types"
import { pickedImageToFormData, type PickedImage } from "@/lib/image-picker"

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

export function requestPresignedUrl(dto: PresignedUrlDto, signal?: AbortSignal) {
  assertDtoConstraints(dto, API_CONSTRAINTS.PresignedUrlDto)
  return http
    .post<unknown, PresignedUrlDto>("/v1/upload/presigned-url", dto, { auth: "required", signal })
    .then((raw) => {
      const value = raw as Record<string, unknown>
      const upload: PresignedUpload = {
        ...(value as Record<string, unknown>),
        url: (value.url ?? value.uploadUrl) as string,
        expiresAt: (value.expiresAt ?? value.expires_at) as string | undefined,
      } as PresignedUpload
      /**
       * D-15 (audit escrow 2026-09-24): `fileKey` dulu lolos apa adanya —
       * `undefined` berakhir di `fileUrls: [undefined]` → `"fileUrls":[null]`
       * ditolak validator server SETELAH objek terunggah (objek yatim).
       * `url` wajib string; `fileKey` wajib non-kosong sebelum dipakai DTO.
       */
      if (typeof upload.url !== "string" || !upload.url)
        throw new ApiError({ code: "PARSE", message: "Respons unggah tidak memuat URL." })
      if (typeof upload.fileKey !== "string" || !upload.fileKey)
        throw new ApiError({ code: "PARSE", message: "Respons unggah tidak memuat kunci berkas." })
      return upload
    })
}

/** Object storage is a separate HTTPS transport: never send cookies or application headers. */
export async function uploadToPresignedUrl(
  upload: Pick<PresignedUpload, "url" | "method" | "fields" | "headers">,
  blob: Blob,
  fileName = "upload",
  timeoutMs = 60_000,
  signal?: AbortSignal,
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
  const abort = () => controller.abort()
  signal?.addEventListener("abort", abort, { once: true })
  if (signal?.aborted) controller.abort()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    let response: Response
    try {
      response = await Promise.race([
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
    } catch (err) {
      // BUG #2: fetch yang gagal total (offline/DNS) sebelumnya lolos sebagai
      // TypeError mentah → userMessage() menampilkan UNKNOWN yang generik.
      if (err instanceof ApiError) throw err // TIMEOUT dari race di atas.
      if ((err as { name?: string } | null)?.name === "AbortError")
        throw new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan." })
      throw new ApiError({ code: "NETWORK", message: DEFAULT_ERROR_MESSAGES.NETWORK, cause: err })
    }
    if (!response.ok) throw await storageUploadError(response)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", abort)
  }
}

/**
 * BUG #2 (2026-09-26): error PUT/POST ke object storage (R2/S3) sebelumnya
 * dibuang dan diganti pesan generik "Unggah berkas gagal" — penyebab asli
 * (mis. 403 SignatureDoesNotMatch) tak pernah terlacak. R2 menjawab error
 * dengan XML `<Error><Code>…</Code><Message>…</Message></Error>`; kode itu
 * sekarang diteruskan ke `ApiError.backendCode` (`R2_<Code>`) untuk
 * diagnostik, dan dipetakan ke copy Indonesia yang bisa ditindaklanjuti user.
 */
function parseStorageErrorCode(bodyText: string): string | undefined {
  const match = /<Code>([^<]{1,120})<\/Code>/i.exec(bodyText)
  const code = match?.[1]?.trim()
  return code || undefined
}

/** Copy Indonesia per kode error R2 yang umum saat PUT presigned gagal. */
const STORAGE_ERROR_COPY: Record<string, string> = {
  SignatureDoesNotMatch:
    "Tanda tangan unggahan tidak cocok. Pilih ulang foto lalu coba unggah kembali.",
  AccessDenied: "Akses ke penyimpanan ditolak. Coba lagi; bila berlanjut, hubungi bantuan.",
  ExpiredToken: "Sesi unggah kedaluwarsa. Coba unggah ulang.",
  EntityTooLarge: "Ukuran berkas melebihi batas penyimpanan.",
  MaxMessageLengthExceeded: "Ukuran berkas melebihi batas penyimpanan.",
  InvalidRequest: "Permintaan unggah tidak valid. Coba dengan foto lain.",
  BadDigest: "Berkas rusak saat diunggah. Coba lagi.",
  NoSuchBucket: "Tujuan penyimpanan tidak tersedia. Coba lagi nanti.",
  InternalError: "Penyimpanan sedang gangguan. Coba lagi nanti.",
  SlowDown: "Penyimpanan sedang sibuk. Tunggu sebentar lalu coba lagi.",
}

async function storageUploadError(response: Response): Promise<ApiError> {
  const bodyText = await response.text().catch(() => "")
  const storageCode = parseStorageErrorCode(bodyText)
  const copy = (storageCode && STORAGE_ERROR_COPY[storageCode]) || undefined
  return new ApiError({
    // codeFromStatus: 4xx → FORBIDDEN/BAD_REQUEST/dsb. sehingga userMessage()
    // menampilkan pesan informatif di bawah (bukan generik); 5xx → SERVER
    // (pesan generik memang tepat untuk gangguan server).
    code: codeFromStatus(response.status, false),
    status: response.status,
    backendCode: storageCode ? `R2_${storageCode}` : "R2_HTTP_ERROR",
    message:
      copy ??
      `Unggah ke penyimpanan gagal (HTTP ${response.status}${
        storageCode ? `, ${storageCode}` : ""
      }). Coba lagi.`,
    // Body XML bisa memuat fileKey di <Resource> — batasi panjangnya dan
    // JANGAN tampilkan ke user (getter `raw` tidak ikut serialisasi).
    raw: bodyText.slice(0, 2000) || undefined,
    path: "object-storage",
  })
}
export async function putToPresignedUrl(
  url: string,
  blob: Blob,
  headers?: Record<string, string>,
  signal?: AbortSignal,
) {
  return uploadToPresignedUrl({ url, method: "PUT", headers }, blob, "upload", 60_000, signal)
}

export function confirmUpload(dto: ConfirmUploadDto, signal?: AbortSignal) {
  return http.post<ConfirmedUpload, ConfirmUploadDto>("/v1/upload/confirm", dto, {
    auth: "required",
    signal,
  })
}

/**
 * Multipart langsung ke server dengan field `file`.
 *
 * O-01 (audit escrow 2026-09-24): `signal` membatalkan penggantian foto
 * avatar / unggah galeri saat pengguna menutup layar — dulu hasilnya tetap
 * terkirim dan menimpa yang lama tanpa bisa dicegah.
 */
export function uploadDirect(formData: FormData, signal?: AbortSignal) {
  return http.post<DirectUpload>("/v1/upload/direct", undefined, {
    formData,
    auth: "required",
    signal,
  })
}

/**
 * Produksi menuntut `fileKeys` (1–20 item) — bukan `{}` seperti spec lama.
 * Dipasang (G-04) di jalur gagal upload avatar (`app/edit-profile.tsx`) dan
 * submit KYC (`app/kyc.tsx`): fileKey yang sudah terupload tapi tidak jadi
 * dipakai dibersihkan best-effort agar tidak menjadi orphan di S3.
 */
export function cleanupUploads(fileKeys: string[]) {
  const dto: CleanupFilesDto = { fileKeys }
  return http.post<void, CleanupFilesDto>("/v1/upload/cleanup", dto, { auth: "required" })
}

/**
 * Upload gambar/video dari asset lokal langsung ke server (multipart
 * `POST /v1/upload/direct`). Pengganti `uploadPresigned` untuk SEMUA
 * purpose — backend sudah mematikan presigned URL (ST-014, 2026-09-26).
 *
 * Memakai `pickedImageToFormData` (format {uri,name,type}) karena Blob
 * langsung tidak terbaca Multer di React Native. Server auto-confirm,
 * jadi tidak perlu `/upload/confirm`.
 */
export async function uploadDirectImage(
  img: PickedImage,
  purpose: string,
  signal?: AbortSignal,
): Promise<{ fileKey: string }> {
  const formData = await pickedImageToFormData(img, "file")
  formData.append("purpose", purpose)
  const result = await uploadDirect(formData, signal)
  if (!result.fileKey) throw new ApiError({ code: "PARSE", message: "Kunci unggahan tidak tersedia." })
  return { fileKey: result.fileKey }
}

/**
 * @deprecated Backend mematikan `POST /v1/upload/presigned-url` (DEPRECATED 400,
 * ST-014, 2026-09-26). JANGAN dipakai untuk kode baru — pakai `uploadDirectImage`
 * atau `uploadDirect`. Fungsi ini dipertahankan agar tidak merusak pemanggil
 * lama yang belum termigrasi; akan selalu gagal di server.
 *
 * Upload dari asset lokal (dipakai form bukti/KYC): ambil blob, minta
 * presigned URL, PUT, lalu confirm. Kembalikan fileKey siap kirim.
 *
 * O-01 (audit escrow 2026-09-24): `signal` membatalkan SELURUH rantai
 * (presigned → PUT → confirm) — bukan hanya langkah terakhir. Cleanup fileKey
 * yang sudah terlanjur terunggah TIDAK diikat signal (harus tetap jalan saat
 * pembatalan, supaya tidak menyisakan orphan di S3).
 */
export async function uploadPresigned(
  purpose: PresignedUrlDto["purpose"],
  fileName: string,
  contentType: string,
  blob: Blob,
  signal?: AbortSignal,
) {
  const presigned = await requestPresignedUrl(
    {
      purpose,
      fileName,
      contentType,
      fileSize: blob.size,
    },
    signal,
  )
  await uploadToPresignedUrl(
    { ...presigned, headers: { "Content-Type": contentType, ...presigned.headers } },
    blob,
    fileName,
    60_000,
    signal,
  )
  const confirmed = await confirmUpload({ fileKey: presigned.fileKey }, signal)
  return { fileKey: presigned.fileKey, url: confirmed.url }
}

/** URL aman untuk fileKey (mis. `${base}/files/...`) — dipakai fallback path. */
export function fileKeyToUrl(fileKey: string) {
  return seg(fileKey)
}
