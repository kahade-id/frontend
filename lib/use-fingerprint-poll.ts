/**
 * D1-010 (perf 2026-09-29): poll fingerprint ringan.
 *
 * Pola: tiap tick hanya mengambil FINGERPRINT (status/updatedAt/count —
 * murah); bundle penuh (`refresh`) HANYA bila fingerprint berubah sejak
 * tick sebelumnya. Tick pertama hanya mencatat baseline (tanpa refresh
 * palsu). Galat fingerprint = lewati tick ini (coba lagi tick berikut).
 */
import { useRef } from "react"

import { usePolling } from "@/lib/use-polling"

export function useFingerprintPoll(
  fingerprint: (signal: AbortSignal) => Promise<unknown>,
  refresh: () => Promise<unknown>,
  intervalMs: number,
  enabled: boolean,
): void {
  const lastRef = useRef<string | null>(null)
  usePolling(
    async (signal) => {
      const fp = await fingerprint(signal).catch(() => null)
      if (fp == null) return
      const key = JSON.stringify(fp)
      if (lastRef.current !== null && lastRef.current !== key) {
        await refresh().catch(() => {})
      }
      lastRef.current = key
    },
    intervalMs,
    enabled,
  )
}
