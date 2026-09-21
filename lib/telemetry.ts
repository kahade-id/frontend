/**
 * Kahade — saluran telemetri error tunggal (D-03/D-06 audit 2026-09-20).
 *
 * Sebelum modul ini ada, kegagalan fire-and-forget (register-device,
 * markChatRoomRead, refreshReceipts, …) ditelan `.catch(() => undefined)`
 * tanpa jejak — debugging produksi buta total. Sekarang SEMUA kegagalan yang
 * sengaja diredam lewat `logWarn(scope, err)` dan error fatal lewat
 * `captureError(scope, err)`.
 *
 * Keputusan non-obvious:
 *   - TANPA dependensi baru. Sentry/Crashlytics butuh keputusan vendor +
 *     DSN + native rebuild; modul ini adalah lapisan ABSTRAKSI di depannya:
 *     bila Sentry dipasang nanti, cukup daftarkan `addTelemetrySink()` di
 *     boot — 58 call-site tidak berubah.
 *   - Remote sink opsional lewat `EXPO_PUBLIC_TELEMETRY_URL` (POST JSON,
 *     fire-and-forget, tanpa cookie/auth). Default MATI: tidak ada data yang
 *     meninggalkan perangkat sampai URL diisi dan ditinjau privasinya.
 *   - Payload dibatasi field non-sensitif: scope, nama error, message yang
 *     DIPOTONG (512 char), kode ApiError, versi app, platform. `raw`/body/
 *     PII TIDAK pernah dikirim — `ApiError.raw` sengaja tidak disentuh.
 *   - Ring buffer 50 entri terakhir di memori supaya sesi debug (shake-to-
 *     open dev menu / layar dukungan) bisa membaca kegagalan terbaru tanpa
 *     penyimpanan persisten (privasi).
 *   - Global handler (unhandled rejection + JS exception) dipasang dari root
 *     layout via `installTelemetry()`; handler bawaan TIDAK ditelan (di RN,
 *     ErrorUtils handler lama tetap dipanggil agar dev red-box tetap muncul).
 */
import { Platform } from "react-native"
import { installedAppVersion } from "@/lib/runtime-info"
import { ApiError } from "@/lib/api/errors"

export type TelemetryLevel = "warn" | "error"

export type TelemetryEvent = {
  level: TelemetryLevel
  scope: string
  message: string
  /** Nama kelas error (ApiError, TypeError, …) */
  errorName?: string
  /** Kode ApiError stabil (NETWORK/UNAUTHORIZED/…) bila berasal dari transport */
  apiCode?: string
  status?: number
  path?: string
  appVersion?: string
  platform?: string
  at: number
}

/** Maksimum entri yang diingat di memori (ring buffer). */
const BUFFER_MAX = 50
/** Batas panjang message yang dikirim/disimpan — payload bukan tempat curhat. */
const MESSAGE_MAX = 512

const buffer: TelemetryEvent[] = []
type TelemetrySink = (event: TelemetryEvent) => void
const sinks = new Set<TelemetrySink>()
let installed = false

/** Baca snapshot kejadian terbaru (paling baru di akhir). Untuk layar debug/dukungan. */
export function getTelemetryBuffer(): readonly TelemetryEvent[] {
  return buffer
}

/**
 * Daftarkan sink tambahan (mis. adapter Sentry). Dipanggil saat boot;
 * mengembalikan fungsi lepas-pasang.
 */
export function addTelemetrySink(sink: TelemetrySink): () => void {
  sinks.add(sink)
  return () => {
    sinks.delete(sink)
  }
}

function buildEvent(level: TelemetryLevel, scope: string, err?: unknown): TelemetryEvent {
  const event: TelemetryEvent = {
    level,
    scope,
    message: describeError(err).slice(0, MESSAGE_MAX),
    at: Date.now(),
    appVersion: installedAppVersion() ?? undefined,
    platform: Platform.OS,
  }
  if (err instanceof Error) event.errorName = err.name
  if (err instanceof ApiError) {
    event.apiCode = err.code
    event.status = err.status
    // Path API bukan PII (tidak mengandung query param — transport membangun
    // path terpisah dari query), dan sangat mempercepat triase.
    event.path = err.path
  }
  return event
}

function describeError(err: unknown): string {
  if (err == null) return "unknown"
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message || err.name
  return "non-error thrown"
}

function dispatch(event: TelemetryEvent) {
  buffer.push(event)
  if (buffer.length > BUFFER_MAX) buffer.splice(0, buffer.length - BUFFER_MAX)
  for (const sink of sinks) {
    try {
      sink(event)
    } catch {
      /* sink rusak tidak boleh menjatuhkan pemanggil */
    }
  }
  void sendRemote(event)
}

/** Remote sink bawaan: aktif hanya bila EXPO_PUBLIC_TELEMETRY_URL diisi. */
async function sendRemote(event: TelemetryEvent): Promise<void> {
  const url = process.env.EXPO_PUBLIC_TELEMETRY_URL
  if (!url || !/^https:\/\//.test(url)) return
  try {
    // keepalive agar request sempat keluar meski tab/app ditutup (web).
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    })
  } catch {
    /* telemetri tidak boleh melahirkan telemetri baru — berhenti di sini */
  }
}

/**
 * Kegagalan yang SENGAJA diredam (fire-and-forget). Dev: console.warn supaya
 * terlihat saat pengembangan; produksi: ring buffer + sink tanpa kebisingan.
 */
export function logWarn(scope: string, err?: unknown): void {
  const event = buildEvent("warn", scope, err)
  if (__DEV__) console.warn(`[kahade/${scope}]`, err ?? event.message)
  dispatch(event)
}

/** Error fatal/tak terduga yang butuh perhatian (boundary, global handler). */
export function captureError(scope: string, err?: unknown): void {
  const event = buildEvent("error", scope, err)
  if (__DEV__) console.error(`[kahade/${scope}]`, err ?? event.message)
  dispatch(event)
}

/**
 * Pasang handler global: unhandled promise rejection + JS exception.
 * Idempoten (root layout bisa re-render/Hot Reload). Handler bawaan tetap
 * dipanggil — di RN dev, red box harus tetap muncul.
 */
export function installTelemetry(): void {
  if (installed) return
  installed = true

  const globalRef = globalThis as {
    ErrorUtils?: {
      getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | null
      setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void
    }
    addEventListener?: (
      type: "unhandledrejection",
      listener: (event: { reason?: unknown }) => void,
    ) => void
    onunhandledrejection?: ((event: { reason?: unknown }) => void) | null
  }

  // React Native: ErrorUtils global handler.
  if (typeof globalRef.ErrorUtils?.setGlobalHandler === "function") {
    const previous = globalRef.ErrorUtils.getGlobalHandler?.() ?? null
    globalRef.ErrorUtils.setGlobalHandler((error, isFatal) => {
      captureError(isFatal ? "global-fatal" : "global-error", error)
      previous?.(error, isFatal)
    })
  }

  // Web (+ RN dengan Hermes yang mendukung): unhandled rejection.
  const onRejection = (event: { reason?: unknown }) => {
    captureError("unhandled-rejection", event.reason)
  }
  if (typeof globalRef.addEventListener === "function") {
    globalRef.addEventListener("unhandledrejection", onRejection)
  } else if (Platform.OS === "web" && typeof window !== "undefined") {
    window.onunhandledrejection = (event) => onRejection({ reason: event.reason })
  }
}
