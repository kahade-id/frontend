import { useEffect, useRef } from "react"
import { AppState, Platform } from "react-native"
import { useIsFocused } from "@react-navigation/native"

/** Schedule after settlement, not setInterval: never overlaps requests or polls hidden screens. */
export function usePolling(callback: () => Promise<unknown>, intervalMs: number, enabled = true) {
  const latest = useRef(callback)
  latest.current = callback
  const running = useRef(false)
  const focused = useIsFocused()
  useEffect(() => {
    if (!enabled || !focused) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
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
      try {
        await latest.current()
      } catch {
        /* caller owns visible error state */
      } finally {
        running.current = false
        schedule()
      }
    }
    const onVisibility = () => {
      clearTimeout(timer)
      if (visible()) void tick()
    }
    schedule()
    const subscription = AppState.addEventListener("change", onVisibility)
    if (Platform.OS === "web" && typeof document !== "undefined")
      document.addEventListener("visibilitychange", onVisibility)
    return () => {
      cancelled = true
      clearTimeout(timer)
      subscription.remove()
      if (Platform.OS === "web" && typeof document !== "undefined")
        document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [enabled, focused, intervalMs])
}
