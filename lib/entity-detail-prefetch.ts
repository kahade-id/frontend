/**
 * Kahade — prefetch ringan detail entity (PERF-FIX P1 nav, 2026-09-30).
 *
 * Meniru pola `lib/showcase-detail-prefetch.ts` (C05): navigasi list→detail
 * terasa lambat karena seluruh detail baru diambil SETELAH ketuk. Solusi:
 * prefetch SATU GET JSON ringan saat niat buka terdeteksi (press-in pada
 * kartu) — halaman detail memakai hasil ini bila masih segar (TTL), tanpa
 * request ulang.
 *
 * BATAS KERAS mode hemat data: yang di-prefetch HANYA metadata JSON — tidak
 * pernah memicu unduhan media. Aman dipanggil berulang (best-effort,
 * tidak melempar).
 */
import { api } from "@/lib/api"
import { getUserByUsername } from "@/lib/api/users"
import { getDispute } from "@/lib/api/disputes"
import { getChatRoom } from "@/lib/api/chat"

/** Umur cache prefetch — cukup untuk jeda press-in → render detail. */
const PREFETCH_TTL_MS = 90_000
/** Batas ukuran cache per entity (pola FE-080 di showcase-detail-prefetch). */
const PREFETCH_MAX_ENTRIES = 50

type Entry<T> = { at: number; item: T | undefined }

function createPrefetch<T>(fetcher: (id: string) => Promise<T>) {
  const cache = new Map<string, Entry<T>>()

  const fresh = (e: Entry<T> | undefined, now: number): e is Entry<T> & { item: T } =>
    !!e && e.item != null && now - e.at < PREFETCH_TTL_MS

  function sweep(now: number): void {
    for (const [key, entry] of cache) {
      if (entry.item != null && now - entry.at >= PREFETCH_TTL_MS) cache.delete(key)
    }
  }

  function evictOverflow(): void {
    for (const [key, entry] of cache) {
      if (cache.size <= PREFETCH_MAX_ENTRIES) break
      if (entry.item == null) continue
      cache.delete(key)
    }
  }

  function prefetch(id: string, now: number = Date.now()): void {
    if (!id) return
    sweep(now)
    if (fresh(cache.get(id), now)) return
    cache.set(id, { at: now, item: undefined })
    evictOverflow()
    void fetcher(id)
      .then((item) => {
        cache.set(id, { at: Date.now(), item })
        sweep(Date.now())
        evictOverflow()
      })
      .catch(() => {
        cache.delete(id)
      })
  }

  function consume(id: string, now: number = Date.now()): T | null {
    const entry = cache.get(id)
    cache.delete(id)
    if (!fresh(entry, now)) return null
    return entry.item
  }

  function clear(id?: string): void {
    if (id) cache.delete(id)
    else cache.clear()
  }

  return { prefetch, consume, clear }
}

// --- Order detail (dari tab Transaksi) ---
const orderPrefetch = createPrefetch((id: string) => api.orders.getOrder(id))
export const prefetchOrderDetail = orderPrefetch.prefetch
export const consumePrefetchedOrderDetail = orderPrefetch.consume
export const clearOrderDetailPrefetch = orderPrefetch.clear

// --- Profil user publik (dari feed / kartu) ---
const userPrefetch = createPrefetch((username: string) => getUserByUsername(username))
export const prefetchUserProfile = userPrefetch.prefetch
export const consumePrefetchedUserProfile = userPrefetch.consume
export const clearUserProfilePrefetch = userPrefetch.clear

// --- Detail sengketa ---
const disputePrefetch = createPrefetch((id: string) => getDispute(id))
export const prefetchDisputeDetail = disputePrefetch.prefetch
export const consumePrefetchedDisputeDetail = disputePrefetch.consume
export const clearDisputeDetailPrefetch = disputePrefetch.clear

// --- Chat room (dari tab Pesan) ---
const chatPrefetch = createPrefetch((roomId: string) => getChatRoom(roomId))
export const prefetchChatRoom = chatPrefetch.prefetch
export const consumePrefetchedChatRoom = chatPrefetch.consume
export const clearChatRoomPrefetch = chatPrefetch.clear
