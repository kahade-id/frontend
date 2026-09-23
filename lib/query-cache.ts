/**
 * Cache respons GET (F-03) — dipisah dari React.
 *
 * Kenapa bukan di `lib/use-api-query.ts` (non-obvious, C-01 audit): cache ini
 * harus bisa dibatalkan dari LAPISAN ADAPTER (`lib/api/*`) setelah mutasi uang
 * berhasil. Sebelumnya `invalidateQueryCache` hanya hidup di modul hook,
 * sehingga adapter tidak punya cara membatalkannya dan setiap layar harus
 * ingat sendiri — pola yang pasti akan bocor begitu ada layar baru.
 * Modul ini TANPA dependensi React supaya aman diimpor dari mana saja.
 *
 * Kontrak:
 *   - Cache hanya untuk GET, hanya per `key`, umur `QUERY_CACHE_TTL_MS`.
 *   - Entri milik sesi lain (revisi sesi berbeda) SELALU dibuang saat dibaca.
 *   - `invalidateQueryCache()` (tanpa argumen) dipakai setelah mutasi yang
 *     mengubah saldo/status: jauh lebih murah membersihkan semua daripada
 *     memelihara daftar kunci yang harus ikut berubah tiap layar baru.
 */
import { getSessionRevision } from "@/lib/api/session"

/** Umur cache per key (ms) — pendek: dedupe navigasi bolak-balik, bukan offline store. */
export const QUERY_CACHE_TTL_MS = 5_000

/**
 * Umur minimum sebelum entri cache boleh DISEGARKAN DI LATAR (C-04 audit).
 *
 * TTL 5 detik dipakai untuk dedupe navigasi bolak-balik; di dalam jendela itu
 * data berumur beberapa detik masih cukup segar untuk ditampilkan langsung.
 * Di atas ambang ini, menyajikan cache TANPA request latar berarti pengguna
 * melihat data lama sebagai data baru — untuk angka uang itu bug kebenaran,
 * bukan sekadar perf. Dipilih 2 detik (2/5 TTL) supaya navigasi cepat tetap
 * nol-request sementara data yang lebih tua selalu diverifikasi.
 */
export const CACHE_REVALIDATE_AFTER_MS = 2_000

/**
 * Batas jumlah entri cache (C-03 audit).
 *
 * Sebelumnya cache tumbuh tanpa batas untuk kunci berparameter tinggi
 * (`order-detail:${id}`, `recipients:${debounced}`, `search:*`) — entri yang
 * tidak akan pernah dibaca lagi juga tidak pernah dibuang, karena
 * pembersihan hanya terjadi saat kunci itu dibaca ulang. Sesi panjang
 * (perangkat kasir/penjual yang jarang restart) menumpuk memori tanpa
 * manfaat. Eviksi FIFO: `Map` JS menjaga urutan penyisipan, dan entri tertua
 * memang yang paling tidak mungkin masih dipakai (TTL-nya cuma 5 detik).
 */
export const QUERY_CACHE_MAX = 200

export type QueryCacheHit<T> = { data: T; at: number; revalidating: boolean }

const queryCache = new Map<string, { revision: number; at: number; data: unknown; revalidating: boolean }>()

export function readQueryCacheEntry<T>(key: string): QueryCacheHit<T> | null {
  const entry = queryCache.get(key)
  if (!entry) return null
  // Sesi berganti (login/logout) → cache akun sebelumnya tidak boleh bocor.
  if (entry.revision !== getSessionRevision()) {
    queryCache.delete(key)
    return null
  }
  if (Date.now() - entry.at > QUERY_CACHE_TTL_MS) {
    queryCache.delete(key)
    return null
  }
  return { data: entry.data as T, at: entry.at, revalidating: entry.revalidating }
}

export function writeQueryCache(key: string, data: unknown, now = Date.now()): void {
  if (!queryCache.has(key) && queryCache.size >= QUERY_CACHE_MAX) {
    const oldest = queryCache.keys().next().value
    if (oldest !== undefined) queryCache.delete(oldest)
  }
  queryCache.set(key, { revision: getSessionRevision(), at: now, data, revalidating: false })
}

/**
 * Buang cache satu key / semua key.
 *
 * Dipanggil (a) setelah mutasi yang mengubah saldo/status — otomatis dari
 * `lib/api/client.ts` untuk jalur uang & order, dan (b) manual dari layar yang
 * mengubah data lewat jalur lain (mis. rekonsiliasi aksi menggantung).
 */
export function invalidateQueryCache(key?: string): void {
  if (key === undefined) queryCache.clear()
  else queryCache.delete(key)
}

/** Tandai bahwa penyegaran latar untuk key ini sedang berjalan (C-04). */
export function markQueryRevalidating(key: string): boolean {
  const entry = queryCache.get(key)
  if (!entry || entry.revalidating) return false
  entry.revalidating = true
  return true
}

/** Lepaskan penanda penyegaran latar supaya percobaan berikutnya diizinkan. */
export function releaseQueryRevalidation(key: string): void {
  const entry = queryCache.get(key)
  if (entry) entry.revalidating = false
}

/**
 * Baca lewat cache bersama untuk pemanggilan IMPERATIF (bukan hook) — C-02.
 *
 * Kenapa perlu (non-obvious): aturan C-02 adalah "satu kunci per ENDPOINT",
 * tetapi beberapa tempat memanggil endpoint yang sudah punya hook di layar
 * lain (`GET /v1/users/me` paling sering) dari dalam fungsi async — bukan dari
 * `useApiQuery`. Panggilan seperti itu tidak pernah melihat cache, jadi header
 * di layar yang sama bisa menembak endpoint yang sama persis beberapa detik
 * sebelumnya. Helper ini menyambungkannya ke cache yang sama: hit → tanpa
 * request, miss → fetch lalu tulis ke kunci itu sehingga pembaca berikutnya
 * (hook mana pun dengan kunci sama) memakai hasilnya.
 *
 * `signal` opsional: pemanggil yang punya AbortController tetap mengendalikan
 * pembatalannya.
 */
export async function fetchViaQueryCache<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const cached = readQueryCacheEntry<T>(key)
  if (cached !== null) return cached.data
  const data = await fetcher(signal ?? new AbortController().signal)
  writeQueryCache(key, data)
  return data
}

/** Jumlah entri saat ini — dipakai test batas ukuran (C-03). */
export function queryCacheSize(): number {
  return queryCache.size
}

/** Invalidate a feature family without discarding unrelated financial queries. */
export function invalidateQueryPrefix(prefix: string) {
  for (const key of queryCache.keys()) if (key.startsWith(prefix)) queryCache.delete(key)
}
