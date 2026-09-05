import { useCallback, useEffect, useState } from "react"
import { api, userMessage, type OtpMethod } from "@/lib/api"

/** Fail closed: an unavailable channel must never be offered as a hardcoded fallback. */
export type OtpMethodsState = {
  methods: OtpMethod[]
  loading: boolean
  error: string | null
  source: "server" | null
  refetch: () => void
}
export function useOtpMethods(): OtpMethodsState {
  const [methods, setMethods] = useState<OtpMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<"server" | null>(null)
  const [tick, setTick] = useState(0)
  const refetch = useCallback(() => setTick((v) => v + 1), [])
  useEffect(() => {
    let alive = true
    setLoading(true)
    setMethods([])
    setError(null)
    api.auth
      .getOtpMethods()
      .then((res) => {
        if (!alive) return
        setMethods(res.methods)
        setSource("server")
        if (!res.methods.length)
          setError("Pengiriman kode belum tersedia. Silakan coba lagi nanti.")
      })
      .catch((error: unknown) => {
        if (!alive) return
        setSource(null)
        setError(userMessage(error))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [tick])
  return { methods, loading, error, source, refetch }
}
