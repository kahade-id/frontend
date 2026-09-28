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

type PrefetchEntry = { at: number; item: ShowcaseSocialItem }

const cache = new Map<string, PrefetchEntry>()

function fresh(entry: PrefetchEntry | undefined, now: number): entry is PrefetchEntry {
  return !!entry && now - entry.at < SHOWCASE_DETAIL_PREFETCH_TTL_MS
}

/**
 * Prefetch metadata detail — fire-and-forget, best-effort. Aman dipanggil
 * berulang: entri segar tidak di-fetch ulang. TIDAK melempar.
 */
export function prefetchShowcaseDetail(id: string, now: number = Date.now()): void {
  if (!id) return
  if (fresh(cache.get(id), now)) return
  // Tandai langsung agar ketukan ganda tidak menembak dua request.
  cache.set(id, { at: now, item: undefined as unknown as ShowcaseSocialItem })
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
