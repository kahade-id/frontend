import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { getSessionSnapshot, subscribeSession } from "@/lib/api/session"
import { planSessionRestore, verifySessionInBackground } from "@/lib/auth-restore"
import { userMessage } from "@/lib/api/errors"

/** B-05 (audit): snapshot server = "belum ada sesi", sepadan dengan store. */
const serverSnapshot = () => null
export function useAuthSession() {
  const token = useSyncExternalStore(subscribeSession, getSessionSnapshot, serverSnapshot)
  const [restoring, setRestoring] = useState(true)
  /**
   * ST-002 (PERF-FIX 2026-09-29): verifikasi refresh token sedang berjalan di
   * background. Render TIDAK diblokir — bernilai true hanya di jendela antara
   * "fase lokal selesai" dan "hasil refresh tiba".
   */
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setRestoring(true)
    setVerifying(false)
    setError(null)
    async function restore() {
      try {
        // Fase 1 — LOKAL SAJA (SecureStore, milidetik): tidak ada jaringan
        // yang boleh menahan render pertama. Lihat lib/auth-restore.ts.
        const plan = await planSessionRestore()
        // Fase lokal selesai → aplikasi boleh dirender. Inilah perbaikan
        // ST-002: sebelumnya `setRestoring(false)` menunggu 1 RTT refresh.
        if (alive) setRestoring(false)
        if (plan.kind !== "verify") return
        // Fase 2 — refresh token di background (non-blocking). Gagal
        // verifikasi (401/403) → sesi dibersihkan + redirect login di dalam
        // `verifySessionInBackground` (fail-closed); gagal jaringan → sesi
        // tidak disentuh (fail-open), pengguna tetap di layar login/guest.
        if (alive) setVerifying(true)
        try {
          await verifySessionInBackground()
        } finally {
          if (alive) setVerifying(false)
        }
      } catch (error) {
        // Hanya kegagalan FASE LOKAL (baca SecureStore) yang menjadi error
        // pemulihan — kegagalan jaringan fase 2 sudah ditangani fail-open
        // di dalam verifySessionInBackground.
        if (alive) {
          setError(userMessage(error))
          setRestoring(false)
          setVerifying(false)
        }
      }
    }
    void restore()
    return () => {
      alive = false
    }
  }, [attempt])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { token, restoring, verifying, error, retry }
}
