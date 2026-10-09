/**
 * Kahade — kontrak pesan kegagalan UPLOAD (audit 2026-10-09).
 *
 * Akar masalah yang diperbaiki: `userMessage()` (lib/api/errors.ts) sengaja
 * membuang pesan karangan klien untuk kode NETWORK/TIMEOUT/SERVER/PARSE dan
 * mengganti dengan default global — padahal untuk upload keempatnya punya
 * penyebab yang beda dan perlu copy yang beda:
 *
 *   - perangkat TERVERIFIKASI offline (NetInfo, lib/connectivity.ts)
 *     → "Tidak ada koneksi internet…" — PASTI, karena sudah dicek;
 *   - transport gagal padahal perangkat online (socket reset di 4G tak
 *     stabil, TLS drop, multipart gagal dibaca) → BUKAN "tidak ada
 *     koneksi" — koneksi terputus/tidak stabil;
 *   - TIMEOUT upload → yang lambat koneksi PENGIRIM, bukan server;
 *   - 413 → sebutkan batas aktual ("maks X MB") agar user tahu apa yang
 *     harus diubah, bukan "terlalu besar" tanpa acuan;
 *   - 5xx → "Server bermasalah" (sesuai klasifikasi server, bukan klien).
 *
 * Lapisan MURNI (logika + constant; dependensi hanya lib/api/errors &
 * snapshot lib/connectivity) agar bisa di-unit-test tanpa React Native.
 */
import { isApiError, isOfflineError, userMessage } from "@/lib/api/errors"
import { isOfflineKnown } from "@/lib/connectivity"

// ---------------------------------------------------------------------------
// Copy kegagalan upload (Bahasa Indonesia = kunci i18n; katalog digenerate
 // dari string di lib/ — lihat scripts/gen-i18n-catalog.mjs).
// ---------------------------------------------------------------------------

/**
 * Copy kegagalan upload — DISIMPAN sebagai object literal (bukan const bebas)
 * karena generator katalog i18n (scripts/gen-i18n-catalog.mjs) hanya memindai
 * NILAI OBJECT di `lib/`: `export const X = "…"` bebas tidak pernah terkatalog,
 * dan kunci yang tidak ada di katalog tidak boleh punya terjemahan EN
 * (check:i18n gagal: "kunci tidak ada di katalog"). Ekspor bernama di bawah
 * adalah alias agar API lama (lib/api/upload.ts, test) tetap tak berubah.
 */
const UPLOAD_COPY = {
  /** Perangkat terverifikasi offline (NetInfo) — satu-satunya momen boleh bilang "tidak ada koneksi". */
  offline: "Tidak ada koneksi internet. Periksa jaringan lalu coba lagi.",
  /** Transport gagal TANPA verifikasi offline — jaringan ada tapi tidak stabil. */
  unstable: "Koneksi terputus saat mengirim berkas. Periksa jaringan lalu coba lagi.",
  /** Timeout upload — koneksi pengirim lambat, bukan server. */
  timeout: "Koneksi lambat, coba lagi.",
  /** 5xx — server yang bermasalah. */
  server: "Server bermasalah. Coba lagi nanti.",
  /** 413 tanpa batas yang diketahui pemanggil. */
  tooLargeGeneric: "File terlalu besar. Pilih file yang lebih kecil.",
  /** Bentuk 413 dengan batas — nilai {x} diisi `uploadTooLargeMessage`. */
  tooLargeLimitShape: "File terlalu besar (maks {x} MB). Pilih file yang lebih kecil.",
}

export const UPLOAD_OFFLINE_COPY = UPLOAD_COPY.offline
export const UPLOAD_UNSTABLE_COPY = UPLOAD_COPY.unstable
export const UPLOAD_TIMEOUT_COPY = UPLOAD_COPY.timeout
export const UPLOAD_SERVER_COPY = UPLOAD_COPY.server
export const UPLOAD_TOO_LARGE_GENERIC_COPY = UPLOAD_COPY.tooLargeGeneric
export const UPLOAD_TOO_LARGE_LIMIT_SHAPE = UPLOAD_COPY.tooLargeLimitShape

/**
 * Batas ukuran (byte) per purpose upload — salinan dari validasi backend yang
 * sudah dicatat di modul guard masing-masing (lihat komentar tiap entri).
 * Dipakai pesan 413 "File terlalu besar (maks X MB)" agar menyebut batas
 * yang benar-benar berlaku untuk purpose itu. `undefined` = batas tidak
 * terdokumentasi di klien → pesan generik (jangan menebak angka).
 */
const MB = 1024 * 1024
const UPLOAD_SIZE_LIMITS: Record<string, number> = {
  // lib/photo-upload-guards.ts (users.service.ts): 2 MB jpeg/png/webp.
  AVATAR: 2 * MB,
  // lib/photo-upload-guards.ts (users.service.ts): 5 MB jpeg/png/webp.
  HEADER: 5 * MB,
  // lib/showcase-limits.ts (UploadPurpose.SHOWCASE_IMAGE): 5 MB.
  SHOWCASE_IMAGE: 5 * MB,
  // lib/showcase-limits.ts (app.constants.ts VIDEO_TOO_LARGE): 100 MiB.
  SHOWCASE_VIDEO: 100 * MB,
  // lib/chat-attachment-limits.ts (send-message.dto.ts @Max 50 MiB).
  CHAT_ATTACHMENT: 50 * MB,
  // app/kyc.tsx KYC_DOC_MAX_MB (guard klien, selaras server): 5 MB.
  KYC_KTP: 5 * MB,
  KYC_SELFIE: 5 * MB,
  KYC_PASSPORT: 5 * MB,
  KYC_LIVENESS: 5 * MB,
  // docs/integrasi_backend.md §4: foto story maks 10 MB (413 STORY_MEDIA_TOO_LARGE).
  STORY: 10 * MB,
}

export type UploadMessageContext = {
  /** Purpose endpoint (mis. "SHOWCASE_IMAGE") — untuk batas 413. */
  purpose?: string
  /**
   * Batas ukuran byte yang diketahui pemanggil — menang atas `purpose`
   * (mis. avatar pasca-resize memakai guard 2 MB walau purpose AVATAR).
   */
  maxBytes?: number
}

/** Batas (byte) untuk pesan 413: eksplisit pemanggil → purpose → tak tahu. */
export function uploadSizeLimitBytes(ctx: UploadMessageContext): number | undefined {
  if (typeof ctx.maxBytes === "number" && ctx.maxBytes > 0) return ctx.maxBytes
  if (ctx.purpose) return UPLOAD_SIZE_LIMITS[ctx.purpose]
  return undefined
}

/** "5" / "50" / "2,5" — format MB untuk pesan (tanpa dependensi Intl). */
function formatMb(bytes: number): string {
  const mb = bytes / MB
  const rounded = Number.isInteger(mb) ? mb : Math.round(mb * 10) / 10
  return String(rounded).replace(".", ",")
}

/**
 * Pesan 413: "File terlalu besar (maks 5 MB). Pilih file yang lebih kecil."
 * bila batas diketahui, selain itu copy generik (jangan mengarang angka).
 */
export function uploadTooLargeMessage(ctx: UploadMessageContext): string {
  const limit = uploadSizeLimitBytes(ctx)
  if (limit == null) return UPLOAD_TOO_LARGE_GENERIC_COPY
  return UPLOAD_TOO_LARGE_LIMIT_SHAPE.replace("{x}", formatMb(limit))
}

/**
 * Kode backend yang copynya SUDAH dikarang upload layer (clientMessage: true,
 * Indonesia, spesifik — VIDEO_TOO_LARGE, FILE_TOO_LARGE, MIME_TYPE_MISMATCH,
 * PHONE_NOT_VERIFIED, dsb.). Untuk kode ini `uploadMessage` meneruskan pesan
 * apa adanya — ia lebih spesifik dari klasifikasi status-nya.
 */
const CLIENT_CRAFTED_CODES = new Set([
  "FILE_TOO_LARGE",
  "VIDEO_TOO_LARGE",
  "MIME_TYPE_MISMATCH",
  "VIDEO_TOO_LONG",
  "VIDEO_RESOLUTION_TOO_HIGH",
  "VIDEO_UNPROCESSABLE",
  "PHONE_NOT_VERIFIED",
  "UPLOAD_FAILED",
  "STORY_MEDIA_TOO_LARGE",
  "IDEMPOTENCY_KEY_REQUIRED",
])

/**
 * Pesan siap tampil untuk kegagalan UPLOAD — beda dengan `userMessage`
 * (generic) di empat titik: (1) offline hanya diklaim bila TERVERIFIKASI
 * lewat NetInfo, (2) transport gagal saat online = "koneksi terputus",
 * (3) timeout = "koneksi lambat", (4) 413 menyebut batas.
 *
 * Urutan pemeriksaan penting:
 *   OfflineError/OFFLINE_VERIFIED → offline (request tak pernah dikirim);
 *   copy klien spesifik (backendCode dikenal) → teruskan apa adanya;
 *   413 → batas; 5xx → server; TIMEOUT → lambat; NETWORK → terverifikasi?;
 *   sisanya → fallback `userMessage` (403/400/429/…).
 */
export function uploadMessage(err: unknown, ctx: UploadMessageContext = {}): string {
  if (isOfflineError(err)) return UPLOAD_OFFLINE_COPY
  if (!isApiError(err)) {
    // Transport sudah harus menormalkan — bila tidak, jangan klaim offline
    // tanpa verifikasi NetInfo (akar bug A1/A2 audit 2026-10-09).
    return isOfflineKnown() ? UPLOAD_OFFLINE_COPY : UPLOAD_UNSTABLE_COPY
  }
  const e = err
  // (1) Pra-upload: perangkat PASTI offline — request tak pernah dikirim.
  if (e.backendCode === "OFFLINE_VERIFIED") return UPLOAD_OFFLINE_COPY
  // (2) Copy klien spesifik dari kode backend (lebih tajam dari status).
  if (e.clientMessage && e.message && (!e.backendCode || CLIENT_CRAFTED_CODES.has(e.backendCode))) {
    if (e.code !== "NETWORK" && e.code !== "TIMEOUT" && e.code !== "SERVER" && e.code !== "PARSE") {
      return e.message
    }
  }
  // (3) 413 — sebutkan batas.
  if (e.code === "PAYLOAD_TOO_LARGE" || e.status === 413) return uploadTooLargeMessage(ctx)
  // (4) 5xx — server.
  if (e.code === "SERVER" || (e.status != null && e.status >= 500)) return UPLOAD_SERVER_COPY
  // (5) Timeout upload — koneksi pengirim lambat.
  if (e.code === "TIMEOUT") return UPLOAD_TIMEOUT_COPY
  // (6) Transport gagal: offline terverifikasi vs tidak stabil.
  if (e.code === "NETWORK") return isOfflineKnown() ? UPLOAD_OFFLINE_COPY : UPLOAD_UNSTABLE_COPY
  // (7) Sisanya — fallback generic (FORBIDDEN, VALIDATION, RATE_LIMITED, …).
  return userMessage(e)
}

// ---------------------------------------------------------------------------
// Timeout adaptif terpusat (audit B6: dulu tiga rumus berbeda di tiga file).
// ---------------------------------------------------------------------------

/**
 * Timeout upload proporsional dengan ukuran file (audit 2026-10-09 B4/B6):
 *   - foto : 60 dtk basis + waktu transfer pada 100 KB/s (konservatif untuk
 *            4G Indonesia), cap 5 menit;
 *   - video: 120 dtk basis (server: ffprobe+ffmpeg) + transfer 100 KB/s,
 *            cap 30 menit (100 MB @ 100 KB/s ≈ 17 menit transfer saja).
 * `fileBytes` tak diketahui (0) → basis tanpa jatah transfer: 60/120 dtk —
 * sama dengan perilaku lama (fail-open ke validasi server).
 */
export function uploadTimeoutMs(fileBytes: number | undefined, kind: "photo" | "video" = "photo"): number {
  const base = kind === "video" ? 120_000 : 60_000
  const cap = kind === "video" ? 1_800_000 : 300_000
  const transfer =
    typeof fileBytes === "number" && Number.isFinite(fileBytes) && fileBytes > 0 ? fileBytes / 100 : 0
  return Math.min(cap, Math.max(base, base + transfer))
}
