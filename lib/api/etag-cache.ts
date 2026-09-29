/**
 * Kahade — cache ETag per URL (hemat bandwidth untuk respons tak berubah).
 *
 * PERF-FIX (network P1): GET yang responsnya membawa header `ETag`
 * menyimpan pasangan (etag, body); GET berikutnya ke URL yang sama mengirim
 * `If-None-Match`, dan bila server menjawab 304, body tersimpan dipakai
 * tanpa mengunduh ulang.
 *
 * FAIL-OPEN PENUH: backend (per 2026-09-30) TIDAK mengirim header ETag —
 * selama itu modul ini tidak mengubah perilaku apa pun (satu `Map.get` +
 * satu `headers.get` per GET). Aktif otomatis bila backend kelak
 * mendukungnya; tidak ada flag konfigurasi yang perlu diingat.
 *
 * Keamanan: entri terikat revisi sesi (`getSessionRevision`) — tidak bocor
 * antar akun. Hanya respons JSON yang disimpan; FIFO cap 50 entri.
 */
import { getSessionRevision } from "@/lib/api/session"

const ETAG_CACHE_MAX = 50

type EtagEntry = { revision: number; etag: string; body: unknown }

const etagCache = new Map<string, EtagEntry>()

function liveEntry(url: string): EtagEntry | null {
  const entry = etagCache.get(url)
  if (!entry) return null
  if (entry.revision !== getSessionRevision()) {
    etagCache.delete(url)
    return null
  }
  return entry
}

/** ETag tersimpan untuk URL — dipakai `send()` untuk header If-None-Match. */
export function getStoredEtag(url: string): string | null {
  return liveEntry(url)?.etag ?? null
}

/** Body tersimpan untuk URL — dipakai saat server menjawab 304. */
export function getStoredEtagBody(url: string): { found: true; body: unknown } | { found: false } {
  const entry = liveEntry(url)
  if (!entry) return { found: false }
  return { found: true, body: entry.body }
}

/** Simpan pasangan (etag, body) — hanya dipanggil bila respons membawa ETag. */
export function storeEtagEntry(url: string, etag: string, body: unknown): void {
  if (!etag) return
  if (!etagCache.has(url) && etagCache.size >= ETAG_CACHE_MAX) {
    const oldest = etagCache.keys().next().value
    if (oldest !== undefined) etagCache.delete(oldest)
  }
  etagCache.set(url, { revision: getSessionRevision(), etag, body })
}
