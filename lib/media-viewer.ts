/**
 * Kahade — kontrak HALAMAN MEDIA TERPUSAT (`/media-viewer`).
 *
 * Satu-satunya jalan untuk melihat media full-screen di aplikasi: SEMUA
 * permukaan (bubble chat, bukti sengketa, bukti pengiriman, KYC) WAJIB lewat
 * `mediaViewerHref()` + `router.push(...)` — tidak ada lagi yang melempar ke
 * browser luar untuk FOTO/VIDEO/FILE/AUDIO/LOKASI.
 *
 * Lapisan MURNI (tanpa runtime native) supaya bisa di-unit-test:
 *   - `MediaViewerType` + `classifyMedia()` — pemetaan MIME → tipe viewer.
 *   - `mediaViewerHref()` — membangun Href expo-router dengan aman.
 *   - `parseMediaViewerParams()` — validasi param rute di layar.
 *   - `formatMediaClock()` — jam M:SS / H:MM:SS untuk pemutar.
 *   - Konstanta pemutar: `PLAYBACK_RATES`, `QUALITY_OPTIONS`, `SEEK_STEP_SECONDS`.
 *
 * Keputusan non-obvious:
 *   - Signed URL (query `?X-Amz-Signature=…`) TIDAK PERNAH di-strip: classifier
 *     hanya membaca `mimeType`/ekstensi nama berkas, dan URL diteruskan verbatim
 *     ke pemutar/unduhan. HTTP Range (seek 206) ditangani native player
 *     (ExoPlayer/AVPlayer) — klien tidak mengunduh manual saat seek.
 *   - Album foto & varian kualitas dikirim sebagai JSON di param `items` /
 *     `variants` (expo-router meng-encode otomatis); `parseMediaViewerParams`
 *     memvalidasi tiap entri dan membuang yang rusak (fail-closed).
 *   - Lokasi (`type=location`) ikut di rute ini (bukan rute peta terpisah)
 *     supaya pola navigasi benar-benar satu: full-screen = /media-viewer.
 */
import type { Href } from "expo-router"

import { safeHttpsLink } from "@/lib/external-url"

/** Tipe konten yang bisa dibuka halaman media viewer. */
export type MediaViewerType = "photo" | "video" | "file" | "audio" | "location"

/** Satu foto dalam album (`items`) — swipe kiri/kanan di photo viewer. */
export type MediaViewerAlbumItem = {
  url: string
  title?: string
  mimeType?: string
  fileName?: string
  fileSize?: number | null
}

/** Satu varian kualitas video (bila backend menyediakannya). */
export type MediaViewerVariant = {
  label: string
  url: string
}

export type MediaViewerRequest = {
  type: MediaViewerType
  /** URL media (https) — diteruskan VERBATIM (query signed URL dipertahankan). */
  url?: string
  /** Judul di header (nama berkas / caption). */
  title?: string
  mimeType?: string
  fileName?: string
  fileSize?: number | null
  /** Durasi detik (video/audio) bila diketahui pengirim. */
  durationSeconds?: number | null
  /** Album foto: JSON di-encode oleh `mediaViewerHref`. */
  items?: MediaViewerAlbumItem[]
  /** Index awal album. */
  index?: number
  /** Varian kualitas video (label + URL). */
  variants?: MediaViewerVariant[]
  /** Lokasi: dipakai bila `type=location`. */
  lat?: number
  lng?: number
  label?: string
  /** ISO tanggal kirim (panel info foto) — dari `message.createdAt`, tanpa API baru. */
  sentAt?: string
}

const TYPE_SET: ReadonlySet<string> = new Set(["photo", "video", "file", "audio", "location"])

export function asMediaViewerType(value: unknown): MediaViewerType | null {
  return typeof value === "string" && TYPE_SET.has(value) ? (value as MediaViewerType) : null
}

/**
 * Klasifikasi MIME → tipe viewer. Urutan penting: `isPdfMime`/dokumen JATUH ke
 * "file" (dirender file viewer in-app), bukan browser luar.
 */
export function classifyMedia(
  mimeType: string | null | undefined,
  fileName?: string | null,
): MediaViewerType {
  if (typeof mimeType === "string") {
    if (mimeType.startsWith("image/")) return "photo"
    if (mimeType.startsWith("video/")) return "video"
    if (mimeType.startsWith("audio/")) return "audio"
  }
  // Fallback ekstensi bila MIME kosong/rusak (data lama).
  if (typeof fileName === "string") {
    const lower = fileName.toLowerCase()
    if (/\.(png|jpe?g|gif|webp|bmp|heic|heif|avif)$/.test(lower)) return "photo"
    if (/\.(mp4|mov|m4v|webm|mkv|3gp)$/.test(lower)) return "video"
    if (/\.(mp3|m4a|aac|wav|ogg|opus|flac|amr)$/.test(lower)) return "audio"
  }
  return "file"
}

/** True bila berkas teks bisa dirender sebagai tampilan baca in-app. */
export function isReadableTextFile(mimeType: string | null | undefined, fileName?: string | null): boolean {
  if (typeof mimeType === "string") {
    if (mimeType.startsWith("text/")) return true
    if (mimeType === "application/json" || mimeType.endsWith("+json")) return true
    if (mimeType === "text/markdown" || mimeType === "text/x-markdown") return true
  }
  if (typeof fileName === "string") {
    return /\.(txt|md|markdown|csv|log|json)$/i.test(fileName)
  }
  return false
}

/** True bila dokumen kantor (preview via penampil dokumen in-app / kartu berkas). */
export function isOfficeDocument(mimeType: string | null | undefined, fileName?: string | null): boolean {
  if (typeof mimeType === "string") {
    if (/word|document|sheet|excel|presentation|powerpoint|officedocument|opendocument/.test(mimeType)) return true
    if (mimeType === "application/rtf" || mimeType === "application/msword") return true
  }
  if (typeof fileName === "string") {
    return /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i.test(fileName)
  }
  return false
}

export function isPdfMedia(mimeType: string | null | undefined, fileName?: string | null): boolean {
  if (mimeType === "application/pdf") return true
  return typeof fileName === "string" && /\.pdf$/i.test(fileName)
}

/** Jam pemutar: 0:07, 12:34, 1:02:03. NaN/negatif → "0:00" (jangan "NaN:NaN"). */
export function formatMediaClock(totalSeconds: number | null | undefined): string {
  if (!Number.isFinite(totalSeconds) || (totalSeconds as number) < 0) return "0:00"
  const total = Math.floor(totalSeconds as number)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes)
  const ss = String(seconds).padStart(2, "0")
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Kecepatan putar video/audio: 0.5x … 2x. */
export const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2] as const
export type PlaybackRate = (typeof PLAYBACK_RATES)[number]

/** Lompat maju/mundur (detik) — tombol ±10 dtk + double-tap kiri/kanan. */
export const SEEK_STEP_SECONDS = 10
/** Kontrol video otomatis sembunyi setelah 3 detik tidak disentuh. */
export const CONTROLS_AUTOHIDE_MS = 3000

/**
 * Pilihan kualitas video (REAL, bukan pajangan):
 *   - "auto"  → `maxResolution = null` (player memilih sendiri).
 *   - high/medium/low → batas resolusi maksimum (berlaku untuk adaptive
 *     stream/HLS; untuk mp4 progresif single-track, player mengabaikan batas
 *     dan tetap memutar satu-satunya track yang ada).
 * Tombol kualitas HANYA tampil bila video punya >1 track ATAU pengirim
 * menyertakan `variants` (URL per kualitas) — MP4 biasa tanpa varian tidak
 * diberi pilihan palsu.
 */
export const QUALITY_OPTIONS = [
  { key: "auto", label: "Otomatis", maxHeight: null },
  { key: "high", label: "Tinggi", maxHeight: 1080 },
  { key: "medium", label: "Sedang", maxHeight: 720 },
  { key: "low", label: "Hemat data", maxHeight: 480 },
] as const
export type QualityKey = (typeof QUALITY_OPTIONS)[number]["key"]

/**
 * Bangun Href `/media-viewer` dari request. `items`/`variants` di-JSON-kan;
 * nilai non-string di-skip supaya URL tetap bersih.
 */
export function mediaViewerHref(req: MediaViewerRequest): Href {
  const params: Record<string, string> = { type: req.type }
  if (req.url) params.url = req.url
  if (req.title) params.title = req.title
  if (req.mimeType) params.mimeType = req.mimeType
  if (req.fileName) params.fileName = req.fileName
  if (req.fileSize != null && Number.isFinite(req.fileSize)) params.fileSize = String(req.fileSize)
  if (req.durationSeconds != null && Number.isFinite(req.durationSeconds)) {
    params.durationSeconds = String(req.durationSeconds)
  }
  if (req.items?.length) {
    const clean = req.items.filter((it) => typeof it?.url === "string" && it.url.length > 0)
    if (clean.length > 0) params.items = JSON.stringify(clean)
  }
  if (req.index != null && Number.isFinite(req.index)) params.index = String(Math.max(0, Math.floor(req.index)))
  if (req.variants?.length) {
    const clean = req.variants.filter((v) => typeof v?.url === "string" && v.url.length > 0)
    if (clean.length > 0) params.variants = JSON.stringify(clean)
  }
  if (req.lat != null && Number.isFinite(req.lat)) params.lat = String(req.lat)
  if (req.lng != null && Number.isFinite(req.lng)) params.lng = String(req.lng)
  if (req.label) params.label = req.label
  if (req.sentAt) params.sentAt = req.sentAt
  return { pathname: "/media-viewer", params } as unknown as Href
}

export type ParsedMediaViewerParams =
  | { ok: true; value: MediaViewerRequest & { type: MediaViewerType } }
  | { ok: false; reason: string }

/**
 * Validasi param rute `/media-viewer`. Fail-closed dengan alasan Indonesia
 * yang akurat (ditampilkan di layar, bukan "terjadi kesalahan").
 */
export function parseMediaViewerParams(raw: Record<string, unknown>): ParsedMediaViewerParams {
  const first = (v: unknown): string | undefined =>
    Array.isArray(v) ? (typeof v[0] === "string" ? v[0] : undefined) : typeof v === "string" ? v : undefined

  const type = asMediaViewerType(first(raw.type))
  if (!type) return { ok: false, reason: "Tautan media tidak valid: jenis konten tidak dikenali." }

  if (type === "location") {
    const lat = Number(first(raw.lat))
    const lng = Number(first(raw.lng))
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return { ok: false, reason: "Koordinat lokasi tidak valid." }
    }
    return { ok: true, value: { type, lat, lng, label: first(raw.label) } }
  }

  const url = first(raw.url)
  const itemsRaw = first(raw.items)
  let items: MediaViewerAlbumItem[] | undefined
  if (itemsRaw) {
    try {
      const parsed: unknown = JSON.parse(itemsRaw)
      if (Array.isArray(parsed)) {
        const clean = parsed.filter(
          (it): it is MediaViewerAlbumItem =>
            !!it && typeof (it as MediaViewerAlbumItem).url === "string",
        )
        if (clean.length > 0) items = clean
      }
    } catch {
      // items rusak → abaikan, pakai url tunggal di bawah.
    }
  }
  // URL boleh http(s) remote ATAU file:// lokal (pratinjau sebelum unggah).
  // Validasi skema di sini; host dibiarkan (signed URL storage bermacam host).
  const usableUrl = url && /^(https?|file|content):/i.test(url) ? url : items?.[0]?.url
  if (!usableUrl) {
    return { ok: false, reason: "Tautan media tidak valid: URL berkas tidak ditemukan." }
  }

  let variants: MediaViewerVariant[] | undefined
  const variantsRaw = first(raw.variants)
  if (variantsRaw) {
    try {
      const parsed: unknown = JSON.parse(variantsRaw)
      if (Array.isArray(parsed)) {
        const clean = parsed.filter(
          (v): v is MediaViewerVariant =>
            !!v && typeof (v as MediaViewerVariant).url === "string" && typeof (v as MediaViewerVariant).label === "string",
        )
        if (clean.length > 0) variants = clean
      }
    } catch {
      // variants rusak → abaikan (kualitas = otomatis).
    }
  }

  const num = (v: unknown): number | null => {
    const s = first(v)
    if (s == null || s === "") return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  const indexRaw = num(raw.index)

  return {
    ok: true,
    value: {
      type,
      // PENTING: URL diteruskan VERBATIM — jangan pernah strip query
      // (signature signed URL hidup di sana).
      url: usableUrl,
      title: first(raw.title),
      mimeType: first(raw.mimeType),
      fileName: first(raw.fileName),
      fileSize: num(raw.fileSize),
      durationSeconds: num(raw.durationSeconds),
      items,
      index: indexRaw != null ? Math.max(0, Math.floor(indexRaw)) : 0,
      variants,
      sentAt: first(raw.sentAt),
    },
  }
}

/**
 * URL aman untuk DIBUKA DI LUAR APLIKASI (fallback terakhir "buka dengan
 * aplikasi lain" memakai file lokal, bukan ini). Hanya https tanpa kredensial.
 */
export function safeMediaShareUrl(value: unknown): string | undefined {
  return safeHttpsLink(value)
}
