/**
 * Kahade — status pemeliharaan server (item #29, kontrak Tim B).
 *
 * Kontrak backend:
 *   - GET /v1/public/maintenance (TANPA auth — dipakai splash check) →
 *     200 { enabled: boolean, message: string | null }.
 *   - Saat maintenance aktif, semua request non-admin → 503 + header
 *     `Retry-After: 300` + body { message }. Pengecualian (tetap 200):
 *     /v1/admin/*, /v1/public/maintenance, /v1/health, /.well-known/*.
 *
 * Arsitektur UI:
 *   - Modul ini memegang SATU state global (pola store modul-level +
 *     useSyncExternalStore, seperti lib/font-scale): "unknown" | "ok" |
 *     "maintenance".
 *   - `checkMaintenance()` dipanggil sekali saat start (MaintenanceGate di
 *     app/_layout.tsx) dan tiap tombol "Coba lagi".
 *   - Transport (lib/api/client.ts) memanggil `verifyMaintenanceFrom503()`
 *     setiap menerima 503: verifikasi best-effort ke endpoint publik, dan
 *     HANYA mengalihkan ke layar maintenance bila endpoint mengonfirmasi
 *     enabled=true. 503 transien (bukan maintenance) tidak mengusir pengguna
 *     dari aplikasi — error asli tetap diteruskan ke pemanggil.
 *   - Fetch langsung (bukan lewat `http`): endpoint tidak butuh auth dan
 *     tidak boleh masuk antrean/backpressure/refresh-token; sekaligus
 *     menghindari import cycle client → maintenance → client.
 *
 * Fail-open yang disengaja: kegagalan jaringan saat pengecekan (offline)
 * TIDAK dianggap maintenance — aplikasi tetap jalan dan banner offline yang
 * menangani UX-nya. Mode maintenance hanya dimasuki atas sinyal positif
 * (endpoint enabled=true), karena memasukinya memblokir seluruh aplikasi.
 */
import { useSyncExternalStore } from "react"

import { API_BASE_URL } from "@/lib/api/config"
import { ApiError } from "@/lib/api/errors"
import { logWarn } from "@/lib/telemetry"

export type MaintenanceStatus = {
  enabled: boolean
  message: string | null
}

export type MaintenancePhase = "unknown" | "ok" | "maintenance"

export type MaintenanceSnapshot = {
  phase: MaintenancePhase
  /** Pesan dari server (atau dari body 503) — tampilkan ke pengguna. */
  message: string | null
  /** true saat pengecekan awal / retry sedang berjalan. */
  checking: boolean
}

const CHECK_TIMEOUT_MS = 10_000

/**
 * GET /v1/public/maintenance — tanpa auth. Melempar bila jaringan gagal atau
 * respons bukan 200/bukan JSON valid (pemanggil memutuskan fail-open).
 */
export async function getMaintenanceStatus(signal?: AbortSignal): Promise<MaintenanceStatus> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS)
  const onAbort = () => ctrl.abort()
  signal?.addEventListener("abort", onAbort)
  try {
    const res = await fetch(`${API_BASE_URL}/v1/public/maintenance`, {
      method: "GET",
      signal: ctrl.signal,
    })
    if (!res.ok) {
      throw new Error(`maintenance check: HTTP ${res.status}`)
    }
    const body = (await res.json()) as unknown
    const rec =
      body && typeof body === "object" ? (body as Record<string, unknown>) : null
    return {
      enabled: rec?.enabled === true,
      message: typeof rec?.message === "string" && rec.message.trim() ? rec.message : null,
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", onAbort)
  }
}

/** true bila error ini adalah 503 (indikasi maintenance dari transport). */
export function isMaintenanceError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 503
}

/**
 * Pesan maintenance dari error 503 (body { message } sudah dinormalisasi ke
 * `ApiError.message` oleh parseErrorBody). null bila tidak ada pesan yang
 * layak tampil.
 */
export function maintenanceMessageFromError(err: unknown): string | null {
  if (!isMaintenanceError(err)) return null
  const msg = err.message?.trim()
  return msg ? msg : null
}

// ------------------------------------------------------------------
// Store global
// ------------------------------------------------------------------

let phase: MaintenancePhase = "unknown"
let message: string | null = null
let checking = false
let inflight: Promise<boolean> | null = null
let cachedSnapshot: MaintenanceSnapshot | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): MaintenanceSnapshot {
  // useSyncExternalStore membandingkan snapshot dengan Object.is — objek
  // BARU setiap panggilan = loop render + warning. Cache sampai ada nilai
  // yang berubah.
  if (
    !cachedSnapshot ||
    cachedSnapshot.phase !== phase ||
    cachedSnapshot.message !== message ||
    cachedSnapshot.checking !== checking
  ) {
    cachedSnapshot = { phase, message, checking }
  }
  return cachedSnapshot
}

function setState(next: MaintenancePhase, nextMessage: string | null) {
  if (phase === next && message === nextMessage) return
  phase = next
  message = nextMessage
  emit()
}

/**
 * Periksa status maintenance ke server. Mengembalikan true bila maintenance
 * AKTIF. Idempoten terhadap pemanggilan konkuren (satu request berbagi).
 *
 * Fail-open: gagal jaringan → phase tidak diubah (kecuali belum pernah
 * dicek: "unknown" → "ok" agar aplikasi tetap bisa dibuka offline).
 */
export function checkMaintenance(signal?: AbortSignal): Promise<boolean> {
  if (inflight) return inflight
  checking = true
  emit()
  inflight = (async () => {
    try {
      const status = await getMaintenanceStatus(signal)
      setState(status.enabled ? "maintenance" : "ok", status.message)
      return status.enabled
    } catch (err) {
      logWarn("maintenance: pengecekan gagal (fail-open)", { error: String(err) })
      if (phase === "unknown") setState("ok", null)
      return false
    } finally {
      checking = false
      inflight = null
      emit()
    }
  })()
  return inflight
}

/**
 * Dipanggil transport (lib/api/client.ts) setiap menerima 503. Verifikasi
 * best-effort: hanya bila endpoint mengonfirmasi maintenance aktif, aplikasi
 * dialihkan ke layar maintenance. Tidak melempar — error asli 503 tetap
 * diteruskan ke pemanggil request tersebut.
 */
export function verifyMaintenanceFrom503(): void {
  if (phase === "maintenance") return
  void checkMaintenance().catch(() => {
    // checkMaintenance sudah fail-open; ini jaring pengaman terakhir.
  })
}

/** Keluar dari mode maintenance (dipakai setelah retry sukses). */
export function clearMaintenance(): void {
  setState("ok", null)
}

/** Hook React untuk MaintenanceGate: snapshot + retry. */
export function useMaintenance(): MaintenanceSnapshot & {
  /** Periksa ulang ke server (tombol "Coba lagi"). */
  retry: () => void
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return {
    ...snapshot,
    retry: () => {
      void checkMaintenance()
    },
  }
}

/** Reset untuk test. */
export function resetMaintenanceForTest(): void {
  phase = "unknown"
  message = null
  checking = false
  inflight = null
  cachedSnapshot = null
  emit()
}

/** Phase saat ini — test-only (produksi memakai `useMaintenance()`). */
export function getMaintenancePhaseForTest(): MaintenancePhase {
  return phase
}
