/**
 * Sinyal global: apakah ada overlay pemblokir (Modal/BottomSheet) yang terbuka.
 *
 * P1-5 (audit perf-UX 2026-10-03): `usePolling` memakai `useIsFocused()` yang
 * tetap true saat modal native menutupi layar (rute tidak berubah) — polling
 * terus menembak di balik modal. Untuk layar non-kritis ini request sia-sia.
 *
 * Mekanisme: external store sederhana (bukan context) agar bisa dipakai dari
 * `lib/` tanpa dependensi ke `components/ui/portal.tsx`. `useBlockingOverlay`
 * di portal.tsx memanggil `setBlockingOverlayCount` setiap kali overlay
 * pemblokir dibuka/ditutup.
 */

let blockingCount = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

/** Dipanggil oleh `useBlockingOverlay` (portal.tsx). */
export function setBlockingOverlayCount(n: number): void {
  const next = Math.max(0, n)
  if (next === blockingCount) return
  blockingCount = next
  emit()
}

/** true bila ada ≥1 overlay pemblokir yang terbuka. */
export function hasBlockingOverlay(): boolean {
  return blockingCount > 0
}

/** Subscribe perubahan — untuk dipakai via `useSyncExternalStore`. */
export function subscribeBlockingOverlay(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
