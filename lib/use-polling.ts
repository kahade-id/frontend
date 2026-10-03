/**
 * Schedule after settlement, not setInterval: never overlaps requests or polls hidden screens.
 * C-05 (audit): tiap tick membuat AbortController — request yang masih
 * terbang dibatalkan saat layar ditutup, param berganti, atau app pindah ke
 * background, sehingga respons basi tidak pernah menyentuh state.
 */

import { useEffect, useRef, useSyncExternalStore } from "react"
import { AppState, Platform } from "react-native"
import { useIsFocused } from "@react-navigation/native"
import { backpressureRemainingMs } from "@/lib/api/backpressure"
import { isOfflineKnown, onReconnect } from "@/lib/connectivity"
import {
  hasBlockingOverlay,
  subscribeBlockingOverlay,
} from "@/lib/overlay-visibility"

export type UsePollingOptions = {
  /**
   * P1-5 (audit perf-UX 2026-10-03): true = jeda polling saat overlay
   * pemblokir (Modal/BottomSheet) menutupi layar. Default false karena
   * layar pembayaran BUTUH polling tetap jalan di balik modal (by design).
   * Aktifkan untuk layar non-kritis (daftar notifikasi, dsb).
   */
  pauseWhenCovered?: boolean
}

export function usePolling(
  callback: (signal: AbortSignal) => Promise<unknown>,
  intervalMs: number,
  enabled = true,
  options?: UsePollingOptions,
) {
  const latest = useRef(callback)
  latest.current = callback
  const running = useRef(false)
  const focused = useIsFocused()
  // Hanya berlangganan bila opt-in — hindari render ulang yang tidak perlu
  // untuk layar pembayaran yang memang butuh polling di balik modal.
  const covered = useSyncExternalStore(
    subscribeBlockingOverlay,
    hasBlockingOverlay,
    () => false,
  )
  const pauseWhenCovered = options?.pauseWhenCovered ?? false
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
        document.visibilityState === "visible") &&
      // P1-5: jeda saat overlay pemblokir menutupi layar (hanya bila opt-in).
      !(pauseWhenCovered && covered)
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
      /**
       * NC-005 (audit performa): gerbang konektivitas. Saat NetInfo PASTI
       * melaporkan offline, tick DILEWATI — jangan tembak jaringan. Callback
       * pemanggil menerjemahkan tiap kegagalan menjadi error terlihat (mis.
       * Alert "Tidak ada koneksi" di app/topup.tsx yang berkedip tiap tick)
       * padahal banner offline global sudah menjelaskan situasinya. Lewati +
       * jadwalkan ulang; saat reconnect, listener `onReconnect` di bawah
       * menembak segera.
       */
      if (isOfflineKnown()) {
        schedule()
        return
      }
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
    /**
     * NC-005 (audit performa): kembali online → tembak SEGERA, jangan tunggu
     * sisa interval (layar pembayaran langsung memverifikasi status).
     * `schedule()` juga terus berjalan saat offline, jadi polling pulih
     * otomatis walau event ini terlewat.
     */
    const stopReconnect = onReconnect(() => {
      if (cancelled) return
      clearTimeout(timer)
      if (visible()) void tick()
    })
    if (Platform.OS === "web" && typeof document !== "undefined")
      document.addEventListener("visibilitychange", onVisibility)
    return () => {
      cancelled = true
      clearTimeout(timer)
      inflight?.abort()
      subscription.remove()
      stopReconnect()
      if (Platform.OS === "web" && typeof document !== "undefined")
        document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [enabled, focused, intervalMs, pauseWhenCovered, covered])
}
