import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useIsFocused } from "expo-router"
import { ApiError, userMessage } from "@/lib/api/errors"
import { getSessionRevision, getSessionSnapshot } from "@/lib/api/session"
import { useGuestPathBlocked } from "@/lib/guest-gate"
import { isOfflineKnown, useIsOnline } from "@/lib/connectivity"
import {
  CACHE_REVALIDATE_AFTER_MS,
  markQueryRevalidating,
  onQueryCacheInvalidation,
  readPersistedQueryCacheEntry,
  readQueryCacheEntry,
  readQueryCacheStale,
  releaseQueryRevalidation,
  restoreQueryCacheEntry,
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
   * PERF-FIX (network P0): batasi refresh-on-focus agar tidak menembak
   * jaringan setiap kali layar kembali fokus. Bila di-set (ms), refresh saat
   * fokus DILEWATI bila entri cache untuk key ini masih lebih muda dari
   * ambang — layar tetap menampilkan data segar tanpa request. Mutasi yang
   * mengubah data WAJIB menginvalidasi key/prefix-nya (lihat
   * `invalidateQueryPrefix`) supaya perubahan tetap terlihat saat kembali.
   * Tanpa opsi ini perilaku lama dipertahankan (selalu refresh saat fokus).
   */
  refreshOnFocusStaleMs?: number
  /**
   * Percobaan ulang HOOK-LEVEL untuk error transient (NETWORK/TIMEOUT/SERVER).
   *
   * NC-002 (audit performa): DEFAULT = 0 (mati). Lapisan retry kini SATU
   * saja — di transport (`lib/api/client.ts`: backoff eksponensial 400/800ms
   * untuk GET + sinyal Retry-After via backpressure). Retry hook DAN retry
   * transport membuat satu GET gagal menembak hingga 4× (~1,6 dtk) sebelum
   * error offline muncul. Isi opsi ini (≥1) hanya bila fetcher TIDAK lewat
   * transport dan butuh retry; `retryAfterMs` dari ApiError dihormati
   * sebagai backoff minimum.
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

/**
 * Jumlah retry HOOK-LEVEL default untuk error transient.
 *
 * NC-002 (audit performa): 0 — retry hook dimatikan secara default karena
 * transport (`lib/api/client.ts`) sudah me-retry GET transient dengan
 * backoff eksponensial. Satu lapis retry = error offline muncul cepat
 * (bukan setelah ~1,6 dtk tumpukan retry hook×transport) dan radio seluler
 * tidak dibangunkan 4× sia-sia per layar. Retry eksplisit via opsi `retry`
 * tetap didukung untuk fetcher non-transport.
 */
const DEFAULT_RETRY = 0
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
  invalidateQueryPrefix,
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
  const online = useIsOnline()
  const current = useRef<AbortController | null>(null)
  const [raw, setRaw] = useState<TRaw | null>(null)
  const [loading, setLoading] = useState(active && !isOfflineKnown())
  const [offlineMiss, setOfflineMiss] = useState(active && isOfflineKnown())
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  /**
   * T4-008 (audit UI/UX intuitif 2026-09-29): error NON-FATAL dari refresh
   * (pull-to-refresh / refresh-on-focus / revalidasi) yang gagal padahal
   * data lama sudah ada. Data lama tetap tampil; konsumen (DataScreen)
   * menampilkan banner inline "Gagal memperbarui" alih-alih menghancurkan
   * layar dengan ErrorState penuh. `error` tetap untuk kegagalan fatal
   * (load awal tanpa data).
   */
  const [refreshError, setRefreshError] = useState<string | null>(null)
  /**
   * Ada/tidaknya data — dibaca di dalam `load` (callback yang di-memo)
   * supaya keputusan fatal-vs-refresh memakai nilai terbaru, bukan yang
   * tertangkap saat callback dibuat. Nilainya ditulis tiap render di bawah
   * (setelah `data` dihitung).
   */
  const hasData = useRef(false)

  const load = useCallback(
    async (refresh = false, background = false) => {
      setErrorStatus(null)
      current.current?.abort()
      const controller = new AbortController()
      current.current = controller
      const requestSessionRevision = getSessionRevision()
      const releaseMarker = () => {
        if (background) releaseQueryRevalidation(key)
      }
      if (!active) {
        setLoading(false)
        setRefreshing(false)
        setError(null)
        setOfflineMiss(false)
        // T4-008: ikut direset — data ikut di-nul-kan di bawah.
        setRefreshError(null)
        setRaw(null)
        releaseMarker()
        return
      }
      /**
       * Cache-first offline: read stale memory, then the persistent native
       * snapshot. An offline cache miss is a neutral empty state, not an API
       * error, and must not send a request that cannot succeed.
       */
      if (isOfflineKnown()) {
        releaseMarker()
        const hit =
          readQueryCacheStale<TRaw>(key) ?? (await readPersistedQueryCacheEntry<TRaw>(key))
        if (controller.signal.aborted || requestSessionRevision !== getSessionRevision()) return
        if (hit !== null) {
          restoreQueryCacheEntry(key, hit.data, hit.at)
          setRaw(hit.data)
          setOfflineMiss(false)
        } else {
          setRaw(null)
          setOfflineMiss(true)
        }
        setLoading(false)
        setRefreshing(false)
        setError(null)
        setRefreshError(null)
        return
      }
      // F-03: cache per key — dua layar yang memakai data yang sama (mis.
      // saldo wallet di Beranda & Dompet) tidak menembak GET ganda saat
      // berpindah dalam jendela TTL. Refresh manual/pull SELALU menembus.
      if (!refresh && !background && opts.useCache !== false) {
        const cached = readQueryCacheEntry<TRaw>(key)
        if (cached !== null) {
          setRaw(cached.data)
          setOfflineMiss(false)
          setLoading(false)
          setRefreshing(false)
          setError(null)
          // T4-008: cache-hit juga membersihkan banner refresh-error lama —
          // data segar dari cache berarti tidak ada lagi yang perlu
          // diperingatkan.
          setRefreshError(null)
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
        const persisted = await readPersistedQueryCacheEntry<TRaw>(key)
        if (controller.signal.aborted || requestSessionRevision !== getSessionRevision()) return
        if (persisted !== null) {
          restoreQueryCacheEntry(key, persisted.data, persisted.at)
          setRaw(persisted.data)
          setOfflineMiss(false)
          setLoading(false)
          setRefreshing(false)
          setError(null)
          setRefreshError(null)
          if (
            Date.now() - persisted.at >= CACHE_REVALIDATE_AFTER_MS &&
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
        setOfflineMiss(false)
        // T4-008: banner refresh-error lama ikut dibersihkan saat percobaan
        // baru dimulai — ia akan muncul lagi bila percobaan ini juga gagal.
        if (!background) setRefreshError(null)
        try {
          const next = await fetchRef.current(controller.signal)
          if (
            controller.signal.aborted ||
            requestSessionRevision !== getSessionRevision()
          ) {
            releaseMarker()
            return
          }
          setRaw(next)
          setOfflineMiss(false)
          writeQueryCache(key, next)
          if (!background) settle()
          // Penyegaran latar selesai: pastikan penanda cache dilepas.
          else releaseQueryRevalidation(key)
          return
        } catch (error) {
          if (
            controller.signal.aborted ||
            requestSessionRevision !== getSessionRevision()
          ) {
            releaseMarker()
            return
          }
          if (isOfflineKnown()) {
            const cached =
              readQueryCacheStale<TRaw>(key) ?? (await readPersistedQueryCacheEntry<TRaw>(key))
            if (
              controller.signal.aborted ||
              requestSessionRevision !== getSessionRevision()
            ) return
            if (cached !== null) {
              restoreQueryCacheEntry(key, cached.data, cached.at)
              setRaw(cached.data)
              setOfflineMiss(false)
            } else {
              setRaw(null)
              setOfflineMiss(true)
            }
            setError(null)
            setRefreshError(null)
            setErrorStatus(null)
            settle()
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
          // F-11 / NC-002: retry transient OPT-IN via opsi `retry` (fetcher
          // non-transport — hook ini memang hanya GET). Default mati:
          // transport sudah me-retry, jadi retry ganda bertumpuk dilarang.
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
          // T4-008: gagal memuat padahal data lama sudah tampil → error
          // NON-FATAL, apa pun pemicunya (refresh maupun reload). Data lama
          // tetap sahih; layar tidak dihancurkan (konsumen menampilkan
          // banner inline via `refreshError`). Tanpa data sama sekali →
          // error fatal seperti sebelumnya.
          const msg = userMessage(error)
          if (hasData.current) setRefreshError(msg)
          else {
            setError(msg)
            setErrorStatus(error instanceof ApiError ? error.status ?? null : null)
          }
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
    setOfflineMiss(active && isOfflineKnown())
    void load()
    return () => current.current?.abort()
  }, [load, active])

  const previousOnline = useRef(online)
  useEffect(() => {
    const wasOnline = previousOnline.current
    previousOnline.current = online
    if (!active || wasOnline === online) return
    if (!online) {
      // Resolve the cache-first offline state immediately; this also clears a
      // prior network message without replacing already-rendered data.
      void load()
    } else if (hasData.current) {
      // A reconnect refreshes stale data in the background, keeping it visible.
      void load(true, true)
    } else {
      void load()
    }
  }, [online, active, load])

  /**
   * R2 (audit ronde-2, butir #20): revalidate diam-diam saat cache
   * diinvalidasi global — mis. notifikasi foreground masuk (pesanan lawan
   * transaksi berubah status) atau mutasi uang selesai. Dulu invalidasi hanya
   * membersihkan cache sehingga layar yang SEDANG tampil tetap menampilkan
   * data basi sampai pull-to-refresh manual; kini hook yang terpasang ikut
   * menyegarkan di latar (tanpa spinner, penanda revalidasi tunggal mencegah
   * tembakan ganda lintas-hook).
   * PERF-FIX (network P1): invalidasi PREFIX hanya membangunkan hook yang
   * kuncinya cocok (filter `scope` di bawah) — push chat tidak me-refresh
   * layar dompet, dsb.
   */
  useEffect(() => {
    if (!active) return
    return onQueryCacheInvalidation((scope) => {
      if (!latest.current.enabled) return
      /**
       * NS-007 (audit performa): lewati revalidasi bila tidak ada sesi.
       * `clearSession()` (logout) memicu `invalidateQueryCache()` tanpa
       * argumen — tanpa guard ini, semua layar yang masih mount menembak
       * ulang dan langsung 401 (token sudah null): badai request sia-sia +
       * risiko `emitSessionExpired` redundan. `getSessionSnapshot()` sinkron
       * (cache dalam-memori); null = tidak ada token yang diketahui.
       * Aman: hook tetap memuat awal saat mount via effect `[load]`.
       */
      if (getSessionSnapshot() == null) return
      /**
       * PERF-FIX (network P1): invalidasi terarah — hanya revalidasi bila
       * kunci query ini termasuk dalam cakupan. `scope === undefined` =
       * invalidasi penuh (perilaku lama). Push foreground kini hanya
       * membangunkan layar yang datanya benar-benar berubah.
       */
      if (scope !== undefined) {
        const inScope =
          scope.keys?.includes(key) === true ||
          scope.prefixes?.some((prefix) => key.startsWith(prefix)) === true
        if (!inScope) return
      }
      if (markQueryRevalidating(key)) void latest.current.load(true, true)
    })
  }, [active, key])

  // Refresh saat layar kembali fokus — lihat UseApiQueryOptions.refreshOnFocus.
  const focused = useIsFocused()
  // Ditulis tiap render (setelah `data` dihitung di atas); deklarasi ref-nya
  // di atas supaya `load` bisa membedakan error fatal vs refreshError.
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
      // PERF-FIX (network P0): lewati refresh bila data cache masih segar —
      // pindah tab bolak-balik dalam hitungan detik tidak mengunduh ulang.
      if (opts.refreshOnFocusStaleMs != null) {
        const cached = readQueryCacheEntry(key)
        if (cached !== null && Date.now() - cached.at < opts.refreshOnFocusStaleMs) return
      }
      void latest.current.load(true)
      return
    }
    // F-02: layar yang gagal muat (error, tanpa data) dipulihkan saat fokus —
    // reload penuh (bukan silent refresh) agar skeleton/retry terlihat jujur.
    if (latest.current.error) void latest.current.load()
    // Sengaja hanya reaksi pada transisi fokus; load/enabled dibaca lewat ref
    // agar perubahan fetcher tidak memicu muat ulang ganda (effect [load]
    // di atas sudah menangani itu).
  }, [focused, opts.refreshOnFocus, opts.refreshOnFocusStaleMs])

  const refresh = useCallback(() => load(true), [load])
  const reload = useCallback(() => load(), [load])
  /**
   * `setData` menerima nilai BAKU (bukan hasil `select`) — dipakai layar untuk
   * pembaruan optimistis (mis. buka/tutup status di daftar). Dokumentasi ini
   * penting karena tipe `data` sudah diproyeksikan.
   *
   * G-02 (audit escrow 2026-09-24): tulisan manual `setData` MEMBATALKAN
   * request yang masih berjalan — respons basi dari fetch yang berangkat
   * sebelum aksi tidak boleh menimpa hasil aksi (balapan `setData` vs
   * `refresh` di detail sengketa: pesan terkirim hilang saat refresh lama
   * mendarat belakangan).
   *
   * M-05 (audit escrow 2026-09-24): objek hasil di-memo — dulu literal baru
   * tiap render membuat callback layar (`handlePayPin`, `runAction`) yang
   * memasukkan `query` ke dep array dibuat ulang terus-menerus.
   */
  const setData = useCallback<typeof setRaw>((value) => {
    current.current?.abort()
    setRaw(value)
    setOfflineMiss(false)
  }, [])

  return useMemo(
    () => ({
      data,
      setData,
      loading,
      refreshing,
      error,
      errorStatus,
      refreshError,
      offline: !online,
      offlineMiss,
      refresh,
      reload,
    }),
    [data, setData, loading, refreshing, error, errorStatus, refreshError, online, offlineMiss, refresh, reload],
  )
}
