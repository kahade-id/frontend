import { useCallback, useEffect, useRef, useState } from "react"
import { userMessage } from "@/lib/api/errors"
import type { Page } from "@/lib/api/response"

export function mergeById<T extends { id: string }>(previous: T[], incoming: T[]): T[] {
  const values = new Map(previous.map((item) => [item.id, item]))
  for (const item of incoming) values.set(item.id, item)
  return [...values.values()]
}

/** Shared pagination for every long list: latest query wins, load-more single-flight, retry keeps rows. */
export function usePaginatedQuery<T extends { id: string }>(
  key: string,
  fetcher: (page: number, signal: AbortSignal) => Promise<Page<T>>,
) {
  const fetchRef = useRef(fetcher)
  fetchRef.current = fetcher
  const active = useRef<AbortController | null>(null)
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

  const load = useCallback(
    async (reset: boolean, refresh = false) => {
      if (!reset && (busy.current || !hasNext.current)) return
      if (reset) active.current?.abort()
      const controller = new AbortController()
      active.current = controller
      busy.current = true
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
        const hasNewIds = result.data.some((item) => !ids.current.has(item.id))
        if (reset) ids.current.clear()
        for (const item of result.data) ids.current.add(item.id)
        setData((previous) => mergeById(reset ? [] : previous, result.data))
        nextPage.current = page + 1
        hasNext.current =
          result.data.length > 0 && (reset || hasNewIds) && page < result.meta.totalPages
        setHasMore(hasNext.current)
      } catch (error) {
        if (controller.signal.aborted) return
        if (reset) setError(userMessage(error))
        else setLoadMoreError(userMessage(error))
      } finally {
        if (active.current === controller) {
          busy.current = false
          if (!controller.signal.aborted) {
            setLoading(false)
            setLoadingMore(false)
            setRefreshing(false)
          }
        }
      }
    },
    [key],
  )

  useEffect(() => {
    ids.current.clear()
    setData([])
    setHasMore(false)
    nextPage.current = 1
    hasNext.current = true
    void load(true)
    return () => {
      active.current?.abort()
      busy.current = false
    }
  }, [load])
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
