/**
 * Schedule after settlement, not setInterval: never overlaps requests or polls hidden screens.
 * C-05 (audit): tiap tick membuat AbortController — request yang masih
 * terbang dibatalkan saat layar ditutup, param berganti, atau app pindah ke
 * background, sehingga respons basi tidak pernah menyentuh state.
 */

import { useEffect, useRef } from "react"
import { AppState, Platform } from "react-native"
import { useIsFocused } from "@react-navigation/native"

export function usePolling(
  callback: (signal: AbortSignal) => Promise<unknown>,
  intervalMs: number,
  enabled = true,
) {
  const latest = useRef(callback)
  latest.current = callback
  const running = useRef(false)
  const focused = useIsFocused()
  useEffect(() => {
    if (!enabled || !focused) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let inflight: AbortController | null = null
    const visible = () =>
      (AppState.currentState == null || AppState.currentState === "active") &&
      (Platform.OS !== "web" ||
        typeof document === "undefined" ||
        document.visibilityState === "visible")
    const schedule = () => {
      if (!cancelled && visible()) timer = setTimeout(tick, intervalMs)
    }
    const tick = async () => {
      if (cancelled || !visible()) return
      if (running.current) {
        schedule()
        return
      }
      running.current = true
      inflight = new AbortController()
      try {
        await latest.current(inflight.signal)
      } catch {
        /* caller owns visible error state */
      } finally {
        running.current = false
        inflight = null
        schedule()
      }
    }
    const onVisibility = () => {
      clearTimeout(timer)
      if (visible()) void tick()
      else inflight?.abort()
    }
    schedule()
    const subscription = AppState.addEventListener("change", onVisibility)
    if (Platform.OS === "web" && typeof document !== "undefined")
      document.addEventListener("visibilitychange", onVisibility)
    return () => {
      cancelled = true
      clearTimeout(timer)
      inflight?.abort()
      subscription.remove()
      if (Platform.OS === "web" && typeof document !== "undefined")
        document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [enabled, focused, intervalMs])
}
