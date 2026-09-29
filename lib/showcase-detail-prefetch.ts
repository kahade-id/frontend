/**
 * Kahade — prefetch ringan detail etalase (C05, batch 139).
 *
 * Masalah: navigasi feed → detail terasa lambat karena seluruh detail baru
 * diambil SETELAH ketuk. Solusi: prefetch metadata ringan (SATU GET JSON
 * `/v1/showcase/:id`) saat niat buka terdeteksi (press-in pada kartu) —
 * halaman detail memakai hasil ini bila masih segar (TTL), tanpa request
 * ulang.
 *
 * BATAS KERAS mode hemat data: yang di-prefetch HANYA metadata JSON — tidak
 * pernah memicu unduhan video/gambar. Gambar poster tetap di-gate oleh
 * `dataSaverGate` <Picture> dan video oleh gate `VideoSlide`; prefetch ini
 * tidak menyentuh keduanya.
 */
import { getShowcaseDetail, type ShowcaseSocialItem } from "@/lib/api/showcase"

/** Umur cache prefetch — cukup untuk jeda press-in → render detail. */
export const SHOWCASE_DETAIL_PREFETCH_TTL_MS = 90_000

/**
 * FE-080: batas ukuran cache. Map TANPA eviksi tumbuh tanpa batas bila
 * pengguna menelusuri banyak kartu tanpa membuka detail (setiap press-in
 * menambah satu entri). 50 ≈ jauh di atas pola pakai wajar.
 */
export const SHOWCASE_DETAIL_PREFETCH_MAX_ENTRIES = 50

type PrefetchEntry = { at: number; item: ShowcaseSocialItem }

const cache = new Map<string, PrefetchEntry>()

/**
 * FE-080: sapu entri kedaluwarsa di setiap write — tanpa ini entri basi
 * menumpuk sampai ada yang mengonsumsinya (yang sering tidak terjadi).
 * Penanda in-flight (`item == null`, request sedang berjalan) TIDAK
 * disentuh: menghapusnya memicu fetch ganda.
 */
function sweepExpired(now: number): void {
  for (const [key, entry] of cache) {
    if (entry.item != null && now - entry.at >= SHOWCASE_DETAIL_PREFETCH_TTL_MS) {
      cache.delete(key)
    }
  }
}

/**
 * FE-080: eviksi kelebihan kapasitas. Map menjaga urutan insersi, jadi
 * hapus dari yang tertua. LRU eksplisit tidak diperlukan: entri bersifat
 * SEKALI PAKAI (`consumePrefetchedShowcaseDetail` menghapus saat dibaca),
 * jadi tidak ada pola akses-ulang yang perlu dilacak — urutan insersi
 * sudah cukup sebagai aproksimasi.
 */
function evictOverflow(): void {
  for (const [key, entry] of cache) {
    if (cache.size <= SHOWCASE_DETAIL_PREFETCH_MAX_ENTRIES) break
    if (entry.item == null) continue
    cache.delete(key)
  }
}

function fresh(entry: PrefetchEntry | undefined, now: number): entry is PrefetchEntry {
  return !!entry && now - entry.at < SHOWCASE_DETAIL_PREFETCH_TTL_MS
}

/**
 * Prefetch metadata detail — fire-and-forget, best-effort. Aman dipanggil
 * berulang: entri segar tidak di-fetch ulang. TIDAK melempar.
 */
export function prefetchShowcaseDetail(id: string, now: number = Date.now()): void {
  if (!id) return
  sweepExpired(now)
  if (fresh(cache.get(id), now)) return
  // Tandai langsung agar ketukan ganda tidak menembak dua request.
  cache.set(id, { at: now, item: undefined as unknown as ShowcaseSocialItem })
  // FE-080: jaga batas ukuran setelah write.
  evictOverflow()
  void getShowcaseDetail(id)
    .then((item) => {
      cache.set(id, { at: Date.now(), item })
    })
    .catch(() => {
      // Gagal = buang penanda supaya percobaan berikutnya boleh mencoba lagi.
      cache.delete(id)
    })
}

/**
 * Ambil hasil prefetch bila masih segar — SEKALI PAKAI (dihapus dari cache).
 * Dipakai fetcher halaman detail sebelum menembak jaringan.
 */
export function consumePrefetchedShowcaseDetail(
  id: string,
  now: number = Date.now(),
): ShowcaseSocialItem | null {
  const entry = cache.get(id)
  cache.delete(id)
  if (!fresh(entry, now) || entry.item == null) return null
  return entry.item
}

/** Untuk test / invalidasi eksplisit. */
export function clearShowcaseDetailPrefetch(id?: string): void {
  if (id) cache.delete(id)
  else cache.clear()
}
