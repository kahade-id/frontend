/**
 * Kahade — store jumlah notifikasi belum dibaca (badge tab Notifikasi §9.14).
 *
 * Satu store modul-level (bukan state lokal di tab layout) karena angka ini
 * dibaca DAN diubah dari tempat berbeda: tab bar membaca, screen Notifikasi
 * (antrian #5) nanti menurunkannya saat `POST .../read` / `read-all`, push
 * notification masuk menaikkannya. Semua lewat `setUnreadCount()` /
 * `refreshUnreadCount()` supaya badge tidak menunggu poll berikutnya.
 *
 * Sumber data: `GET /v1/notifications/unread-count` via `api.notifications`.
 *
 * State eksplisit:
 *   - status "idle"    : belum pernah diminta
 *   - status "loading" : request pertama berjalan (count masih null)
 *   - status "success" : count valid (≥ 0)
 *   - status "error"   : request terakhir gagal; `count` = nilai TERAKHIR yang
 *                        diketahui (bukan direset ke 0) agar badge tidak
 *                        berkedip hilang saat jaringan goyah.
 *   - `count === null` : tidak diketahui (belum ada data / bentuk response
 *                        tak dikenal) → badge disembunyikan.
 *
 * Keputusan non-obvious:
 *   - Poll 60 detik + refresh saat app kembali `active` (AppState). Push
 *     notification adalah pemicu utama; poll hanya jaring pengaman bila push
 *     ditolak/tidak tersedia (emulator, web). Interval bukan token desain —
 *     konstanta modul.
 *   - Error UNAUTHORIZED tidak ditangani di sini: client.ts sudah memanggil
 *     `emitSessionExpired` → root layout redirect ke login. Error lain
 *     dibiarkan sunyi (badge bukan data kritis), hanya log di dev.
 *   - `useSyncExternalStore` (React 18+) agar semua pemakai melihat snapshot
 *     yang sama tanpa Context provider tambahan di root.
 */
import { useEffect, useSyncExternalStore } from "react"
import { usePolling } from "@/lib/use-polling"
import { getSessionRevision, subscribeSession } from "@/lib/api/session"

import * as notificationsApi from "@/lib/api/notifications"
import { isApiError } from "@/lib/api/errors"

export type UnreadStatus = "idle" | "loading" | "success" | "error"

export type UnreadCountState = {
  status: UnreadStatus
  /** null = tidak diketahui → badge disembunyikan */
  count: number | null
}

/** Jarak antar poll latar (ms). Push notification adalah pemicu utama; ini jaring pengaman. */
export const UNREAD_POLL_INTERVAL_MS = 60_000

let state: UnreadCountState = { status: "idle", count: null }
const listeners = new Set<() => void>()
let inFlight: Promise<void> | null = null
let generation = 0
let accountRevision = getSessionRevision()
subscribeSession(() => {
  if (accountRevision !== getSessionRevision()) {
    accountRevision = getSessionRevision()
    resetUnreadCount()
  }
})

function emit(next: UnreadCountState) {
  state = next
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return state
}

/** Set langsung (mis. setelah read-all → 0, atau push masuk → count + 1). */
export function setUnreadCount(count: number | null) {
  // A poll started before a confirmed read-all must not restore the old count.
  generation += 1
  inFlight = null
  const nextCount = count === null || !Number.isFinite(count) ? null : Math.max(0, Math.trunc(count))
  // PERF-FIX (state audit): jangan emit bila count tidak berubah — polling
  // memanggil ini berkala dan tiap emit me-render ulang semua consumer badge.
  if (state.status === "success" && state.count === nextCount) return
  emit({
    status: "success",
    count: nextCount,
  })
}

/** Ambil ulang dari server. Single-flight: panggilan paralel menunggu request yang sama. */
export function refreshUnreadCount(): Promise<void> {
  if (inFlight) return inFlight
  const started = generation
  inFlight = (async () => {
    if (state.status === "idle") emit({ status: "loading", count: null })
    try {
      // ST-001 (audit performa): import domain langsung, bukan barrel @/lib/api.
      const body = await notificationsApi.getUnreadCount()
      if (started === generation) emit({ status: "success", count: notificationsApi.readUnreadCount(body) })
    } catch (err) {
      if (started !== generation) return
      // Sesi habis sudah ditangani client.ts (redirect). Sisanya: pertahankan angka terakhir.
      if (__DEV__ && !(isApiError(err) && err.code === "UNAUTHORIZED")) {
        console.warn("[kahade/unread] gagal memuat unread-count:", err)
      }
      emit({ status: "error", count: state.count })
    } finally {
      if (started === generation) inFlight = null
    }
  })()
  return inFlight
}

/** Reset ke idle — panggil saat logout agar akun berikutnya tidak mewarisi angka. */
export function resetUnreadCount() {
  generation += 1
  inFlight = null
  emit({ status: "idle", count: null })
}

/** Baca snapshot store tanpa memicu fetch. */
export function useUnreadCountState(): UnreadCountState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * R1-007 (2026-09-29, audit render-perf): selector primitif — konsumen yang
 * hanya butuh angka (badge tab) berlangganan `count` saja, sehingga transisi
 * `status` (idle→loading→success) tanpa perubahan angka tidak memicu
 * re-render.
 */
export function useUnreadCountNumber(): number | null {
  return useSyncExternalStore(subscribe, () => state.count, () => state.count)
}

/**
 * Baca store + jalankan fetch awal, poll berkala, dan refresh saat app aktif.
 * Pasang SEKALI di layout yang hidup selama user login (tab layout), bukan
 * di tiap screen — beberapa pemasangan berarti beberapa timer.
 */
export function useUnreadCount(opts: { enabled?: boolean } = {}): UnreadCountState {
  const enabled = opts.enabled ?? true
  const snapshot = useUnreadCountState()

  useEffect(() => {
    if (!enabled) return

    void refreshUnreadCount()
  }, [enabled])

  usePolling(refreshUnreadCount, UNREAD_POLL_INTERVAL_MS, enabled, {
    // P1-5: badge non-kritis — jeda saat modal menutupi layar.
    pauseWhenCovered: true,
  })
  return snapshot
}
