import { useCallback, useEffect, useRef, useState } from "react"
import { useIsFocused } from "@react-navigation/native"
import { userMessage } from "@/lib/api/errors"
import { useGuestPathBlocked } from "@/lib/guest-gate"
import type { Page } from "@/lib/api/response"

export function mergeById<T extends { id: string }>(previous: T[], incoming: T[]): T[] {
  const values = new Map(previous.map((item) => [item.id, item]))
  for (const item of incoming) values.set(item.id, item)
  return [...values.values()]
}

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
export function byTimestampDesc<T>(pick: (item: T) => string | null | undefined) {
  const timeOf = (value: string | null | undefined) => {
    if (!value) return 0
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return (a: T, b: T) => timeOf(pick(b)) - timeOf(pick(a))
}

export type UsePaginatedQueryOptions<T> = {
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
}

/** Shared pagination for every long list: latest query wins, load-more single-flight, retry keeps rows. */
export function usePaginatedQuery<T extends { id: string }>(
  key: string,
  fetcher: (page: number, signal: AbortSignal) => Promise<Page<T>>,
  opts: UsePaginatedQueryOptions<T> = {},
) {
  const fetchRef = useRef(fetcher)
  fetchRef.current = fetcher
  const compareRef = useRef(opts.compare)
  compareRef.current = opts.compare
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
    async (reset: boolean, refresh = false) => {
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
        const result = await fetchRef.current(page, controller.signal)
        if (controller.signal.aborted) return
        if (reset) ids.current.clear()
        for (const item of result.data) ids.current.add(item.id)
        setData((previous) => {
          const merged = mergeById(reset ? [] : previous, result.data)
          const compare = compareRef.current
          return compare ? [...merged].sort(compare) : merged
        })
        nextPage.current = page + 1
        // F-09: `hasNewIds` sebelumnya menghentikan paginasi bila satu
        // halaman penuh berisi duplikat (backend menggeser urutan saat item
        // baru masuk di atas) — item lama jadi tak terjangkau padahal
        // `totalPages` mengatakan masih ada halaman. Duplikat sudah diurus
        // mergeById; sumber kebenaran "masih ada halaman" adalah meta server.
        hasNext.current = result.data.length > 0 && page < result.meta.totalPages
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

  useEffect(() => {
    ids.current.clear()
    setData([])
    setHasMore(false)
    nextPage.current = 1
    hasNext.current = true
    void load(true)
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
    if (latest.current.hasRows) void latest.current.load(true, true)
    else if (latest.current.error) void latest.current.load(true)
  }, [focused, opts.refreshOnFocus])

  const refresh = useCallback(() => load(true, true), [load])
  const reload = useCallback(() => load(true), [load])
  const loadMore = useCallback(() => load(false), [load])
  return {
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
  }
}
