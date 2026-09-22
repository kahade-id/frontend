import { useCallback, useEffect, useRef, useState } from "react"
import { useIsFocused } from "@react-navigation/native"
import { ApiError, userMessage } from "@/lib/api/errors"
import { getSessionRevision } from "@/lib/api/session"
import { useGuestPathBlocked } from "@/lib/guest-gate"

export type UseApiQueryOptions = {
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
}

/** Umur cache per key (ms) — pendek: dedupe navigasi bolak-balik, bukan offline store. */
export const QUERY_CACHE_TTL_MS = 5_000
/** Jumlah retry default untuk error transient (F-11). */
const DEFAULT_RETRY = 1
const RETRY_BACKOFF_MS = 800
/** Backoff maksimum yang dihormati dari Retry-After (jangan gantung UI menit-menitan). */
const RETRY_AFTER_CAP_MS = 10_000

type CacheEntry = { revision: number; at: number; data: unknown }
const queryCache = new Map<string, CacheEntry>()

function readQueryCache<T>(key: string): T | null {
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
  return entry.data as T
}

function writeQueryCache(key: string, data: unknown) {
  queryCache.set(key, { revision: getSessionRevision(), at: Date.now(), data })
}

/** Buang cache satu key / semua key (mis. setelah mutasi uang). */
export function invalidateQueryCache(key?: string): void {
  if (key === undefined) queryCache.clear()
  else queryCache.delete(key)
}

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
export function useApiQuery<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  enabled = true,
  opts: UseApiQueryOptions = {},
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
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(active)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (refresh = false) => {
      current.current?.abort()
      const controller = new AbortController()
      current.current = controller
      if (!active) {
        setLoading(false)
        setRefreshing(false)
        setError(null)
        setData(null)
        return
      }
      // F-03: cache per key — dua layar yang memakai data yang sama (mis.
      // saldo wallet di transfer & withdraw) tidak menembak GET ganda saat
      // berpindah dalam jendela TTL. Refresh manual/pull SELALU menembus.
      if (!refresh && opts.useCache !== false) {
        const cached = readQueryCache<T>(key)
        if (cached !== null) {
          setData(cached)
          setLoading(false)
          setRefreshing(false)
          setError(null)
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
      for (let attempt = 0; ; attempt += 1) {
        if (refresh) setRefreshing(true)
        else setLoading(true)
        setError(null)
        try {
          const next = await fetchRef.current(controller.signal)
          if (controller.signal.aborted) return
          setData(next)
          writeQueryCache(key, next)
          settle()
          return
        } catch (error) {
          if (controller.signal.aborted) return
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

  useEffect(() => {
    setData(null)
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
  return { data, setData, loading, refreshing, error, refresh, reload }
}
