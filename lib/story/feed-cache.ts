/**
 * Kahade — cache feed story per penulis untuk viewer (2026-10-10).
 *
 * Masalah yang diselesaikan: viewer dulu `router.replace` ke rute baru tiap
 * ganti penulis → layar di-mount ulang, `useApiQuery` memuat dari nol, dan
 * di antaranya tampil layar loading PUTIH (CLAUDE.md §3: "shimmer, bukan
 * layar putih"). Dengan cache ini viewer tetap satu layar: feed penulis
 * berikutnya di-PREFETCH saat penulis sekarang mulai diputar, jadi geser/tap
 * ke penulis berikutnya instan.
 *
 * Murni (tanpa React) agar bisa diuji:
 *   - TTL per entri (default 60 dtk — story berumur 24 jam, perubahan dalam
 *     1 menit cukup langka; event realtime/revision membatalkan lebih awal).
 *   - LRU kecil (default 12 penulis) — tray jarang lebih panjang dari itu;
 *     memori bebas saat scroll banyak penulis.
 *   - Dedup permintaan: `load` untuk kunci yang sedang berjalan mengembalikan
 *     promise yang sama (prefetch + buka manual = satu request).
 */

export type FeedCacheEntry<T> = { data: T; at: number }

export type FeedCache<T> = {
  /** Data segar (dalam TTL) atau null. */
  get: (key: string, now?: number) => T | null
  /** Data walau basi (untuk ditampilkan sambil memuat ulang). */
  peek: (key: string) => T | null
  set: (key: string, data: T, now?: number) => void
  /** Hapus satu kunci, atau semua bila tanpa argumen. */
  invalidate: (key?: string) => void
  /**
   * Ambil dari cache bila segar; selain itu panggil `fetcher` (satu kali
   * untuk permintaan bersamaan) dan simpan hasilnya.
   */
  load: (key: string, fetcher: () => Promise<T>, now?: number) => Promise<T>
  /** True bila ada permintaan berjalan untuk kunci ini. */
  isLoading: (key: string) => boolean
  size: () => number
}

export function createFeedCache<T>(opts: { ttlMs?: number; max?: number } = {}): FeedCache<T> {
  const ttlMs = opts.ttlMs ?? 60_000
  const max = Math.max(1, opts.max ?? 12)
  const entries = new Map<string, FeedCacheEntry<T>>()
  const inflight = new Map<string, Promise<T>>()

  const touch = (key: string, entry: FeedCacheEntry<T>) => {
    // Map menjaga urutan sisip: hapus-lalu-sisip = pindah ke paling baru (LRU).
    entries.delete(key)
    entries.set(key, entry)
    while (entries.size > max) {
      const oldest = entries.keys().next().value
      if (oldest === undefined) break
      entries.delete(oldest)
    }
  }

  const get: FeedCache<T>["get"] = (key, now = Date.now()) => {
    const entry = entries.get(key)
    if (!entry) return null
    if (now - entry.at > ttlMs) {
      entries.delete(key)
      return null
    }
    touch(key, entry)
    return entry.data
  }

  return {
    get,
    peek: (key) => entries.get(key)?.data ?? null,
    set: (key, data, now = Date.now()) => touch(key, { data, at: now }),
    invalidate: (key) => {
      if (key === undefined) entries.clear()
      else entries.delete(key)
    },
    load: (key, fetcher, now = Date.now()) => {
      const fresh = get(key, now)
      if (fresh !== null) return Promise.resolve(fresh)
      const running = inflight.get(key)
      if (running) return running
      const p = fetcher()
        .then((data) => {
          touch(key, { data, at: Date.now() })
          return data
        })
        .finally(() => {
          inflight.delete(key)
        })
      inflight.set(key, p)
      return p
    },
    isLoading: (key) => inflight.has(key),
    size: () => entries.size,
  }
}
