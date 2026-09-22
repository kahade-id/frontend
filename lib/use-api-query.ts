import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useIsFocused } from "@react-navigation/native"
import { ApiError, userMessage } from "@/lib/api/errors"
import { useGuestPathBlocked } from "@/lib/guest-gate"
import {
  CACHE_REVALIDATE_AFTER_MS,
  markQueryRevalidating,
  readQueryCacheEntry,
  releaseQueryRevalidation,
  writeQueryCache,
} from "@/lib/query-cache"

export type UseApiQueryOptions<TRaw = unknown, T = TRaw> = {
  /**
   * Muat ulang (diam, mode `refresh`) setiap kali layar kembali fokus.
   *
   * Kenapa perlu (non-obvious): layar tab di Expo Router TETAP TER-MOUNT
   * selama app hidup, jadi `useEffect` muat-awal hanya berjalan sekali per
   * sesi. Tanpa refresh-on-focus, saldo di tab Dompet/Beranda tidak pernah
   * diperbarui setelah top-up/withdraw/transfer di layar lain — pengguna
   * harus tahu kalau angka itu basi dan menarik-untuk-menyegarkan manual.
   * Untuk angka uang, tampilan basi adalah bug kebenaran, bukan perf.
   *
   * F-02 (audit 2026-09-20): fokus ulang JUGA memulihkan layar yang muat
   * awalnya GAGAL — sebelumnya `if (!hasData) return` membuat error state
   * menetap selamanya meski jaringan sudah pulih.
   */
  refreshOnFocus?: boolean
  /**
   * Percobaan ulang otomatis untuk error transient (NETWORK/TIMEOUT/SERVER).
   * F-11: default 1 (satu retry, backoff 800 ms) — jaringan seluler goyah
   * sekali tidak boleh memaksa interaksi manual. `retryAfterMs` dari
   * transport (429/503) dihormati sebagai backoff minimum.
   */
  retry?: number
  /**
   * Lewati request bila cache global per `key` masih segar (F-03). Default
   * true. `refresh()`/pull-to-refresh SELALU menembus cache.
   */
  useCache?: boolean
  /**
   * C-02 (audit): turunkan nilai yang dipakai UI dari respons BAKU yang
   * di-cache — bukan dari request terpisah di bawah kunci sendiri.
   *
   * Contoh: `app/withdraw.tsx` hanya butuh `{ balance }` sementara Beranda
   * butuh seluruh `WalletData`. Dulu keduanya memakai kunci berbeda supaya
   * bentuknya boleh berbeda; akibatnya GET /v1/wallet tidak pernah ter-dedupe
   * dan invalidasi cache tidak menjangkau semua salinan. Dengan `select`,
   * yang di-cache tetap satu bentuk (respons baku) dan proyeksi per layar
   * dihitung dari situ.
   */
  select?: (raw: TRaw) => T
}

/** Jumlah retry default untuk error transient (F-11). */
const DEFAULT_RETRY = 1
const RETRY_BACKOFF_MS = 800
/** Backoff maksimum yang dihormati dari Retry-After (jangan gantung UI menit-menitan). */
const RETRY_AFTER_CAP_MS = 10_000

/**
 * Cache + kebijakan kesegarannya hidup di `lib/query-cache.ts` supaya lapisan
 * adapter (`lib/api/*`) bisa membatalkannya setelah mutasi uang (C-01) tanpa
 * menarik React. Di sini hanya pemakaiannya.
 */
export {
  CACHE_REVALIDATE_AFTER_MS,
  invalidateQueryCache,
  QUERY_CACHE_TTL_MS,
  queryCacheSize,
} from "@/lib/query-cache"

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new ApiError({ code: "ABORTED", message: "Permintaan dibatalkan." }))
    }
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

/** One generation per request: aborted/slow responses can never overwrite newer input. */
export function useApiQuery<TRaw, T = TRaw>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<TRaw>,
  enabled = true,
  opts: UseApiQueryOptions<TRaw, T> = {},
) {
  const fetchRef = useRef(fetcher)
  fetchRef.current = fetcher
  /**
   * B-03 (audit): layar ber-auth yang sedang tertutup <GuestLoginPrompt>
   * (tamu web) TIDAK boleh menembak endpoint `auth:"required"` — layar di
   * balik lapisan itu tetap ter-mount, jadi tanpa gerbang ini tiap deep link
   * tamu ke /order/x, /kyc, /settings menghasilkan 401 → refresh → potensi
   * `expireSession` yang tidak pernah bisa berhasil. Gerbangnya terpusat di
   * `lib/guest-gate.ts` supaya definisinya sama dengan yang dipakai root
   * layout saat memunculkan lapisan login.
   */
  const guestBlocked = useGuestPathBlocked()
  const active = enabled && !guestBlocked
  const current = useRef<AbortController | null>(null)
  const [raw, setRaw] = useState<TRaw | null>(null)
  const [loading, setLoading] = useState(active)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (refresh = false, background = false) => {
      current.current?.abort()
      const controller = new AbortController()
      current.current = controller
      const releaseMarker = () => {
        if (background) releaseQueryRevalidation(key)
      }
      if (!active) {
        setLoading(false)
        setRefreshing(false)
        setError(null)
        setRaw(null)
        releaseMarker()
        return
      }
      // F-03: cache per key — dua layar yang memakai data yang sama (mis.
      // saldo wallet di Beranda & Dompet) tidak menembak GET ganda saat
      // berpindah dalam jendela TTL. Refresh manual/pull SELALU menembus.
      if (!refresh && !background && opts.useCache !== false) {
        const cached = readQueryCacheEntry<TRaw>(key)
        if (cached !== null) {
          setRaw(cached.data)
          setLoading(false)
          setRefreshing(false)
          setError(null)
          /**
           * C-04 (audit): stale-while-revalidate. Entri yang sudah berumur
           * melewati CACHE_REVALIDATE_AFTER_MS TIDAK boleh disajikan sebagai
           * data segar tanpa verifikasi — jalankan penyegaran DIAM di latar
           * (tanpa spinner, tanpa mengubah data sampai hasilnya datang).
           * Penanda `revalidating` menjaga agar beberapa layar dengan kunci
           * sama tidak memicu beberapa request sekaligus.
           */
          if (
            !cached.revalidating &&
            Date.now() - cached.at >= CACHE_REVALIDATE_AFTER_MS &&
            markQueryRevalidating(key)
          ) {
            void load(true, true)
          }
          return
        }
      }
      const maxAttempts = 1 + Math.max(0, opts.retry ?? DEFAULT_RETRY)
      const settle = () => {
        if (!controller.signal.aborted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
      /**
       * C-04 (audit): penanda `revalidating` WAJIB dilepas pada SEMUA jalan
       * keluar saat mode latar — termasuk saat request dibatalkan (unmount,
       * ganti kunci, atau load berikutnya). Tanpa ini satu pembatalan membuat
       * penanda tertinggal `true` selamanya, dan sejak itu kunci tersebut
       * tidak pernah lagi disegarkan di latar: layar menyajikan data basi
       * tanpa verifikasi — persis bug yang ingin dihilangkan C-04.
       */
      for (let attempt = 0; ; attempt += 1) {
        if (background) {
          // Diam: data lama tetap tampil, tanpa spinner (C-04). Ini yang
          // membedakan "menyegarkan di belakang" dari pull-to-refresh.
        } else if (refresh) setRefreshing(true)
        else setLoading(true)
        if (!background) setError(null)
        try {
          const next = await fetchRef.current(controller.signal)
          if (controller.signal.aborted) {
            releaseMarker()
            return
          }
          setRaw(next)
          writeQueryCache(key, next)
          if (!background) settle()
          // Penyegaran latar selesai: pastikan penanda cache dilepas.
          else releaseQueryRevalidation(key)
          return
        } catch (error) {
          if (controller.signal.aborted) {
            releaseMarker()
            return
          }
          // Kegagalan penyegaran latar BUKAN galat layar: data lama tetap
          // sahih sampai pembacaan berikutnya gagal di jalur normal. Penanda
          // dilepas supaya pembacaan berikutnya boleh mencoba lagi (kalau
          // tidak, satu kegagalan jaringan mematikan SWR untuk kunci ini).
          if (background) {
            releaseQueryRevalidation(key)
            return
          }
          // F-11: retry transient (GET idempoten — hook ini memang hanya GET).
          // Selama menunggu retry, `loading` SENGAJA tidak dimatikan —
          // daftar/skeleton tidak boleh berkedip di antara dua percobaan.
          const transient = error instanceof ApiError && error.isTransient
          if (transient && attempt < maxAttempts - 1) {
            const retryAfter = error instanceof ApiError ? error.retryAfterMs : undefined
            const backoff = Math.min(
              Math.max(RETRY_BACKOFF_MS * (attempt + 1), retryAfter ?? 0),
              RETRY_AFTER_CAP_MS,
            )
            try {
              await sleep(backoff, controller.signal)
              continue
            } catch {
              return // aborted saat menunggu
            }
          }
          setError(userMessage(error))
          settle()
          return
        }
      }
    },
    [key, active, opts.retry, opts.useCache],
  )

  /**
   * C-02 (audit): `select` dijalankan dari nilai BAKU yang di-cache, jadi
   * bentuk proyeksi tidak pernah masuk cache dan tidak bisa dibaca layar lain
   * yang mengharapkan respons penuh.
   */
  const selectRef = useRef(opts.select)
  selectRef.current = opts.select
  const data = useMemo<T | null>(() => {
    if (raw === null) return null
    return selectRef.current ? selectRef.current(raw) : (raw as unknown as T)
  }, [raw])

  useEffect(() => {
    setRaw(null)
    void load()
    return () => current.current?.abort()
  }, [load])

  // Refresh saat layar kembali fokus — lihat UseApiQueryOptions.refreshOnFocus.
  const focused = useIsFocused()
  const hasData = useRef(false)
  hasData.current = data != null
  const latest = useRef({ load, enabled: active, error })
  latest.current = { load, enabled: active, error }
  const everFocused = useRef(false)
  useEffect(() => {
    if (!opts.refreshOnFocus) return
    // Fokus pertama (mount) = muat awal yang sudah dijalankan effect di atas;
    // lewati. Blur tidak me-reset penanda: setiap fokus BERIKUTNYA memuat
    // ulang, bukan kembali diperlakukan sebagai muat pertama.
    if (!everFocused.current) {
      everFocused.current = true
      return
    }
    if (!focused) return
    if (!latest.current.enabled) return
    if (hasData.current) {
      void latest.current.load(true)
      return
    }
    // F-02: layar yang gagal muat (error, tanpa data) dipulihkan saat fokus —
    // reload penuh (bukan silent refresh) agar skeleton/retry terlihat jujur.
    if (latest.current.error) void latest.current.load()
    // Sengaja hanya reaksi pada transisi fokus; load/enabled dibaca lewat ref
    // agar perubahan fetcher tidak memicu muat ulang ganda (effect [load]
    // di atas sudah menangani itu).
  }, [focused, opts.refreshOnFocus])

  const refresh = useCallback(() => load(true), [load])
  const reload = useCallback(() => load(), [load])
  /**
   * `setData` menerima nilai BAKU (bukan hasil `select`) — dipakai layar untuk
   * pembaruan optimistis (mis. buka/tutup status di daftar). Dokumentasi ini
   * penting karena tipe `data` sudah diproyeksikan.
   */
  return { data, setData: setRaw, loading, refreshing, error, refresh, reload }
}
