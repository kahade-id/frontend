/**
 * Kahade — domain `upload` (direct, confirm, cleanup).
 *
 * Self-hosted storage (2026-09-26): SEMUA upload lewat `POST /v1/upload/direct`
 * (multipart). Alur presigned URL sudah dimatikan backend (DEPRECATED 400) —
 * BFE-115 (2026-10-03): `requestPresignedUrl`/`confirmUpload`/`uploadPresigned`
 * dihapus (dead code, nol pemanggil).
 */
import { ApiError, codeFromStatus, DEFAULT_ERROR_MESSAGES, type ApiErrorCode } from "@/lib/api/errors"
import { buildUrl, http, refreshAccessToken, seg } from "@/lib/api/client"
import { getAccessToken } from "@/lib/api/session"
import type { CleanupFilesDto } from "@/lib/api/types"
import type { PickedImage } from "@/lib/image-picker"
import { isOfflineKnown } from "@/lib/connectivity"
import {
  UPLOAD_OFFLINE_COPY,
  UPLOAD_TIMEOUT_COPY,
  UPLOAD_UNSTABLE_COPY,
  uploadTimeoutMs,
} from "@/lib/upload-errors"

// PERF-FIX (bundle): `@/lib/image-picker` menarik `expo-image-picker`
// (±788KB) — modul ini ada di barrel `@/lib/api` yang diimpor 152 file.
// Muat hanya saat fungsi upload benar-benar dipanggil (preseden dynamic
// import sudah ada di file ini: `expo-file-system/legacy`).
type ImagePickerModule = typeof import("@/lib/image-picker")
let imagePickerPromise: Promise<ImagePickerModule> | null = null
function loadImagePicker(): Promise<ImagePickerModule> {
  if (!imagePickerPromise) imagePickerPromise = import("@/lib/image-picker")
  return imagePickerPromise
}
import { Platform } from "react-native"

/** Hasil POST /v1/upload/direct — menerima FormData multipart. */
export type DirectUpload = {
  fileKey: string
  // BFI-100: BE (DirectUploadResult) mengembalikan `fileUrl`, BUKAN `url`.
  // Field `url` dihapus agar tipe tidak berbohong (runtime-nya undefined).
  fileUrl?: string
  /**
   * PERF-FIX (NP-001): hanya diisi untuk purpose=SHOWCASE_IMAGE — key + URL
   * thumbnail JPEG ~640px auto-generate server-side (sharp). Dilampirkan
   * sebagai `thumbnailFileKey` saat membuat media etalase.
   */
  thumbnailFileKey?: string
  thumbnailUrl?: string
}

/**
 * BFE-115 (2026-10-03): `requestPresignedUrl` DIHAPUS — dead code (nol
 * pemanggil); backend mematikan `POST /v1/upload/presigned-url`
 * (DEPRECATED 400). Upload kini via `uploadDirectImage`/`uploadDirect`.
 */

/**
 * BFE-115 (2026-10-03): `confirmUpload` DIHAPUS — dead code (nol pemanggil);
 * alur presigned dimatikan backend; `uploadDirect` auto-confirm server-side.
 */

// ---------------------------------------------------------------------------
// Transport multipart XHR terpusat (audit upload 2026-10-09)
// ---------------------------------------------------------------------------

/**
 * Audit 2026-10-09: SATU transport multipart untuk SEMUA upload file —
 * menggantikan percabangan lama (fetch `http.post` 20 dtk untuk foto vs XHR
 * untuk video/chat) yang menghasilkan perilaku error & progress berbeda per
 * titik upload. Alasan XHR (bukan fetch):
 *   1. `xhr.upload.onprogress` = progress byte JUJUR 0–100% (fetch tidak
 *      bisa melaporkan kemajuan upload — UI foto tidak boleh mengarang %);
 *   2. `ontimeout`/`onerror` memisahkan TIMEOUT dari NETWORK dengan jelas;
 *   3. satu titik untuk retry transien + backoff, cek NetInfo pra-upload,
 *      dan refresh-token 401 (selaras perilaku lib/api/client.ts).
 *
 * O-01 (audit escrow 2026-09-24): `signal` membatalkan unggahan per file
 * (avatar, etalase, sengketa, dsb.) — dulu hasilnya tetap terkirim.
 */
export type UploadFileOptions = {
  /** Endpoint multipart (default `POST /v1/upload/direct`). */
  path?: string
  /**
   * Ukuran file (byte) — timeout ADAPTIF proporsional (audit B4/B6):
   * file besar = deadline lebih longgar. Dipakai hanya bila `timeoutMs`
   * tidak dikirim eksplisit.
   */
  fileBytes?: number
  /** Fraksi 0–1 kemajuan transfer (jujur — dari `xhr.upload.onprogress`). */
  onProgress?: (fraction: number) => void
  /** Batalkan file ini. */
  signal?: AbortSignal
  /** Override timeout eksplisit (detik→milidetik). */
  timeoutMs?: number
  /** Rumus timeout: "photo" (basis 60 dtk, cap 5 mnt) | "video" (basis 120 dtk, cap 30 mnt). */
  timeoutKind?: "photo" | "video"
  /** Chat: header `Idempotency-Key` wajib (backend `@Idempotency()`, BFE-001). */
  idempotencyKey?: string
  /** Basis jeda retry (produksi 1000 ms); dikecilkan untuk test. */
  retryBaseMs?: number
}

/** Maks 2 ulang (3 percobaan total) — selaras kebijakan NP-006 jalur video. */
export const UPLOAD_MAX_RETRIES = 2
export const UPLOAD_RETRY_BASE_MS = 1000

function abortedUploadError(path: string): ApiError {
  return new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan.", path })
}

/**
 * Perangkat TERVERIFIKASI offline via NetInfo (lib/connectivity.ts) —
 * request TIDAK PERNAH dikirim. `backendCode: "OFFLINE_VERIFIED"`
 * membedakan ini dari NETWORK biasa (transport gagal di tengah — nasib
 * upload tak pasti) supaya pesan UI-nya benar (audit A1/A2/A3):
 *   - OFFLINE_VERIFIED → "Tidak ada koneksi internet…"
 *   - NETWORK saat online → "Koneksi terputus saat mengirim berkas…"
 */
export function offlineVerifiedUploadError(path: string): ApiError {
  return new ApiError({
    code: "NETWORK",
    backendCode: "OFFLINE_VERIFIED",
    message: UPLOAD_OFFLINE_COPY,
    path,
    clientMessage: true,
  })
}

/**
 * Hanya error TRANSIEN yang layak diulang otomatis: jaringan terputus,
 * timeout, atau 5xx. 4xx validasi (FILE_TOO_LARGE, MIME_TYPE_MISMATCH, …)
 * TIDAK diulang (mengulang tidak akan sukses); ABORTED (user batal) tidak
 * diulang; OFFLINE_VERIFIED tidak diulang (perangkat masih offline — cek
 * ulang NetInfo di percobaan berikutnya).
 */
export function isRetriableUploadError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  if (err.backendCode === "OFFLINE_VERIFIED") return false
  return err.isTransient
}

/**
 * Ambil kode error backend dari body respons (bentuk NestJS umum).
 * BFI-061: envelope BE yang sebenarnya adalah
 * `{ success:false, message, data:null, errors:{ code, message, ... } }`
 * (http-exception.filter.ts) — kode ada di `errors.code`, bukan di root.
 */
export function uploadBackendCode(bodyText: string): string | undefined {
  try {
    const body = JSON.parse(bodyText) as Record<string, unknown>
    const errors = body.errors as Record<string, unknown> | undefined
    const code =
      (typeof errors?.code === "string" && errors.code) ||
      (typeof body.code === "string" && body.code) ||
      (typeof (body.error as Record<string, unknown> | undefined)?.code === "string" &&
        (body.error as Record<string, unknown>).code) ||
      undefined
    return typeof code === "string" ? code : undefined
  } catch {
    return undefined
  }
}

/** Pesan backend dari body (untuk log/diagnostik; copy UI tetap karangan klien). */
function uploadBackendMessage(bodyText: string): string | undefined {
  try {
    const body = JSON.parse(bodyText) as Record<string, unknown>
    const errors = body.errors as Record<string, unknown> | undefined
    const message = errors?.message ?? body.message
    return typeof message === "string" && message ? message : undefined
  } catch {
    return undefined
  }
}

/**
 * Error HTTP upload → ApiError terklasifikasi. Copy Indonesia spesifik dari
 * `UPLOAD_ERROR_COPY` bila kode backend dikenal; selain itu default per
 * status — TAPI untuk 413 pesan transport tetap netral: UI mengisi batas
 * "maks X MB" via `uploadMessage` (upload-errors.ts) karena hanya UI yang
 * tahu purpose/batas yang berlaku.
 */
function uploadHttpError(status: number, bodyText: string, path: string): ApiError {
  const backendCode = uploadBackendCode(bodyText)
  const copy = backendCode ? UPLOAD_ERROR_COPY[backendCode] : undefined
  const serverMessage = uploadBackendMessage(bodyText)
  const is413 = status === 413
  return new ApiError({
    code: is413 ? "PAYLOAD_TOO_LARGE" : codeFromStatus(status, false),
    status,
    backendCode: backendCode ?? "UPLOAD_HTTP_ERROR",
    message:
      copy ??
      (is413
        ? "Ukuran berkas melebihi batas maksimal server."
        : serverMessage ?? `Berkas gagal diunggah (HTTP ${status}). Coba lagi.`),
    // copy/413-netral dikarang klien; pesan server (bahasa tak terjamin) fail-closed.
    clientMessage: copy != null || is413 || !serverMessage,
    path,
  })
}

/**
 * Respons sukses → objek JSON apa adanya. Transport TIDAK memvalidasi bentuk
 * per endpoint (direct vs avatar vs header beda field); pemanggil memvalidasi
 * lewat `parseDirectUploadObject` / cast bertipe. Fail-closed: PARSE bila
 * body bukan objek JSON (jangan kirim `undefined` ke layar).
 */
function parseUploadJsonObject(bodyText: string, path: string): Record<string, unknown> {
  let body: unknown
  try {
    body = JSON.parse(bodyText) as unknown
  } catch {
    throw new ApiError({ code: "PARSE", message: "Respons unggahan tidak valid.", path })
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError({ code: "PARSE", message: "Respons unggahan tidak valid.", path })
  }
  return body as Record<string, unknown>
}

/**
 * Parse respons sukses `POST /v1/upload/direct` (foto MAUPUN video) —
 * `fileKey` WAJIB; tanpa itu upload dianggap gagal (fail-closed).
 */
function parseDirectUploadObject(body: Record<string, unknown>, path: string): DirectUpload {
  const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined)
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined
  const fileKey = str(body.fileKey)
  if (!fileKey)
    throw new ApiError({ code: "PARSE", message: "Kunci unggahan tidak tersedia.", path })
  const out: DirectUpload = { fileKey }
  const fileUrl = str(body.fileUrl)
  if (fileUrl) out.fileUrl = fileUrl
  const thumbnailFileKey = str(body.thumbnailFileKey)
  if (thumbnailFileKey) out.thumbnailFileKey = thumbnailFileKey
  const thumbnailUrl = str(body.thumbnailUrl)
  if (thumbnailUrl) out.thumbnailUrl = thumbnailUrl
  // Field video (durationSec/width/height) diteruskan apa adanya bila ada.
  const durationSec = num(body.durationSec)
  if (durationSec != null) (out as DirectVideoUpload).durationSec = durationSec
  const width = num(body.width)
  if (width != null) (out as DirectVideoUpload).width = width
  const height = num(body.height)
  if (height != null) (out as DirectVideoUpload).height = height
  return out
}

/**
 * Unggah `formData` multipart via XHR dengan progress jujur, timeout
 * adaptif, cek NetInfo pra-upload, refresh-token 401 sekali, dan retry
 * transien + backoff (lihat docblock blok ini). Dipakai SEMUA titik upload
 * file (direct, avatar, header, story, lampiran chat/sengketa).
 *
 * Mengembalikan objek respons apa adanya (per endpoint bentuknya beda:
 * direct → `fileKey`+thumbnail, avatar → `avatarKey`/`avatarUrl`,
 * header → `headerUrl`). Validasi bentuk dilakukan pemanggil
 * (`parseDirectUploadObject` dst.) — transport hanya menjamin JSON valid.
 */
export function uploadFileWithProgress(
  formData: FormData,
  opts: UploadFileOptions = {},
): Promise<Record<string, unknown>> {
  const path = opts.path ?? "/v1/upload/direct"
  const { onProgress, signal, idempotencyKey } = opts
  const timeoutMs = opts.timeoutMs ?? uploadTimeoutMs(opts.fileBytes, opts.timeoutKind ?? "photo")
  const retryBaseMs = opts.retryBaseMs ?? UPLOAD_RETRY_BASE_MS
  return new Promise<Record<string, unknown>>((resolvePromise, rejectPromise) => {
    let settled = false
    const resolve = (v: Record<string, unknown>) => {
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
      reject(abortedUploadError(path))
      return
    }
    // Audit 2026-10-09 (A3): cek NetInfo SEBELUM upload — offline yang pasti
    // gagal cepat dengan pesan offline yang benar, bukan menyimpulkan dari
    // kegagalan request setelah percobaan sia-sia.
    if (isOfflineKnown()) {
      reject(offlineVerifiedUploadError(path))
      return
    }

    const sendOnce = (token: string): Promise<Record<string, unknown>> =>
      new Promise<Record<string, unknown>>((resolveXhr, rejectXhr) => {
        const xhr = new XMLHttpRequest()
        let done = false
        const cleanupAbort = () => signal?.removeEventListener("abort", onAbort)
        const fail = (err: ApiError) => {
          if (done) return
          done = true
          cleanupAbort()
          rejectXhr(err)
        }
        const onAbort = () => {
          try {
            xhr.abort()
          } catch {
            // abaikan
          }
        }
        if (signal) signal.addEventListener("abort", onAbort, { once: true })
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            onProgress?.(Math.min(1, Math.max(0, event.loaded / event.total)))
          }
        }
        xhr.timeout = timeoutMs
        xhr.ontimeout = () =>
          fail(
            new ApiError({
              code: "TIMEOUT",
              message: UPLOAD_TIMEOUT_COPY,
              path,
              clientMessage: true,
            }),
          )
        xhr.onabort = () => fail(abortedUploadError(path))
        xhr.onerror = () =>
          fail(
            // JANGAN menulis "Tidak ada koneksi internet" di sini — perangkat
            // BISA online dengan socket yang terputus (audit A2). Pesan
            // final dipilih `uploadMessage` setelah mengecek NetInfo.
            new ApiError({
              code: "NETWORK",
              message: UPLOAD_UNSTABLE_COPY,
              path,
              clientMessage: true,
            }),
          )
        xhr.onload = () => {
          if (done) return
          done = true
          cleanupAbort()
          const status = xhr.status
          const bodyText = typeof xhr.responseText === "string" ? xhr.responseText : ""
          if (status >= 200 && status < 300) {
            try {
              resolveXhr(parseUploadJsonObject(bodyText, path))
            } catch (err) {
              rejectXhr(err)
            }
            return
          }
          if (status === 401) {
            // Selaras client.ts: satu kali refresh token lalu ulangi.
            rejectXhr({ retriable401: true as const })
            return
          }
          rejectXhr(uploadHttpError(status, bodyText, path))
        }
        xhr.open("POST", buildUrl(path))
        xhr.setRequestHeader("Accept", "application/json")
        xhr.setRequestHeader("Authorization", `Bearer ${token}`)
        if (idempotencyKey) xhr.setRequestHeader("Idempotency-Key", idempotencyKey)
        // JANGAN set Content-Type — XHR mengisi multipart boundary sendiri.
        // RN: FormData diterima XMLHttpRequest.send; tipe lib DOM tidak
        // mengenalnya sehingga cast ke parameter send yang sahih.
        try {
          xhr.send(formData as unknown as Parameters<XMLHttpRequest["send"]>[0])
        } catch (err) {
          // Kegagalan menyusun/membaca berkas (mis. URI tidak terbaca) —
          // bukan "tidak ada koneksi internet" (audit A2).
          fail(
            new ApiError({
              code: "NETWORK",
              message: UPLOAD_UNSTABLE_COPY,
              path,
              cause: err,
              clientMessage: true,
            }),
          )
        }
      })

    const run = async () => {
      try {
        let attempt = 0
        for (;;) {
          try {
            // Ulangi cek NetInfo tiap percobaan — status bisa berubah antar
            // attempt (device baru saja offline → hentikan, jangan bakar retry).
            if (isOfflineKnown()) throw offlineVerifiedUploadError(path)
            const token = await getAccessToken()
            if (!token)
              throw new ApiError({
                code: "UNAUTHORIZED",
                message: DEFAULT_ERROR_MESSAGES.UNAUTHORIZED,
                path,
              })
            try {
              const result = await sendOnce(token)
              resolve(result)
              return
            } catch (err) {
              const retriable =
                err && typeof err === "object" && (err as { retriable401?: unknown }).retriable401 === true
              if (!retriable || signal?.aborted) throw err
              const fresh = await refreshAccessToken()
              if (!fresh)
                throw new ApiError({
                  code: "UNAUTHORIZED",
                  message: DEFAULT_ERROR_MESSAGES.UNAUTHORIZED,
                  path,
                })
              resolve(await sendOnce(fresh))
              return
            }
          } catch (err) {
            // Retry CERDAS (NP-006, kini juga jalur foto): hanya TRANSIEN,
            // hormati abort, backoff eksponensial 1s → 2s, maks 2 ulang.
            const canRetry =
              attempt < UPLOAD_MAX_RETRIES &&
              !signal?.aborted &&
              isRetriableUploadError(err)
            if (!canRetry) throw err
            attempt += 1
            await sleepAbortable(retryBaseMs * 2 ** (attempt - 1), signal)
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
 * Multipart langsung ke `POST /v1/upload/direct` dengan field `file`.
 *
 * 2026-10-07: timeout adaptif (dulu default 20 detik membunuh upload di
 * koneksi HP lambat). Audit 2026-10-09 (B1–B3): kini lewat
 * `uploadFileWithProgress` — bila `timeoutMs` tidak dikirim, deadline
 * dihitung dari `fileBytes` (basis 60 dtk + 100 KB/s, cap 5 mnt).
 */
export function uploadDirect(
  formData: FormData,
  signal?: AbortSignal,
  timeoutMs?: number,
  fileBytes?: number,
): Promise<DirectUpload> {
  return uploadFileWithProgress(formData, { signal, timeoutMs, fileBytes }).then((raw) =>
    parseDirectUploadObject(raw, "/v1/upload/direct"),
  )
}

/**
 * Produksi menuntut `fileKeys` (1–20 item) — bukan `{}` seperti spec lama.
 * Dipasang (G-04) di jalur gagal upload yang file-nya BELUM live — mis.
 * submit KYC (`app/kyc.tsx`) dan lampiran sengketa: fileKey yang sudah
 * terupload tapi tidak jadi dipakai dibersihkan best-effort agar tidak
 * menjadi orphan di storage. JANGAN dipakai untuk avatar/header direct:
 * key itu sudah live sejak upload (UPI-08).
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

/**
 * Copy Indonesia per kode error upload backend — SAHA untuk semua purpose
 * (audit 2026-10-09 F2: dulu tabel ini hanya jalur video, jalur foto jatuh
 * ke default generik). FILE_TOO_LARGE netral-media: pesan "maks X MB" per
 * purpose diisi `uploadMessage` (upload-errors.ts) saat 413.
 */
export const UPLOAD_ERROR_COPY: Record<string, string> = {
  FILE_TOO_LARGE: "Ukuran berkas melebihi batas maksimal. Pilih berkas yang lebih kecil.",
  // BFI-098: kode ini dipakai BE untuk SHOWCASE_VIDEO yang melebihi 100 MiB
  // (sebelumnya tidak dipetakan → fallback generik).
  VIDEO_TOO_LARGE: "Ukuran video melebihi batas maksimal 100 MB. Maksimal 100 MB / 180 detik.",
  MIME_TYPE_MISMATCH: "Format berkas tidak didukung. Untuk video gunakan MP4, MOV, atau WebM.",
  VIDEO_TOO_LONG: "Durasi video melebihi batas yang diizinkan. Pilih video yang lebih pendek.",
  // UPV-04: resolusi video melebihi 3840p.
  VIDEO_RESOLUTION_TOO_HIGH: "Resolusi video terlalu tinggi. Pilih video dengan resolusi lebih rendah.",
  VIDEO_UNPROCESSABLE: "Video tidak dapat diproses. Coba dengan video lain.",
  UPLOAD_FAILED: "Unggahan gagal di server. Coba lagi.",
  // 2026-10-07: PhoneVerifiedGuard memblokir upload bila HP belum verifikasi.
  // Tanpa ini user hanya lihat error generik dan tidak tahu penyebabnya.
  PHONE_NOT_VERIFIED: "Verifikasi nomor HP dulu untuk mengunggah. Buka Pengaturan untuk verifikasi.",
  // docs/integrasi_backend.md:74 — 413 foto story.
  STORY_MEDIA_TOO_LARGE: "Ukuran foto story melebihi batas maksimal 10 MB. Pilih foto yang lebih kecil.",
}

/**
 * RV-001 (re-verifikasi upload/media, 2026-10-01): pemetaan ulang kode error
 * backend → copy Indonesia untuk jalur CHUNKED. `init`/`complete` lewat
 * `http.post` — error-nya dinormalisasi `toApiError` (400 → BAD_REQUEST,
 * backendCode tersimpan terpisah), sehingga `userMessage()` fail-closed ke
 * copy generik "Permintaan tidak valid." Padahal backend mengirim kode yang
 * sama persis dengan jalur direct (VIDEO_TOO_LARGE dst., UMD-002) — tanamkan
 * kembali copy actionable-nya agar UX konsisten antar jalur.
 */
function remapChunkedUploadError(err: unknown, path: string): never {
  if (err instanceof ApiError) {
    const copy = err.backendCode ? UPLOAD_ERROR_COPY[err.backendCode] : undefined
    if (copy) {
      throw new ApiError({
        code: err.code,
        status: err.status,
        backendCode: err.backendCode,
        // Copy dikarang klien (Indonesia) → uploadMessage() tampil apa adanya.
        message: copy,
        method: err.method,
        path,
      })
    }
  }
  // 413 tanpa copy dikenal: kode sudah PAYLOAD_TOO_LARGE (codeFromStatus) —
  // `uploadMessage` di UI mengisi batas "maks X MB" dari ctx purpose.
  throw err
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
  // Audit 2026-10-09: JOIN transport terpusat `uploadFileWithProgress`
  // (dulu XHR sendiri — ±150 baris duplikat dari jalur foto). Perilakunya
  // sama: progress byte jujur, cek NetInfo pra-upload, refresh 401 sekali,
  // retry transien + backoff (NP-006), timeout adaptif rumus VIDEO
  // (basis 120 dtk + 100 KB/s, cap 30 mnt — 100 MB @ 100 KB/s ≈ 17 mnt
  // transfer saja). Field video (durationSec/width/height) diteruskan
  // parser yang sama.
  const { purpose = "SHOWCASE_VIDEO", onProgress, signal, timeoutMs } = opts
  return (async () => {
    // PERF-FIX (bundle): image-picker dimuat lazy (lihat loadImagePicker).
    const { pickedImageToFormData } = await loadImagePicker()
    const formData = await pickedImageToFormData(asset, "file")
    formData.append("purpose", purpose)
    const raw = await uploadFileWithProgress(formData, {
      fileBytes: asset.size ?? 0,
      onProgress,
      signal,
      timeoutMs,
      timeoutKind: "video",
    })
    // fail-closed: fileKey wajib (parser memvalidasi + meneruskan field video).
    return parseDirectUploadObject(raw, "/v1/upload/direct") as DirectVideoUpload
  })()
}

// ------------------------------------------------------------------
// Upload video chunked/resumable (NP-006, 2026-09-29)
// ------------------------------------------------------------------

/**
 * Batas bawah ukuran file yang memakai jalur chunked — file ≤ ini tetap
 * memakai `uploadDirectVideo` single-shot (lebih sedikit round-trip).
 */
export const CHUNKED_UPLOAD_THRESHOLD_BYTES = 8 * 1024 * 1024
/**
 * Ukuran chunk yang diminta ke server. Server me-clamp ke [512KiB, 8MiB];
 * nilai ini hanya usulan — ukuran final selalu dari respons `init`.
 */
export const CHUNKED_UPLOAD_CHUNK_BYTES = 4 * 1024 * 1024

interface ChunkedInitResponse {
  sessionId?: unknown
  chunkSize?: unknown
  totalChunks?: unknown
  totalSize?: unknown
  expiresAt?: unknown
}

interface ChunkedStatusResponse {
  sessionId?: unknown
  chunkSize?: unknown
  totalChunks?: unknown
  totalSize?: unknown
  received?: unknown
  receivedBytes?: unknown
  expiresAt?: unknown
}

interface ParsedChunkSession {
  sessionId: string
  chunkSize: number
  totalChunks: number
  totalSize: number
}

function parseChunkSession(raw: unknown, what: string): ParsedChunkSession {
  const o = (raw ?? {}) as Record<string, unknown>
  const sessionId = typeof o.sessionId === "string" ? o.sessionId : ""
  const chunkSize = typeof o.chunkSize === "number" ? o.chunkSize : 0
  const totalChunks = typeof o.totalChunks === "number" ? o.totalChunks : 0
  const totalSize = typeof o.totalSize === "number" ? o.totalSize : 0
  if (!/^[0-9a-f]{64}$/.test(sessionId) || chunkSize <= 0 || totalChunks <= 0 || totalSize <= 0) {
    throw new ApiError({ code: "PARSE", message: `Respons ${what} tidak valid.` })
  }
  return { sessionId, chunkSize, totalChunks, totalSize }
}

/**
 * UPV-06 (audit upload video 2026-10-03): persistensi sesi chunked lintas
 * restart app. Server menyimpan sesi 24 jam dan `GET .../status` mendukung
 * resume — tapi `sessionId` sebelumnya hanya di variabel lokal, sehingga
 * app di-kill = upload ulang dari byte 0.
 *
 * Identitas file = hash(purpose|fileName|mimeType|totalSize). Bila file
 * berubah (nama/ukuran beda), kunci beda → sesi lama tidak dipakai. Lapisan
 * kedua: `status` memvalidasi totalChunks/totalSize konsisten (sudah ada).
 * Sesi tersimpan > 23 jam dianggap basi (server kedaluwarsa 24 jam).
 * Bukan data sensitif → `getRawItem/setRawItem` (pola chat-failed-queue).
 */
type StoredChunkedSession = ParsedChunkSession & {
  purpose: string
  fileName: string
  mimeType: string
  savedAt: number
}

const CHUNKED_SESSION_TTL_MS = 23 * 60 * 60 * 1000

function chunkedSessionStoreKey(purpose: string, fileName: string, mimeType: string, totalSize: number): string {
  const raw = `${purpose}|${fileName}|${mimeType}|${totalSize}`
  let h = 0
  for (let i = 0; i < raw.length; i++) h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0
  return `kahade:chunked-upload-session:${(h >>> 0).toString(16)}`
}

async function loadStoredChunkedSession(
  key: string,
  purpose: string,
  fileName: string,
  mimeType: string,
  totalSize: number,
): Promise<ParsedChunkSession | null> {
  try {
    const { getRawItem } = await import("@/lib/secure-storage")
    const raw = await getRawItem(key)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<StoredChunkedSession>
    if (
      typeof s.sessionId !== "string" ||
      !/^[0-9a-f]{64}$/.test(s.sessionId) ||
      typeof s.chunkSize !== "number" || s.chunkSize <= 0 ||
      typeof s.totalChunks !== "number" || s.totalChunks <= 0 ||
      typeof s.totalSize !== "number" || s.totalSize <= 0 ||
      s.purpose !== purpose ||
      s.fileName !== fileName ||
      s.mimeType !== mimeType ||
      s.totalSize !== totalSize ||
      typeof s.savedAt !== "number" ||
      Date.now() - s.savedAt > CHUNKED_SESSION_TTL_MS
    ) {
      return null
    }
    return { sessionId: s.sessionId, chunkSize: s.chunkSize, totalChunks: s.totalChunks, totalSize: s.totalSize }
  } catch {
    return null
  }
}

async function saveStoredChunkedSession(
  key: string,
  session: ParsedChunkSession,
  purpose: string,
  fileName: string,
  mimeType: string,
): Promise<void> {
  try {
    const { setRawItem } = await import("@/lib/secure-storage")
    const stored: StoredChunkedSession = { ...session, purpose, fileName, mimeType, savedAt: Date.now() }
    await setRawItem(key, JSON.stringify(stored))
  } catch {
    // best-effort: gagal persist → resume lintas restart tak tersedia,
    // upload dalam sesi ini tetap jalan normal.
  }
}

async function clearStoredChunkedSession(key: string): Promise<void> {
  try {
    const { deleteRawItem } = await import("@/lib/secure-storage")
    await deleteRawItem(key)
  } catch {
    // best-effort
  }
}

function parseReceivedChunks(raw: unknown): Set<number> {
  const o = (raw ?? {}) as Record<string, unknown>
  const list = Array.isArray(o.received) ? o.received : []
  const out = new Set<number>()
  for (const v of list) {
    if (typeof v === "number" && Number.isInteger(v) && v >= 0) out.add(v)
  }
  return out
}

/**
 * Panjang byte chunk ke-`index` menurut kesepakatan sesi
 * (chunk terakhir boleh parsial).
 */
function agreedChunkLength(index: number, chunkSize: number, totalChunks: number, totalSize: number): number {
  if (index === totalChunks - 1) return totalSize - chunkSize * (totalChunks - 1)
  return chunkSize
}

/**
 * XHR multipart generik dengan auth + refresh token sekali saat 401 —
 * dipakai endpoint chunked (bukan lewat `http` karena perlu progress).
 */
function xhrPostMultipart(
  path: string,
  formData: FormData,
  opts: {
    onProgress?: (loadedBytes: number) => void
    signal?: AbortSignal
    timeoutMs?: number
  } = {},
): Promise<string> {
  const { onProgress, signal, timeoutMs = 600_000 } = opts
  const url = buildUrl(path)
  let currentXhr: XMLHttpRequest | null = null
  if (signal?.aborted) {
    return Promise.reject(new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan." }))
  }
  const attempt = (token: string, retried401: boolean): Promise<string> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      currentXhr = xhr
      let settled = false
      const fail = (err: ApiError) => {
        if (settled) return
        settled = true
        reject(err)
      }
      xhr.open("POST", url)
      xhr.setRequestHeader("Authorization", `Bearer ${token}`)
      xhr.timeout = timeoutMs
      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded)
        }
      }
      xhr.onload = async () => {
        const status = xhr.status
        if (status === 401 && !retried401) {
          try {
            const fresh = await refreshAccessToken()
            if (fresh) {
              attempt(fresh, true).then(resolve, reject)
              return
            }
          } catch {
            // jatuh ke error 401 di bawah
          }
        }
        if (status >= 200 && status < 300) {
          settled = true
          resolve(xhr.responseText ?? "")
          return
        }
        let code: ApiErrorCode = codeFromStatus(status, false)
        let message: string | undefined
        try {
          const parsed = JSON.parse(xhr.responseText || "{}") as { code?: unknown; message?: unknown; errors?: unknown }
          // BFI-061: envelope BE → kode ada di `errors.code`
          // (http-exception.filter.ts), bukan di root.
          const errors = (parsed.errors ?? {}) as { code?: unknown; message?: unknown }
          const rawCode = errors.code ?? parsed.code
          if (typeof rawCode === "string") code = rawCode as ApiErrorCode
          const rawMessage = errors.message ?? parsed.message
          if (typeof rawMessage === "string") message = rawMessage
        } catch {
          // biarkan default
        }
        fail(
          new ApiError({
            code,
            message: message ?? DEFAULT_ERROR_MESSAGES[code] ?? `Upload gagal (${status}).`,
            status,
          }),
        )
      }
      xhr.onerror = () => fail(new ApiError({ code: "NETWORK", message: DEFAULT_ERROR_MESSAGES.NETWORK }))
      xhr.ontimeout = () =>
        fail(new ApiError({ code: "TIMEOUT", message: "Waktu upload chunk habis. Coba lagi." }))
      xhr.onabort = () => fail(new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan." }))
      const onAbort = () => {
        try {
          xhr.abort()
        } catch {
          // abaikan
        }
      }
      signal?.addEventListener("abort", onAbort, { once: true })
      try {
        xhr.send(formData)
      } catch (err) {
        fail(new ApiError({ code: "NETWORK", message: DEFAULT_ERROR_MESSAGES.NETWORK, cause: err }))
      }
    })
  const outer = (async (): Promise<string> => {
    const token = await getAccessToken()
    if (!token) {
      throw new ApiError({ code: "UNAUTHORIZED", message: DEFAULT_ERROR_MESSAGES.UNAUTHORIZED })
    }
    return attempt(token, false)
  })()
  if (signal) {
    signal.addEventListener(
      "abort",
      () => {
        try {
          currentXhr?.abort()
        } catch {
          // abaikan
        }
      },
      { once: true },
    )
  }
  return outer
}

/**
 * Tulis satu chunk ke file temporer cache (native saja). Byte dibaca sebagai
 * range base64 TANPA memuat seluruh file ke memori — inilah yang membuat
 * upload 100MB aman di HP. Mengembalikan URI file temporer (wajib dihapus
 * pemanggil).
 */
async function writeNativeChunkTempFile(
  sourceUri: string,
  sessionId: string,
  index: number,
  position: number,
  length: number,
): Promise<string> {
  const fsLegacy = await import("expo-file-system/legacy")
  const cacheDir = fsLegacy.cacheDirectory
  if (!cacheDir) {
    throw new ApiError({ code: "CHUNK_SOURCE_UNSUPPORTED", message: "Cache penyimpanan tidak tersedia." })
  }
  let base64: string
  try {
    base64 = await fsLegacy.readAsStringAsync(sourceUri, { encoding: "base64", position, length })
  } catch (err) {
    throw new ApiError({
      code: "CHUNK_SOURCE_UNSUPPORTED",
      message: "Perangkat tidak mendukung pembacaan parsial file.",
      cause: err,
    })
  }
  // Guard jujur: pastikan yang terbaca benar-benar sepanjang yang diminta
  // (beberapa URI content:// mengabaikan position/length).
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  const decodedLen = Math.floor((base64.length * 3) / 4) - padding
  if (decodedLen !== length) {
    throw new ApiError({
      code: "CHUNK_SOURCE_UNSUPPORTED",
      message: "Perangkat tidak mendukung pembacaan parsial file.",
    })
  }
  const tempUri = `${cacheDir}kahade-chunk-${sessionId}-${index}.bin`
  await fsLegacy.writeAsStringAsync(tempUri, base64, { encoding: "base64" })
  return tempUri
}

/**
 * NP-006: upload video besar (di atas `CHUNKED_UPLOAD_THRESHOLD_BYTES`)
 * secara chunked + resumable.
 *
 * Protokol: init → (status untuk resume) → kirim chunk yang hilang →
 * complete. Gagal di tengah jalan (koneksi putus, app di-kill) → pemanggilan
 * berikutnya otomatis melanjutkan dari chunk terakhir yang diterima server,
 * BUKAN dari byte 0. Progress `onProgress` dihitung dari total file
 * (tidak reset per attempt).
 *
 * Bila perangkat tidak mendukung pembacaan parsial file, otomatis fallback
 * ke `uploadDirectVideo` single-shot (upload tetap jalan, hanya tanpa
 * resume).
 */
export async function uploadChunkedVideo(
  asset: PickedImage,
  opts: {
    purpose?: string
    /** Fraksi 0–1 kemajuan upload (dihitung dari total file). */
    onProgress?: (fraction: number) => void
    signal?: AbortSignal
    timeoutMs?: number
    /** Usulan ukuran chunk (byte); default 4MiB. */
    chunkSize?: number
  } = {},
): Promise<DirectVideoUpload> {
  const { onProgress, signal, chunkSize = CHUNKED_UPLOAD_CHUNK_BYTES, ...directOpts } = opts
  const totalBytes = typeof asset.size === "number" ? asset.size : 0
  if (!totalBytes || totalBytes <= CHUNKED_UPLOAD_THRESHOLD_BYTES) {
    // File kecil / ukuran tak diketahui → jalur direct biasa (lebih hemat round-trip).
    return uploadDirectVideo(asset, opts)
  }
  if (signal?.aborted) {
    throw new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan." })
  }
  // Audit 2026-10-09 (A3): cek NetInfo SEBELUM upload — video 100 MB offline
  // dulu terbakar di onerror XHR dan dilaporkan "Tidak ada koneksi internet"
  // SETELAH percobaan; kini gagal cepat dengan pesan offline yang terverifikasi.
  if (isOfflineKnown()) {
    throw offlineVerifiedUploadError("/v1/upload/chunked/init")
  }
  const isWeb = Platform.OS === "web"

  // 1. init sesi (validasi purpose/batas/MIME gagal-cepat di server)
  const purpose = directOpts.purpose ?? "SHOWCASE_VIDEO"
  const initDto = {
    purpose,
    fileName: asset.name,
    mimeType: asset.mimeType,
    totalSize: totalBytes,
    chunkSize,
  }
  const doInit = async (what: string): Promise<ParsedChunkSession> => {
    try {
      const initRaw = await http.post<ChunkedInitResponse, Record<string, unknown>>(
        "/v1/upload/chunked/init",
        initDto,
        { auth: "required", retry: 1, signal },
      )
      return parseChunkSession(initRaw, what)
    } catch (err) {
      // RV-001: petakan VIDEO_TOO_LARGE/FILE_TOO_LARGE/MIME_TYPE_MISMATCH dari
      // init ke copy Indonesia (jangan "Permintaan tidak valid.").
      remapChunkedUploadError(err, "/v1/upload/chunked/init")
    }
  }
  // UPV-06: coba pulihkan sesi tersimpan — resume lintas restart app.
  // Server menyimpan sesi 24 jam; `status` di bawah memvalidasi konsistensi.
  const storeKey = chunkedSessionStoreKey(purpose, asset.name, asset.mimeType, totalBytes)
  let session = await loadStoredChunkedSession(storeKey, purpose, asset.name, asset.mimeType, totalBytes)
  let basePath: string
  if (session) {
    basePath = `/v1/upload/chunked/${seg(session.sessionId)}`
  } else {
    session = await doInit("init upload")
    basePath = `/v1/upload/chunked/${seg(session.sessionId)}`
    await saveStoredChunkedSession(storeKey, session, purpose, asset.name, asset.mimeType)
  }

  // 2. status → chunk mana yang sudah diterima (resume)
  const received = new Set<number>()
  try {
    const statusRaw = await http.get<ChunkedStatusResponse>(`${basePath}/status`, {
      auth: "required",
      retry: 1,
      signal,
    })
    const sessionCheck = parseChunkSession(statusRaw, "status upload")
    if (sessionCheck.totalChunks !== session.totalChunks || sessionCheck.totalSize !== session.totalSize) {
      throw new ApiError({ code: "PARSE", message: "Sesi upload tidak konsisten." })
    }
    for (const i of parseReceivedChunks(statusRaw)) {
      if (i < session.totalChunks) received.add(i)
    }
  } catch (err) {
    if (err instanceof ApiError && (err.code === "PARSE" || err.code === "CHUNK_SOURCE_UNSUPPORTED")) throw err
    if (err instanceof ApiError && (err.status === 404 || err.status === 410)) {
      // BFI-109: sesi HILANG (404 CHUNK_SESSION_NOT_FOUND) / KEDALUWARSA (410
      // CHUNK_SESSION_EXPIRED) — kirim chunk ke sesi mati hanya membuang N
      // request 404. Init ulang SEKALI lalu anggap sesi baru/kosong.
      session = await doInit("init ulang upload")
      basePath = `/v1/upload/chunked/${seg(session.sessionId)}`
      // UPV-06: simpan sesi pengganti agar resume lintas restart tetap jalan.
      await saveStoredChunkedSession(storeKey, session, purpose, asset.name, asset.mimeType)
      received.clear()
    }
    // 5xx / lainnya pada status → anggap sesi baru/kosong (idempoten: chunk
    // yang sebenarnya sudah ada akan dijawab 200 oleh server).
  }
  const { chunkSize: serverChunkSize, totalChunks, totalSize } = session

  const report = (doneBytes: number) =>
    onProgress?.(Math.min(1, Math.max(0, doneBytes / totalSize)))
  let doneBytes = 0
  for (const i of received) doneBytes += agreedChunkLength(i, serverChunkSize, totalChunks, totalSize)
  report(doneBytes)

  // Sumber byte: web → Blob.slice (tanpa baca ulang); native → range base64
  // ke file temporer (tanpa memuat 100MB ke memori).
  let webBlob: Blob | null = null
  if (isWeb) {
    try {
      // PERF-FIX (bundle): image-picker dimuat lazy (lihat loadImagePicker).
      const { pickedImageToBlob } = await loadImagePicker()
      webBlob = await pickedImageToBlob(asset)
    } catch (err) {
      throw new ApiError({
        code: "CHUNK_SOURCE_UNSUPPORTED",
        message: "Gagal membaca file video.",
        cause: err,
      })
    }
  }
  const tempFiles = new Set<string>()
  const cleanupTempFiles = async () => {
    if (isWeb || tempFiles.size === 0) return
    try {
      const fsLegacy = await import("expo-file-system/legacy")
      await Promise.all(
        [...tempFiles].map((uri) => fsLegacy.deleteAsync(uri, { idempotent: true }).catch(() => undefined)),
      )
    } catch {
      // best-effort; cache OS akan membersihkan sendiri
    }
    tempFiles.clear()
  }

  try {
    // 3. kirim chunk yang hilang, masing-masing dengan retry cerdas
    for (let i = 0; i < totalChunks; i++) {
      if (signal?.aborted) throw new ApiError({ code: "ABORTED", message: "Unggahan dibatalkan." })
      if (received.has(i)) continue
      const start = i * serverChunkSize
      const length = agreedChunkLength(i, serverChunkSize, totalChunks, totalSize)

      const buildFormData = async (): Promise<FormData> => {
        const formData = new FormData()
        if (isWeb) {
          formData.append("chunk", (webBlob as Blob).slice(start, start + length), `chunk-${i}.bin`)
        } else {
          const tempUri = await writeNativeChunkTempFile(asset.uri, session.sessionId, i, start, length)
          tempFiles.add(tempUri)
          formData.append("chunk", {
            uri: tempUri,
            name: `chunk-${i}.bin`,
            type: "application/octet-stream",
          } as unknown as Blob)
        }
        formData.append("chunkIndex", String(i))
        return formData
      }

      let attempt = 0
      for (;;) {
        try {
          const formData = await buildFormData()
          await xhrPostMultipart(`${basePath}/chunk`, formData, {
            signal,
            timeoutMs: 600_000,
            onProgress: (loaded) => report(doneBytes + Math.min(loaded, length)),
          })
          break
        } catch (err) {
          const retriable = !signal?.aborted && attempt < UPLOAD_MAX_RETRIES && isRetriableUploadError(err)
          if (!retriable) throw err
          attempt += 1
          await sleepAbortable(1000 * 2 ** (attempt - 1), signal)
        }
      }
      doneBytes += length
      received.add(i)
      report(doneBytes)
    }

    // 4. complete → server merakit + menjalankan pipeline uploadDirect yang
    // SAMA (validasi magic-byte, thumbnail ffmpeg). Timeout adaptif mengikuti
    // pola uploadDirectVideo (pemrosesan video butuh waktu).
    const completeTimeoutMs = Math.min(1_800_000, Math.max(600_000, 120_000 + totalSize / 100))
    let completeRaw: unknown
    try {
      completeRaw = await http.post<unknown, undefined>(`${basePath}/complete`, undefined, {
        auth: "required",
        retry: 0,
        signal,
        timeoutMs: completeTimeoutMs,
      })
    } catch (err) {
      // RV-001: complete menjalankan pipeline validasi yang sama dengan direct
      // (magic-byte, durasi, thumbnail) — petakan ulang kode backendnya juga.
      remapChunkedUploadError(err, `${basePath}/complete`)
    }
    const result = parseDirectUploadObject(
      (completeRaw ?? {}) as Record<string, unknown>,
      `${basePath}/complete`,
    )
    if (!result.fileKey) {
      throw new ApiError({ code: "PARSE", message: "Respons server tidak lengkap." })
    }
    // UPV-06: upload selesai — sesi tersimpan tidak lagi dibutuhkan.
    await clearStoredChunkedSession(storeKey)
    report(1)
    return result
  } catch (err) {
    // Fallback jujur: perangkat tak mendukung baca parsial → single-shot.
    if (err instanceof ApiError && err.code === "CHUNK_SOURCE_UNSUPPORTED") {
      return uploadDirectVideo(asset, opts)
    }
    throw err
  } finally {
    await cleanupTempFiles()
  }
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
  opts: { onProgress?: (fraction: number) => void } = {},
): Promise<{ fileKey: string }> {
  // PERF-FIX (bundle): image-picker dimuat lazy (lihat loadImagePicker).
  // PERF-FIX (2026-09-30): resize TERPUSAT untuk semua purpose (KYC, sengketa,
  // bukti kirim, dsb) — foto kamera 4000px+ dikecilkan ke 1920px sebelum
  // upload. Hanya gambar; fail-open (aset asli bila gagal), idempoten.
  // Video tidak lewat sini (uploadDirectVideo terpisah).
  const { pickedImageToFormData, resizePickedImage } = await loadImagePicker()
  const resized = (img.mimeType ?? "").startsWith("image/") ? await resizePickedImage(img) : img
  const formData = await pickedImageToFormData(resized, "file")
  formData.append("purpose", purpose)
  // Audit 2026-10-09 (B4/B6): transport terpusat — timeout adaptif terhitung
  // dari fileBytes (basis 60 dtk + 100 KB/s, cap 5 mnt; dulu rumus ini
  // tercakup inline di sini, kini terpusat di upload-errors.ts), cek NetInfo
  // pra-upload, progress byte jujur, retry transien + backoff.
  const fileBytes = resized.size ?? img.size ?? 0
  const result = parseDirectUploadObject(
    await uploadFileWithProgress(formData, { signal, fileBytes, onProgress: opts.onProgress }),
    "/v1/upload/direct",
  )
  return { fileKey: result.fileKey }
}

/**
 * BFE-115 (2026-10-03): `uploadPresigned` DIHAPUS — dead code (nol pemanggil);
 * backend mematikan presigned URL (DEPRECATED 400). Pakai `uploadDirectImage`
 * / `uploadDirect` untuk semua purpose.
 */

/** URL aman untuk fileKey (mis. `${base}/files/...`) — dipakai fallback path. */
export function fileKeyToUrl(fileKey: string) {
  return seg(fileKey)
}
