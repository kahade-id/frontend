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
 * R2 (audit ronde-2, butir #104): TTL per KELAS data. Order aktif memang
 * pantas 5 detik; data yang nyaris statis (template, invoice, limit, paket
 * langganan, tiket bantuan) boleh 60 detik — navigasi balik ≤1 menit tidak
 * lagi memicu kilatan skeleton untuk data yang pasti sama.
 * Pencocokan prefix (kunci berbentuk `kelas:…`); kelas yang tidak terdaftar
 * memakai default 5 detik.
 */
const QUERY_CACHE_TTL_RULES: ReadonlyArray<[prefix: string, ttlMs: number]> = [
  ["transaction-templates:", 60_000], // app/transaction-templates.tsx
  ["invoice:", 60_000], // app/invoice/[orderId].tsx
  ["support-ticket:", 60_000], // daftar/detail tiket bantuan
  ["help:", 60_000], // artikel bantuan (publikasi tulen)
  ["article:", 60_000],
  // PERF-FIX (network P0): katalog etalase milik sendiri — berubah hanya
  // lewat mutasi yang menginvalidasi prefix ini; navigasi bolak-balik ≤60 dtk
  // tidak mengunduh ulang seluruh katalog.
  ["my-showcase:", 60_000], // app/showcase-management.tsx
  // PERF-FIX (network P2): data nyaris statis — berubah hanya lewat mutasi
  // yang me-refresh eksplisit (atau pull-to-refresh); navigasi bolak-balik
  // ≤60 dtk tidak mengunduh ulang.
  ["kahade-plus-plans", 60_000], // app/kahade-plus/plans.tsx — katalog paket
  ["bank-accounts", 60_000], // queryKeys.bankAccounts() — tambah/hapus refresh eksplisit
  ["topup-fee:", 60_000], // app/topup.tsx — estimasi per nominal+metode
  ["fee-schedule", 60_000], // app/create-transaction.tsx — jadwal biaya publik
]

/** TTL efektif untuk sebuah kunci cache. */
export function queryCacheTtlMs(key: string): number {
  for (const [prefix, ttl] of QUERY_CACHE_TTL_RULES) if (key.startsWith(prefix)) return ttl
  return QUERY_CACHE_TTL_MS
}

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
/** Batas total estimasi byte seluruh entri (~2MB — respons API tipikal <50KB). */
export const QUERY_CACHE_MAX_BYTES = 2_000_000

export type QueryCacheHit<T> = { data: T; at: number; revalidating: boolean }

const queryCache = new Map<
  string,
  { revision: number; at: number; data: unknown; revalidating: boolean; bytes: number }
>()
let queryCacheBytes = 0

/** Estimasi byte sebuah nilai via JSON — murah, hanya dipanggil saat tulis. */
function estimateBytes(data: unknown): number {
  try {
    const s = JSON.stringify(data)
    return s ? s.length : 0
  } catch {
    return 0
  }
}

export function readQueryCacheEntry<T>(key: string): QueryCacheHit<T> | null {
  const entry = queryCache.get(key)
  if (!entry) return null
  // Sesi berganti (login/logout) → cache akun sebelumnya tidak boleh bocor.
  if (entry.revision !== getSessionRevision()) {
    queryCacheBytes -= entry.bytes
    queryCache.delete(key)
    return null
  }
  if (Date.now() - entry.at > queryCacheTtlMs(key)) {
    queryCacheBytes -= entry.bytes
    queryCache.delete(key)
    return null
  }
  return { data: entry.data as T, at: entry.at, revalidating: entry.revalidating }
}

export function writeQueryCache(key: string, data: unknown, now = Date.now()): void {
  const bytes = estimateBytes(data)
  const prev = queryCache.get(key)
  if (prev) queryCacheBytes -= prev.bytes
  // Eviksi FIFO sampai muat: entri tertua memang yang paling tidak mungkin
  // masih dipakai (TTL-nya pendek). Dua batas: jumlah entri DAN total byte.
  while (queryCache.size >= QUERY_CACHE_MAX || queryCacheBytes + bytes > QUERY_CACHE_MAX_BYTES) {
    const oldest = queryCache.keys().next().value
    if (oldest === undefined) break
    const removed = queryCache.get(oldest)
    if (removed) queryCacheBytes -= removed.bytes
    queryCache.delete(oldest)
    // Jangan eviksi key yang sedang ditulis bila ia satu-satunya entri.
    if (oldest === key) break
  }
  queryCache.set(key, { revision: getSessionRevision(), at: now, data, revalidating: false, bytes })
  queryCacheBytes += bytes
}

/**
 * Buang cache satu key / semua key.
 *
 * Dipanggil (a) setelah mutasi yang mengubah saldo/status — otomatis dari
 * `lib/api/client.ts` untuk jalur uang & order, dan (b) manual dari layar yang
 * mengubah data lewat jalur lain (mis. rekonsiliasi aksi menggantung).
 *
 * G-05 (audit escrow 2026-09-24): invalidasi juga memberi tahu PENDENGAR —
 * cache statistik jangka panjang (`getAverageDurationsCached`) punya TTL
 * sendiri (10 menit, kuota) dan tidak disimpan di `queryCache`; tanpa
 * pemberitahuan ini mutasi uang tidak pernah menyegarkan angka estimasi itu.
 */
/**
 * PERF-FIX (network P1): cakupan invalidasi terarah.
 *
 * `undefined` = seluruh cache (perilaku lama: SEMUA pendengar bereaksi →
 * badai refetch). Dengan `prefixes`/`keys`, pendengar HANYA bereaksi bila
 * kuncinya cocok — push foreground tidak lagi membangunkan semua query yang
 * sedang mount.
 */
export type QueryInvalidationScope = {
  keys?: readonly string[]
  prefixes?: readonly string[]
}

const invalidateListeners = new Set<(scope: QueryInvalidationScope | undefined) => void>()

export function onQueryCacheInvalidation(
  listener: (scope: QueryInvalidationScope | undefined) => void,
): () => void {
  invalidateListeners.add(listener)
  return () => {
    invalidateListeners.delete(listener)
  }
}

function notifyInvalidation(scope: QueryInvalidationScope | undefined): void {
  for (const listener of [...invalidateListeners]) listener(scope)
}

export function invalidateQueryCache(key?: string): void {
  if (key === undefined) queryCache.clear()
  else queryCache.delete(key)
  // Invalidasi penuh = siaran ke semua pendengar (perilaku lama dipertahankan).
  notifyInvalidation(undefined)
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
/**
 * PERF-FIX (state audit): janji in-flight per key. Tanpa ini, dua cache miss
 * paralel untuk key yang sama (mount ganda saat tab berpindah cepat) menembak
 * jaringan dua kali. Pola yang sama dipakai `lib/unread-count.ts`.
 * Dedupe hanya untuk pemanggil TANPA signal sendiri — pemanggil yang membawa
 * AbortController mengelola pembatalannya sendiri dan tidak boleh berbagi
 * janji dengan pemanggil lain.
 */
const inFlightFetches = new Map<string, Promise<unknown>>()

export async function fetchViaQueryCache<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const cached = readQueryCacheEntry<T>(key)
  if (cached !== null) return cached.data
  if (signal === undefined) {
    const existing = inFlightFetches.get(key)
    if (existing) return existing as Promise<T>
  }
  // PERF-FIX (TIM1): `run` dipakai di `finally` sebelum assignment selesai —
  // bungkus dalam holder agar TS tidak error TS2454 (runtime tidak berubah:
  // `finally` baru jalan setelah `holder.run` ter-assign).
  const holder: { run?: Promise<T> } = {}
  holder.run = (async () => {
    try {
      const data = await fetcher(signal ?? new AbortController().signal)
      writeQueryCache(key, data)
      return data
    } finally {
      if (signal === undefined && inFlightFetches.get(key) === holder.run) {
        inFlightFetches.delete(key)
      }
    }
  })()
  const run = holder.run
  if (signal === undefined) inFlightFetches.set(key, run)
  return run
}

/** Jumlah entri saat ini — dipakai test batas ukuran (C-03). */
export function queryCacheSize(): number {
  return queryCache.size
}

/** Invalidate a feature family without discarding unrelated financial queries. */
export function invalidateQueryPrefix(prefix: string) {
  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) {
      const entry = queryCache.get(key)
      if (entry) queryCacheBytes -= entry.bytes
      queryCache.delete(key)
    }
  }
  // PERF-FIX (network P1): beri tahu pendengar SECARA TERARAH — hook yang
  // kuncinya tidak cocok dengan prefix ini diam saja (tidak ada badai refetch
  // lintas layar; lihat filter cakupan di lib/use-api-query.ts).
  notifyInvalidation({ prefixes: [prefix] })
}
