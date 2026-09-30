import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useIsFocused } from "@react-navigation/native"
import { userMessage } from "@/lib/api/errors"
import { useGuestPathBlocked } from "@/lib/guest-gate"
import { fetchViaQueryCache } from "@/lib/query-cache"
import type { Page } from "@/lib/api/response"

export function mergeById<T extends { id?: string }>(
  previous: T[],
  incoming: T[],
  getKey: (item: T) => string = (item) => item.id ?? "",
): T[] {
  if (previous.length === 0) return incoming
  if (incoming.length === 0) return previous
  const values = new Map(previous.map((item) => [getKey(item), item]))
  for (const item of incoming) values.set(getKey(item), item)
  return [...values.values()]
}

/**
 * PERF-FIX (TIM1-P2): gabung dua array TERURUT menjadi satu array terurut —
 * O(n), bukan O(n log n) sort ulang seluruh list tiap halaman tiba.
 * Dipakai `usePaginatedQuery` saat `compare` ada: `previous` sudah terurut
 * dari pemuatan sebelumnya, hanya item baru yang di-sort dulu (O(k log k),
 * k = ukuran halaman) lalu di-merge.
 */
export function mergeSorted<T>(
  a: readonly T[],
  b: readonly T[],
  compare: (x: T, y: T) => number,
): T[] {
  if (a.length === 0) return [...b]
  if (b.length === 0) return [...a]
  const out: T[] = new Array(a.length + b.length)
  let i = 0
  let j = 0
  let k = 0
  while (i < a.length && j < b.length) {
    if (compare(a[i], b[j]) <= 0) out[k++] = a[i++]
    else out[k++] = b[j++]
  }
  while (i < a.length) out[k++] = a[i++]
  while (j < b.length) out[k++] = b[j++]
  return out
}

/**
 * PERF (tim8-komputasi P1): batas default item yang disimpan hook paginasi —
 * infinite scroll tanpa cap membuat array + biaya render tumbuh tanpa batas
 * (notifikasi, transaksi, feed, dsb.).
 */
export const DEFAULT_MAX_ITEMS = 300

/**
 * Pembanding untuk daftar KRONOLOGIS (C-08 audit).
 *
 * `mergeById` mempertahankan posisi baris lama: bila data server berubah di
 * tengah sesi (item naik peringkat — notifikasi baru, transaksi terbaru,
 * percakapan yang baru dibalas), urutan yang terlihat bisa berbeda dari server
 * tanpa indikasi apa pun. Opsi `compare` sudah ada sejak F-10, tetapi TIDAK
 * ada satu pun pemanggil yang mengisinya di checkout audit; helper ini membuat
 * pengisiannya satu baris dan konsisten (terbaru di atas, toleran tanda waktu
 * yang hilang/tidak valid).
 */
/**
 * PERF (tim8-komputasi P1): cache hasil `Date.parse` per string cap waktu.
 * Komparator sort memanggil `timeOf` O(N log N) kali untuk N item yang sama
 * — tanpa cache, 200 item ≈ 1500+ parse per sort. Dipakai 8 layar
 * (chat, notifikasi, transaksi, questions, ratings, order-links, returns).
 */
const timestampParseCache = new Map<string, number>()
function cachedParseTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const cached = timestampParseCache.get(value)
  if (cached !== undefined) return cached
  const parsed = Date.parse(value)
  const result = Number.isFinite(parsed) ? parsed : 0
  if (timestampParseCache.size >= 500) timestampParseCache.clear()
  timestampParseCache.set(value, result)
  return result
}

export function byTimestampDesc<T extends { id?: string }>(
  pick: (item: T) => string | null | undefined,
) {
  const timeOf = (value: string | null | undefined) => cachedParseTimestamp(value)
  return (a: T, b: T) => {
    // G-07 (audit escrow 2026-09-24): `createdAt` bisa IDENTIK antar item dalam
    // satu batch (mis. beberapa Order Link dibuat berbarengan) — tanpa
    // tiebreaker, perbandingan `0` membuat urutan antar-merge tidak
    // deterministik. Kunci akhir `id` menjamin urutan stabil kapan pun
    // digabung/urut ulang.
    const diff = timeOf(pick(b)) - timeOf(pick(a))
    if (diff !== 0) return diff
    const aId = a.id ?? ""
    const bId = b.id ?? ""
    if (aId === bId) return 0
    return aId < bId ? 1 : -1
  }
}

export type UsePaginatedQueryOptions<T> = {
  /**
   * Kunci unik baris untuk dedup merge. Default `item.id`; timpa bila payload
   * tidak membawa id (mis. followers/following — backend tidak membocorkan id
   * internal). R1 (audit 2026-09-26).
   */
  getKey?: (item: T) => string
  /**
   * Muat ulang halaman pertama (diam, mode `refresh`) saat layar kembali
   * fokus — paritas dengan `useApiQuery.refreshOnFocus` (F-01).
   *
   * Kenapa penting: daftar uang/notifikasi memakai hook ini dan tab Expo
   * Router tetap ter-mount. Bayar pesanan di layar detail lalu kembali ke
   * tab Transaksi tanpa ini = status "PENDING_PAYMENT" basi terus tampil
   * sampai pull-to-refresh manual. Untuk angka/status uang, tampilan basi
   * adalah bug kebenaran.
   */
  refreshOnFocus?: boolean
  /**
   * NC-003 (audit performa ronde-3): penjaga kesegaran untuk `refreshOnFocus` —
   * paritas dengan `useApiQuery.refreshOnFocusStaleMs`. Bila di-set (ms),
   * refresh diam saat layar kembali fokus DILEWATI bila pemuatan halaman-1
   * terakhir masih lebih muda dari ambang. Tanpa ini, tab yang tetap
   * ter-mount (Pesan/Notifikasi/Transaksi/Dompet) menembak jaringan setiap
   * bolak-balik tab walau data berumur <1 detik. Mutasi yang mengubah data
   * WAJIB menginvalidasi key/prefix-nya (lihat `invalidateQueryPrefix`)
   * supaya perubahan tetap terlihat saat kembali.
   */
  refreshOnFocusStaleMs?: number
  /**
   * Komparator opsional untuk mengurutkan ulang hasil merge (F-10).
   * `mergeById` mempertahankan urutan UNDUHAN (posisi item lama tidak
   * berubah saat diperbarui) — benar untuk daftar stabil, salah untuk feed
   * kronologis. Feed waktu memberikan compare (mis. waktu dibuat desc);
   * tanpa compare perilakunya persis seperti sebelumnya.
   */
  compare?: (a: T, b: T) => number
  /**
   * B-02 (audit): gate request untuk layar yang route-nya terbuka bagi tamu
   * web tetapi datanya `auth:"required"` (tab Dompet/Transaksi/Pengguna).
   * Sebelumnya hook ini selalu menembak halaman pertama; tamu web tanpa token
   * memanen 401 → refresh → potensi `expireSession` tiap kali tab difokuskan.
   * Default true (semua pemanggil lama tidak berubah).
   */
  enabled?: boolean
  /**
   * R2 (audit ronde-2, butir #110): saat `key` berubah (mis. ketukan pencarian
   * ber-debounce), baris LAMA tetap tampil dalam mode refresh senyap alih-alih
   * diganti skeleton penuh — tiap commit query dulu memicu skeleton → paint
   * ulang yang terlihat seperti flicker di jaringan lambat.
   * Default false (perilaku lama untuk daftar lain).
   */
  keepPreviousOnKeyChange?: boolean
  /**
   * PERF (tim8-komputasi P1): batas maksimum item yang disimpan — infinite
   * scroll tanpa cap membuat array + biaya render tumbuh tanpa batas. Item
   * terlama dibuang saat cap tercapai dan paginasi berhenti di situ.
   * Default {@link DEFAULT_MAX_ITEMS} (300); isi `0` untuk menonaktifkan
   * bila daftar memang harus lengkap.
   */
  maxItems?: number
}

/** Shared pagination for every long list: latest query wins, load-more single-flight, retry keeps rows. */
export function usePaginatedQuery<T extends { id?: string }>(
  key: string,
  fetcher: (page: number, signal: AbortSignal) => Promise<Page<T>>,
  opts: UsePaginatedQueryOptions<T> = {},
) {
  const fetchRef = useRef(fetcher)
  fetchRef.current = fetcher
  const compareRef = useRef(opts.compare)
  compareRef.current = opts.compare
  // R1 (audit 2026-09-26): kunci dedup mengikuti `getKey` bila diberikan.
  const getKeyRef = useRef(opts.getKey)
  getKeyRef.current = opts.getKey
  // PERF (tim8-komputasi P1): cap jumlah item (default 300).
  const maxItemsRef = useRef(opts.maxItems)
  maxItemsRef.current = opts.maxItems
  const activeRequest = useRef<AbortController | null>(null)
  /**
   * Jenis request yang sedang terbang — C-10 (audit).
   *
   * `busy` saja tidak cukup untuk memutuskan apa yang boleh dibatalkan saat
   * layar kehilangan fokus: muat-awal dan muat-lebih sama-sama menyalakannya.
   * Membatalkan muat-awal akan meninggalkan `loading` bernilai true tanpa ada
   * yang memulai ulang request (layar tampak menggantung di skeleton). Jadi
   * pembatalan saat tidak fokus HANYA berlaku untuk "more".
   */
  const inFlight = useRef<"initial" | "more" | null>(null)
  /**
   * NC-003 (audit performa ronde-3): kapan halaman-1 terakhir berhasil dimuat.
   * Dipakai `refreshOnFocusStaleMs` untuk melewati refresh fokus bila data
   * masih segar. Hanya pemuatan reset (halaman 1) yang menggesernya — muat
   * halaman berikutnya tidak menyegarkan halaman 1.
   */
  const lastLoadedAt = useRef(0)
  const ids = useRef(new Set<string>())
  const nextPage = useRef(1)
  const hasNext = useRef(true)
  const busy = useRef(false)
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  /**
   * Gerbang tamu web (B-03, lihat lib/guest-gate.ts) + gate eksplisit pemanggil
   * (B-02). Saat tertutup, TIDAK ada request sama sekali — dan saat gerbang
   * kembali terbuka (tamu pindah ke layar publik / habis login), `load`
   * berubah identitas sehingga effect muat-awal menjalankannya lagi.
   */
  const guestBlocked = useGuestPathBlocked()
  const active = (opts.enabled ?? true) && !guestBlocked

  const load = useCallback(
    async (reset: boolean, refresh = false, viaCache = false) => {
      if (!active) {
        // Bersihkan sisa data akun sebelumnya; tamu tidak boleh melihat baris
        // milik sesi lain, dan skeleton tidak boleh berputar selamanya.
        activeRequest.current?.abort()
        ids.current.clear()
        setData([])
        setHasMore(false)
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
        setError(null)
        setLoadMoreError(null)
        return
      }
      if (!reset && (busy.current || !hasNext.current)) return
      if (reset) activeRequest.current?.abort()
      const controller = new AbortController()
      activeRequest.current = controller
      busy.current = true
      inFlight.current = reset ? "initial" : "more"
      const page = reset ? 1 : nextPage.current
      if (reset) {
        setRefreshing(refresh)
        setLoading(!refresh)
        setLoadingMore(false)
        setError(null)
      } else setLoadingMore(true)
      setLoadMoreError(null)
      try {
        /**
         * NC-006 (audit performa): cache halaman-1 per `key` dengan TTL pendek
         * (`QUERY_CACHE_TTL_MS` via `fetchViaQueryCache`, sesi-aware).
         * Navigasi stack bolak-balik ke layar ber-daftar (disputes,
         * wallet-history, chat, …) tidak lagi mengunduh ulang halaman pertama
         * bila baru dibuka beberapa detik lalu — kembali ke daftar instan
         * (0-RTT) dalam jendela TTL.
         *
         * Yang MENEMBUS cache (perilaku tak berubah): halaman lanjut
         * (load-more selalu data baru), pull-to-refresh, dan silent refresh
         * (`refresh = true`) — kesegaran data uang/status tetap dijamin.
         */
        const result =
          reset && !refresh && viaCache
            ? await fetchViaQueryCache<Page<T>>(
                `paginated:page1:${key}`,
                (s) => fetchRef.current(1, s),
                controller.signal,
              )
            : await fetchRef.current(page, controller.signal)
        if (controller.signal.aborted) return
        if (reset) ids.current.clear()
        const getKey = getKeyRef.current ?? ((item: T) => item.id ?? "")
        for (const item of result.data) ids.current.add(getKey(item))
        const maxItems = maxItemsRef.current ?? DEFAULT_MAX_ITEMS
        setData((previous) => {
          const compare = compareRef.current
          const getKey = getKeyRef.current ?? ((item: T) => item.id ?? "")
          let merged: T[]
          if (!compare) {
            merged = mergeById(reset ? [] : previous, result.data, getKey)
          } else if (reset || previous.length === 0) {
            // Muat awal / reset: previous kosong — sort langsung.
            merged = [...result.data].sort(compare)
          } else {
            // PERF-FIX (TIM1-P2): insertion-merge — `previous` sudah terurut
            // dari pemuatan sebelumnya. Pisahkan item baru vs update,
            // sort hanya yang baru (O(k log k)), lalu merge O(n).
            const prevKeys = new Set<string>()
            for (const item of previous) prevKeys.add(getKey(item))
            const fresh: T[] = []
            const updated = new Map<string, T>()
            for (const item of result.data) {
              const key = getKey(item)
              if (prevKeys.has(key)) updated.set(key, item)
              else fresh.push(item)
            }
            // Update di tempat — kunci urut (mis. timestamp) tidak berubah
            // saat item di-update, jadi posisi urut tetap valid.
            const withUpdates =
              updated.size > 0
                ? previous.map((item) => updated.get(getKey(item)) ?? item)
                : previous
            fresh.sort(compare)
            merged = mergeSorted(withUpdates, fresh, compare)
          }
          // PERF (tim8-komputasi P1): batasi panjang array — item terlama
          // (ekor urutan unduhan) dibuang; `ids` dijaga sinkron.
          let capped = merged
          if (maxItems > 0 && merged.length > maxItems) {
            capped = merged.slice(0, maxItems)
            for (let i = maxItems; i < merged.length; i++) ids.current.delete(getKey(merged[i]))
          }
          return capped
        })
        nextPage.current = page + 1
        // F-09: `hasNewIds` sebelumnya menghentikan paginasi bila satu
        // halaman penuh berisi duplikat (backend menggeser urutan saat item
        // baru masuk di atas) — item lama jadi tak terjangkau padahal
        // `totalPages` mengatakan masih ada halaman. Duplikat sudah diurus
        // mergeById; sumber kebenaran "masih ada halaman" adalah meta server.
        hasNext.current = result.data.length > 0 && page < result.meta.totalPages
        // NC-003 (audit performa ronde-3): catat kesegaran halaman-1.
        if (reset) lastLoadedAt.current = Date.now()
        // PERF (tim8-komputasi P1): cap tercapai → hentikan paginasi agar
        // tidak fetch halaman sia-sia. `rowCount` = panjang data render
        // terakhir; reset memulai ulang dari halaman 1.
        if (!reset && maxItems > 0 && rowCount.current >= maxItems) {
          hasNext.current = false
        }
        setHasMore(hasNext.current)
      } catch (error) {
        if (controller.signal.aborted) return
        if (reset) setError(userMessage(error))
        else setLoadMoreError(userMessage(error))
      } finally {
        if (activeRequest.current === controller) {
          busy.current = false
          inFlight.current = null
          if (!controller.signal.aborted) {
            setLoading(false)
            setLoadingMore(false)
            setRefreshing(false)
          }
        }
      }
    },
    [key, active],
  )

  // R2 #110: jumlah baris tersimpan di ref supaya effect kunci-berubah bisa
  // memutuskan mode refresh-senyap tanpa membaca state (stale closure).
  const rowCount = useRef(0)
  if (data.length !== rowCount.current) rowCount.current = data.length
  const keepPrevious = opts.keepPreviousOnKeyChange === true
  useEffect(() => {
    const hasRows = rowCount.current > 0
    if (!(keepPrevious && hasRows)) {
      ids.current.clear()
      setData([])
    }
    setHasMore(false)
    nextPage.current = 1
    hasNext.current = true
    // Baris lama dipertahankan → muat-awal kunci baru sebagai REFRESH senyap
    // (indikator tarik-ulang tipis), bukan skeleton penuh (#110).
    // NC-006: muat-awal (bukan refresh) boleh lewat cache halaman-1 — remount
    // dalam jendela TTL menjadi 0-RTT. `reload`/pull/focus-refresh tetap
    // menembus cache (`viaCache = false`).
    void load(true, keepPrevious && hasRows, !(keepPrevious && hasRows))
    return () => {
      activeRequest.current?.abort()
      busy.current = false
    }
  }, [load])

  // F-01: refresh senyap saat kembali fokus (reset ke halaman 1, baris lama
  // tetap tampil — `refresh`, bukan `reload`). Error muat awal juga dipulihkan.
  const focused = useIsFocused()
  const latest = useRef({ load, error, hasRows: false })
  latest.current = { load, error, hasRows: data.length > 0 }
  const everFocused = useRef(false)
  /**
   * C-10 (audit): permintaan "muat lebih banyak" dibatalkan saat layar
   * kehilangan fokus.
   *
   * Tab Expo Router tetap ter-mount, jadi tanpa ini pengguna yang menekan
   * "muat lebih banyak" lalu langsung berpindah layar tetap menunggu respons
   * dan tetap memanggil `setData` di layar yang tidak terlihat — kuota
   * terbuang dan render terjadi untuk sesuatu yang tak seorang pun lihat.
   * Muat-awal/reset TIDAK dibatalkan (data pertama tetap dibutuhkan saat
   * kembali, dan membatalkannya akan menggantung skeleton selamanya — lihat
   * `inFlight` di atas), hanya penambahan halaman.
   */
  useEffect(() => {
    if (focused || inFlight.current !== "more") return
    activeRequest.current?.abort()
    busy.current = false
    inFlight.current = null
    setLoadingMore(false)
  }, [focused])

  useEffect(() => {
    if (!opts.refreshOnFocus) return
    if (!everFocused.current) {
      everFocused.current = true
      return
    }
    if (!focused || busy.current) return
    // NC-003 (audit performa ronde-3): lewati refresh bila halaman-1 masih
    // segar — bolak-balik tab dalam hitungan detik tidak mengunduh ulang.
    // lastLoadedAt = 0 (belum pernah sukses) → selisih raksasa → tetap refresh.
    if (
      opts.refreshOnFocusStaleMs != null &&
      Date.now() - lastLoadedAt.current < opts.refreshOnFocusStaleMs
    )
      return
    if (latest.current.hasRows) void latest.current.load(true, true)
    else if (latest.current.error) void latest.current.load(true)
  }, [focused, opts.refreshOnFocus, opts.refreshOnFocusStaleMs])

  const refresh = useCallback(() => load(true, true), [load])
  const reload = useCallback(() => load(true), [load])
  const loadMore = useCallback(() => load(false), [load])
  // PERF-FIX (state audit): objek return stabil via useMemo — consumer yang
  // memakai hasil sebagai dependency effect tidak re-run tiap render.
  return useMemo(
    () => ({
      data,
      setData,
      loading,
      refreshing,
      loadingMore,
      error,
      loadMoreError,
      hasMore,
      refresh,
      reload,
      loadMore,
    }),
    [
      data,
      loading,
      refreshing,
      loadingMore,
      error,
      loadMoreError,
      hasMore,
      refresh,
      reload,
      loadMore,
    ],
  )
}
