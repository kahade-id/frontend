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
import { buildUrl, http, refreshAccessToken, seg } from "@/lib/api/client"
import { getAccessToken } from "@/lib/api/session"
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
 * Batch 43 (item 14): unduh file privat milik sendiri —
 * GET /v1/upload/my-file?key=<fileKey>. Hanya berhasil bila segmen userId
 * pada key = peminta (dipakai pemilik untuk pratinjau aset digital FILE).
 */
export function downloadOwnFile(fileKey: string, signal?: AbortSignal) {
  return http.get<Blob>("/v1/upload/my-file", {
    auth: "required",
    signal,
    query: { key: fileKey },
    responseType: "blob",
  })
}

// ------------------------------------------------------------------
// Upload video showcase (kontrak final Tim A, 2026-09-28)
// ------------------------------------------------------------------

/**
 * Hasil POST /v1/upload/direct dengan purpose=SHOWCASE_VIDEO.
 * Backend memproses video (ffmpeg) dan mengembalikan thumbnail otomatis —
 * `thumbnailFileKey` WAJIB dilampirkan saat membuat item etalase (#2).
 */
export type DirectVideoUpload = {
  fileKey: string
  fileUrl?: string
  thumbnailFileKey?: string
  thumbnailUrl?: string
  durationSec?: number
  width?: number
  height?: number
}

/** Copy Indonesia per kode error upload video backend (kontrak #1). */
const VIDEO_UPLOAD_ERROR_COPY: Record<string, string> = {
  FILE_TOO_LARGE: "Video terlalu besar. Pilih video yang lebih kecil lalu coba lagi.",
  MIME_TYPE_MISMATCH: "Format video tidak didukung. Gunakan MP4, MOV, atau WebM.",
  VIDEO_TOO_LONG: "Durasi video melebihi batas yang diizinkan. Pilih video yang lebih pendek.",
  VIDEO_UNPROCESSABLE: "Video tidak dapat diproses. Coba dengan video lain.",
  UPLOAD_FAILED: "Unggah video gagal. Periksa koneksi lalu coba lagi.",
}

/** Ambil kode error backend dari body respons (bentuk NestJS umum). */
function videoUploadBackendCode(bodyText: string): string | undefined {
  try {
    const body = JSON.parse(bodyText) as Record<string, unknown>
    const code =
      (typeof body.code === "string" && body.code) ||
      (typeof (body.error as Record<string, unknown> | undefined)?.code === "string" &&
        (body.error as Record<string, unknown>).code) ||
      undefined
    return typeof code === "string" ? code : undefined
  } catch {
    return undefined
  }
}

function videoUploadError(status: number, bodyText: string): ApiError {
  const backendCode = videoUploadBackendCode(bodyText)
  const copy = (backendCode && VIDEO_UPLOAD_ERROR_COPY[backendCode]) || undefined
  return new ApiError({
    code: codeFromStatus(status, false),
    status,
    backendCode: backendCode ?? "UPLOAD_HTTP_ERROR",
    message: copy ?? `Unggah video gagal (HTTP ${status}). Coba lagi.`,
    path: "/v1/upload/direct",
  })
}

function parseVideoUploadResponse(bodyText: string): DirectVideoUpload {
  let body: Record<string, unknown>
  try {
    body = JSON.parse(bodyText) as Record<string, unknown>
  } catch {
    throw new ApiError({ code: "PARSE", message: "Respons unggah video tidak valid." })
  }
  const str = (v: unknown): string | undefined =>
    typeof v === "string" && v ? v : undefined
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined
  const fileKey = str(body.fileKey)
  if (!fileKey)
    throw new ApiError({ code: "PARSE", message: "Respons unggah video tidak memuat kunci berkas." })
  const out: DirectVideoUpload = { fileKey }
  const fileUrl = str(body.fileUrl)
  if (fileUrl) out.fileUrl = fileUrl
  const thumbnailFileKey = str(body.thumbnailFileKey)
  if (thumbnailFileKey) out.thumbnailFileKey = thumbnailFileKey
  const thumbnailUrl = str(body.thumbnailUrl)
  if (thumbnailUrl) out.thumbnailUrl = thumbnailUrl
  const durationSec = num(body.durationSec)
  if (durationSec != null) out.durationSec = durationSec
  const width = num(body.width)
  if (width != null) out.width = width
  const height = num(body.height)
  if (height != null) out.height = height
  return out
}

/**
 * Upload video showcase via `POST /v1/upload/direct` (multipart
 * `file` + `purpose=SHOWCASE_VIDEO`) dengan LAPORAN PROGRESS.
 *
 * `fetch` tidak melaporkan progress upload, jadi jalur ini memakai
 * `XMLHttpRequest` (`xhr.upload.onprogress` — didukung React Native & web).
 * Auth: Bearer token dari sesi (satu kali refresh-and-retry bila 401,
 * selaras perilaku client.ts).
 *
 * Error backend (FILE_TOO_LARGE, MIME_TYPE_MISMATCH, VIDEO_TOO_LONG,
 * VIDEO_UNPROCESSABLE, UPLOAD_FAILED) dipetakan ke pesan Indonesia yang
 * bisa ditindaklanjuti (lihat VIDEO_UPLOAD_ERROR_COPY).
 */
/**
 * NP-006 (audit performa): upload besar single-attempt — putus di tengah =
 * ulang dari NOL. Resume/chunked sejati butuh protokol backend baru
 * (DEFERRED — lihat laporan: endpoint `POST /v1/upload/chunk` dkk. belum
 * ada). Sementara itu, retry CERDAS sisi klien:
 * - hanya error TRANSIEN (NETWORK/TIMEOUT/SERVER 5xx) yang diulang;
 * - 4xx validasi (FILE_TOO_LARGE, MIME_TYPE_MISMATCH, ...) TIDAK di-retry
 *   (mengulang tidak akan sukses); ABORTED (user batal) tidak di-retry;
 * - backoff eksponensial 1s → 2s, maks 2x ulang (3 percobaan total).
 *
 * Jujur soal batasnya: ini tetap upload ulang PENUH dari byte 0 — menolong
 * putus-awal/gangguan sesaat, bukan putus di 95%. Progress dilaporkan ulang
 * dari 0 di tiap percobaan (pemanggil menampilkan "mencoba lagi").
 */
const MAX_VIDEO_UPLOAD_RETRIES = 2
const VIDEO_UPLOAD_RETRY_BASE_MS = 1000

function isRetriableVideoUploadError(err: unknown): boolean {
  // `{ retriable401: true }` bukan ApiError — jalur refresh token sudah
  // ditangani di attemptUpload; di sini bukan kandidat retry jaringan.
  if (!(err instanceof ApiError)) return false
  return err.isTransient
}

function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan." }))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan." }))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

export function uploadDirectVideo(
  asset: PickedImage,
  opts: {
    purpose?: string
    /** Fraksi 0–1 kemajuan upload. */
    onProgress?: (fraction: number) => void
    signal?: AbortSignal
    timeoutMs?: number
  } = {},
): Promise<DirectVideoUpload> {
  // Timeout adaptif (bug 2026-09-28): 180 detik terlalu pendek untuk video
  // besar di koneksi HP Indonesia (100MB @ 2Mbps ≈ 400 detik upload saja).
  // Rumus: 120 detik basis (server: ffprobe 30s + ffmpeg 60s + margin) +
  // waktu upload pada 100 KB/s (konservatif). Min 10 menit, maks 30 menit.
  const fileBytes = asset.size ?? 0
  const adaptiveTimeout = fileBytes > 0
    ? Math.min(1_800_000, Math.max(600_000, 120_000 + fileBytes / 100))
    : 600_000
  const { purpose = "SHOWCASE_VIDEO", onProgress, signal, timeoutMs = adaptiveTimeout } = opts
  return new Promise<DirectVideoUpload>((resolvePromise, rejectPromise) => {
    let settled = false
    const resolve = (v: DirectVideoUpload) => {
      if (!settled) {
        settled = true
        resolvePromise(v)
      }
    }
    const reject = (e: unknown) => {
      if (!settled) {
        settled = true
        rejectPromise(e)
      }
    }
    if (signal?.aborted) {
      reject(new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan." }))
      return
    }

    const sendOnce = async (token: string): Promise<void> => {
      const formData = await pickedImageToFormData(asset, "file")
      formData.append("purpose", purpose)
      await new Promise<void>((resolveXhr, rejectXhr) => {
        const xhr = new XMLHttpRequest()
        const onAbort = () => xhr.abort()
        signal?.addEventListener("abort", onAbort, { once: true })
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            onProgress?.(Math.min(1, Math.max(0, event.loaded / event.total)))
          }
        }
        xhr.timeout = timeoutMs
        xhr.ontimeout = () => {
          signal?.removeEventListener("abort", onAbort)
          rejectXhr(
            new ApiError({
              code: "TIMEOUT",
              message: "Unggah video terlalu lama. Periksa koneksi lalu coba lagi.",
              path: "/v1/upload/direct",
            }),
          )
        }
        xhr.onabort = () => {
          signal?.removeEventListener("abort", onAbort)
          rejectXhr(new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan." }))
        }
        xhr.onerror = () => {
          signal?.removeEventListener("abort", onAbort)
          rejectXhr(
            new ApiError({
              code: "NETWORK",
              message: DEFAULT_ERROR_MESSAGES.NETWORK,
              path: "/v1/upload/direct",
            }),
          )
        }
        xhr.onload = () => {
          signal?.removeEventListener("abort", onAbort)
          const bodyText = typeof xhr.responseText === "string" ? xhr.responseText : ""
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolveXhr()
              resolve(parseVideoUploadResponse(bodyText))
            } catch (err) {
              rejectXhr(err)
            }
            return
          }
          if (xhr.status === 401) {
            // Selaras client.ts: satu kali refresh token lalu ulangi.
            rejectXhr({ retriable401: true as const })
            return
          }
          rejectXhr(videoUploadError(xhr.status, bodyText))
        }
        xhr.open("POST", buildUrl("/v1/upload/direct"))
        xhr.setRequestHeader("Accept", "application/json")
        xhr.setRequestHeader("Authorization", `Bearer ${token}`)
        // JANGAN set Content-Type — XHR mengisi multipart boundary sendiri.
        // RN: FormData diterima XMLHttpRequest.send; tipe lib DOM tidak
        // mengenalnya sehingga cast ke parameter send yang sahih.
        xhr.send(formData as unknown as Parameters<XMLHttpRequest["send"]>[0])
      })
    }

    const run = async () => {
      try {
        let attempt = 0
        for (;;) {
          try {
            let token = await getAccessToken()
            if (!token)
              throw new ApiError({
                code: "UNAUTHORIZED",
                message: DEFAULT_ERROR_MESSAGES.UNAUTHORIZED,
                path: "/v1/upload/direct",
              })
            try {
              await sendOnce(token)
            } catch (err) {
              const retriable =
                err && typeof err === "object" && (err as { retriable401?: unknown }).retriable401 === true
              if (!retriable || signal?.aborted) throw err
              const fresh = await refreshAccessToken()
              if (!fresh)
                throw new ApiError({
                  code: "UNAUTHORIZED",
                  message: DEFAULT_ERROR_MESSAGES.UNAUTHORIZED,
                  path: "/v1/upload/direct",
                })
              await sendOnce(fresh)
            }
            return
          } catch (err) {
            // NP-006: retry cerdas — hanya transien, hormati abort.
            const canRetry =
              attempt < MAX_VIDEO_UPLOAD_RETRIES &&
              !signal?.aborted &&
              isRetriableVideoUploadError(err)
            if (!canRetry) throw err
            attempt += 1
            await sleepAbortable(VIDEO_UPLOAD_RETRY_BASE_MS * 2 ** (attempt - 1), signal)
          }
        }
      } catch (err) {
        reject(err)
      }
    }
    void run()
  })
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
