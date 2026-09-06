import { useCallback, useEffect, useRef, useState } from "react"
import { useIsFocused } from "@react-navigation/native"
import { userMessage } from "@/lib/api/errors"

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
   */
  refreshOnFocus?: boolean
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
  const current = useRef<AbortController | null>(null)
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (refresh = false) => {
      current.current?.abort()
      const controller = new AbortController()
      current.current = controller
      if (!enabled) {
        setLoading(false)
        setRefreshing(false)
        setError(null)
        setData(null)
        return
      }
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const next = await fetchRef.current(controller.signal)
        if (!controller.signal.aborted) setData(next)
      } catch (error) {
        if (!controller.signal.aborted) setError(userMessage(error))
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [key, enabled],
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
  const latest = useRef({ load, enabled })
  latest.current = { load, enabled }
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
    if (!latest.current.enabled || !hasData.current) return
    void latest.current.load(true)
    // Sengaja hanya reaksi pada transisi fokus; load/enabled dibaca lewat ref
    // agar perubahan fetcher tidak memicu muat ulang ganda (effect [load]
    // di atas sudah menangani itu).
  }, [focused, opts.refreshOnFocus])

  const refresh = useCallback(() => load(true), [load])
  const reload = useCallback(() => load(), [load])
  return { data, setData, loading, refreshing, error, refresh, reload }
}
