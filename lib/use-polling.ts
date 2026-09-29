/**
 * Schedule after settlement, not setInterval: never overlaps requests or polls hidden screens.
 * C-05 (audit): tiap tick membuat AbortController — request yang masih
 * terbang dibatalkan saat layar ditutup, param berganti, atau app pindah ke
 * background, sehingga respons basi tidak pernah menyentuh state.
 */

import { useEffect, useRef } from "react"
import { AppState, Platform } from "react-native"
import { useIsFocused } from "@react-navigation/native"
import { backpressureRemainingMs } from "@/lib/api/backpressure"

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
    /**
     * PERF-FIX (network P1): iOS mengenal status `inactive` (transisi
     * foreground ↔ background, mis. Control Center / panggilan masuk) —
     * sebelumnya hanya `active` yang dianggap terlihat sehingga polling
     * terus menembak saat app setengah-tersembunyi. Kini hanya `active`
     * (dan `null` = tidak diketahui, mis. beberapa build web) yang
     * dianggap terlihat.
     */
    const visible = () =>
      (AppState.currentState == null || AppState.currentState === "active") &&
      (Platform.OS !== "web" ||
        typeof document === "undefined" ||
        document.visibilityState === "visible")
    /**
     * C-09 (audit): interval EFEKTIF = max(interval permintaan, cooldown server).
     *
     * Backend yang membalas 429/503 berantai (mis. endpoint payment-status saat
     * insiden) dulu tetap ditembak pada interval tetap selama sesi pengguna,
     * karena `retryAfterMs` hanya dibaca jalur retry `useApiQuery`. Callback
     * polling yang menelan galatnya sendiri tidak bisa melihatnya — jadi
     * sinyalnya diambil dari transport (`lib/api/backpressure.ts`).
     *
     * PERF-FIX (network P1): + jitter ±15% per tick — puluhan perangkat yang
     * membuka layar yang sama pada detik yang sama (mis. setelah push massal)
     * tidak lagi menembak server dalam gelombang sinkron (thundering herd).
     */
    const schedule = () => {
      if (cancelled || !visible()) return
      const base = Math.max(intervalMs, backpressureRemainingMs())
      const jitter = base * 0.15 * (Math.random() * 2 - 1)
      timer = setTimeout(tick, Math.max(1_000, Math.round(base + jitter)))
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
