/**
 * UX-04 (audit etalase 2026-10-10): judul ErrorState daftar/feed yang JUJUR.
 *
 * Dulu <PaginatedList> tidak mengirim `title`, jadi judulnya selalu
 * "Terjadi kesalahan" — termasuk saat offline/timeout (CLAUDE.md: itu BUG).
 * Deskripsi (`userMessage`) sudah spesifik; judul di sini menyusulnya.
 * Disimpan sebagai object literal agar terkatalog i18n (gen-i18n-catalog
 * hanya memindai nilai object di lib/).
 */
import { isApiError, isOfflineError, NETWORK_COPY } from "@/lib/api/errors"

const LOAD_ERROR_TITLES = {
  offline: "Tidak ada koneksi internet",
  dropped: "Koneksi terputus",
  slow: "Koneksi lambat",
  server: "Server sedang bermasalah",
  rateLimited: "Terlalu banyak permintaan",
}

/** `undefined` = tidak ada judul khusus (pemanggil memakai judul konteksnya). */
export function loadErrorTitle(err: unknown): string | undefined {
  if (isOfflineError(err)) return LOAD_ERROR_TITLES.offline
  if (!isApiError(err)) return undefined
  switch (err.code) {
    case "NETWORK":
      // Copy offline hanya dipasang client.ts saat NetInfo memverifikasi offline.
      return err.message === NETWORK_COPY.offline ? LOAD_ERROR_TITLES.offline : LOAD_ERROR_TITLES.dropped
    case "TIMEOUT":
      return LOAD_ERROR_TITLES.slow
    case "SERVER":
      return LOAD_ERROR_TITLES.server
    case "RATE_LIMITED":
      return LOAD_ERROR_TITLES.rateLimited
    default:
      return undefined
  }
}
