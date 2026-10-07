/**
 * Kahade — aksi berkas halaman media viewer: unduh, simpan ke galeri,
 * bagikan, dan "buka dengan aplikasi lain".
 *
 * Aturan main:
 *   - Native TIDAK PERNAH melempar media ke browser luar. "Buka dengan
 *     aplikasi lain" = unduh ke cache lalu `expo-sharing` (sheet OS → pemilih
 *     aplikasi: Files/Drive/penampil PDF). "Unduh" foto/video = simpan ke
 *     galeri via `expo-media-library`; dokumen = unduh + sheet OS supaya user
 *     memilih tujuan simpan (Files/Drive) — tanpa path misterius.
 *   - Web = unduhan browser biasa (anchor `download`).
 *   - Semua modul native di-import DINAMIS (pola repo: jangan membebani boot).
 *   - Error SELALU `MediaActionError` dengan pesan Indonesia yang akurat —
 *     bedakan jaringan, izin, dan berkas tak didukung (jangan generik).
 *
 * Izin (Android): tulis ke galeri tidak butuh izin tambahan di API 29+
 * (MediaStore scoped storage); di bawah itu `requestPermissionsAsync` meminta
 * saat dibutuhkan. iOS: butuh `NSPhotoLibraryAddUsageDescription` (app.json).
 * Plugin `expo-media-library` TIDAK didaftarkan di app.json — runtime request
 * sudah cukup dan gate `check-permissions` melarang plugin tanpa entry point.
 */
import { Platform } from "react-native"

import { shareContent } from "@/lib/share"

export type MediaActionReason =
  | "network"
  | "permission"
  | "unsupported"
  | "cancelled"
  | "not-found"
  | "unknown"

export class MediaActionError extends Error {
  reason: MediaActionReason
  constructor(reason: MediaActionReason, message: string) {
    super(message)
    this.name = "MediaActionError"
    this.reason = reason
  }
}

/** Nama berkas aman untuk cache/sheet OS (tanpa pemisah path, maks 120 char). */
export function sanitizeFileName(name: string, fallback = "berkas"): string {
  const base = name.split("/").pop()?.split("\\").pop()?.trim() || fallback
  const cleaned = base.replace(/[^\w.\-()[\] ]+/g, "_").replace(/\s+/g, " ").trim()
  const limited = cleaned.slice(0, 120) || fallback
  return limited
}

/**
 * Tebak nama berkas dari URL remote. Query TIDAK ikut (itu signature, bukan
 * nama) — tetapi URL ASLI tetap dipakai verbatim saat mengunduh.
 */
export function inferFileName(
  url: string,
  fileName?: string | null,
  fallback = "berkas",
): string {
  if (fileName?.trim()) return sanitizeFileName(fileName.trim(), fallback)
  try {
    const path = url.split("?")[0] ?? ""
    const last = decodeURIComponent(path.split("/").pop() ?? "")
    if (last.includes(".")) return sanitizeFileName(last, fallback)
  } catch {
    // Abaikan — pakai fallback di bawah.
  }
  return fallback
}

/** Ekstensi dari MIME bila nama berkas tidak punya ekstensi. */
const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
}

export function ensureFileExtension(fileName: string, mimeType?: string | null): string {
  if (fileName.includes(".")) return fileName
  const ext = mimeType ? MIME_EXTENSION[mimeType.toLowerCase()] : undefined
  return ext ? `${fileName}${ext}` : fileName
}

export type DownloadProgress = { written: number; total: number }

function toMediaActionError(err: unknown, fallback: string): MediaActionError {
  if (err instanceof MediaActionError) return err
  const message = err instanceof Error ? err.message : String(err)
  if (/network|connection|timeout|ENOTFOUND|EAI_AGAIN|fetch failed|Unable to resolve|404|403|410/i.test(message)) {
    return new MediaActionError(
      "network",
      "Unduhan gagal — periksa koneksi internet Anda, lalu coba lagi.",
    )
  }
  return new MediaActionError("unknown", fallback)
}

/**
 * Unduh URL remote ke cache lokal. `onProgress` dipanggil dengan byte
 * tertulis/total (total bisa 0 bila server tidak mengirim Content-Length).
 * Mengembalikan URI file lokal (file://).
 */
export async function downloadToCache(
  url: string,
  fileName: string,
  opts: { onProgress?: (p: DownloadProgress) => void; timeoutMs?: number } = {},
): Promise<string> {
  if (Platform.OS === "web") {
    throw new MediaActionError("unsupported", "Unduhan berkas tidak tersedia di tampilan web ini.")
  }
  // PERF-FIX (bundle): modul native lazy — lihat pola lib/share.ts.
  const FileSystem = await import("expo-file-system/legacy")
  const cacheDir = FileSystem.cacheDirectory
  if (!cacheDir) {
    throw new MediaActionError("unsupported", "Penyimpanan sementara perangkat tidak tersedia.")
  }
  const target = `${cacheDir}${sanitizeFileName(fileName)}`
  try {
    if (opts.onProgress) {
      const task = FileSystem.createDownloadResumable(
        url,
        target,
        {},
        (data) => opts.onProgress?.({ written: data.totalBytesWritten, total: data.totalBytesExpectedToWrite }),
      )
      const result = await task.downloadAsync()
      if (!result?.uri) throw new Error("empty-download")
      return result.uri
    }
    const result = await FileSystem.downloadAsync(url, target)
    // downloadAsync me-resolve walau status HTTP gagal — periksa status.
    if (result.status !== 200) {
      if (result.status === 404) {
        throw new MediaActionError("not-found", "Berkas tidak ditemukan di server (mungkin sudah dihapus).")
      }
      if (result.status === 403 || result.status === 410) {
        throw new MediaActionError(
          "network",
          "Tautan berkas sudah kedaluwarsa. Tutup halaman ini lalu buka ulang dari chat untuk tautan baru.",
        )
      }
      throw new MediaActionError(
        "network",
        `Unduhan gagal (server menjawab ${result.status}). Periksa koneksi lalu coba lagi.`,
      )
    }
    return result.uri
  } catch (err) {
    throw toMediaActionError(err, "Unduhan gagal. Periksa koneksi internet Anda, lalu coba lagi.")
  }
}

/**
 * Simpan foto/video ke galeri perangkat ("Download" di photo/video viewer).
 * Mengembalikan true bila tersimpan; melempar MediaActionError dengan pesan
 * akurat (izin ditolak / jaringan / dsb).
 */
export async function saveImageOrVideoToGallery(
  url: string,
  fileName: string,
  opts: { onProgress?: (p: DownloadProgress) => void } = {},
): Promise<void> {
  if (Platform.OS === "web") {
    triggerWebDownload(url, fileName)
    return
  }
  const localUri = await downloadToCache(url, fileName, { onProgress: opts.onProgress })
  const MediaLibrary = await import("expo-media-library")
  try {
    // `createAssetAsync` butuh izin tulis di sebagian platform/versi OS.
    const current = await MediaLibrary.getPermissionsAsync(false)
    let granted = current.granted
    if (!granted) {
      const req = await MediaLibrary.requestPermissionsAsync(false)
      granted = req.granted
    }
    if (!granted) {
      throw new MediaActionError(
        "permission",
        "Izin galeri ditolak. Aktifkan akses foto di Pengaturan perangkat agar bisa menyimpan.",
      )
    }
    const asset = await MediaLibrary.createAssetAsync(localUri)
    // Kumpulkan ke album "Kahade" — gagal album tidak menggagalkan simpan.
    try {
      await MediaLibrary.createAlbumAsync("Kahade", asset, false)
    } catch {
      // Abaikan: berkas sudah tersimpan di galeri (Camera Roll).
    }
  } catch (err) {
    throw toMediaActionError(err, "Gagal menyimpan ke galeri. Coba lagi.")
  }
}

/**
 * "Buka dengan aplikasi lain" (file viewer): unduh ke cache lalu buka sheet
 * OS — di Android itu pemilih aplikasi (Files/Drive/penampil PDF), di iOS
 * UIActivityViewController. TIDAK PERNAH membuka browser luar.
 */
export async function openFileWithOtherApp(
  url: string,
  fileName: string,
  mimeType?: string | null,
  opts: { onProgress?: (p: DownloadProgress) => void } = {},
): Promise<void> {
  if (Platform.OS === "web") {
    triggerWebDownload(url, fileName)
    return
  }
  const safeName = ensureFileExtension(sanitizeFileName(fileName), mimeType)
  const localUri = await downloadToCache(url, safeName, { onProgress: opts.onProgress })
  const outcome = await shareContent({
    fileUri: localUri,
    mimeType: mimeType ?? undefined,
    dialogTitle: safeName,
  })
  if (outcome === "unavailable") {
    throw new MediaActionError(
      "unsupported",
      "Tidak ada aplikasi di perangkat yang bisa membuka berkas ini.",
    )
  }
}

/**
 * Bagikan berkas media (tombol Share di viewer): unduh ke cache lalu sheet OS.
 */
export async function shareRemoteFile(
  url: string,
  fileName: string,
  mimeType?: string | null,
  opts: { onProgress?: (p: DownloadProgress) => void } = {},
): Promise<"shared" | "dismissed"> {
  if (Platform.OS === "web") {
    triggerWebDownload(url, fileName)
    return "shared"
  }
  const safeName = ensureFileExtension(sanitizeFileName(fileName), mimeType)
  const localUri = await downloadToCache(url, safeName, { onProgress: opts.onProgress })
  const outcome = await shareContent({
    fileUri: localUri,
    mimeType: mimeType ?? undefined,
    dialogTitle: safeName,
  })
  if (outcome === "unavailable") {
    throw new MediaActionError("unsupported", "Berbagi berkas tidak tersedia di perangkat ini.")
  }
  return outcome
}

/** Unduhan browser (web): anchor `download` — pola lib/export-file.ts. */
function triggerWebDownload(url: string, fileName: string): void {
  if (typeof document === "undefined") {
    throw new MediaActionError("unsupported", "Unduhan tidak tersedia di perangkat ini.")
  }
  const a = document.createElement("a")
  a.href = url
  a.download = sanitizeFileName(fileName)
  a.rel = "noopener"
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  setTimeout(() => a.remove(), 0)
}
