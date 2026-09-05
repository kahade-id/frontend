import { useCallback, useEffect, useRef, useState } from "react"
import { userMessage } from "@/lib/api/errors"

/** One generation per request: aborted/slow responses can never overwrite newer input. */
export function useApiQuery<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  enabled = true,
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
  const refresh = useCallback(() => load(true), [load])
  const reload = useCallback(() => load(), [load])
  return { data, setData, loading, refreshing, error, refresh, reload }
}
