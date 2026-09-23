import { useCallback, useEffect, useRef, useState } from "react"
import { useIsFocused } from "@react-navigation/native"
import { api, userMessage } from "@/lib/api"
import type { ShowcaseItem } from "@/lib/api/users"
import { useSessionRevision } from "@/lib/guest-gate"
import { useShowcaseDirtyVersion } from "@/lib/showcase-social-prefs"

/** Profile tab owns its request lifecycle independently from the other profile tabs. */
export function useProfileShowcase() {
  const [items, setItems] = useState<ShowcaseItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const target = useRef<string | null>(null)
  const revision = useSessionRevision()
  const version = useShowcaseDirtyVersion()
  const seen = useRef(version)
  const focused = useIsFocused()
  const fetch = useCallback((username: string) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    target.current = username
    setLoading(true)
    setError(null)
    void api.users.getPublicShowcase(username, controller.signal).then((result) => {
      if (!controller.signal.aborted) setItems(result)
    }).catch((err) => {
      if (!controller.signal.aborted) { setItems([]); setError(userMessage(err)) }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
  }, [])
  useEffect(() => {
    request.current?.abort()
    setItems([])
    if (target.current) fetch(target.current)
    return () => request.current?.abort()
  }, [revision, fetch])
  useEffect(() => {
    if (focused && version !== seen.current && target.current) {
      seen.current = version
      fetch(target.current)
    }
  }, [focused, version, fetch])
  return { items, loading, error, fetch }
}
